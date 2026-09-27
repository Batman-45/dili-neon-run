const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function testPerfectComposite() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9328',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9328/json/list', r => {
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

      // 1. Isolate and enhance the 3D afro hair
      const hairCanvas = document.createElement('canvas');
      hairCanvas.width = 1024; hairCanvas.height = 1024;
      const hCtx = hairCanvas.getContext('2d');
      hCtx.drawImage(src3D, 0, 0);

      const bcX = 512;
      const bcY = 460;
      const bRad = 390;

      // Extract hair mask and recolor to vibrant royal purple
      const hImgData = hCtx.getImageData(0, 0, 1024, 1024);
      const hp = hImgData.data;

      // Find hair pixels and transform them
      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const r = hp[idx], g = hp[idx+1], b = hp[idx+2];

          // Hair is the dark purple mass in the center
          const dx = x - bcX;
          const dy = y - 450;
          const dist = Math.sqrt(dx*dx + dy*dy);

          const isHair = (dist < 325) && (y < 735) && (r < 120 && g < 80 && b < 140) && (b >= g - 2);

          if (isHair) {
            // Relative luminance of 3D form shading (0 to 1)
            const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 80;

            // Map to rich Dili mascot palette:
            // Deep shadows: #350f4c (53, 15, 76)
            // Midtones:     #631e94 (99, 30, 148)
            // Highlights:   #8a32cc (138, 50, 204)
            // Top sheen:    #a855f7 (168, 85, 247)
            let nR, nG, nB;
            if (lum < 0.4) {
              const t = lum / 0.4;
              nR = 45 + t * 45;
              nG = 12 + t * 18;
              nB = 68 + t * 65;
            } else if (lum < 0.75) {
              const t = (lum - 0.4) / 0.35;
              nR = 90 + t * 48;
              nG = 30 + t * 20;
              nB = 133 + t * 65;
            } else {
              const t = (lum - 0.75) / 0.25;
              nR = 138 + t * 30;
              nG = 50 + t * 35;
              nB = 198 + t * 49;
            }

            // Keep the natural 3D noise/shading
            hp[idx]     = Math.min(255, Math.round(nR * 0.88 + r * 0.12));
            hp[idx + 1] = Math.min(255, Math.round(nG * 0.88 + g * 0.12));
            hp[idx + 2] = Math.min(255, Math.round(nB * 0.88 + b * 0.12));
            hp[idx + 3] = 255;
          } else {
            hp[idx + 3] = 0; // transparent outside hair
          }
        }
      }
      hCtx.putImageData(hImgData, 0, 0);

      // Add soft volumetric curl highlights to enhance readability at small sizes
      // 14 natural curl lobe centers
      const lobes = [
        { x: 0,   y: 260, r: 75, s: 0.30 },
        { x: -70, y: 280, r: 75, s: 0.32 },
        { x: 70,  y: 280, r: 75, s: 0.32 },
        { x: -140,y: 330, r: 75, s: 0.28 },
        { x: 140, y: 330, r: 75, s: 0.28 },
        { x: -190,y: 410, r: 75, s: 0.26 },
        { x: 190, y: 410, r: 75, s: 0.26 },
        { x: -210,y: 500, r: 75, s: 0.24 },
        { x: 210, y: 500, r: 75, s: 0.24 },
        { x: -180,y: 590, r: 75, s: 0.22 },
        { x: 180, y: 590, r: 75, s: 0.22 },
        // Crown centers
        { x: -60, y: 380, r: 85, s: 0.35 },
        { x: 60,  y: 380, r: 85, s: 0.35 },
        { x: 0,   y: 470, r: 90, s: 0.30 },
      ];

      hCtx.save();
      for (const lb of lobes) {
        const lx = bcX + lb.x;
        const ly = lb.y;
        const grad = hCtx.createRadialGradient(
          lx - lb.r * 0.25, ly - lb.r * 0.35, 1,
          lx, ly, lb.r
        );
        grad.addColorStop(0, \`rgba(216, 180, 254, \${lb.s})\`);
        grad.addColorStop(0.4, \`rgba(168, 85, 247, \${lb.s * 0.7})\`);
        grad.addColorStop(0.8, \`rgba(107, 33, 168, \${lb.s * 0.25})\`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        hCtx.fillStyle = grad;
        hCtx.beginPath();
        hCtx.arc(lx, ly, lb.r, 0, Math.PI * 2);
        hCtx.fill();
      }
      hCtx.restore();

      // -------------------------------------------------------------
      // 2. BUILD COMPOSITE REAR HEAD AT 1024x1024
      // -------------------------------------------------------------
      const masterCanvas = document.createElement('canvas');
      masterCanvas.width = 1024; masterCanvas.height = 1024;
      const mCtx = masterCanvas.getContext('2d');

      // Clip to spherical glass dome
      mCtx.save();
      mCtx.beginPath();
      mCtx.arc(bcX, bcY, bRad, 0, Math.PI * 2);
      mCtx.clip();

      // Interior atmosphere
      const voidGrad = mCtx.createRadialGradient(bcX - 30, bcY - 50, 40, bcX, bcY, bRad);
      voidGrad.addColorStop(0, 'rgba(38, 12, 58, 0.35)');
      voidGrad.addColorStop(0.7, 'rgba(20, 5, 34, 0.55)');
      voidGrad.addColorStop(1, 'rgba(8, 1, 16, 0.85)');
      mCtx.fillStyle = voidGrad;
      mCtx.fillRect(0, 0, 1024, 1024);

      // DRAW HAIR LOWERED BY 72 PIXELS:
      // In original, hair was at Y ~ 200..735 (bottom at 735, neck went to 850).
      // When lowered by 72px:
      // Top of hair is at Y = 272 (leaving clear glass dome above)
      // Bottom of hair is at Y = 807 (SITS RIGHT IN THE HOODIE COLLAR AT 810!)
      // ZERO VISIBLE NECK STEM!
      mCtx.drawImage(hairCanvas, 0, 72);

      // Glass specular reflection highlights (upper hemisphere only)
      mCtx.beginPath();
      mCtx.arc(bcX, bcY, bRad - 18, -Math.PI * 0.82, -Math.PI * 0.36, false);
      mCtx.strokeStyle = 'rgba(255, 255, 255, 0.60)';
      mCtx.lineWidth = 14;
      mCtx.lineCap = 'round';
      mCtx.stroke();

      mCtx.beginPath();
      mCtx.arc(bcX, bcY, bRad - 18, -Math.PI * 0.72, -Math.PI * 0.46, false);
      mCtx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
      mCtx.lineWidth = 6;
      mCtx.lineCap = 'round';
      mCtx.stroke();

      // Cyan rim along top and sides (stops at collar level, angles -0.92pi to -0.08pi)
      // NO GLASS LINE CROSSING THE NECK!
      mCtx.beginPath();
      mCtx.arc(bcX, bcY, bRad - 4, -Math.PI * 0.92, -Math.PI * 0.08, false);
      mCtx.strokeStyle = 'rgba(120, 240, 255, 0.50)';
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
      // 3. COMPOSITE ONTO FRAME 1 AT GAMEPLAY RESOLUTION (384x384)
      // -------------------------------------------------------------
      const testC = document.createElement('canvas');
      testC.width = 384; testC.height = 384;
      const tCtx = testC.getContext('2d');

      // Draw original frame 1
      tCtx.drawImage(f1, 0, 0);

      // Clear old head above collar (y <= 176)
      const f1Data = tCtx.getImageData(0, 0, 384, 384);
      const fp = f1Data.data;
      const oldCx = 224.5;
      const oldCy = 101.5;
      const oldRad = 87.5;

      for (let y = 0; y < 185; y++) {
        for (let x = 0; x < 384; x++) {
          const idx = (y * 384 + x) * 4;
          const dx = x - oldCx;
          const dy = y - oldCy;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < oldRad + 1) {
            if (y <= 176) {
              fp[idx + 3] = 0;
            } else {
              // Smooth gradient into 3D hoodie collar
              const alpha = (y - 176) / 8;
              fp[idx + 3] = Math.round(fp[idx + 3] * alpha);
            }
          }
        }
      }
      tCtx.putImageData(f1Data, 0, 0);

      // Draw redesigned head:
      const scale = oldRad / bRad;
      const destW = 1024 * scale;
      const destH = 1024 * scale;
      const destX = oldCx - (bcX * scale);
      const destY = oldCy - (bcY * scale);

      tCtx.drawImage(masterCanvas, destX, destY, destW, destH);

      return {
        masterHead: masterCanvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''),
        testFrame: testC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/master_head_v6.png', Buffer.from(res.result.value.masterHead, 'base64'));
  fs.writeFileSync('test-screenshots/test_frame1_v6.png', Buffer.from(res.result.value.testFrame, 'base64'));
  console.log('Saved master_head_v6.png and test_frame1_v6.png');
  ws.close();
  p.kill();
}

testPerfectComposite().catch(console.error);
