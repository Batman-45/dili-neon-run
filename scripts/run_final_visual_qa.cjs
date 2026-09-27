const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9235;

async function runFinalQA() {
  const outDir = path.resolve('test-screenshots/final_qa');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1920,1080',
    'http://localhost:5173/',
  ]);

  await new Promise(r => setTimeout(r, 2200));

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
    console.log('Target page found:', page.title);

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

    await new Promise(resolve => ws.onopen = resolve);
    await send('Page.enable');
    await send('Runtime.enable');

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      return res.result?.value;
    }

    async function capture(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(outDir, filename);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`[CAPTURED] ${filename} (${fs.statSync(filePath).size} bytes)`);
    }

    // Set 1920x1080 desktop viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    await new Promise(r => setTimeout(r, 1000));

    // 1. START SCREEN
    console.log('--- 1. CAPTURING START SCREEN (1920x1080) ---');
    await capture('01_start_screen_1920.png');

    // 2. START GAME RUN
    console.log('--- 2. STARTING GAME ---');
    await evaluate(`document.getElementById('btn-play').click();`);

    // Wait for countdown to finish & HUD active
    for (let i = 0; i < 40; i++) {
      const hudActive = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden')`);
      if (hudActive) {
        console.log('Gameplay started! HUD active.');
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // 3. 15-SECOND CONTINUOUS RUNNING OBSERVATION
    console.log('--- 3. CONTINUOUS RUNNING OBSERVATION (15 SECONDS) ---');
    // Enable invulnerability during continuous stride observation so obstacles do not interrupt
    await evaluate(`window.__dili.isInvulnerable = true;`);

    // Capture initial running state
    await new Promise(r => setTimeout(r, 500));
    await capture('02_running_t0.png');

    // Stride burst capture: capture 8 frames ~65ms apart across one full stride cycle
    console.log('Capturing stride burst sequence (8 frames across a full run cycle)...');
    for (let f = 0; f < 8; f++) {
      await capture(`03_stride_burst_frame_${f}.png`);
      await new Promise(r => setTimeout(r, 65));
    }

    // Capture checkpoints across 15 seconds of continuous running
    console.log('Capturing continuous running progression over 15 seconds...');
    await new Promise(r => setTimeout(r, 2000));
    await capture('04_running_2s.png');

    await new Promise(r => setTimeout(r, 3000));
    await capture('05_running_5s.png');

    await new Promise(r => setTimeout(r, 4000));
    await capture('06_running_9s.png');

    await new Promise(r => setTimeout(r, 4000));
    await capture('07_running_13s.png');

    await new Promise(r => setTimeout(r, 2000));
    await capture('08_running_15s.png');

    // Keep invulnerability active through all action tests so obstacles do not interrupt
    // (Jump, Slide, Dash, Shield)
    await evaluate(`window.__dili.isInvulnerable = true;`);

    // 4. GAMEPLAY STATES
    console.log('--- 4. TESTING GAMEPLAY STATES ---');

    // A. Left lane switch
    console.log('Left lane switch...');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
    await new Promise(r => setTimeout(r, 120));
    await capture('09_action_lane_switch_left.png');
    await new Promise(r => setTimeout(r, 250));

    // B. Right lane switch
    console.log('Right lane switch...');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
    await new Promise(r => setTimeout(r, 100));
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
    await new Promise(r => setTimeout(r, 120));
    await capture('10_action_lane_switch_right.png');
    await new Promise(r => setTimeout(r, 250));

    // Back to Center
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
    await new Promise(r => setTimeout(r, 250));

    // C. Jump
    console.log('Jump action...');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));`);
    await new Promise(r => setTimeout(r, 260));
    await capture('11_action_jump.png');
    await new Promise(r => setTimeout(r, 600)); // Land

    // D. Slide
    console.log('Slide action...');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown' }));`);
    await new Promise(r => setTimeout(r, 220));
    await capture('12_action_slide.png');
    await new Promise(r => setTimeout(r, 650)); // Slide end

    // E. Hyper Dash
    console.log('Hyper Dash action...');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }));`);
    await new Promise(r => setTimeout(r, 200));
    await capture('13_action_hyper_dash.png');
    await new Promise(r => setTimeout(r, 700));

    // F. Phase Shield activation test (Verify Dili is 100% visible inside shield)
    console.log('Phase Shield activation...');
    await evaluate(`window.__dili.setShieldVisible(true);`);
    await new Promise(r => setTimeout(r, 300));
    await capture('14_phase_shield_dili_visible.png');
    await evaluate(`window.__dili.setShieldVisible(false);`);
    await new Promise(r => setTimeout(r, 200));

    // 5. COLLISION & GAME OVER
    console.log('--- 5. COLLISION & GAME OVER SCREEN ---');
    await evaluate(`window.__dili.isInvulnerable = false;`);
    await evaluate(`window.__testCrash();`);
    for (let i = 0; i < 30; i++) {
      const gameOverShown = await evaluate(`document.getElementById('screen-gameover').classList.contains('active')`);
      if (gameOverShown) {
        console.log('Game Over screen is active!');
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 700));
    await capture('15_game_over_screen.png');

    // 6. RETURN TO HOME
    console.log('--- 6. RETURN TO HOME / TITLE ---');
    await evaluate(`document.getElementById('btn-gameover-title').click();`);
    for (let i = 0; i < 30; i++) {
      const startActive = await evaluate(`document.getElementById('screen-start').classList.contains('active')`);
      if (startActive) {
        console.log('Returned to Start screen!');
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 600));
    await capture('16_return_to_home.png');

    // 7. RESPONSIVE VIEWPORT 1366x768
    console.log('--- 7. VIEWPORT 1366x768 ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 500));
    await capture('17_start_screen_1366x768.png');

    // Start run on 1366
    await evaluate(`document.getElementById('btn-play').click();`);
    for (let i = 0; i < 40; i++) {
      const hudActive = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden')`);
      if (hudActive) break;
      await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 800));
    await capture('18_gameplay_1366x768.png');

    // 8. RESPONSIVE VIEWPORT 390x844 (Mobile Portrait)
    console.log('--- 8. VIEWPORT 390x844 (MOBILE PORTRAIT) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 500));
    await capture('19_gameplay_mobile_390x844.png');

    // Trigger pause on mobile
    await evaluate(`document.getElementById('btn-pause').click();`);
    await new Promise(r => setTimeout(r, 500));
    await capture('20_pause_mobile_390x844.png');

    // Return to Title on mobile
    await evaluate(`document.getElementById('btn-title').click();`);
    await new Promise(r => setTimeout(r, 500));
    await capture('21_start_screen_mobile_390x844.png');

    // Clear emulation
    await send('Emulation.clearDeviceMetricsOverride');

    ws.close();
    console.log('====================================================');
    console.log('FINAL REAL VISUAL QA CAPTURE COMPLETED SUCCESSFULLY');
    console.log('====================================================');
  } finally {
    chromeProc.kill();
  }
}

runFinalQA().catch(err => {
  console.error('Final QA error:', err);
  process.exit(1);
});
