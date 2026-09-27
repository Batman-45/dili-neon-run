const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9312;

async function runResponsiveQA() {
  const outDir = path.resolve('test-screenshots/rear_head_qa');

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1366,768',
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
      console.log(`[CAPTURED] ${filename}`);
    }

    // 1. Desktop 1366x768
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false
    });
    await evaluate(`document.getElementById('btn-play').click();`);
    await new Promise(r => setTimeout(r, 2500));
    await capture('09_gameplay_1366x768_rear.png');

    // 2. Mobile 390x844
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 1200));
    await capture('10_gameplay_mobile_390x844_rear.png');

    ws.close();
  } finally {
    chromeProc.kill();
  }
}

runResponsiveQA().catch(console.error);
