const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

async function testComposite() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9253',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9253/json/list', r => {
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
  const frame0B64 = fs.readFileSync('public/assets/3d_frames/frame_0.png').toString('base64');
  const frame1B64 = fs.readFileSync('public/assets/3d_frames/frame_1.png').toString('base64');
  const frame2B64 = fs.readFileSync('public/assets/3d_frames/frame_2.png').toString('base64');

  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      const loadImg = (b64, type='image/png') => new Promise(res => {
        const img = new Image();
        img.src = 'data:' + type + ';base64,' + b64;
        img.onload = () => res(img);
      });

      const refImg = await loadImg('${refB64}', 'image/jpeg');
      const f0Img = await loadImg('${frame0B64}', 'image/png');
      const f1Img = await loadImg('${frame1B64}', 'image/png');
      const f2Img = await loadImg('${frame2B64}', 'image/png');

      // 1. Isolate the official head from dili_rear_ref.jpg (1024x1024)
      // Helmet center: (512, 285), radius: 196
      const refC = document.createElement('canvas');
      refC.width = 1024; refC.height = 1024;
      const refCtx = refC.getContext('2d');
      refCtx.drawImage(refImg, 0, 0);

      const refData = refCtx.getImageData(0, 0, 1024, 1024);
      const rp = refData.data;

      const hcX = 512, hcY = 285, bRad = 196.5;

      const headC = document.createElement('canvas');
      headC.width = 1024; headC.height = 1024;
      const hCtx = headC.getContext('2d');
      const hData = hCtx.createImageData(1024, 1024);
      const hp = hData.data;

      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const r = rp[idx], g = rp[idx+1], b = rp[idx+2];
          const dx = x - hcX, dy = y - hcY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const isBg = (r > 234 && g > 234 && b > 236);

          // We include:
          // A) Pixels within helmet sphere (dist <= bRad)
          // B) Anti-aliased outer glass edge (dist <= bRad + 1.8)
          // C) Pink hood/collar nestled at the bottom of the helmet (y between 415 and 510, |dx| < 155)
          const inSphere = (dist <= bRad - 1.2);
          const inRim = (dist <= bRad + 1.8);
          const inCollar = (y >= 415 && y <= 510 && Math.abs(dx) <= 150 && !isBg);

          if (inSphere || inCollar) {
            hp[idx] = r;
            hp[idx+1] = g;
            hp[idx+2] = b;
            // Smooth collar fade at the bottom edge (y: 465..510) so it integrates seamlessly with the body
            let alpha = 1.0;
            if (y > 465) {
              alpha = Math.max(0, 1.0 - (y - 465) / 45.0);
            }
            if (inCollar && Math.abs(dx) > 105) {
              alpha *= Math.max(0, 1.0 - (Math.abs(dx) - 105) / 45.0);
            }
            hp[idx+3] = Math.round(255 * alpha);
          } else if (inRim) {
            const alpha = Math.max(0, Math.min(1, (bRad + 1.8 - dist) / 3.0));
            hp[idx] = r;
            hp[idx+1] = g;
            hp[idx+2] = b;
            hp[idx+3] = Math.round(255 * alpha);
          }
        }
      }
      hCtx.putImageData(hData, 0, 0);

      // Now create a test composite on frame 0, 1, 2
      // Frame 0: cx = 180.5, cy = 133.5, rad = 67.5 (target diameter 135)
      // Scale factor = (67.5 * 2) / (bRad * 2) = 135 / 393 = 0.3435
      function compositeFrame(bodyImg, cx, cy, rad, dOffsetX = 0, dOffsetY = 0) {
        const c = document.createElement('canvas');
        c.width = 384; c.height = 384;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 1. Draw base body
        ctx.drawImage(bodyImg, 0, 0);

        // 2. Draw 'D' on cape
        ctx.save();
        ctx.translate(192 + dOffsetX, 222 + dOffsetY);
        ctx.shadowColor = 'rgba(20, 5, 30, 0.75)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 3;

        ctx.font = '900 44px "Arial Black", "Impact", "Segoe UI Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Magenta border bevel
        ctx.strokeStyle = '#d62a98';
        ctx.lineWidth = 7;
        ctx.strokeText('D', 0, 0);

        // Crisp white core
        ctx.fillStyle = '#ffffff';
        ctx.fillText('D', 0, 0);
        ctx.restore();

        // 3. Composite official head
        const scale = (rad * 2) / (bRad * 2);
        const drawW = 1024 * scale;
        const drawH = 1024 * scale;
        const drawX = cx - hcX * scale;
        const drawY = cy - hcY * scale;

        ctx.drawImage(headC, drawX, drawY, drawW, drawH);

        return c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
      }

      const f0Comp = compositeFrame(f0Img, 180.5, 133.5, 67.5, 0, 4);
      const f1Comp = compositeFrame(f1Img, 179.0, 128.5, 67.0, -1, 0);
      const f2Comp = compositeFrame(f2Img, 185.0, 128.5, 67.0, 1, -4);

      return { f0Comp, f1Comp, f2Comp };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  const { f0Comp, f1Comp, f2Comp } = res.result.value;
  fs.writeFileSync('test-screenshots/composite_f0.png', Buffer.from(f0Comp, 'base64'));
  fs.writeFileSync('test-screenshots/composite_f1.png', Buffer.from(f1Comp, 'base64'));
  fs.writeFileSync('test-screenshots/composite_f2.png', Buffer.from(f2Comp, 'base64'));
  console.log('Saved composite frames 0, 1, 2');
  ws.close();
  p.kill();
}
testComposite();
