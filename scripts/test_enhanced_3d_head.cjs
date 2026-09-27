const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function testEnhanced3DHead() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9322',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9322/json/list', r => {
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

      // 1024x1024 work canvas
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 1024;
      const ctx = c.getContext('2d');
      ctx.drawImage(src3D, 0, 0);

      const bcX = 512;
      const bcY = 460;
      const bRad = 390;

      const imgData = ctx.getImageData(0, 0, 1024, 1024);
      const data = imgData.data;

      // -------------------------------------------------------------
      // 1. IDENTIFY HAIR PIXELS AND COLOR GRADE TO VIBRANT ROYAL PURPLE
      // Hair is inside x: 200..824, y: 150..770
      // In src3D, hair has r: 20..75, g: 15..55, b: 35..95
      // -------------------------------------------------------------
      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          // Check if pixel is part of the hair
          // Hair is dark purple/charcoal where b > g, r > g*0.9, and brightness is low-to-mid
          const isHair = (y > 140 && y < 760 && Math.abs(x - bcX) < 330) &&
                         (b > g + 4) && (r < 110) && (g < 75) && (b < 130);

          if (isHair) {
            // Calculate relative lightness/shading of hair
            const lum = (r * 0.3 + g * 0.4 + b * 0.3) / 100; // 0.0 to 1.0

            // Target colors:
            // Deep shadows (lum < 0.3): #2c0b42 -> #3b1456
            // Midtones (lum 0.3..0.6): #5e228c -> #6b21a8
            // Highlights (lum > 0.6): #7b2cb8 -> #9d4edd

            let targetR, targetG, targetB;
            if (lum < 0.35) {
              const t = lum / 0.35;
              targetR = 40 + t * 45; // 40..85
              targetG = 12 + t * 18; // 12..30
              targetB = 65 + t * 65; // 65..130
            } else if (lum < 0.7) {
              const t = (lum - 0.35) / 0.35;
              targetR = 85 + t * 45;  // 85..130
              targetG = 30 + t * 20;  // 30..50
              targetB = 130 + t * 60; // 130..190
            } else {
              const t = (lum - 0.7) / 0.3;
              targetR = 130 + t * 40; // 130..170
              targetG = 50 + t * 35;  // 50..85
              targetB = 190 + t * 45; // 190..235
            }

            // Blend 85% new vibrant purple with 15% original texture luminance
            data[idx]     = Math.min(255, Math.round(targetR * 0.9 + r * 0.1));
            data[idx + 1] = Math.min(255, Math.round(targetG * 0.9 + g * 0.1));
            data[idx + 2] = Math.min(255, Math.round(targetB * 0.9 + b * 0.1));
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // -------------------------------------------------------------
      // 2. ELIMINATE THE VISIBLE NECK STEM
      // In src3D, the pink neck extends from y = 730 to 850 in x: 420..604.
      // Dili must have NO visible neck. The purple curly afro should
      // extend down to y = 825, nestling right into the collar!
      // We sample lower afro curl texture and tile/stamp it over the neck stem.
      // -------------------------------------------------------------
      ctx.save();
      // Clip to neck region (y: 720..830, x: 400..624)
      ctx.beginPath();
      ctx.ellipse(bcX, 775, 110, 55, 0, 0, Math.PI * 2);
      ctx.clip();

      // Draw lower curl texture downwards to fill the neck void
      ctx.drawImage(c, 0, -65, 1024, 1024);
      ctx.restore();

      // Darken and tint the newly added lower curl region to match deep lower hair
      const neckCoverData = ctx.getImageData(390, 720, 244, 115);
      const ncd = neckCoverData.data;
      for (let i = 0; i < ncd.length; i += 4) {
        if (ncd[i + 3] > 100) {
          // Dark royal purple shadow
          ncd[i]     = Math.min(255, Math.round(ncd[i] * 0.8 + 25));
          ncd[i + 1] = Math.min(255, Math.round(ncd[i + 1] * 0.5 + 8));
          ncd[i + 2] = Math.min(255, Math.round(ncd[i + 2] * 0.8 + 45));
        }
      }
      ctx.putImageData(neckCoverData, 390, 720);

      // -------------------------------------------------------------
      // 3. SCULPT READABLE 3D CURL CLUSTERS (12-16 SOFT VOLUMETRIC LOBES)
      // These soft radial volumetric highlights catch the light on each
      // curl cluster, ensuring readability at small gameplay distance!
      // -------------------------------------------------------------
      const curlClusters = [
        // Perimeter lobes
        { x: -140, y: 280, r: 80, strength: 0.28 },
        { x: -60,  y: 250, r: 85, strength: 0.32 },
        { x: 60,   y: 250, r: 85, strength: 0.32 },
        { x: 140,  y: 280, r: 80, strength: 0.28 },
        { x: -210, y: 360, r: 85, strength: 0.30 },
        { x: 210,  y: 360, r: 85, strength: 0.30 },
        { x: -240, y: 460, r: 85, strength: 0.26 },
        { x: 240,  y: 460, r: 85, strength: 0.26 },
        { x: -220, y: 560, r: 85, strength: 0.24 },
        { x: 220,  y: 560, r: 85, strength: 0.24 },
        { x: -160, y: 660, r: 85, strength: 0.20 },
        { x: 160,  y: 660, r: 85, strength: 0.20 },
        { x: -70,  y: 730, r: 85, strength: 0.16 },
        { x: 70,   y: 730, r: 85, strength: 0.16 },
        // Central crown lobes
        { x: -70,  y: 390, r: 90, strength: 0.35 },
        { x: 70,   y: 390, r: 90, strength: 0.35 },
        { x: 0,    y: 480, r: 95, strength: 0.30 },
        { x: -70,  y: 570, r: 90, strength: 0.25 },
        { x: 70,   y: 570, r: 90, strength: 0.25 },
      ];

      ctx.save();
      for (const cl of curlClusters) {
        const cx = bcX + cl.x;
        const cy = cl.y;
        const hGrad = ctx.createRadialGradient(
          cx - cl.r * 0.25, cy - cl.r * 0.35, 1,
          cx, cy, cl.r
        );
        hGrad.addColorStop(0, \`rgba(216, 180, 254, \${cl.strength * 1.2})\`); // soft lilac highlight
        hGrad.addColorStop(0.35, \`rgba(168, 85, 247, \${cl.strength * 0.8})\`); // vibrant violet
        hGrad.addColorStop(0.7, \`rgba(107, 33, 168, \${cl.strength * 0.3})\`);
        hGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = hGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, cl.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // -------------------------------------------------------------
      // 4. CLEAN SPHERICAL GLASS SILHOUETTE WITH NESTED COLLAR
      // -------------------------------------------------------------
      const finalHeadCanvas = document.createElement('canvas');
      finalHeadCanvas.width = 1024;
      finalHeadCanvas.height = 1024;
      const fCtx = finalHeadCanvas.getContext('2d');

      // Draw processed 3D head
      fCtx.drawImage(c, 0, 0);

      // Mask outside the glass sphere (smooth antialiased edge)
      // BUT keep the soft pink hoodie collar at the bottom (y > 810)
      const outData = fCtx.getImageData(0, 0, 1024, 1024);
      const op = outData.data;

      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const dx = x - bcX;
          const dy = y - bcY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > bRad + 1) {
            // Check if it's the pink hoodie collar below the sphere (y > 805)
            if (y > 805 && y < 915 && Math.abs(dx) < 220) {
              const r = op[idx], g = op[idx+1], b = op[idx+2];
              // Background white
              if (r > 240 && g > 240 && b > 240) {
                op[idx + 3] = 0;
              } else if (y > 880) {
                // Soft bottom fade
                const fade = Math.max(0, 1 - (y - 880) / 35);
                op[idx + 3] = Math.round(op[idx + 3] * fade);
              }
            } else {
              op[idx + 3] = 0;
            }
          } else if (dist > bRad - 2) {
            // Antialias outer glass bubble edge
            const alpha = Math.max(0, Math.min(1, (bRad + 1 - dist) / 3));
            op[idx + 3] = Math.round(op[idx + 3] * alpha);
          }
        }
      }
      fCtx.putImageData(outData, 0, 0);

      // Add upper glass specular gloss arc & subtle cyan rim
      fCtx.save();
      fCtx.beginPath();
      fCtx.arc(bcX, bcY, bRad - 18, -Math.PI * 0.82, -Math.PI * 0.36, false);
      fCtx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      fCtx.lineWidth = 14;
      fCtx.lineCap = 'round';
      fCtx.stroke();

      fCtx.beginPath();
      fCtx.arc(bcX, bcY, bRad - 18, -Math.PI * 0.72, -Math.PI * 0.46, false);
      fCtx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
      fCtx.lineWidth = 6;
      fCtx.lineCap = 'round';
      fCtx.stroke();

      // Cyan rim along top and sides (avoid bottom collar seam)
      fCtx.beginPath();
      fCtx.arc(bcX, bcY, bRad - 5, -Math.PI * 0.95, -Math.PI * 0.05, false);
      fCtx.strokeStyle = 'rgba(120, 240, 255, 0.40)';
      fCtx.lineWidth = 7;
      fCtx.stroke();
      fCtx.restore();

      // -------------------------------------------------------------
      // 5. TEST COMPOSITE ONTO FRAME 1 (At standard runner size)
      // -------------------------------------------------------------
      const testC = document.createElement('canvas');
      testC.width = 384; testC.height = 384;
      const tCtx = testC.getContext('2d');

      // Draw original frame 1
      tCtx.drawImage(f1, 0, 0);

      // Erase old head from frame 1
      const f1Data = tCtx.getImageData(0, 0, 384, 384);
      const fp = f1Data.data;
      const oldCx = 224.5;
      const oldCy = 101.5;
      const oldRad = 87.5;

      for (let y = 0; y < 186; y++) {
        for (let x = 0; x < 384; x++) {
          const idx = (y * 384 + x) * 4;
          const dx = x - oldCx;
          const dy = y - oldCy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < oldRad) {
            if (y <= 176) {
              fp[idx + 3] = 0;
            } else {
              const blend = (y - 176) / 10;
              fp[idx + 3] = Math.round(fp[idx + 3] * blend);
            }
          }
        }
      }
      tCtx.putImageData(f1Data, 0, 0);

      // Draw redesigned head (radius = 87.5)
      const scale = oldRad / bRad;
      const destW = 1024 * scale;
      const destH = 1024 * scale;
      const destX = oldCx - (bcX * scale);
      const destY = oldCy - (bcY * scale);

      tCtx.drawImage(finalHeadCanvas, destX, destY, destW, destH);

      return {
        masterHead: finalHeadCanvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''),
        testFrame: testC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/master_head_v4.png', Buffer.from(res.result.value.masterHead, 'base64'));
  fs.writeFileSync('test-screenshots/test_frame1_v4.png', Buffer.from(res.result.value.testFrame, 'base64'));
  console.log('Saved master_head_v4.png and test_frame1_v4.png');
  ws.close();
  p.kill();
}

testEnhanced3DHead().catch(console.error);
