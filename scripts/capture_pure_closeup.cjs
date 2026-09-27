const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9266;

async function capturePureCloseup() {
  const outDir = path.resolve('test-screenshots/mascot_qa');
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

    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    await new Promise(r => setTimeout(r, 800));
    await send('Runtime.evaluate', { expression: `document.getElementById('btn-play').click();` });

    // Wait until countdown is gone and HUD is active
    for (let i = 0; i < 50; i++) {
      const res = await send('Runtime.evaluate', {
        expression: `!document.getElementById('hud-overlay').classList.contains('hud-hidden') && !document.getElementById('countdown-overlay').classList.contains('active')`,
        returnByValue: true
      });
      if (res.result?.value) {
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 600));

    // Position camera for heroic rear close-up
    await send('Runtime.evaluate', {
      expression: `
        window.__dili.isInvulnerable = true;
        window.__dili.setShieldVisible(false);
        window.__engine.camera.position.set(0, 2.2, 4.4);
        window.__engine.camera.lookAt(0, 1.25, 0);
      `
    });

    await new Promise(r => setTimeout(r, 300));

    const res = await send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(outDir, '14_pure_running_closeup.png');
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`[CAPTURED] 14_pure_running_closeup.png (${fs.statSync(filePath).size} bytes)`);

    ws.close();
    chromeProc.kill();
  } catch (err) {
    console.error(err);
    chromeProc.kill();
  }
}

capturePureCloseup();
