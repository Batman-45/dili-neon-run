const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9285;

async function runSlideUnderBarrierTest() {
  const outDir = path.resolve('test-screenshots/slide_barrier_test');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const userDataDir = path.resolve('scratch/chrome_barrier_profile');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  console.log('Launching Chrome to test sliding under LOW_BARRIER...');
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
    console.log('Connected to tab:', page.title);

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
      console.log(`[SAVED] ${filename}`);
      return filePath;
    }

    // Wait for load & start
    await new Promise(r => setTimeout(r, 1200));
    await evaluate(`document.getElementById('btn-play').click();`);

    // Wait for countdown
    for (let i = 0; i < 40; i++) {
      const active = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden') && !document.getElementById('countdown-overlay').classList.contains('active')`);
      if (active) break;
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 600));

    // Spawn a LOW_BARRIER directly ahead in center lane (lane 0) at z = -28
    console.log('Spawning LOW_BARRIER overhead gantry ahead...');
    await evaluate(`
      if (window.__obstacleManager) {
        window.__obstacleManager.spawnSingleObstacle('LOW_BARRIER', 0, -28);
      }
      true;
    `);

    // Run toward obstacle
    await new Promise(r => setTimeout(r, 450));
    await capture('barrier_approaching.png');

    // Trigger slide right as obstacle reaches Z = -6
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown' }));`);
    await new Promise(r => setTimeout(r, 140));
    await capture('sliding_under_barrier.png');

    await new Promise(r => setTimeout(r, 150));
    await capture('sliding_clearing_barrier.png');

    await new Promise(r => setTimeout(r, 350));
    await capture('barrier_cleared_running.png');

    ws.close();
    console.log('*** BARRIER SLIDE TEST COMPLETED ***');
  } finally {
    chromeProc.kill();
  }
}

runSlideUnderBarrierTest().catch(err => {
  console.error(err);
  process.exit(1);
});
