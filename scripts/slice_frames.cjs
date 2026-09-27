const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9225;

async function sliceFrames() {
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1000,1000',
    'about:blank',
  ]);

  await new Promise(r => setTimeout(r, 1500));

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

    const sheetPath = path.resolve('public/assets/dili_runner_sheet.png');
    const sheetData = fs.readFileSync(sheetPath).toString('base64');

    // Create slice page in browser
    await send('Runtime.evaluate', {
      expression: `
        const img = new Image();
        img.src = 'data:image/png;base64,${sheetData}';
        window.sliceReady = new Promise(r => {
          img.onload = () => {
            window.sheetImg = img;
            r();
          };
        });
      `,
    });

    await send('Runtime.evaluate', {
      expression: `window.sliceReady`,
      awaitPromise: true,
    });

    for (let f = 0; f < 8; f++) {
      const frameDataUrl = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const canvas = document.createElement('canvas');
            canvas.width = 384;
            canvas.height = 384;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(window.sheetImg, ${f * 384}, 0, 384, 384, 0, 0, 384, 384);
            return canvas.toDataURL('image/png');
          })()
        `,
        returnByValue: true,
      });

      const base64 = frameDataUrl.result.value.replace(/^data:image\/png;base64,/, '');
      const outPath = path.resolve('test-screenshots', `frame_${f}.png`);
      fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
      console.log(`Saved frame_${f}.png`);
    }

    ws.close();
  } finally {
    chromeProc.kill();
  }
}

sliceFrames().catch(console.error);
