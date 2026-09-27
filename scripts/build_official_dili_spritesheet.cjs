const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

async function buildSpritesheet() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9254',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9254/json/list', r => {
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
  const framesB64 = [];
  for (let i = 0; i < 8; i++) {
    framesB64.push(fs.readFileSync(`public/assets/3d_frames/frame_${i}.png`).toString('base64'));
  }

  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      const loadImg = (b64, type='image/png') => new Promise(res => {
        const img = new Image();
        img.src = 'data:' + type + ';base64,' + b64;
        img.onload = () => res(img);
      });

      const refImg = await loadImg('${refB64}', 'image/jpeg');
      const baseFrames = [];
      const frameData = ${JSON.stringify(framesB64)};
      for (let i = 0; i < 8; i++) {
        baseFrames.push(await loadImg(frameData[i], 'image/png'));
      }

      // 1. Isolate the official rear head from dili_rear_ref.jpg
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

          const inSphere = (dist <= bRad - 1.2);
          const inRim = (dist <= bRad + 1.8);
          const inCollar = (y >= 415 && y <= 512 && Math.abs(dx) <= 152 && !isBg);

          if (inSphere || inCollar) {
            hp[idx] = r;
            hp[idx+1] = g;
            hp[idx+2] = b;

            let alpha = 1.0;
            if (y > 465) {
              alpha = Math.max(0, 1.0 - (y - 465) / 47.0);
            }
            if (inCollar && Math.abs(dx) > 105) {
              alpha *= Math.max(0, 1.0 - (Math.abs(dx) - 105) / 47.0);
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

      // Frame parameters calibrated from 3D motion capture:
      const frameConfigs = [
        { cx: 180.5, cy: 133.5, rad: 67.5, dX: 0,  dY: 3,  tilt: 0 },
        { cx: 179.0, cy: 128.5, rad: 67.0, dX: -2, dY: -1, tilt: -0.02 },
        { cx: 185.0, cy: 128.5, rad: 67.0, dX: 0,  dY: -4, tilt: -0.01 },
        { cx: 186.5, cy: 128.0, rad: 67.5, dX: 2,  dY: -2, tilt: 0 },
        { cx: 202.5, cy: 133.5, rad: 67.5, dX: 0,  dY: 3,  tilt: 0 },
        { cx: 204.0, cy: 128.5, rad: 67.0, dX: 2,  dY: -1, tilt: 0.02 },
        { cx: 198.0, cy: 128.5, rad: 67.0, dX: 0,  dY: -4, tilt: 0.01 },
        { cx: 196.5, cy: 128.0, rad: 67.5, dX: -2, dY: -2, tilt: 0 },
      ];

      const TOTAL_FRAMES = 8;
      const FRAME_SIZE = 384;
      const sheetC = document.createElement('canvas');
      sheetC.width = FRAME_SIZE * TOTAL_FRAMES;
      sheetC.height = FRAME_SIZE;
      const sCtx = sheetC.getContext('2d');
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';

      for (let f = 0; f < TOTAL_FRAMES; f++) {
        const ox = f * FRAME_SIZE;
        const cfg = frameConfigs[f];

        // 1. Draw base 3D body frame to temporary slot canvas
        const slotC = document.createElement('canvas');
        slotC.width = FRAME_SIZE;
        slotC.height = FRAME_SIZE;
        const slotCtx = slotC.getContext('2d');
        slotCtx.imageSmoothingEnabled = true;
        slotCtx.imageSmoothingQuality = 'high';

        slotCtx.drawImage(baseFrames[f], 0, 0);

        // Backpack glare cleanup (especially frame 3)
        const slotData = slotCtx.getImageData(0, 0, FRAME_SIZE, FRAME_SIZE);
        const sp = slotData.data;
        for (let y = 195; y < 265; y++) {
          for (let x = 150; x < 230; x++) {
            const idx = (y * FRAME_SIZE + x) * 4;
            const r = sp[idx], g = sp[idx+1], b = sp[idx+2];
            if (r > 175 && g > 175 && b > 175) {
              sp[idx] = 48;
              sp[idx+1] = 32;
              sp[idx+2] = 48;
            }
          }
        }
        slotCtx.putImageData(slotData, 0, 0);

        // 2. Draw official 'D' badge on the cape
        slotCtx.save();
        slotCtx.translate(192 + cfg.dX, 222 + cfg.dY);
        if (cfg.tilt !== 0) slotCtx.rotate(cfg.tilt);

        slotCtx.shadowColor = 'rgba(20, 5, 30, 0.75)';
        slotCtx.shadowBlur = 6;
        slotCtx.shadowOffsetX = 1;
        slotCtx.shadowOffsetY = 3;

        slotCtx.font = '900 44px "Arial Black", "Impact", "Segoe UI Black", sans-serif';
        slotCtx.textAlign = 'center';
        slotCtx.textBaseline = 'middle';

        // Magenta border bevel
        slotCtx.strokeStyle = '#d62a98';
        slotCtx.lineWidth = 7;
        slotCtx.strokeText('D', 0, 0);

        // Crisp white core
        slotCtx.fillStyle = '#ffffff';
        slotCtx.fillText('D', 0, 0);
        slotCtx.restore();

        // 3. Composite official Dili rear head
        const scale = (cfg.rad * 2) / (bRad * 2);
        const dw = 1024 * scale;
        const dh = 1024 * scale;
        const dx = cfg.cx - hcX * scale;
        const dy = cfg.cy - hcY * scale;

        slotCtx.drawImage(headC, dx, dy, dw, dh);

        // Draw this frame into the spritesheet
        sCtx.drawImage(slotC, ox, 0);
      }

      return sheetC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  const outPath = path.resolve('public/assets/dili_runner_sheet.png');
  fs.writeFileSync(outPath, Buffer.from(res.result.value, 'base64'));
  console.log(`Successfully generated official Dili runner spritesheet at: ${outPath} (${fs.statSync(outPath).size} bytes)`);

  ws.close();
  p.kill();
}

buildSpritesheet().catch(console.error);
