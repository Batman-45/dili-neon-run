const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function measureCapeCenters() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9293',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9293/json/list', r => {
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

  const framesB64 = [];
  for (let i = 0; i < 8; i++) {
    framesB64.push(fs.readFileSync(`public/assets/3d_frames/frame_${i}.png`).toString('base64'));
  }

  const script = `(async () => {
    const loadImg = (b64) => new Promise(res => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      img.onload = () => res(img);
    });

    const frames = await Promise.all(${JSON.stringify(framesB64)}.map(loadImg));
    const results = [];

    const c = document.createElement('canvas');
    c.width = 384; c.height = 384;
    const ctx = c.getContext('2d');

    for (let f = 0; f < 8; f++) {
      ctx.clearRect(0, 0, 384, 384);
      ctx.drawImage(frames[f], 0, 0);
      const imgData = ctx.getImageData(0, 0, 384, 384);
      const p = imgData.data;

      // Cape is purple/magenta fabric on back: Y: 180..260
      // Color: R > 130, B > 130, G < 80
      let minX = 384, maxX = 0, minY = 384, maxY = 0;
      let sumX = 0, sumY = 0, count = 0;

      for (let y = 180; y < 265; y++) {
        for (let x = 120; x < 264; x++) {
          const idx = (y * 384 + x) * 4;
          const a = p[idx + 3];
          if (a > 50) {
            const r = p[idx], g = p[idx+1], b = p[idx+2];
            // Cape purple:
            if (r > 120 && b > 120 && g < 80) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              sumX += x;
              sumY += y;
              count++;
            }
          }
        }
      }

      results.push({
        f,
        capeBbox: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
        centroidX: count ? (sumX / count) : 192,
        centroidY: count ? (sumY / count) : 222,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
      });
    }

    return results;
  })()`;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Cape analysis:', JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}
measureCapeCenters().catch(console.error);
