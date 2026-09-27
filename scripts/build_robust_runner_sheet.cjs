const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

async function buildRobustRunnerSheet() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9284',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9284/json/list', r => {
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

  const currentSheetB64 = fs.readFileSync('public/assets/dili_runner_sheet.png').toString('base64');
  const cleanFramesB64 = [];
  for (let i = 0; i < 8; i++) {
    cleanFramesB64.push(fs.readFileSync(`public/assets/3d_frames/frame_${i}.png`).toString('base64'));
  }

  const script = `(async () => {
    const load = (b64, mime='image/png') => new Promise(res => {
      const img = new Image();
      img.src = 'data:' + mime + ';base64,' + b64;
      img.onload = () => res(img);
    });

    const currentSheet = await load('${currentSheetB64}', 'image/png');
    const cleanFrames = await Promise.all(${JSON.stringify(cleanFramesB64)}.map(b => load(b, 'image/png')));

    // Helper: draw official simplified D
    function drawOfficialD(ctx, cx, cy, w, h, slant=-0.04) {
      ctx.save();
      ctx.translate(cx, cy);
      if (slant !== 0) ctx.transform(1, 0, Math.tan(slant), 1, 0, 0);

      const halfW = w / 2;
      const halfH = h / 2;
      const r = Math.min(w, h) * 0.14;

      const stemW = w * 0.26;
      const topBarH = h * 0.22;
      const botBarH = h * 0.25;

      // Outer path
      ctx.beginPath();
      ctx.moveTo(-halfW + r, -halfH);
      ctx.lineTo(halfW * 0.25, -halfH);
      ctx.bezierCurveTo(halfW * 0.72, -halfH, halfW, -halfH * 0.55, halfW, 0);
      ctx.bezierCurveTo(halfW, halfH * 0.55, halfW * 0.72, halfH, halfW * 0.25, halfH);
      ctx.bezierCurveTo(0, halfH * 1.04, -halfW * 0.4, halfH * 0.94, -halfW + r, halfH);
      ctx.arcTo(-halfW, halfH, -halfW, halfH - r, r);
      ctx.lineTo(-halfW, -halfH + r);
      ctx.arcTo(-halfW, -halfH, -halfW + r, -halfH, r);
      ctx.closePath();

      // Inner counter path
      const holeLeft = -halfW + stemW;
      const holeTop = -halfH + topBarH;
      const holeBot = halfH - botBarH;
      const holeRight = halfW * 0.56;
      const holeR = r * 0.6;

      ctx.moveTo(holeLeft, holeTop + holeR);
      ctx.lineTo(holeLeft, holeBot - holeR);
      ctx.arcTo(holeLeft, holeBot, holeLeft + holeR, holeBot, holeR);
      ctx.lineTo(holeRight * 0.4, holeBot);
      ctx.bezierCurveTo(holeRight, holeBot, holeRight * 1.15, holeTop * 0.2, holeRight * 0.4, holeTop);
      ctx.lineTo(holeLeft + holeR, holeTop);
      ctx.arcTo(holeLeft, holeTop, holeLeft, holeTop + holeR, holeR);
      ctx.closePath();

      // Tight, crisp deep purple contact edge shadow (no muddy spread)
      ctx.shadowColor = 'rgba(40, 5, 45, 0.88)';
      ctx.shadowBlur = 3.5;
      ctx.shadowOffsetX = 0.5;
      ctx.shadowOffsetY = 1.8;

      ctx.fillStyle = '#ffffff';
      ctx.fill('evenodd');

      // Crisp pure white pass on top to guarantee 100% white surface
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#ffffff';
      ctx.fill('evenodd');

      ctx.restore();
    }

    const fullSheet = document.createElement('canvas');
    fullSheet.width = 384 * 8; fullSheet.height = 384;
    const fsCtx = fullSheet.getContext('2d');
    fsCtx.imageSmoothingEnabled = true;
    fsCtx.imageSmoothingQuality = 'high';

    // Start with current sheet (head and boots 100% intact)
    fsCtx.drawImage(currentSheet, 0, 0);

    // Frame positions accurately tracked to cape center
    const frameConfigs = [
      { posX: 189, posY: 220, tilt: 0,     w: 64, h: 46 },
      { posX: 186, posY: 218, tilt: -0.02, w: 64, h: 46 },
      { posX: 182, posY: 214, tilt: -0.04, w: 62, h: 45 },
      { posX: 180, posY: 212, tilt: -0.02, w: 60, h: 44 },
      { posX: 194, posY: 220, tilt: 0,     w: 64, h: 46 },
      { posX: 197, posY: 218, tilt: 0.02,  w: 64, h: 46 },
      { posX: 201, posY: 214, tilt: 0.04,  w: 62, h: 45 },
      { posX: 203, posY: 212, tilt: 0.02,  w: 60, h: 44 },
    ];

    const crops = [];

    for (let f = 0; f < 8; f++) {
      const ox = f * 384;
      const cleanF = cleanFrames[f];
      const cfg = frameConfigs[f];

      const frameC = document.createElement('canvas');
      frameC.width = 384; frameC.height = 384;
      const fcCtx = frameC.getContext('2d');
      fcCtx.imageSmoothingEnabled = true;
      fcCtx.imageSmoothingQuality = 'high';
      fcCtx.drawImage(fullSheet, ox, 0, 384, 384, 0, 0, 384, 384);

      // Clean cape patch
      const patchC = document.createElement('canvas');
      patchC.width = 384; patchC.height = 384;
      const pCtx = patchC.getContext('2d');
      pCtx.drawImage(cleanF, 0, 0);

      // Backpack glare removal
      const pData = pCtx.getImageData(0, 0, 384, 384);
      for (let y = 190; y < 270; y++) {
        for (let x = 140; x < 255; x++) {
          const idx = (y * 384 + x) * 4;
          const r = pData.data[idx], g = pData.data[idx+1], b = pData.data[idx+2];
          if (r > 150 && g > 150 && b > 150) {
            pData.data[idx] = 42;
            pData.data[idx+1] = 28;
            pData.data[idx+2] = 42;
          }
        }
      }
      pCtx.putImageData(pData, 0, 0);

      // Overwrite only the cape area (Y: 188..265, X: 135..252) to erase old D
      const fData = fcCtx.getImageData(0, 0, 384, 384);
      for (let y = 188; y < 265; y++) {
        for (let x = 135; x < 252; x++) {
          const idx = (y * 384 + x) * 4;
          fData.data[idx] = pData.data[idx];
          fData.data[idx+1] = pData.data[idx+1];
          fData.data[idx+2] = pData.data[idx+2];
          fData.data[idx+3] = pData.data[idx+3];
        }
      }
      fcCtx.putImageData(fData, 0, 0);

      // Draw official solid white D logo
      drawOfficialD(fcCtx, cfg.posX, cfg.posY, cfg.w, cfg.h, cfg.tilt);

      // Put frame back into fullSheet
      fsCtx.clearRect(ox, 0, 384, 384);
      fsCtx.drawImage(frameC, ox, 0);

      const zoomC = document.createElement('canvas');
      zoomC.width = 160; zoomC.height = 120;
      const zCtx = zoomC.getContext('2d');
      zCtx.drawImage(frameC, 112, 170, 160, 120, 0, 0, 160, 120);
      crops.push(zoomC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''));
    }

    const stripC = document.createElement('canvas');
    stripC.width = 160 * 8; stripC.height = 120;
    const sCtx = stripC.getContext('2d');
    for (let f = 0; f < 8; f++) {
      const cImg = await load(crops[f]);
      sCtx.drawImage(cImg, f * 160, 0);
    }

    return {
      sheet: fullSheet.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''),
      cropsStrip: stripC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
    };
  })()`;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/robust_8_crops.png', Buffer.from(res.result.value.cropsStrip, 'base64'));
  fs.writeFileSync('public/assets/dili_runner_sheet.png', Buffer.from(res.result.value.sheet, 'base64'));
  console.log('Successfully generated public/assets/dili_runner_sheet.png');
  ws.close();
  p.kill();
}
buildRobustRunnerSheet().catch(console.error);
