const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9313;

async function buildSlideAsset() {
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
  const sheetB64 = fs.readFileSync('public/assets/dili_runner_sheet.png').toString('base64');
  const dRefB64 = fs.existsSync('test-screenshots/ref_rear_d_logo.png') 
    ? fs.readFileSync('test-screenshots/ref_rear_d_logo.png').toString('base64')
    : '';

  const script = `
    (async () => {
      const load = (b64, mime='image/jpeg') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });

      const slideImg = await load('${slideB64}', 'image/jpeg');
      const sheetImg = await load('${sheetB64}', 'image/png');

      const w = slideImg.width, h = slideImg.height;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(slideImg, 0, 0);

      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;

      // 1. Cut out character on pure white background
      // Use flood fill from edges to distinguish background from character's white boots & backpack
      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let qHead = 0, qTail = 0;

      // Seed all border pixels
      for (let x = 0; x < w; x++) {
        queue[qTail++] = 0 * w + x;
        queue[qTail++] = (h - 1) * w + x;
        visited[0 * w + x] = 1;
        visited[(h - 1) * w + x] = 1;
      }
      for (let y = 1; y < h - 1; y++) {
        queue[qTail++] = y * w + 0;
        queue[qTail++] = y * w + (w - 1);
        visited[y * w + 0] = 1;
        visited[y * w + (w - 1)] = 1;
      }

      while (qHead < qTail) {
        const curr = queue[qHead++];
        const cx = curr % w;
        const cy = Math.floor(curr / w);

        const neighbors = [
          cy > 0 ? (cy - 1) * w + cx : -1,
          cy < h - 1 ? (cy + 1) * w + cx : -1,
          cx > 0 ? cy * w + (cx - 1) : -1,
          cx < w - 1 ? cy * w + (cx + 1) : -1
        ];

        for (const n of neighbors) {
          if (n >= 0 && visited[n] === 0) {
            const nIdx = n * 4;
            const nr = d[nIdx], ng = d[nIdx+1], nb = d[nIdx+2];
            // Background is pure white/light grey (r>230, g>230, b>230)
            if (nr > 232 && ng > 232 && nb > 232) {
              visited[n] = 1;
              queue[qTail++] = n;
            }
          }
        }
      }

      // Convert visited to alpha with feathering
      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        if (visited[i] === 1) {
          const r = d[idx], g = d[idx+1], b = d[idx+2];
          const brightness = (r + g + b) / 3;
          if (brightness >= 246) {
            d[idx + 3] = 0;
          } else {
            // Anti-alias fringe
            d[idx + 3] = Math.round(Math.max(0, Math.min(255, (246 - brightness) / 14 * 255)));
          }
        } else {
          d[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // Find character bounding box
      let minX = w, maxX = 0, minY = h, maxY = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          if (d[idx + 3] > 20) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Now create standardized 384x384 slide sprite frame
      // In the normal 384x384 runner frames:
      // Character feet are grounded at Y = 368 (with ~16px padding at bottom)
      // Normal head top is at Y = 14
      // Normal standing height is ~354px
      // For slide: character should be ducked down low:
      // Feet grounded at Y = 368
      // Head top should be at around Y = 150 ~ 170 (lowered by ~140-150px)
      // Head width should match normal running head width (~174px diameter)
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = 384;
      frameCanvas.height = 384;
      const fCtx = frameCanvas.getContext('2d');

      const charW = maxX - minX + 1;
      const charH = maxY - minY + 1;

      // In slide image:
      // The head circle diameter can be measured:
      // From y = minY to neck collar
      // Let's measure head width in the cutout
      // Helmet in slide image is roughly from y=minY to y=minY + 380, width ~390px
      // We want the head diameter in the 384px frame to be ~170px (matching the normal runner head!)
      const targetHeadDiam = 172; // normal runner head diameter
      // In slide image, helmet diameter is approx charH * 0.44
      // Let's compute scale so head matches normal runner head
      // Let's find helmet width in slide image
      let helmetMinX = w, helmetMaxX = 0;
      for (let y = minY; y < minY + 300; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          if (d[idx + 3] > 50) {
            if (x < helmetMinX) helmetMinX = x;
            if (x > helmetMaxX) helmetMaxX = x;
          }
        }
      }
      const rawHelmetW = helmetMaxX - helmetMinX + 1;
      const scale = targetHeadDiam / rawHelmetW;

      const drawW = Math.round(charW * scale);
      const drawH = Math.round(charH * scale);
      const drawX = Math.round((384 - drawW) / 2);
      // Anchor boots at Y = 368 (exact ground baseline)
      const drawY = 368 - drawH;

      fCtx.drawImage(c, minX, minY, charW, charH, drawX, drawY, drawW, drawH);

      // Now, let's also composite the official master head from frame 0 onto the slide head!
      // In frame 0 of sheetImg: head is centered at cx = 153.5, cy = 100.0, rad = 86.0
      // In our slide frame:
      // Let's find the head center in frameCanvas:
      const slideHeadCx = 192;
      const slideHeadTop = drawY;
      const slideHeadCy = slideHeadTop + (targetHeadDiam / 2);
      const slideHeadRad = targetHeadDiam / 2;

      // Extract official head from sheetImg (frame 0)
      const headCanvas = document.createElement('canvas');
      headCanvas.width = 384; headCanvas.height = 384;
      const hCtx = headCanvas.getContext('2d');
      // Frame 0 bounds
      hCtx.drawImage(sheetImg, 0, 0, 384, 384, 0, 0, 384, 384);
      const hData = hCtx.getImageData(0, 0, 384, 384);
      // Keep only head region (y <= 184)
      for (let y = 0; y < 384; y++) {
        for (let x = 0; x < 384; x++) {
          const idx = (y * 384 + x) * 4;
          if (y > 185) {
            hData.data[idx + 3] = 0;
          } else if (y > 180) {
            hData.data[idx + 3] = Math.round(hData.data[idx + 3] * ((185 - y) / 5));
          }
        }
      }
      hCtx.putImageData(hData, 0, 0);

      // Let's test two variations:
      // Variation A: Clean original slide pose
      const varA = frameCanvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');

      // Variation B: Slide body + official master head perfectly blended
      const canvasB = document.createElement('canvas');
      canvasB.width = 384; canvasB.height = 384;
      const bCtx = canvasB.getContext('2d');
      bCtx.drawImage(frameCanvas, 0, 0);

      // Head offset from frame 0 (cx=153.5, cy=100.0) to slide head (slideHeadCx, slideHeadCy)
      const dx = slideHeadCx - 153.5;
      const dy = slideHeadCy - 100.0;
      bCtx.drawImage(headCanvas, dx, dy);

      const varB = canvasB.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');

      return {
        bounds: { minX, maxX, minY, maxY, rawHelmetW, scale, drawW, drawH, drawX, drawY, slideHeadCy },
        varA,
        varB
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Result:', res.result?.value?.bounds);

  const outDir = path.resolve('test-screenshots/slide_candidates');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, 'slide_varA.png'), Buffer.from(res.result.value.varA, 'base64'));
  fs.writeFileSync(path.join(outDir, 'slide_varB.png'), Buffer.from(res.result.value.varB, 'base64'));
  console.log('Saved slide_varA.png and slide_varB.png');

  ws.close();
  p.kill();
}

buildSlideAsset().catch(console.error);
