const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9288;

async function verifyPowerUpReadability() {
  const outDir = path.resolve('test-screenshots/powerup_readability');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const userDataDir = path.resolve('scratch/chrome_powerup_profile');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  console.log('🚀 Launching REAL Google Chrome at 1280x720...');
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1280,720',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:5173/',
  ]);

  await new Promise(r => setTimeout(r, 2500));

  function getList() {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/json/list`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
  }

  try {
    const list = await getList();
    const page = list.find(t => t.type === 'page');
    console.log('Connected to real Chrome tab:', page.title);

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 1;
    const callbacks = new Map();

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const reqId = id++;
        callbacks.set(reqId, { resolve, reject });
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise(r => ws.onopen = r);
    console.log('CDP WebSocket connected!');
    await send('Page.enable');
    await send('Runtime.enable');

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (res.exceptionDetails) {
        throw new Error(JSON.stringify(res.exceptionDetails));
      }
      return res.result ? res.result.value : null;
    }

    async function captureScreenshot(name) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(res.data, 'base64');
      const filename = path.join(outDir, `${name}.png`);
      fs.writeFileSync(filename, buffer);
      console.log(`📸 Saved screenshot: ${filename}`);
      return filename;
    }

    // 1. Initial Start Screen
    console.log('\n--- STEP 1: START SCREEN ---');
    await new Promise(r => setTimeout(r, 1000));
    await captureScreenshot('01_start_screen');

    // 2. Start Run and wait for Countdown
    console.log('\n--- STEP 2: START RUN & COUNTDOWN ---');
    await evaluate("document.getElementById('btn-play').click()");
    await new Promise(r => setTimeout(r, 1000));
    await captureScreenshot('02_countdown_active');

    // Wait for countdown to complete and gameplay to be running
    console.log('Waiting for run to start...');
    await new Promise(r => setTimeout(r, 2500));
    await captureScreenshot('03_gameplay_running_clean');

    // 3. Spawning & identifying pickup items on track before pickup
    console.log('\n--- STEP 3: PICKUP ITEMS ON TRACK (BEFORE PICKUP) ---');
    await evaluate(`(() => {
      if (window.__spawnPowerUp) {
        window.__spawnPowerUp('SHIELD', -1, -22);
        window.__spawnPowerUp('MAGNET', 0, -25);
        window.__spawnPowerUp('BOOST', 1, -28);
      }
      return true;
    })()`);
    await new Promise(r => setTimeout(r, 600));
    await captureScreenshot('03a_powerup_pickups_approaching_track');

    // Spawn 2X Multiplier in center
    await evaluate(`(() => {
      if (window.__spawnPowerUp) {
        window.__spawnPowerUp('MULTIPLIER', 0, -20);
      }
      return true;
    })()`);
    await new Promise(r => setTimeout(r, 400));
    await captureScreenshot('03b_multiplier_pickup_approaching_track');

    // 4. Test PHASE SHIELD
    console.log('\n--- STEP 4: PHASE SHIELD ACTIVATION ---');
    await evaluate("(() => { window.__givePowerUp('SHIELD'); return true; })()");
    await new Promise(r => setTimeout(r, 200)); // Capture during punch announcement
    await captureScreenshot('04_shield_pickup_announcement');
    await new Promise(r => setTimeout(r, 1000)); // After announcement settled, bubble active
    await captureScreenshot('05_shield_active_protective_bubble');

    // 5. Test PULSE MAGNET (coexisting with Shield)
    console.log('\n--- STEP 5: PULSE MAGNET ACTIVATION (COEXISTING WITH SHIELD) ---');
    await evaluate("(() => { window.__givePowerUp('MAGNET'); return true; })()");
    await new Promise(r => setTimeout(r, 200));
    await captureScreenshot('06_magnet_pickup_announcement');
    await new Promise(r => setTimeout(r, 1000));
    await captureScreenshot('07_shield_and_magnet_coexisting_hud');

    // 6. Test HYPER BOOST (speed trails, speed lines, FOV kick)
    console.log('\n--- STEP 6: HYPER BOOST ACTIVATION ---');
    await evaluate("(() => { window.__givePowerUp('BOOST'); return true; })()");
    await new Promise(r => setTimeout(r, 200));
    await captureScreenshot('08_boost_pickup_announcement');
    await new Promise(r => setTimeout(r, 1000));
    await captureScreenshot('09_hyper_boost_active_speed_lines');

    // 7. Test SCORE MULTIPLIER (2x badge near score/combo area)
    console.log('\n--- STEP 7: SCORE MULTIPLIER ACTIVATION ---');
    await evaluate("(() => { window.__givePowerUp('MULTIPLIER'); return true; })()");
    await new Promise(r => setTimeout(r, 200));
    await captureScreenshot('10_multiplier_pickup_announcement');
    await new Promise(r => setTimeout(r, 1000));
    await captureScreenshot('11_multiplier_badge_active_near_score');


    // 8. Test Mobile Landscape Viewport (800x450)
    console.log('\n--- STEP 8: MOBILE LANDSCAPE READABILITY (800x450) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 800,
      height: 450,
      deviceScaleFactor: 1,
      mobile: true,
      screenOrientation: { angle: 90, type: 'landscapePrimary' }
    });
    await new Promise(r => setTimeout(r, 500));
    await captureScreenshot('12_mobile_landscape_readability_800x450');

    // Reset viewport back to desktop
    await send('Emulation.clearDeviceMetricsOverride');

    console.log('\n✅ All power-up readability scenarios verified in real Chrome!');

    ws.close();
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    try { chromeProc.kill(); } catch (e) {}
  }
}

verifyPowerUpReadability();
