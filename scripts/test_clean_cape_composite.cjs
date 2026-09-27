const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

async function testCleanCapeComposite() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9290',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9290/json/list', r => {
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
  const clean3dB64 = fs.readFileSync('public/assets/3d_frames/frame_0.png').toString('base64');
  const refRearB64 = fs.readFileSync('public/assets/dili_rear_ref.jpg').toString('base64');

  const script = `(async () => {
    const load = (b64, mime='image/png') => new Promise(res => {
      const img = new Image();
      img.src = 'data:' + mime + ';base64,' + b64;
      img.onload = () => res(img);
    });

    const currentSheet = await load('${currentSheetB64}', 'image/png');
    const cleanFrame0 = await load('${clean3dB64}', 'image/png');
    const refRear = await load('${refRearB64}', 'image/jpeg');

    // 1. Extract official D logo from dili_rear_ref.jpg (high precision)
    const refC = document.createElement('canvas');
    refC.width = 1024; refC.height = 1024;
    const rCtx = refC.getContext('2d');
    rCtx.drawImage(refRear, 0, 0);

    // In 1024x1024 dili_rear_ref.jpg:
    // Cape D is in X: 370..630, Y: 460..650
    const sx = 370, sy = 460, sw = 260, sh = 200;
    const imgData = rCtx.getImageData(sx, sy, sw, sh);
    const d = imgData.data;

    // Isolate white core of D
    const isCoreD = new Uint8Array(sw * sh);
    for (let y = 35; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const idx = (y * sw + x) * 4;
        if (d[idx+1] > 160) isCoreD[y * sw + x] = 1;
      }
    }

    // Connected component of the D
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

    // Build master high-res transparent D with antialiased edge & subtle drop shadow
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

    // 2. Test composite onto Frame 0
    // Start with currentSheet Frame 0 (so head and boots are 100% untouched)
    const testC = document.createElement('canvas');
    testC.width = 384; testC.height = 384;
    const tCtx = testC.getContext('2d');
    tCtx.drawImage(currentSheet, 0, 0, 384, 384, 0, 0, 384, 384);

    // Clean the cape region (Y: 185..265, X: 140..245) by restoring clean cape pixels from cleanFrame0
    const cleanCapeData = cleanFrame0;
    // We only need to overwrite the cape area where the old D was:
    // Let's create a temporary canvas to draw the clean cape patch
    const patchC = document.createElement('canvas');
    patchC.width = 384; patchC.height = 384;
    const pCtx = patchC.getContext('2d');
    pCtx.drawImage(cleanFrame0, 0, 0);

    // Replace the cape region
    const tData = tCtx.getImageData(0, 0, 384, 384);
    const pData = pCtx.getImageData(0, 0, 384, 384);
    for (let y = 188; y < 265; y++) {
      for (let x = 140; x < 245; x++) {
        const idx = (y * 384 + x) * 4;
        // Copy clean cape pixel
        tData.data[idx] = pData.data[idx];
        tData.data[idx+1] = pData.data[idx+1];
        tData.data[idx+2] = pData.data[idx+2];
        tData.data[idx+3] = pData.data[idx+3];
      }
    }
    tCtx.putImageData(tData, 0, 0);

    // Now draw the official D logo on the clean cape:
    // Size: scale masterD (134x88) to approx 54px wide x 36px tall
    const targetW = 54;
    const targetH = Math.round(targetW * (tightH / tightW));
    const targetX = 191.5 - targetW / 2;
    const targetY = 222 - targetH / 2;

    tCtx.save();
    // Subtle authentic cape-fabric shadow (matching dili_rear_ref.jpg)
    tCtx.shadowColor = 'rgba(50, 10, 60, 0.6)';
    tCtx.shadowBlur = 3;
    tCtx.shadowOffsetX = 0.5;
    tCtx.shadowOffsetY = 1.5;

    tCtx.drawImage(masterD, targetX, targetY, targetW, targetH);
    tCtx.restore();

    // Zoom crop (160x120 around torso)
    const zoomC = document.createElement('canvas');
    zoomC.width = 160; zoomC.height = 120;
    const zCtx = zoomC.getContext('2d');
    zCtx.drawImage(testC, 112, 170, 160, 120, 0, 0, 160, 120);

    return {
      fullFrame: testC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''),
      zoomCrop: zoomC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
    };
  })()`;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/test_frame0_clean_d.png', Buffer.from(res.result.value.fullFrame, 'base64'));
  fs.writeFileSync('test-screenshots/test_crop0_clean_d.png', Buffer.from(res.result.value.zoomCrop, 'base64'));
  console.log('Saved test frame0 clean D and crop');
  ws.close();
  p.kill();
}
testCleanCapeComposite().catch(console.error);
