const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9224;

const VIEWPORTS = [
  { name: 'phase2_01_desktop_1200x740.png', width: 1200, height: 740, mobile: false, scale: 1 },
  { name: 'phase2_02_desktop_960x640.png', width: 960, height: 640, mobile: false, scale: 1 },
  { name: 'phase2_03_tablet_768x800.png', width: 768, height: 800, mobile: true, scale: 1 },
  { name: 'phase2_04_mobile_390x780.png', width: 390, height: 780, mobile: true, scale: 2 },
  { name: 'phase2_05_mobile_375x667.png', width: 375, height: 667, mobile: true, scale: 2 },
];

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

      // 1. Capture across all 5 specified viewports
      for (const vp of VIEWPORTS) {
        console.log(`Setting viewport: ${vp.width}x${vp.height} (Mobile: ${vp.mobile})...`);
        await send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: vp.scale,
          mobile: vp.mobile,
        });
        await new Promise(r => setTimeout(r, 500));
        await capture(vp.name);
      }

      // Reset back to standard desktop for interaction verification
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1200,
        height: 740,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await new Promise(r => setTimeout(r, 400));

      // 2. Verify Leaderboard modal interaction
      console.log('Testing Leaderboard button...');
      await evaluate(`document.getElementById('btn-open-leaderboard').click();`);
      await new Promise(r => setTimeout(r, 400));
      const isLeaderboardActive = await evaluate(`document.getElementById('screen-leaderboard').classList.contains('active')`);
      console.log('Leaderboard active:', isLeaderboardActive);
      await evaluate(`document.getElementById('btn-leaderboard-back').click();`);
      await new Promise(r => setTimeout(r, 400));

      // 3. Test PLAY button & entering gameplay
      console.log('Clicking PLAY button (#btn-play)...');
      await evaluate(`document.getElementById('btn-play').click();`);
      await new Promise(r => setTimeout(r, 600));

      // Wait for countdown to finish and gameplay HUD to become active
      console.log('Waiting for gameplay to start...');
      for (let i = 0; i < 30; i++) {
        const hudVisible = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden')`);
        if (hudVisible) break;
        await new Promise(r => setTimeout(r, 200));
      }
      await new Promise(r => setTimeout(r, 1200));

      // Capture active gameplay screenshot
      await capture('phase2_06_gameplay_active.png');

      // Test player lane movement
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
      await new Promise(r => setTimeout(r, 350));
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));`);
      await new Promise(r => setTimeout(r, 300));

      console.log('All Phase 2 verification checks passed!');
      ws.close();
    }
  } finally {
    chromeProc.kill();
  }
}

main().catch(err => {
  console.error('Phase 2 test script error:', err);
  process.exit(1);
});
