const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

async function inspectSheetDetails() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9246',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9246/json/list', r => {
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
  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + '${sheetB64}';
      await new Promise(r => img.onload = r);
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const frames = [];
      for (let f = 0; f < 8; f++) {
        const ox = f * 384;
        const d = ctx.getImageData(ox, 0, 384, 384);
        const p = d.data;

        // Measure bounding box of character in this frame
        let minX = 384, maxX = 0, minY = 384, maxY = 0;
        let bpMinX = 384, bpMaxX = 0, bpY = 0;
        // Measure collar: pink pixels between y = 145 and 190
        let collarPoints = [];

        for (let y = 0; y < 384; y++) {
          for (let x = 0; x < 384; x++) {
            const idx = (y * 384 + x) * 4;
            const a = p[idx + 3];
            if (a > 30) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;

              const r = p[idx], g = p[idx+1], b = p[idx+2];
              // Pink hoodie/collar
              if (y >= 145 && y <= 190 && r > 160 && b > 120 && g < 150) {
                collarPoints.push({ x, y });
              }
            }
          }
        }

        let collarCenterX = collarPoints.length ? collarPoints.reduce((s, pt) => s + pt.x, 0) / collarPoints.length : 192;
        let collarMinY = collarPoints.length ? Math.min(...collarPoints.map(pt => pt.y)) : 160;

        frames.push({
          frame: f,
          bbox: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
          centerX: (minX + maxX) / 2,
          collarCenterX,
          collarMinY
        });
      }

      return { frames };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Sheet analysis:', JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}
inspectSheetDetails();
