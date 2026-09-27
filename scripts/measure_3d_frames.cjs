const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

async function measure3DFrames() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9252',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9252/json/list', r => {
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

  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      const frames = ${JSON.stringify(framesB64)};
      const results = [];

      for (let i = 0; i < 8; i++) {
        const img = new Image();
        img.src = 'data:image/png;base64,' + frames[i];
        await new Promise(r => img.onload = r);

        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;

        // Find helmet center and radius in this 3d_frame:
        // Glass rim or head pixels in rows y: 60..200
        let minX = img.width, maxX = 0, minY = img.height, maxY = 0;
        let headMinX = img.width, headMaxX = 0, headMinY = img.height, headMaxY = 0;

        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const idx = (y * img.width + x) * 4;
            const a = data[idx+3];
            if (a > 30) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;

              if (y < 200) {
                if (x < headMinX) headMinX = x;
                if (x > headMaxX) headMaxX = x;
                if (y < headMinY) headMinY = y;
                if (y > headMaxY) headMaxY = y;
              }
            }
          }
        }

        // Measure collar top (pink pixels at y: 160..210)
        let collarPoints = [];
        for (let y = 160; y < 220; y++) {
          for (let x = headMinX; x < headMaxX; x++) {
            const idx = (y * img.width + x) * 4;
            const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
            if (a > 100 && r > 180 && g > 110 && g < 170 && b > 140) {
              collarPoints.push({ x, y });
            }
          }
        }

        const collarX = collarPoints.length ? collarPoints.reduce((s, p) => s + p.x, 0) / collarPoints.length : (headMinX + headMaxX) / 2;
        const collarY = collarPoints.length ? Math.min(...collarPoints.map(p => p.y)) : 180;

        results.push({
          frame: i,
          imgSize: { w: img.width, h: img.height },
          totalBBox: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
          headBBox: {
            minX: headMinX, maxX: headMaxX,
            minY: headMinY, maxY: headMaxY,
            cx: (headMinX + headMaxX) / 2,
            cy: (headMinY + headMaxY) / 2,
            rad: (headMaxX - headMinX) / 2,
            diameter: headMaxX - headMinX
          },
          collar: { x: collarX, y: collarY }
        });
      }
      return results;
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('3D Frame measurements:', JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}
measure3DFrames();
