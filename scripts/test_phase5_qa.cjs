const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9245;

const outDir = path.resolve('test-screenshots/phase5');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function main() {
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1200,740',
    'http://localhost:5173/',
  ]);

  await new Promise(r => setTimeout(r, 2000));

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
    console.log('Target page:', page ? page.title : 'none');

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
    console.log('Connected to CDP');

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

    async function setVp(w, h, scale = 1, mobile = false) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: scale,
        mobile: mobile,
      });
      await new Promise(r => setTimeout(r, 200));
    }

    await send('Page.enable');
    await send('Runtime.enable');

    // Wait for page ready
    await evaluate(`new Promise(r => {
      if (document.readyState === 'complete') r();
      else window.addEventListener('load', () => r());
    })`);
    await new Promise(r => setTimeout(r, 1200));

    // Seed mock high scores
    await evaluate(`(() => {
      const entries = [
        { playerName: 'CYBER_GHOST', score: 48200, distance: 3120, timestamp: Date.now() - 100000 },
        { playerName: 'NEON_RACER', score: 32840, distance: 2140, timestamp: Date.now() - 80000 },
        { playerName: 'DILI_SPEED', score: 28450, distance: 1890, timestamp: Date.now() - 60000 },
        { playerName: 'VORTEX_99', score: 24100, distance: 1560, timestamp: Date.now() - 40000 },
        { playerName: 'BATMAN', score: 19800, distance: 1240, timestamp: Date.now() - 20000 }
      ];
      localStorage.setItem('dili-neon-run-leaderboard', JSON.stringify(entries));
    })()`);

    // -------------------------------------------------------------------------
    // 1. START SCREEN CAPTURES
    // -------------------------------------------------------------------------
    console.log('--- 1. START SCREEN ---');
    await setVp(1200, 740, 1, false);
    await capture('01_start_1200x740.png');

    await setVp(390, 780, 2, true);
    await capture('02_start_390x780.png');

    await setVp(375, 667, 2, true);
    await capture('03_start_375x667.png');

    await setVp(780, 390, 2, true);
    await capture('04_start_landscape_780x390.png');

    // -------------------------------------------------------------------------
    // 2. LEADERBOARD CAPTURES (from Start)
    // -------------------------------------------------------------------------
    console.log('--- 2. LEADERBOARD ---');
    await evaluate(`document.getElementById('btn-open-leaderboard').click()`);
    await new Promise(r => setTimeout(r, 400));

    await setVp(1200, 740, 1, false);
    await capture('05_leaderboard_1200x740.png');

    await setVp(390, 780, 2, true);
    await capture('06_leaderboard_390x780.png');

    await setVp(375, 667, 2, true);
    await capture('07_leaderboard_375x667.png');

    await setVp(780, 390, 2, true);
    await capture('08_leaderboard_landscape_780x390.png');

    // Close Leaderboard back to Start
    await evaluate(`document.getElementById('btn-leaderboard-back').click()`);
    await new Promise(r => setTimeout(r, 300));

    // -------------------------------------------------------------------------
    // 3. START GAMEPLAY & COUNTDOWN
    // -------------------------------------------------------------------------
    console.log('--- 3. GAMEPLAY START & COUNTDOWN ---');
    await setVp(1200, 740, 1, false);
    await evaluate(`document.getElementById('btn-play').click()`);
    await new Promise(r => setTimeout(r, 600));
    await capture('09_countdown_1200x740.png');

    // Wait for countdown to finish (3s) and gameplay to run
    console.log('Waiting for countdown to finish...');
    await new Promise(r => setTimeout(r, 3500));

    // -------------------------------------------------------------------------
    // 4. GAMEPLAY HUD CAPTURES
    // -------------------------------------------------------------------------
    console.log('--- 4. GAMEPLAY HUD ---');
    await setVp(1200, 740, 1, false);
    await capture('10_gameplay_1200x740.png');

    await setVp(390, 780, 2, true);
    await capture('11_gameplay_390x780.png');

    await setVp(375, 667, 2, true);
    await capture('12_gameplay_375x667.png');

    await setVp(780, 390, 2, true);
    await capture('13_gameplay_landscape_780x390.png');

    // -------------------------------------------------------------------------
    // 5. PAUSE MODAL (During active run)
    // -------------------------------------------------------------------------
    console.log('--- 5. PAUSE MODAL ---');
    await evaluate(`document.getElementById('btn-pause').click()`);
    await new Promise(r => setTimeout(r, 400));

    await setVp(1200, 740, 1, false);
    await capture('16_pause_1200x740.png');

    await setVp(390, 780, 2, true);
    await capture('17_pause_390x780.png');

    await setVp(375, 667, 2, true);
    await capture('18_pause_375x667.png');

    await setVp(780, 390, 2, true);
    await capture('19_pause_landscape_780x390.png');

    // Resume gameplay
    console.log('Resuming gameplay...');
    await evaluate(`document.getElementById('btn-resume').click()`);
    await new Promise(r => setTimeout(r, 400));

    // -------------------------------------------------------------------------
    // 6. ACTIVE POWER-UP & HYPER DASH
    // -------------------------------------------------------------------------
    console.log('--- 6. POWER-UP & DASH ---');
    await setVp(1200, 740, 1, false);
    await evaluate(`window.__diliGame.powerUpSystem.activate('SHIELD')`);
    await new Promise(r => setTimeout(r, 300));
    await capture('14_gameplay_powerup_active_1200x740.png');

    await evaluate(`window.__diliGame.dili.dash()`);
    await new Promise(r => setTimeout(r, 80));
    await capture('15_gameplay_dash_active_1200x740.png');

    // -------------------------------------------------------------------------
    // 7. GAME OVER MODAL (DEBRIEF + CALLSIGN ENTRY)
    // -------------------------------------------------------------------------
    console.log('--- 7. GAME OVER MODAL ---');
    await evaluate(`(() => {
      const hud = window.__diliGame.hud;
      const lb = window.__diliGame.leaderboardUI;
      hud.hideHUD();
      hud.populateGameOver(35420, 72, 2380, 16, 4.5, 48200, true);
      lb.checkAndPromptHighScore(35420, 2380);
      document.querySelectorAll('.game-screen').forEach(s => s.classList.remove('active'));
      document.getElementById('screen-gameover').classList.add('active');
    })()`);
    await new Promise(r => setTimeout(r, 400));

    await setVp(1200, 740, 1, false);
    await capture('20_gameover_1200x740.png');

    await setVp(390, 780, 2, true);
    await capture('21_gameover_390x780.png');

    await setVp(375, 667, 2, true);
    await capture('22_gameover_375x667.png');

    await setVp(780, 390, 2, true);
    await capture('23_gameover_landscape_780x390.png');

    console.log('All QA captures completed successfully!');
    ws.close();
  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

main();
