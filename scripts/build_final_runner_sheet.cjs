const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function buildFinalRunnerSheet() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9352',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9352/json/list', r => {
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

  const b64_v2 = fs.readFileSync('C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\d86d48cc-c83b-4c0a-a996-4889df60c7b4\\dili_rear_head_chibi_v2_1790329622771.jpg').toString('base64');
  const sheetB64 = fs.readFileSync('public/assets/dili_runner_sheet.png').toString('base64');

  const script = `
    (async () => {
      const load = (b64, mime='image/png') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });
      const originalSheet = await load('${sheetB64}', 'image/png');
      const imgV2 = await load('${b64_v2}', 'image/jpeg');

      // -------------------------------------------------------------
      // 1. ISOLATE HAIR AND ENHANCE VOLUME/COLOR
      // -------------------------------------------------------------
      const rawC = document.createElement('canvas');
      rawC.width = 1024; rawC.height = 1024;
      const rawCtx = rawC.getContext('2d');
      rawCtx.drawImage(imgV2, 0, 0);

      const rawData = rawCtx.getImageData(0, 0, 1024, 1024);
      const rp = rawData.data;

      const hcX = 512, hcY = 450;
      
      const hairOnlyC = document.createElement('canvas');
      hairOnlyC.width = 1024; hairOnlyC.height = 1024;
      const hoCtx = hairOnlyC.getContext('2d');

      const hairData = hoCtx.createImageData(1024, 1024);
      const hp = hairData.data;

      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          let r = rp[idx], g = rp[idx+1], b = rp[idx+2];
          const dx = x - hcX, dy = y - hcY;
          const dist = Math.sqrt(dx*dx + dy*dy);

          const isPinkNeck = (r > 165 && g > 110 && b > 140 && y > 710);
          const isHair = (dist < 370) && !isPinkNeck && (
            (b > g + 8 && r > g + 4) ||
            (r < 110 && g < 70 && b < 130 && dist < 340)
          );

          if (isHair) {
            hp[idx] = r;
            hp[idx + 1] = g;
            hp[idx + 2] = b;
            hp[idx + 3] = 255;
          }
        }
      }
      hoCtx.putImageData(hairData, 0, 0);

      // Add full volumetric bottom curl lobes across entire lower perimeter
      // so the rear hair mass rounds out naturally and seats snugly into the hoodie collar
      const bottomLobes = [
        { x: -140, y: 700, r: 85, cMid: '#5a1d7c', cHi: '#983ed8' },
        { x: 140,  y: 700, r: 85, cMid: '#5a1d7c', cHi: '#983ed8' },
        { x: -100, y: 745, r: 90, cMid: '#4d1668', cHi: '#8a33c2' },
        { x: 100,  y: 745, r: 90, cMid: '#4d1668', cHi: '#8a33c2' },
        { x: -55,  y: 785, r: 90, cMid: '#44145e', cHi: '#7d2cb3' },
        { x: 55,   y: 785, r: 90, cMid: '#44145e', cHi: '#7d2cb3' },
        { x: 0,    y: 810, r: 95, cMid: '#401258', cHi: '#7d2cb3' },
      ];
      hoCtx.save();
      for (const lb of bottomLobes) {
        const lx = hcX + lb.x, ly = lb.y;
        const g = hoCtx.createRadialGradient(lx - 25, ly - 25, 8, lx, ly, lb.r);
        g.addColorStop(0, lb.cHi);
        g.addColorStop(0.35, lb.cMid);
        g.addColorStop(0.85, '#2b0a3d');
        g.addColorStop(1, 'rgba(30, 8, 45, 0.9)');
        hoCtx.fillStyle = g;
        hoCtx.beginPath();
        hoCtx.arc(lx, ly, lb.r, 0, Math.PI * 2);
        hoCtx.fill();
      }
      hoCtx.restore();

      // -------------------------------------------------------------
      // 2. BUILD MASTER 1024x1024 HEAD DOME
      // -------------------------------------------------------------
      const bcX = 512, bcY = 470, bRad = 420;

      const masterHead = document.createElement('canvas');
      masterHead.width = 1024; masterHead.height = 1024;
      const mhCtx = masterHead.getContext('2d');

      // Clip to spherical bubble
      mhCtx.save();
      mhCtx.beginPath();
      mhCtx.arc(bcX, bcY, bRad, 0, Math.PI * 2);
      mhCtx.clip();

      // Subtle crystal glass sheen
      const gGrad = mhCtx.createRadialGradient(bcX - 80, bcY - 100, 50, bcX, bcY, bRad);
      gGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      gGrad.addColorStop(0.5, 'rgba(120, 240, 255, 0.04)');
      gGrad.addColorStop(0.85, 'rgba(80, 20, 120, 0.06)');
      gGrad.addColorStop(1, 'rgba(0, 230, 255, 0.22)');
      mhCtx.fillStyle = gGrad;
      mhCtx.fillRect(0, 0, 1024, 1024);

      // Scale hair so it fills ~85% of bubble (matching official mascot reference)
      const hairScale = 1.08;
      const hDestW = 1024 * hairScale;
      const hDestH = 1024 * hairScale;
      const hDestX = bcX - (hcX * hairScale);
      // Lower hair mass so bottom curl lobes reach well into collar (y > 930)
      const hDestY = (bcY - (hcY * hairScale)) + 74;

      mhCtx.drawImage(hairOnlyC, hDestX, hDestY, hDestW, hDestH);

      // Spherical gloss highlight arc (top right / top left)
      mhCtx.beginPath();
      mhCtx.arc(bcX, bcY, bRad - 20, -Math.PI * 0.82, -Math.PI * 0.38, false);
      mhCtx.strokeStyle = 'rgba(255, 255, 255, 0.70)';
      mhCtx.lineWidth = 14;
      mhCtx.lineCap = 'round';
      mhCtx.stroke();

      mhCtx.beginPath();
      mhCtx.arc(bcX, bcY, bRad - 20, -Math.PI * 0.72, -Math.PI * 0.48, false);
      mhCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      mhCtx.lineWidth = 6;
      mhCtx.lineCap = 'round';
      mhCtx.stroke();

      // Cyan rim on top/sides only (stops well before collar level at -0.88pi to -0.12pi)
      mhCtx.beginPath();
      mhCtx.arc(bcX, bcY, bRad - 4, -Math.PI * 0.88, -Math.PI * 0.12, false);
      mhCtx.strokeStyle = 'rgba(120, 240, 255, 0.60)';
      mhCtx.lineWidth = 6;
      mhCtx.stroke();

      mhCtx.restore();

      // Antialias outer edge of glass dome
      const imgData = mhCtx.getImageData(0, 0, 1024, 1024);
      const pData = imgData.data;
      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const dx = x - bcX;
          const dy = y - bcY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > bRad + 1) {
            pData[idx + 3] = 0;
          } else if (dist > bRad - 2) {
            pData[idx + 3] = Math.round(pData[idx + 3] * Math.max(0, Math.min(1, (bRad + 1 - dist) / 3)));
          }
        }
      }
      mhCtx.putImageData(imgData, 0, 0);

      // -------------------------------------------------------------
      // 3. COMPOSITE ONTO ALL 8 FRAMES OF dili_runner_sheet.png
      // -------------------------------------------------------------
      const finalSheet = document.createElement('canvas');
      finalSheet.width = 3072; finalSheet.height = 384;
      const sCtx = finalSheet.getContext('2d');

      const frameCoords = [
        { cx: 153.5, cy: 100.0, rad: 86.0 },
        { cx: 224.5, cy: 101.5, rad: 87.5 },
        { cx: 228.0, cy: 100.5, rad: 88.0 },
        { cx: 227.0, cy: 100.5, rad: 88.0 },
        { cx: 227.5, cy: 99.0,  rad: 87.5 },
        { cx: 229.5, cy: 99.0,  rad: 87.5 },
        { cx: 229.5, cy: 96.5,  rad: 87.5 },
        { cx: 230.0, cy: 95.5,  rad: 87.0 }
      ];

      for (let f = 0; f < 8; f++) {
        const { cx, cy, rad } = frameCoords[f];
        const scale = rad / bRad;
        const destW = 1024 * scale;
        const destH = 1024 * scale;
        const destX = (f * 384) + cx - (bcX * scale);
        const destY = cy - (bcY * scale);

        // 1. Draw new head on sheet
        sCtx.drawImage(masterHead, destX, destY, destW, destH);

        // 2. Extract existing body for this frame from originalSheet
        const frameC = document.createElement('canvas');
        frameC.width = 384; frameC.height = 384;
        const fCtx = frameC.getContext('2d');
        fCtx.drawImage(originalSheet, f * 384, 0, 384, 384, 0, 0, 384, 384);

        const fd = fCtx.getImageData(0, 0, 384, 384);
        const fdp = fd.data;

        // Dynamic collar contour for this frame's bobbing
        const centerCollarY = cy + rad - 4.5;

        for (let y = 0; y < 384; y++) {
          for (let x = 0; x < 384; x++) {
            const idx = (y * 384 + x) * 4;
            const r = fdp[idx], g = fdp[idx+1], b = fdp[idx+2];
            const dx = Math.abs(x - cx);

            // Parabolic collar contour:
            const collarCutoff = centerCollarY - Math.min(12.0, Math.pow(dx / 48, 2) * 8.0);

            // Detect old glass rim / old neck:
            const isOldGlassRemnant = (y < centerCollarY + 5) && (Math.abs(r - g) < 25 || (r > 155 && g > 150));

            if (y < collarCutoff - 1 || isOldGlassRemnant) {
              fdp[idx + 3] = 0; // erase old head & neck completely
            } else if (y < collarCutoff + 1) {
              fdp[idx + 3] = Math.round(fdp[idx + 3] * ((y - (collarCutoff - 1)) / 2));
            }
          }
        }
        fCtx.putImageData(fd, 0, 0);

        // Draw body with hugged collar in front
        sCtx.drawImage(frameC, f * 384, 0);
      }

      return {
        sheet: finalSheet.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('public/assets/dili_runner_sheet.png', Buffer.from(res.result.value.sheet, 'base64'));
  console.log('Successfully updated public/assets/dili_runner_sheet.png');
  ws.close();
  p.kill();
}
buildFinalRunnerSheet().catch(console.error);
