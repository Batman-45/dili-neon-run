const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function testCleanHugV9() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9335',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9335/json/list', r => {
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

  const head3DB64 = fs.readFileSync('C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\d86d48cc-c83b-4c0a-a996-4889df60c7b4\\dili_rear_head_test_1790327217548.jpg').toString('base64');
  const f1B64 = fs.readFileSync('test-screenshots/frames/frame_1.png').toString('base64');

  const script = `
    (async () => {
      const load = (b64, mime='image/png') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });
      const f1 = await load('${f1B64}', 'image/png');
      const src3D = await load('${head3DB64}', 'image/jpeg');

      const bcX = 512;
      const bcY = 460;
      const bRad = 390;

      // 1. Isolate and enhance the 3D afro hair
      const hairCanvas = document.createElement('canvas');
      hairCanvas.width = 1024; hairCanvas.height = 1024;
      const hCtx = hairCanvas.getContext('2d');
      hCtx.drawImage(src3D, 0, 0);

      const hImgData = hCtx.getImageData(0, 0, 1024, 1024);
      const hp = hImgData.data;

      // Recolor to rich royal purple & fill neck stem with lower curl volume
      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const r = hp[idx], g = hp[idx+1], b = hp[idx+2];

          const dx = x - bcX;
          const dy = y - 460;
          const dist = Math.sqrt(dx*dx + dy*dy);

          const isMainHair = (dist < 320) && (y < 735) && (r < 120 && g < 80 && b < 140) && (b >= g - 2);
          const isNeckToHair = (y >= 730 && y <= 830 && Math.abs(dx) < 140 && dist < 370);

          if (isMainHair) {
            const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 80;

            let nR, nG, nB;
            if (lum < 0.4) {
              const t = lum / 0.4;
              nR = 52 + t * 45; // 52..97 (#340f4e base)
              nG = 15 + t * 18; // 15..33
              nB = 78 + t * 65; // 78..143
            } else if (lum < 0.75) {
              const t = (lum - 0.4) / 0.35;
              nR = 97 + t * 45;  // 97..142 (#611e8e body)
              nG = 33 + t * 20;  // 33..53
              nB = 143 + t * 65; // 143..208
            } else {
              const t = (lum - 0.75) / 0.25;
              nR = 142 + t * 30; // 142..172 (#8e2ec8 highlights)
              nG = 53 + t * 35;  // 53..88
              nB = 208 + t * 40; // 208..248
            }

            hp[idx]     = Math.min(255, Math.round(nR * 0.90 + r * 0.10));
            hp[idx + 1] = Math.min(255, Math.round(nG * 0.90 + g * 0.10));
            hp[idx + 2] = Math.min(255, Math.round(nB * 0.90 + b * 0.10));
            hp[idx + 3] = 255;
          } else if (isNeckToHair) {
            // Replace neck stem with deep purple lower curls
            const falloff = Math.max(0, 1 - Math.max(0, y - 805) / 25);
            hp[idx]     = 46;
            hp[idx + 1] = 12;
            hp[idx + 2] = 68;
            hp[idx + 3] = Math.round(255 * falloff);
          } else {
            hp[idx + 3] = 0;
          }
        }
      }
      hCtx.putImageData(hImgData, 0, 0);

      // Add 16 volumetric rounded curl highlights for crisp readability at 100px
      const lobes = [
        { x: 0,    y: 260, r: 75, s: 0.35 },
        { x: -70,  y: 280, r: 75, s: 0.36 },
        { x: 70,   y: 280, r: 75, s: 0.36 },
        { x: -140, y: 330, r: 75, s: 0.32 },
        { x: 140,  y: 330, r: 75, s: 0.32 },
        { x: -190, y: 410, r: 75, s: 0.30 },
        { x: 190,  y: 410, r: 75, s: 0.30 },
        { x: -210, y: 500, r: 75, s: 0.28 },
        { x: 210,  y: 500, r: 75, s: 0.28 },
        { x: -180, y: 590, r: 75, s: 0.26 },
        { x: 180,  y: 590, r: 75, s: 0.26 },
        { x: -110, y: 670, r: 75, s: 0.24 },
        { x: 110,  y: 670, r: 75, s: 0.24 },
        { x: 0,    y: 710, r: 80, s: 0.22 },
        // Crown centers
        { x: -60,  y: 380, r: 85, s: 0.40 },
        { x: 60,   y: 380, r: 85, s: 0.40 },
        { x: 0,    y: 470, r: 90, s: 0.36 },
      ];

      hCtx.save();
      for (const lb of lobes) {
        const lx = bcX + lb.x;
        const ly = lb.y;
        const grad = hCtx.createRadialGradient(
          lx - lb.r * 0.25, ly - lb.r * 0.35, 1,
          lx, ly, lb.r
        );
        grad.addColorStop(0, \`rgba(224, 195, 255, \${lb.s})\`);
        grad.addColorStop(0.4, \`rgba(168, 85, 247, \${lb.s * 0.75})\`);
        grad.addColorStop(0.8, \`rgba(107, 33, 168, \${lb.s * 0.25})\`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        hCtx.fillStyle = grad;
        hCtx.beginPath();
        hCtx.arc(lx, ly, lb.r, 0, Math.PI * 2);
        hCtx.fill();
      }
      hCtx.restore();

      // -------------------------------------------------------------
      // 2. MASTER 1024x1024 REAR HEAD COMPOSITE
      // -------------------------------------------------------------
      const masterCanvas = document.createElement('canvas');
      masterCanvas.width = 1024; masterCanvas.height = 1024;
      const mCtx = masterCanvas.getContext('2d');

      // Clip to spherical glass dome
      mCtx.save();
      mCtx.beginPath();
      mCtx.arc(bcX, bcY, bRad, 0, Math.PI * 2);
      mCtx.clip();

      // Crystal-clear subtle glass sheen
      const glassGrad = mCtx.createRadialGradient(bcX - 60, bcY - 80, 50, bcX, bcY, bRad);
      glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
      glassGrad.addColorStop(0.5, 'rgba(120, 240, 255, 0.04)');
      glassGrad.addColorStop(0.85, 'rgba(80, 20, 120, 0.06)');
      glassGrad.addColorStop(1, 'rgba(0, 240, 255, 0.20)');
      mCtx.fillStyle = glassGrad;
      mCtx.fillRect(0, 0, 1024, 1024);

      // Draw hair lowered by 50px:
      // Sits directly into collar (y: 250 to 880)
      // ZERO visible neck stem!
      mCtx.drawImage(hairCanvas, 0, 50);

      // Curved upper specular gloss arc
      mCtx.beginPath();
      mCtx.arc(bcX, bcY, bRad - 18, -Math.PI * 0.82, -Math.PI * 0.36, false);
      mCtx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      mCtx.lineWidth = 14;
      mCtx.lineCap = 'round';
      mCtx.stroke();

      mCtx.beginPath();
      mCtx.arc(bcX, bcY, bRad - 18, -Math.PI * 0.72, -Math.PI * 0.46, false);
      mCtx.strokeStyle = 'rgba(255, 255, 255, 0.90)';
      mCtx.lineWidth = 6;
      mCtx.lineCap = 'round';
      mCtx.stroke();

      // Cyan outer rim glow along top and sides ONLY
      // Stops cleanly above collar line (-0.88pi to -0.12pi), so NO LINE cuts across neck!
      mCtx.beginPath();
      mCtx.arc(bcX, bcY, bRad - 4, -Math.PI * 0.88, -Math.PI * 0.12, false);
      mCtx.strokeStyle = 'rgba(120, 240, 255, 0.55)';
      mCtx.lineWidth = 6;
      mCtx.stroke();

      mCtx.restore(); // end clip

      // Antialias outer perimeter of the glass sphere
      const mData = mCtx.getImageData(0, 0, 1024, 1024);
      const mp = mData.data;
      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const dx = x - bcX;
          const dy = y - bcY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > bRad + 1) {
            mp[idx + 3] = 0;
          } else if (dist > bRad - 2) {
            const alpha = (bRad + 1 - dist) / 3;
            mp[idx + 3] = Math.round(mp[idx + 3] * Math.max(0, Math.min(1, alpha)));
          }
        }
      }
      mCtx.putImageData(mData, 0, 0);

      // -------------------------------------------------------------
      // 3. SEAMLESS COMPOSITING WITH HOODIE IN FRONT
      // -------------------------------------------------------------
      const testC = document.createElement('canvas');
      testC.width = 384; testC.height = 384;
      const tCtx = testC.getContext('2d');

      const oldCx = 224.5;
      const oldCy = 101.5;
      const oldRad = 87.5;

      const scale = oldRad / bRad;
      const destW = 1024 * scale;
      const destH = 1024 * scale;
      const destX = oldCx - (bcX * scale);
      const destY = oldCy - (bcY * scale);

      // 1. Draw new head on clean canvas
      tCtx.drawImage(masterCanvas, destX, destY, destW, destH);

      // 2. Draw existing body/hoodie on top, but ONLY pixels where y >= 170
      // (This naturally puts the entire 3D pink hoodie collar and shoulders IN FRONT of the lower head!)
      const bodyCanvas = document.createElement('canvas');
      bodyCanvas.width = 384; bodyCanvas.height = 384;
      const bCtx = bodyCanvas.getContext('2d');
      bCtx.drawImage(f1, 0, 0);

      const bodyData = bCtx.getImageData(0, 0, 384, 384);
      const bp = bodyData.data;
      for (let y = 0; y < 384; y++) {
        for (let x = 0; x < 384; x++) {
          const idx = (y * 384 + x) * 4;
          // Only keep pixels below the neckline:
          // In the center (near oldCx), neckline is at y=174
          // On the sides, neckline goes up to y=168
          const dx = Math.abs(x - oldCx);
          const neckThreshold = (dx < 35) ? 174 : (dx < 65 ? 170 : 166);

          if (y < neckThreshold) {
            bp[idx + 3] = 0; // erase old head pixels above collar
          } else if (y < neckThreshold + 3) {
            // soft 3px blend at the very rim of the collar
            const alpha = (y - neckThreshold) / 3;
            bp[idx + 3] = Math.round(bp[idx + 3] * alpha);
          }
        }
      }
      bCtx.putImageData(bodyData, 0, 0);

      // Draw the body/collar on top!
      tCtx.drawImage(bodyCanvas, 0, 0);

      return {
        testFrame: testC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/test_clean_hug_v9.png', Buffer.from(res.result.value.testFrame, 'base64'));
  console.log('Saved test_clean_hug_v9.png');
  ws.close();
  p.kill();
}

testCleanHugV9().catch(console.error);
