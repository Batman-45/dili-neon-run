const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

async function measureStrideBob() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9251',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9251/json/list', r => {
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
    framesB64.push(fs.readFileSync(`test-screenshots/frames/frame_${i}.png`).toString('base64'));
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
        c.width = 384; c.height = 384;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, 384, 384).data;

        // Find collar top:
        // In the original frames, where does the pink hood/collar begin under the helmet?
        // Helmet was glass, hood is pink: r > 180, g in 100..160, b in 130..190
        let hoodTopY = 384, hoodTopX = 192;
        let hoodPoints = [];
        for (let y = 130; y < 200; y++) {
          for (let x = 140; x < 244; x++) {
            const idx = (y * 384 + x) * 4;
            const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
            if (a > 100 && r > 180 && g > 110 && g < 170 && b > 140) {
              hoodPoints.push({ x, y });
              if (y < hoodTopY) {
                hoodTopY = y;
                hoodTopX = x;
              }
            }
          }
        }

        // Backpack top (dark grey pixels, r < 70, g < 70, b < 70)
        let bpTopY = 384, bpTopX = 192;
        for (let y = 170; y < 260; y++) {
          for (let x = 140; x < 244; x++) {
            const idx = (y * 384 + x) * 4;
            const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
            if (a > 100 && r < 60 && g < 60 && b < 60) {
              if (y < bpTopY) {
                bpTopY = y;
                bpTopX = x;
              }
            }
          }
        }

        // Head bounds in original 3d frame (purple hair or glass)
        let headMinY = 384, headMaxY = 0, headMinX = 384, headMaxX = 0;
        for (let y = 20; y < 175; y++) {
          for (let x = 80; x < 304; x++) {
            const idx = (y * 384 + x) * 4;
            if (data[idx+3] > 80) {
              if (y < headMinY) headMinY = y;
              if (y > headMaxY) headMaxY = y;
              if (x < headMinX) headMinX = x;
              if (x > headMaxX) headMaxX = x;
            }
          }
        }

        results.push({
          frame: i,
          hoodTop: { x: hoodTopX, y: hoodTopY },
          bpTop: { x: bpTopX, y: bpTopY },
          origHead: {
            minX: headMinX, maxX: headMaxX,
            minY: headMinY, maxY: headMaxY,
            cx: (headMinX + headMaxX) / 2,
            cy: (headMinY + headMaxY) / 2,
            rad: (headMaxX - headMinX) / 2,
            height: headMaxY - headMinY
          }
        });
      }
      return results;
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Original frame measurements:', JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}
measureStrideBob();
