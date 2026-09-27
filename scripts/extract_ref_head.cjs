const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

async function testExtractHead() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9249',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9249/json/list', r => {
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

      const srcC = document.createElement('canvas');
      srcC.width = 1024; srcC.height = 1024;
      const sCtx = srcC.getContext('2d');
      sCtx.drawImage(img, 0, 0);

      const sData = sCtx.getImageData(0, 0, 1024, 1024);
      const sp = sData.data;

      // Extract isolated rear head canvas
      // Helmet center: (512, 285), radius: 196
      const hcX = 512, hcY = 285, bRad = 196.5;

      const outC = document.createElement('canvas');
      outC.width = 1024; outC.height = 1024;
      const oCtx = outC.getContext('2d');
      const oData = oCtx.createImageData(1024, 1024);
      const op = oData.data;

      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const r = sp[idx], g = sp[idx+1], b = sp[idx+2];
          const dx = x - hcX, dy = y - hcY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // 1. Inside helmet sphere (dist <= bRad)
          if (dist <= bRad - 1.5) {
            op[idx] = r;
            op[idx+1] = g;
            op[idx+2] = b;
            op[idx+3] = 255;
          }
          // 2. Anti-aliased outer glass perimeter
          else if (dist <= bRad + 1.5) {
            const alpha = Math.max(0, Math.min(1, (bRad + 1.5 - dist) / 3.0));
            op[idx] = r;
            op[idx+1] = g;
            op[idx+2] = b;
            op[idx+3] = Math.round(255 * alpha);
          }
          // 3. Below the helmet sphere: pink neck and hoodie collar (y >= 430 and y <= 515, |dx| <= 160)
          else if (y >= 430 && y <= 515 && Math.abs(dx) <= 150) {
            // Check if not white background (background has r,g,b > 235)
            const isBg = (r > 235 && g > 235 && b > 235);
            if (!isBg) {
              // Smooth natural feathering towards bottom edge (y: 470..515)
              let alpha = 1.0;
              if (y > 470) {
                alpha = Math.max(0, 1.0 - (y - 470) / 45.0);
              }
              // Also soft horizontal feathering at outer edges of collar
              const xDist = Math.abs(dx);
              if (xDist > 105) {
                alpha *= Math.max(0, 1.0 - (xDist - 105) / 45.0);
              }

              op[idx] = r;
              op[idx+1] = g;
              op[idx+2] = b;
              op[idx+3] = Math.round(255 * alpha);
            }
          }
        }
      }

      oCtx.putImageData(oData, 0, 0);

      // Now crop tightly around the head assembly:
      // x: 512 - 220 = 292 to 512 + 220 = 732 (width 440)
      // y: 80 to 520 (height 440)
      const cropC = document.createElement('canvas');
      cropC.width = 440; cropC.height = 440;
      const cCtx = cropC.getContext('2d');
      cCtx.drawImage(outC, 292, 80, 440, 440, 0, 0, 440, 440);

      return cropC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  fs.writeFileSync('test-screenshots/extracted_ref_head.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved test-screenshots/extracted_ref_head.png');
  ws.close();
  p.kill();
}
testExtractHead();
