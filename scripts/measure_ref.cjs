const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

async function measureRef() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9247',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9247/json/list', r => {
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

  const refB64 = fs.readFileSync('public/assets/dili_rear_ref.jpg').toString('base64');
  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + '${refB64}';
      await new Promise(r => img.onload = r);
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height);
      const p = d.data;

      // Character bounds:
      let minX = 1024, maxX = 0, minY = 1024, maxY = 0;
      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const r = p[idx], g = p[idx+1], b = p[idx+2];
          if (r < 235 || g < 235 || b < 235) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Helmet sphere: cx = 512, cy = 285, rad = 196
      // Shoulder width at y = 460..500
      let shoulderMinX = 1024, shoulderMaxX = 0;
      for (let y = 460; y <= 500; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const r = p[idx], g = p[idx+1], b = p[idx+2];
          if (r < 235 || g < 235 || b < 235) {
            if (x < shoulderMinX) shoulderMinX = x;
            if (x > shoulderMaxX) shoulderMaxX = x;
          }
        }
      }

      // Boots bottom:
      let bootsMaxY = maxY;

      return {
        totalBBox: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
        helmet: { cx: 512, cy: 285, rad: 196, diameter: 392, top: 285 - 196, bottom: 285 + 196 },
        shoulders: { minX: shoulderMinX, maxX: shoulderMaxX, width: shoulderMaxX - shoulderMinX },
        ratioHelmetToTotalHeight: 392 / (maxY - minY),
        ratioHelmetToShoulderWidth: 392 / (shoulderMaxX - shoulderMinX)
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Ref Measurements:', JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}
measureRef();
