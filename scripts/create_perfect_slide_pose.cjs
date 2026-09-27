const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9317;

async function createPerfectSlidePose() {
  const p = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));

  const list = await new Promise(res => http.get(`http://localhost:${port}/json/list`, r => {
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

  const slideJpgPath = 'C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\e1da6ab2-d590-402c-a5f4-7e543392a40f\\dili_slide_rear_clean_1790501174086.jpg';
  const slideB64 = fs.readFileSync(slideJpgPath).toString('base64');
  const runnerSheetB64 = fs.readFileSync('public/assets/dili_runner_sheet.png').toString('base64');
  const dLogoB64 = fs.existsSync('test-screenshots/ref_d_isolated.png')
    ? fs.readFileSync('test-screenshots/ref_d_isolated.png').toString('base64')
    : (fs.existsSync('test-screenshots/ref_rear_d_logo.png') ? fs.readFileSync('test-screenshots/ref_rear_d_logo.png').toString('base64') : '');

  const script = `
    (async () => {
      const load = (b64, mime='image/jpeg') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });

      const slideImg = await load('${slideB64}', 'image/jpeg');
      const runnerSheet = await load('${runnerSheetB64}', 'image/png');
      const dLogoImg = '${dLogoB64}' ? await load('${dLogoB64}', 'image/png') : null;

      // Extract official master head from frame 0 of runnerSheet
      // Frame 0 head: cx = 180, cy = 125, radius ~68px
      const frame0Canvas = document.createElement('canvas');
      frame0Canvas.width = 384; frame0Canvas.height = 384;
      const f0Ctx = frame0Canvas.getContext('2d');
      f0Ctx.drawImage(runnerSheet, 0, 0, 384, 384, 0, 0, 384, 384);

      // Isolate head from frame 0
      const headCanvas = document.createElement('canvas');
      headCanvas.width = 384; headCanvas.height = 384;
      const hCtx = headCanvas.getContext('2d');
      hCtx.drawImage(frame0Canvas, 0, 0);
      const hData = hCtx.getImageData(0, 0, 384, 384);
      for (let y = 0; y < 384; y++) {
        for (let x = 0; x < 384; x++) {
          const idx = (y * 384 + x) * 4;
          if (y > 182) {
            hData.data[idx + 3] = 0;
          } else if (y > 176) {
            hData.data[idx + 3] = Math.round(hData.data[idx + 3] * ((182 - y) / 6));
          }
        }
      }
      hCtx.putImageData(hData, 0, 0);

      // Now process slideImg body (cut out body from collar down to boots)
      const sw = slideImg.width, sh = slideImg.height;
      const sCanvas = document.createElement('canvas');
      sCanvas.width = sw; sCanvas.height = sh;
      const sCtx = sCanvas.getContext('2d');
      sCtx.drawImage(slideImg, 0, 0);

      const sData = sCtx.getImageData(0, 0, sw, sh);
      const sp = sData.data;

      // Cutout body below collar (y >= 400 in slideImg)
      // Cape is magenta (r > 120, g < 100, b > 120)
      // Pants/hoodie are pink (r > 180, g in [120, 180], b > 160)
      // Boots are white (r > 160, g > 160, b > 160, with shaded sole)
      // Background is grey/white (r > 200, g > 200, b > 200, abs(r-g) < 12 && abs(g-b) < 12)

      // Let's do an accurate flood fill for the background below y=400:
      const visited = new Uint8Array(sw * sh);
      const queue = new Int32Array(sw * sh);
      let qHead = 0, qTail = 0;

      // Seed left, right, and bottom edges
      for (let y = 400; y < sh; y++) {
        queue[qTail++] = y * sw + 0;
        queue[qTail++] = y * sw + (sw - 1);
        visited[y * sw + 0] = 1;
        visited[y * sw + (sw - 1)] = 1;
      }
      for (let x = 0; x < sw; x++) {
        queue[qTail++] = (sh - 1) * sw + x;
        visited[(sh - 1) * sw + x] = 1;
      }

      while (qHead < qTail) {
        const curr = queue[qHead++];
        const cx = curr % sw;
        const cy = Math.floor(curr / sw);

        const neighbors = [
          cy > 400 ? (cy - 1) * sw + cx : -1,
          cy < sh - 1 ? (cy + 1) * sw + cx : -1,
          cx > 0 ? cy * sw + (cx - 1) : -1,
          cx < sw - 1 ? cy * sw + (cx + 1) : -1
        ];

        for (const n of neighbors) {
          if (n >= 0 && visited[n] === 0) {
            const idx = n * 4;
            const r = sp[idx], g = sp[idx+1], b = sp[idx+2];
            const maxV = Math.max(r, g, b);
            const minV = Math.min(r, g, b);
            const diff = maxV - minV;
            const avg = (r + g + b) / 3;

            // Background condition:
            // High brightness and very low color difference
            let isBg = false;
            if (avg > 210 && diff < 16) isBg = true;
            else if (avg > 190 && diff < 10) isBg = true;
            // Floor shading under boots (grey shadow on floor)
            else if (cy > 950 && avg > 175 && diff < 12) isBg = true;

            if (isBg) {
              visited[n] = 1;
              queue[qTail++] = n;
            }
          }
        }
      }

      // Apply alpha to body
      for (let y = 400; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const idx = (y * sw + x) * 4;
          if (visited[y * sw + x] === 1) {
            const avg = (sp[idx] + sp[idx+1] + sp[idx+2]) / 3;
            if (avg > 235) {
              sp[idx + 3] = 0;
            } else if (avg > 200) {
              sp[idx + 3] = Math.round(((235 - avg) / 35) * 255);
            } else {
              sp[idx + 3] = 0;
            }
          } else {
            sp[idx + 3] = 255;
          }
        }
      }

      // Zero out anything above y=400 (we will use official head)
      for (let y = 0; y < 400; y++) {
        for (let x = 0; x < sw; x++) {
          const idx = (y * sw + x) * 4;
          sp[idx + 3] = 0;
        }
      }
      sCtx.putImageData(sData, 0, 0);

      // Find tight bounds of body
      let bMinX = sw, bMaxX = 0, bMinY = sh, bMaxY = 0;
      for (let y = 400; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const idx = (y * sw + x) * 4;
          if (sp[idx + 3] > 20) {
            if (x < bMinX) bMinX = x;
            if (x > bMaxX) bMaxX = x;
            if (y < bMinY) bMinY = y;
            if (y > bMaxY) bMaxY = y;
          }
        }
      }

      const bodyW = bMaxX - bMinX + 1;
      const bodyH = bMaxY - bMinY + 1;

      // Now assemble on standard 384x384 canvas
      // Target sizing:
      // Ground baseline: boots grounded at Y = 359 (exact same as normal running frames!)
      // Head: cx = 192 (centered in lane), head top at Y ~ 155, diameter = 137px (exact same size as normal running!)
      // Body: scaled so collar aligns with head bottom at Y ~ 265
      // Height of head: 119px (from 155 to 274)
      // Body spans from collar Y ~ 260 to baseline Y = 359 -> body height ~ 100px!
      // In original slideImg, body height is (bMaxY - bMinY) ~ 560px
      // So body scale = 100 / 560 = 0.178
      // And body width ~ 800 * 0.178 = 142px (matches character width!)
      const targetBodyH = 105;
      const bodyScale = targetBodyH / bodyH;
      const drawBodyW = Math.round(bodyW * bodyScale);
      const drawBodyH = targetBodyH;
      const drawBodyX = Math.round((384 - drawBodyW) / 2);
      const drawBodyY = 359 - drawBodyH; // grounded at 359

      const resultCanvas = document.createElement('canvas');
      resultCanvas.width = 384; resultCanvas.height = 384;
      const rCtx = resultCanvas.getContext('2d');

      // 1. Draw head first (or body first, then collar overlap)
      // Head center in slide:
      const headDiam = 137;
      const headH = 119;
      // Head bottom sits right in the pink hoodie collar!
      // In body, the collar is at top of body: drawBodyY
      // So head bottom should overlap slightly into collar:
      const headBottomY = drawBodyY + 18;
      const headTopY = headBottomY - headH;
      const headX = Math.round(192 - (headDiam / 2));

      // Draw head
      // In frame 0: head is at (112, 66) with w=137, h=119
      rCtx.drawImage(headCanvas, 112, 66, 137, 119, headX, headTopY, 137, 119);

      // 2. Draw body (collar naturally hugs the bottom of the helmet!)
      rCtx.drawImage(sCanvas, bMinX, bMinY, bodyW, bodyH, drawBodyX, drawBodyY, drawBodyW, drawBodyH);

      // 3. Draw iconic white "D" logo centered on the backpack/cape
      // Let's place the bold white D logo right in the center of the backpack:
      // Backpack center in draw coordinates:
      const bpX = 192;
      const bpY = drawBodyY + Math.round(drawBodyH * 0.38);

      // Draw high-visibility white D logo
      rCtx.save();
      rCtx.font = '900 24px "Inter", "Arial Black", sans-serif';
      rCtx.textAlign = 'center';
      rCtx.textBaseline = 'middle';
      // Subtle shadow/glow for pop
      rCtx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      rCtx.shadowBlur = 4;
      rCtx.shadowOffsetY = 1;
      rCtx.fillStyle = '#ffffff';
      rCtx.fillText('D', bpX, bpY);
      rCtx.restore();

      return {
        measurements: {
          bMinX, bMaxX, bMinY, bMaxY, bodyW, bodyH,
          drawBodyX, drawBodyY, drawBodyW, drawBodyH,
          headTopY, headBottomY, totalH: 359 - headTopY
        },
        png: resultCanvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Measurements:', JSON.stringify(res.result?.value?.measurements, null, 2));

  const outPath = 'test-screenshots/slide_candidates/perfect_slide_pose.png';
  fs.writeFileSync(outPath, Buffer.from(res.result.value.png, 'base64'));
  console.log('Saved to', outPath);

  ws.close();
  p.kill();
}

createPerfectSlidePose().catch(console.error);
