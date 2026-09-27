const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9335;

async function main() {
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1600,1000',
    'http://localhost:5173/test_workbench.html',
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

  const list = await getList();
  const page = list.find(t => t.type === 'page' && t.url.includes('test_workbench'));
  if (!page) throw new Error('No page found');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
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

  await send('Page.enable');
  await send('Runtime.enable');

  // Wait 1.5s for frames to load and process in the workbench
  await new Promise(r => setTimeout(r, 2000));

  // Trigger export
  const evalRes = await send('Runtime.evaluate', {
    expression: `(async () => {
      document.getElementById('exportBtn').click();
      return window.latestExportDataUrl;
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  const dataUrl = evalRes.result?.value;
  if (!dataUrl) {
    throw new Error('Export dataUrl was empty: ' + JSON.stringify(evalRes));
  }

  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  const outPath = path.join(__dirname, '..', 'public', 'assets', 'dili_runner_sheet.png');
  fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
  console.log('Saved updated spritesheet to:', outPath);

  // Also take screenshot of workbench
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const ssPath = path.join(__dirname, '..', 'test-screenshots', 'workbench_preview.png');
  fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
  console.log('Saved workbench screenshot to:', ssPath);

  ws.close();
  chromeProc.kill();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
