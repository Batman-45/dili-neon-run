const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9230;

async function measure() {
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
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
    await send('Runtime.enable');

    const evalRes = await send('Runtime.evaluate', {
      expression: `(async () => {
        const img = new Image();
        img.src = '/assets/dili_runner_sheet.png';
        await new Promise(r => img.onload = r);
        const w = img.width;
        const h = img.height;
        const totalFrames = 8;
        const fw = w / totalFrames;
        
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const frameDetails = [];
        for (let i = 0; i < totalFrames; i++) {
          const frameData = ctx.getImageData(i * fw, 0, fw, h);
          let lowestY = -1;
          let highestY = h;
          let leftX = fw;
          let rightX = -1;
          
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < fw; x++) {
              const alpha = frameData.data[(y * fw + x) * 4 + 3];
              if (alpha > 30) {
                if (y < highestY) highestY = y;
                if (y > lowestY) lowestY = y;
                if (x < leftX) leftX = x;
                if (x > rightX) rightX = x;
              }
            }
          }
          frameDetails.push({
            frame: i,
            highestY,
            lowestY,
            height: lowestY - highestY + 1,
            bottomPadding: h - 1 - lowestY,
            leftX,
            rightX,
            width: rightX - leftX + 1
          });
        }
        return { w, h, fw, frameDetails };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    console.log(JSON.stringify(evalRes.result.value, null, 2));
    ws.close();
  } finally {
    chromeProc.kill();
  }
}

measure().catch(console.error);
