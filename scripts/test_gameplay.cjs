const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9222;

async function main() {
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1280,720',
    'http://localhost:5173/',
  ]);

  // Wait for debug endpoint
  await new Promise(r => setTimeout(r, 2000));

  function getVersion() {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/json/version`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
  }

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
    console.log('WS URL:', page?.webSocketDebuggerUrl);

    if (page && page.webSocketDebuggerUrl) {
      // Connect to WS using Node built-in or WebSocket
      // Node 22 has global WebSocket!
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
      console.log('WebSocket connected to Chrome DevTools Protocol!');

      // Helper to evaluate JS in the page
      async function evaluate(expr) {
        const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
        return res.result?.value;
      }

      // Helper to save screenshot
      async function capture(filename) {
        const res = await send('Page.captureScreenshot', { format: 'png' });
        const filePath = path.resolve('test-screenshots', filename);
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
      await new Promise(r => setTimeout(r, 1000));

      // Click START RUN
      console.log('Clicking #btn-play...');
      await evaluate(`document.getElementById('btn-play').click();`);

      // Wait for countdown (3 -> 2 -> 1 -> GO! takes ~3.2s)
      console.log('Waiting for countdown to finish...');
      for (let i = 0; i < 30; i++) {
        const hudVisible = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden')`);
        if (hudVisible) {
          console.log('HUD is active! Gameplay has started.');
          break;
        }
        await new Promise(r => setTimeout(r, 200));
      }
      await new Promise(r => setTimeout(r, 800)); // Let run settle

      // 1. Capture Center Lane running
      await capture('gameplay_center_lane.png');

      // 2. Switch Left (press ArrowLeft / KeyA)
      console.log('Switching to LEFT lane...');
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
      await new Promise(r => setTimeout(r, 400));
      await capture('gameplay_left_lane.png');

      // 3. Switch to Right lane (press ArrowRight twice)
      console.log('Switching to RIGHT lane...');
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
      await new Promise(r => setTimeout(r, 250));
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
      await new Promise(r => setTimeout(r, 400));
      await capture('gameplay_right_lane.png');

      // 4. Return to Center lane
      console.log('Returning to CENTER lane...');
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
      await new Promise(r => setTimeout(r, 300));

      // 5. Jump
      console.log('Jumping (Space)...');
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));`);
      await new Promise(r => setTimeout(r, 220));
      await capture('gameplay_jump.png');

      // 6. Slide
      await new Promise(r => setTimeout(r, 600)); // wait to land
      console.log('Sliding (ArrowDown)...');
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown' }));`);
      await new Promise(r => setTimeout(r, 200));
      await capture('gameplay_slide.png');

      // 7. Dash
      await new Promise(r => setTimeout(r, 600));
      console.log('Dashing (ShiftLeft)...');
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }));`);
      await new Promise(r => setTimeout(r, 150));
      await capture('gameplay_dash.png');

      // 8. Pause Screen
      console.log('Pausing (KeyP)...');
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p' }));`);
      await new Promise(r => setTimeout(r, 300));
      await capture('gameplay_pause_modal.png');

      // 9. Mobile portrait gameplay capture (resize viewport to 390x844)
      console.log('Resizing to mobile portrait 390x844...');
      await send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true,
      });
      // Resume game
      await evaluate(`document.getElementById('btn-resume').click();`);
      await new Promise(r => setTimeout(r, 500));
      await capture('gameplay_mobile_portrait_center.png');

      // Mobile lane switch left
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
      await new Promise(r => setTimeout(r, 300));
      await capture('gameplay_mobile_portrait_left.png');

      // Mobile lane switch right
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
      await new Promise(r => setTimeout(r, 200));
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
      await new Promise(r => setTimeout(r, 300));
      await capture('gameplay_mobile_portrait_right.png');

      ws.close();
      console.log('All gameplay tests completed successfully!');
    }
  } finally {
    chromeProc.kill();
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
