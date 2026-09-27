const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

async function testCalibratedFrames() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9287',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9287/json/list', r => {
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
  const refRearB64 = fs.readFileSync('public/assets/dili_rear_ref.jpg').toString('base64');
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
    const refRear = await load('${refRearB64}', 'image/jpeg');
    const cleanFrames = await Promise.all(${JSON.stringify(cleanFramesB64)}.map(b => load(b, 'image/png')));

    // 1. High-resolution extraction of official D logo from dili_rear_ref.jpg
    const refC = document.createElement('canvas');
    refC.width = 1024; refC.height = 1024;
    const rCtx = refC.getContext('2d');
    rCtx.drawImage(refRear, 0, 0);

    const sx = 370, sy = 460, sw = 260, sh = 200;
    const imgData = rCtx.getImageData(sx, sy, sw, sh);
    const d = imgData.data;

    const isCoreD = new Uint8Array(sw * sh);
    for (let y = 35; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const idx = (y * sw + x) * 4;
        if (d[idx+1] > 160) isCoreD[y * sw + x] = 1;
      }
    }

    const visited = new Uint8Array(sw * sh);
    const dComp = new Uint8Array(sw * sh);
    const queue = [];
    for (let y = 40; y < sh; y++) {
      for (let x = 20; x < sw - 20; x++) {
        if (isCoreD[y * sw + x]) {
          queue.push(x, y);
          visited[y * sw + x] = 1;
          break;
        }
      }
      if (queue.length > 0) break;
    }

    while (queue.length > 0) {
      const cy = queue.pop();
      const cx = queue.pop();
      dComp[cy * sw + cx] = 1;
      for (const [nx, ny] of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]) {
        if (nx >= 0 && nx < sw && ny >= 35 && ny < sh) {
          const nidx = ny * sw + nx;
          if (!visited[nidx] && isCoreD[nidx]) {
            visited[nidx] = 1;
            queue.push(nx, ny);
          }
        }
      }
    }

    let minX = sw, maxX = 0, minY = sh, maxY = 0;
    const dCanvas = document.createElement('canvas');
    dCanvas.width = sw; dCanvas.height = sh;
    const dCtx = dCanvas.getContext('2d');
    const dOut = dCtx.createImageData(sw, sh);
    const dp = dOut.data;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const nidx = y * sw + x;
        const idx = nidx * 4;

        if (dComp[nidx]) {
          dp[idx] = 255;
          dp[idx+1] = 255;
          dp[idx+2] = 255;
          dp[idx+3] = 255;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        } else {
          let minDist = 999;
          for (let dy = -3; dy <= 3; dy++) {
            const py = y + dy;
            if (py < 0 || py >= sh) continue;
            for (let dx = -3; dx <= 3; dx++) {
              const px = x + dx;
              if (px < 0 || px >= sw) continue;
              if (dComp[py * sw + px]) {
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < minDist) minDist = dist;
              }
            }
          }

          if (minDist <= 2.8) {
            const alpha = Math.max(0, Math.min(1, 1.0 - (minDist - 0.2) / 2.6));
            dp[idx] = 255;
            dp[idx+1] = 255;
            dp[idx+2] = 255;
            dp[idx+3] = Math.round(255 * alpha);
            if (alpha > 0.05) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
      }
    }
    dCtx.putImageData(dOut, 0, 0);

    const pad = 4;
    const tightW = maxX - minX + 1 + pad * 2;
    const tightH = maxY - minY + 1 + pad * 2;
    const masterD = document.createElement('canvas');
    masterD.width = tightW; masterD.height = tightH;
    const mCtx = masterD.getContext('2d');
    mCtx.drawImage(dCanvas, minX - pad, minY - pad, tightW, tightH, 0, 0, tightW, tightH);

    // 2. Build full 8-frame spritesheet
    const fullSheet = document.createElement('canvas');
    fullSheet.width = 384 * 8; fullSheet.height = 384;
    const fsCtx = fullSheet.getContext('2d');
    fsCtx.imageSmoothingEnabled = true;
    fsCtx.imageSmoothingQuality = 'high';

    fsCtx.drawImage(currentSheet, 0, 0);

    // Frame positions accurately tracked to cape center
    const frameConfigs = [
      { posX: 189, posY: 221, tilt: 0 },
      { posX: 186, posY: 219, tilt: -0.03 },
      { posX: 182, posY: 215, tilt: -0.05 },
      { posX: 180, posY: 213, tilt: -0.03 },
      { posX: 194, posY: 221, tilt: 0 },
      { posX: 197, posY: 219, tilt: 0.03 },
      { posX: 201, posY: 215, tilt: 0.05 },
      { posX: 203, posY: 213, tilt: 0.03 },
    ];

    // Calibrated logo width
    const targetW = 46;
    const targetH = Math.round(targetW * (tightH / tightW)); // ~30px

    const crops = [];

    for (let f = 0; f < 8; f++) {
      const ox = f * 384;
      const cleanF = cleanFrames[f];
      const cfg = frameConfigs[f];

      const frameC = document.createElement('canvas');
      frameC.width = 384; frameC.height = 384;
      const fcCtx = frameC.getContext('2d');
      fcCtx.drawImage(fullSheet, ox, 0, 384, 384, 0, 0, 384, 384);

      // Clean cape patch
      const patchC = document.createElement('canvas');
      patchC.width = 384; patchC.height = 384;
      const pCtx = patchC.getContext('2d');
      pCtx.drawImage(cleanF, 0, 0);

      // Backpack glare removal in clean patch
      const pData = pCtx.getImageData(0, 0, 384, 384);
      for (let y = 195; y < 265; y++) {
        for (let x = 145; x < 240; x++) {
          const idx = (y * 384 + x) * 4;
          const r = pData.data[idx], g = pData.data[idx+1], b = pData.data[idx+2];
          if (r > 165 && g > 165 && b > 165) {
            pData.data[idx] = 45;
            pData.data[idx+1] = 30;
            pData.data[idx+2] = 45;
          }
        }
      }
      pCtx.putImageData(pData, 0, 0);

      // Overwrite only the cape area (Y: 188..265, X: 135..250) to erase old D
      const fData = fcCtx.getImageData(0, 0, 384, 384);
      for (let y = 188; y < 265; y++) {
        for (let x = 135; x < 250; x++) {
          const idx = (y * 384 + x) * 4;
          fData.data[idx] = pData.data[idx];
          fData.data[idx+1] = pData.data[idx+1];
          fData.data[idx+2] = pData.data[idx+2];
          fData.data[idx+3] = pData.data[idx+3];
        }
      }
      fcCtx.putImageData(fData, 0, 0);

      // Draw official D logo centered on cape
      fcCtx.save();
      fcCtx.translate(cfg.posX, cfg.posY);
      if (cfg.tilt !== 0) fcCtx.rotate(cfg.tilt);

      // Subtle, crisp purple/magenta edge shadow treatment (matching reference)
      fcCtx.shadowColor = 'rgba(55, 10, 65, 0.7)';
      fcCtx.shadowBlur = 3;
      fcCtx.shadowOffsetX = 0.5;
      fcCtx.shadowOffsetY = 1.5;

      // Draw master D
      fcCtx.drawImage(masterD, -targetW / 2, -targetH / 2, targetW, targetH);
      fcCtx.restore();

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
  fs.writeFileSync('test-screenshots/calibrated_all_8_crops.png', Buffer.from(res.result.value.cropsStrip, 'base64'));
  fs.writeFileSync('public/assets/dili_runner_sheet.png', Buffer.from(res.result.value.sheet, 'base64'));
  console.log('Successfully updated public/assets/dili_runner_sheet.png and saved calibrated preview');
  ws.close();
  p.kill();
}
testCalibratedFrames().catch(console.error);
