const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

async function rebuildRunnerSheet() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9305',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9305/json/list', r => {
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

  const sheetB64 = fs.readFileSync('public/assets/dili_runner_sheet.png').toString('base64');
  const headB64 = fs.readFileSync('C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\d86d48cc-c83b-4c0a-a996-4889df60c7b4\\dili_rear_head_test_1790327217548.jpg').toString('base64');

  const script = `
    (async () => {
      const load = (b64, mime='image/png') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });
      const sheet = await load('${sheetB64}', 'image/png');
      const headImg = await load('${headB64}', 'image/jpeg');

      // 1. Build high-resolution isolated head asset (1024x1024)
      const hc = document.createElement('canvas');
      hc.width = 1024; hc.height = 1024;
      const hctx = hc.getContext('2d');
      hctx.drawImage(headImg, 0, 0);

      const hData = hctx.getImageData(0, 0, 1024, 1024);
      const hp = hData.data;

      const bcX = 512;
      const bcY = 460;
      const bRad = 390;

      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const dx = x - bcX;
          const dy = y - bcY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= bRad - 2) {
            // Interior: perfectly preserved
          } else if (dist <= bRad + 1) {
            // Antialias outer perimeter of the glass bubble
            const alpha = (bRad + 1 - dist) / 3;
            hp[idx + 3] = Math.round(hp[idx + 3] * Math.max(0, Math.min(1, alpha)));
          } else {
            // Outside sphere:
            // Soft pink collar under helmet center to blend seamlessly into hoodie
            const collarCenterY = 850;
            const collarBottomY = 895;
            if (y >= collarCenterY && y <= collarBottomY && Math.abs(dx) < 160) {
              const r = hp[idx], g = hp[idx+1], b = hp[idx+2];
              if (r > 240 && g > 240 && b > 240) {
                hp[idx + 3] = 0; // white background
              } else {
                const dyCollar = (y - collarCenterY) / (collarBottomY - collarCenterY);
                const dxCollar = Math.abs(dx) / 160;
                const falloff = Math.max(0, 1 - Math.sqrt(dyCollar * dyCollar + dxCollar * dxCollar));
                hp[idx + 3] = Math.round(hp[idx + 3] * falloff);
              }
            } else {
              hp[idx + 3] = 0;
            }
          }
        }
      }
      hctx.putImageData(hData, 0, 0);

      // Add delicate glossy glass reflection highlight:
      hctx.save();
      // Curved upper specular reflection
      hctx.beginPath();
      hctx.arc(bcX, bcY, bRad - 18, -Math.PI * 0.82, -Math.PI * 0.38, false);
      hctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      hctx.lineWidth = 14;
      hctx.lineCap = 'round';
      hctx.stroke();

      // Sharp central glossy specular shine
      hctx.beginPath();
      hctx.arc(bcX, bcY, bRad - 18, -Math.PI * 0.72, -Math.PI * 0.48, false);
      hctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      hctx.lineWidth = 7;
      hctx.lineCap = 'round';
      hctx.stroke();

      // Subtle cyan outer rim glow
      hctx.beginPath();
      hctx.arc(bcX, bcY, bRad - 6, -Math.PI * 0.9, 0, false);
      hctx.strokeStyle = 'rgba(120, 240, 255, 0.28)';
      hctx.lineWidth = 8;
      hctx.stroke();
      hctx.restore();

      // 2. Head parameters per frame:
      // Verified exact centers and natural athletic stride bob:
      const frameParams = [
        { cx: 153.5, cy: 100.0, rad: 86.0, rot: 0 },
        { cx: 224.5, cy: 101.5, rad: 87.5, rot: -0.015 },
        { cx: 228.0, cy: 100.5, rad: 88.0, rot: -0.008 },
        { cx: 227.0, cy: 100.5, rad: 88.0, rot: 0 },
        { cx: 227.5, cy: 99.0,  rad: 87.5, rot: 0.008 },
        { cx: 229.5, cy: 99.0,  rad: 87.5, rot: 0.015 },
        { cx: 229.5, cy: 96.5,  rad: 87.5, rot: 0.010 },
        { cx: 230.0, cy: 95.5,  rad: 87.0, rot: 0.000 },
      ];

      // 3. Process the full 3072 x 384 sprite sheet
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = 3072;
      finalCanvas.height = 384;
      const fCtx = finalCanvas.getContext('2d');
      fCtx.imageSmoothingEnabled = true;
      fCtx.imageSmoothingQuality = 'high';

      // Draw original entire sheet first (keeps boots, legs, body, backpack, cape 100% intact)
      fCtx.drawImage(sheet, 0, 0);

      // In each frame, cleanly remove old head and composite new official Dili rear head
      for (let f = 0; f < 8; f++) {
        const ox = f * 384;
        const p = frameParams[f];

        // Clear old head pixels in slot
        const slotData = fCtx.getImageData(ox, 0, 384, 384);
        const sp = slotData.data;

        for (let y = 0; y < 185; y++) {
          for (let x = 0; x < 384; x++) {
            const idx = (y * 384 + x) * 4;
            const dx = x - p.cx;
            const dy = y - p.cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < p.rad) {
              if (y <= 174) {
                sp[idx + 3] = 0;
              } else {
                const blend = (y - 174) / 11;
                sp[idx + 3] = Math.round(sp[idx + 3] * blend);
              }
            }
          }
        }
        fCtx.putImageData(slotData, ox, 0);

        // Draw new head:
        const scale = p.rad / bRad;
        const dw = 1024 * scale;
        const dh = 1024 * scale;
        const dx = ox + p.cx - (bcX * scale);
        const dy = p.cy - (bcY * scale);

        fCtx.save();
        if (p.rot !== 0) {
          fCtx.translate(ox + p.cx, p.cy);
          fCtx.rotate(p.rot);
          fCtx.drawImage(hc, -(bcX * scale), -(bcY * scale), dw, dh);
        } else {
          fCtx.drawImage(hc, dx, dy, dw, dh);
        }
        fCtx.restore();
      }

      return finalCanvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  const outPath = path.resolve('public/assets/dili_runner_sheet.png');

  // Backup previous sheet first
  fs.copyFileSync(outPath, path.resolve('public/assets/dili_runner_sheet_backup.png'));
  fs.writeFileSync(outPath, Buffer.from(res.result.value, 'base64'));
  console.log(`Successfully updated ${outPath} (${fs.statSync(outPath).size} bytes)`);

  ws.close();
  p.kill();
}

rebuildRunnerSheet().catch(console.error);
