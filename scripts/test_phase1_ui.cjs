const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9223;

async function main() {
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1280,720',
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
    console.log('Found page target:', page ? page.title : 'none');

    if (page && page.webSocketDebuggerUrl) {
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
      console.log('Connected to CDP WebSocket');

      async function evaluate(expr) {
        const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
        return res.result?.value;
      }

      async function capture(filename) {
        const res = await send('Page.captureScreenshot', { format: 'png' });
        const outDir = path.resolve('test-screenshots');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const filePath = path.join(outDir, filename);
        fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
        console.log(`Saved screenshot: ${filename} (${fs.statSync(filePath).size} bytes)`);
      }

      await send('Page.enable');
      await send('Runtime.enable');

      // Wait for page ready
      await evaluate(`new Promise(r => {
        if (document.readyState === 'complete') r();
        else window.addEventListener('load', () => r());
      })`);
      await new Promise(r => setTimeout(r, 1200));

      // 1. Capture Start Screen
      console.log('1. Capturing Start Screen...');
      await capture('phase1_01_start_screen.png');

      // 2. Open Leaderboard
      console.log('2. Opening Leaderboard modal...');
      await evaluate(`document.getElementById('btn-open-leaderboard').click();`);
      await new Promise(r => setTimeout(r, 500));
      await capture('phase1_02_leaderboard_modal.png');

      // 3. Close Leaderboard
      console.log('3. Closing Leaderboard modal...');
      await evaluate(`document.getElementById('btn-leaderboard-back').click();`);
      await new Promise(r => setTimeout(r, 500));

      // 4. Click Start Run
      console.log('4. Clicking Start Run (#btn-play)...');
      await evaluate(`document.getElementById('btn-play').click();`);
      await new Promise(r => setTimeout(r, 600));
      await capture('phase1_03_countdown.png');

      // 5. Wait for countdown to finish and HUD to appear
      console.log('5. Waiting for gameplay HUD...');
      for (let i = 0; i < 30; i++) {
        const hudVisible = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden')`);
        if (hudVisible) break;
        await new Promise(r => setTimeout(r, 200));
      }
      await new Promise(r => setTimeout(r, 1200)); // allow some score/distance to accumulate
      await capture('phase1_04_gameplay_hud.png');

      // 6. Test movement (lane switch, jump, slide)
      console.log('6. Testing movement controls...');
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
      await new Promise(r => setTimeout(r, 350));
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));`);
      await new Promise(r => setTimeout(r, 250));
      await capture('phase1_05_gameplay_action.png');

      // 7. Pause game
      console.log('7. Pausing game...');
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p' }));`);
      await new Promise(r => setTimeout(r, 400));
      await capture('phase1_06_pause_modal.png');

      // 8. Resume game
      console.log('8. Resuming game...');
      await evaluate(`document.getElementById('btn-resume').click();`);
      await new Promise(r => setTimeout(r, 500));

      // 9. Trigger Game Over by calling gameOver directly on GameStateManager
      console.log('9. Triggering Game Over for debrief screen inspection...');
      await evaluate(`
        if (window.__gameInstance && window.__gameInstance.stateManager) {
          window.__gameInstance.stateManager.transitionTo('GAMEOVER');
        } else {
          // If no global instance exposed, simulate crash via window event or dispatch
          const ev = new CustomEvent('gameover');
          window.dispatchEvent(ev);
        }
      `);
      // Check if gameover screen is active; if not, wait or simulate collision
      await new Promise(r => setTimeout(r, 600));
      const isGameOverActive = await evaluate(`document.getElementById('screen-gameover').classList.contains('active')`);
      console.log('Is GameOver screen active?', isGameOverActive);

      if (!isGameOverActive) {
        // Trigger via game loop or waiting for collision or force class for visual audit
        await evaluate(`
          document.getElementById('screen-gameover').classList.add('active');
          document.getElementById('res-score').textContent = '24,980';
          document.getElementById('res-distance').textContent = '1,482 m';
          document.getElementById('res-bits').textContent = '42';
          document.getElementById('res-near-misses').textContent = '7';
          document.getElementById('res-max-combo').textContent = '3.5x';
          document.getElementById('res-best').textContent = '18,450';
          const entry = document.getElementById('gameover-leaderboard-entry');
          if (entry) entry.classList.remove('hidden');
        `);
      }
      await new Promise(r => setTimeout(r, 400));
      await capture('phase1_07_gameover_modal.png');

      ws.close();
      console.log('Visual audit capture complete!');
    }
  } finally {
    chromeProc.kill();
  }
}

main().catch(err => {
  console.error('Audit script error:', err);
  process.exit(1);
});
