const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9316;

async function measureFrame0() {
  const p = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));

  const list = await new Promise(res => http.get(`http://localhost:${port}/json/list`, r => {
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
      const img = new Image();
      img.src = 'data:image/png;base64,' + '${sheetB64}';
      await new Promise(r => img.onload = r);

      const c = document.createElement('canvas');
      c.width = 384; c.height = 384;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 384, 384, 0, 0, 384, 384);

      const d = ctx.getImageData(0, 0, 384, 384).data;
      let minX = 384, maxX = 0, minY = 384, maxY = 0;
      let hMinX = 384, hMaxX = 0, hMinY = 384, hMaxY = 0;

      for (let y = 0; y < 384; y++) {
        for (let x = 0; x < 384; x++) {
          const idx = (y * 384 + x) * 4;
          if (d[idx + 3] > 20) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            if (y < 185) {
              if (x < hMinX) hMinX = x;
              if (x > hMaxX) hMaxX = x;
              if (y < hMinY) hMinY = y;
              if (y > hMaxY) hMaxY = y;
            }
          }
        }
      }

      return {
        total: { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 },
        head: { hMinX, hMaxX, hMinY, hMaxY, hw: hMaxX - hMinX + 1, hh: hMaxY - hMinY + 1, cx: (hMinX + hMaxX)/2, cy: (hMinY + hMaxY)/2 }
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Frame 0 measurements:', JSON.stringify(res.result?.value, null, 2));

  ws.close();
  p.kill();
}

measureFrame0().catch(console.error);
