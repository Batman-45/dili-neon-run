const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9226;

const VIEWPORTS = [
  { name: 'phase3_01_desktop_1200x740.png', width: 1200, height: 740, mobile: false, scale: 1 },
  { name: 'phase3_02_desktop_960x640.png', width: 960, height: 640, mobile: false, scale: 1 },
  { name: 'phase3_03_tablet_768x800.png', width: 768, height: 800, mobile: true, scale: 1 },
  { name: 'phase3_04_mobile_390x780.png', width: 390, height: 780, mobile: true, scale: 2 },
  { name: 'phase3_05_mobile_375x667.png', width: 375, height: 667, mobile: true, scale: 2 },
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

      async function dispatchKey(code, key) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key });
        await new Promise(r => setTimeout(r, 60));
        await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key });
      }

      await send('Page.enable');
      await send('Runtime.enable');

      // Wait for page ready
      await evaluate(`new Promise(r => {
        if (document.readyState === 'complete') r();
        else window.addEventListener('load', () => r());
      })`);
      await new Promise(r => setTimeout(r, 1200));

      // Click START RUN
      console.log('Starting gameplay...');
      await evaluate(`document.getElementById('btn-play').click()`);

      // Wait for countdown overlay (3 seconds) to complete and enter active PLAYING
      console.log('Waiting for countdown to finish...');
      await new Promise(r => setTimeout(r, 3800));

      // Perform gameplay input actions (lane switch, jump, slide)
      console.log('Dispatching control inputs: Jump (ArrowUp)...');
      await dispatchKey('ArrowUp', 'ArrowUp');
      await new Promise(r => setTimeout(r, 400));

      console.log('Dispatching control inputs: Lane Right (ArrowRight)...');
      await dispatchKey('ArrowRight', 'ArrowRight');
      await new Promise(r => setTimeout(r, 400));

      console.log('Dispatching control inputs: Slide (ArrowDown)...');
      await dispatchKey('ArrowDown', 'ArrowDown');
      await new Promise(r => setTimeout(r, 400));

      // 1. Capture across all 5 specified viewports during active gameplay
      for (const vp of VIEWPORTS) {
        console.log(`Setting viewport: ${vp.width}x${vp.height} (Mobile: ${vp.mobile})...`);
        await send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: vp.scale,
          mobile: vp.mobile,
        });
        await new Promise(r => setTimeout(r, 300));
        await capture(vp.name);
      }

      // 2. Set viewport to 1200x740 for state tests
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1200,
        height: 740,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await new Promise(r => setTimeout(r, 200));

      // 3. Test Power-Up state: Activate Shield in real game loop
      console.log('Activating Power-Up in real game loop (SHIELD)...');
      await evaluate(`window.__diliGame.powerUpSystem.activate('SHIELD')`);
      await new Promise(r => setTimeout(r, 300));
      await capture('phase3_06_gameplay_powerup_active.png');

      // 4. Test Hyper Dash state: Trigger real Dash
      console.log('Triggering real Hyper Dash in game loop...');
      await evaluate(`window.__diliGame.dili.dash()`);
      await new Promise(r => setTimeout(r, 80));
      await capture('phase3_07_gameplay_dash_active.png');

      // 5. Test Pause functionality
      console.log('Testing pause button click...');
      await evaluate(`document.getElementById('btn-pause').click()`);
      await new Promise(r => setTimeout(r, 400));
      await capture('phase3_08_gameplay_paused.png');

      // Check pause status and metric values
      const telemetryStats = await evaluate(`(() => {
        return {
          score: document.getElementById('hud-score')?.textContent,
          distance: document.getElementById('hud-distance')?.textContent,
          bits: document.getElementById('hud-bits')?.textContent,
          combo: document.getElementById('hud-combo')?.textContent,
          pauseVisible: !document.getElementById('screen-pause')?.classList.contains('hidden'),
        };
      })()`);
      console.log('Telemetry verification:', telemetryStats);

      ws.close();
    }
  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    chromeProc.kill('SIGKILL');
    console.log('Verification completed.');
  }
}

main();
