const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function measureFrames() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9292',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9292/json/list', r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
  }));
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (m, params = {}) => new Promise(res => {
    const i = id++;
    const onm = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === i) { ws.removeEventListener('message', onm); res(msg.result); }
    };
    ws.addEventListener('message', onm);
    ws.send(JSON.stringify({ id: i, method: m, params }));
  });
  await send('Runtime.enable');

  const sheetB64 = fs.readFileSync('public/assets/dili_runner_sheet.png').toString('base64');

  const script = `
    (async () => {
      const load = (b64) => new Promise(res => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        img.onload = () => res(img);
      });
      const sheet = await load('${sheetB64}');

      const frames = [];
      const c = document.createElement('canvas');
      c.width = 384; c.height = 384;
      const ctx = c.getContext('2d');

      for (let f = 0; f < 8; f++) {
        ctx.clearRect(0, 0, 384, 384);
        ctx.drawImage(sheet, f * 384, 0, 384, 384, 0, 0, 384, 384);
        const data = ctx.getImageData(0, 0, 384, 384).data;
        let minX = 384, maxX = 0, minY = 384, maxY = 0;
        for (let y = 0; y < 384; y++) {
          for (let x = 0; x < 384; x++) {
            const a = data[(y * 384 + x) * 4 + 3];
            if (a > 30) {
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
          }
        }
        frames.push({
          frame: f,
          overall: { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1, cx: (minX + maxX)/2 }
        });
      }
      return frames;
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Overall frames:', JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}

measureFrames().catch(console.error);
