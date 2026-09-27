const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9248;

async function inspectSheet() {
  const imgPath = 'C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\f9aa1e5a-c2f5-4c1d-b0e2-46b7668abe78\\dili_inbetween_sheet_1790321993045.jpg';
  const imgData = fs.readFileSync(imgPath).toString('base64');

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    'about:blank',
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

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      return res.result?.value;
    }

    await evaluate(`window.__base64 = "${imgData}";`);

    const result = await evaluate(`
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth;
          const h = img.naturalHeight;

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const cols = 5;
          const rows = 2;
          const cellW = w / cols;
          const cellH = h / rows;
          const cleanData = ctx.getImageData(0, 0, w, h).data;

          const boxes = [];
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const startX = Math.floor(c * cellW);
              const endX = Math.floor((c + 1) * cellW);
              const startY = Math.floor(r * cellH);
              const endY = Math.floor((r + 1) * cellH);

              let minX = endX, maxX = startX, minY = endY, maxY = startY;
              for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                  const idx = (y * w + x) * 4;
                  const red = cleanData[idx];
                  const green = cleanData[idx + 1];
                  const blue = cleanData[idx + 2];
                  if (red < 240 || green < 240 || blue < 240) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                  }
                }
              }

              boxes.push({ r, c, minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 });
            }
          }

          resolve({ w, h, boxes });
        };
        img.src = 'data:image/jpeg;base64,' + window.__base64;
      })
    `);

    console.log('Result:', JSON.stringify(result, null, 2));

    ws.close();
  } finally {
    chromeProc.kill();
  }
}

inspectSheet().catch(console.error);
