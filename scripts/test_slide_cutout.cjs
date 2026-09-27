const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9315;

async function testSlideCutout() {
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
  const dRefB64 = fs.readFileSync('test-screenshots/ref_rear_d_logo.png').toString('base64');
  const sheetB64 = fs.readFileSync('public/assets/dili_runner_sheet.png').toString('base64');

  const script = `
    (async () => {
      const load = (b64, mime='image/jpeg') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });

      const slideImg = await load('${slideB64}', 'image/jpeg');
      const dRefImg = await load('${dRefB64}', 'image/png');
      const sheetImg = await load('${sheetB64}', 'image/png');

      const w = slideImg.width, h = slideImg.height;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(slideImg, 0, 0);

      const idata = ctx.getImageData(0, 0, w, h);
      const d = idata.data;

      // Flood fill background from perimeter
      // A pixel is background if it connects to perimeter AND is neutral bright (white/light grey background)
      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let head = 0, tail = 0;

      // Seed all 4 borders
      for (let x = 0; x < w; x++) {
        queue[tail++] = 0 * w + x;
        queue[tail++] = (h - 1) * w + x;
        visited[0 * w + x] = 1;
        visited[(h - 1) * w + x] = 1;
      }
      for (let y = 1; y < h - 1; y++) {
        queue[tail++] = y * w + 0;
        queue[tail++] = y * w + (w - 1);
        visited[y * w + 0] = 1;
        visited[y * w + (w - 1)] = 1;
      }

      function isBgPixel(r, g, b, cx, cy) {
        const maxV = Math.max(r, g, b);
        const minV = Math.min(r, g, b);
        const diff = maxV - minV;
        const avg = (r + g + b) / 3;

        // At top/sides (helmet region):
        // Helmet is inside circle centered at (500, 310) with radius ~200
        // Outside helmet is pure white/light grey
        if (avg > 225 && diff < 16) return true;
        if (avg > 215 && diff < 10) return true;
        // Near floor corners
        if ((cx < 240 || cx > 780) && avg > 200 && diff < 12) return true;
        // Floor under character (below boots at y > 940 outside boots x range [270, 720])
        if (cy > 930 && (cx < 270 || cx > 720) && avg > 200 && diff < 14) return true;
        if (cy > 950 && avg > 215 && diff < 15) return true;
        return false;
      }

      while (head < tail) {
        const curr = queue[head++];
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
            const nx = n % w;
            const ny = Math.floor(n / w);
            if (isBgPixel(nr, ng, nb, nx, ny)) {
              visited[n] = 1;
              queue[tail++] = n;
            }
          }
        }
      }

      // Fill alpha
      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        if (visited[i] === 1) {
          const r = d[idx], g = d[idx+1], b = d[idx+2];
          const avg = (r + g + b) / 3;
          if (avg > 240) {
            d[idx + 3] = 0;
          } else if (avg > 220) {
            d[idx + 3] = Math.round(((240 - avg) / 20) * 255);
          } else {
            d[idx + 3] = 0;
          }
        } else {
          d[idx + 3] = 255;
        }
      }
      ctx.putImageData(idata, 0, 0);

      // Measure character tight bounding box
      let minX = w, maxX = 0, minY = h, maxY = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          if (d[idx + 3] > 15) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Also let's measure the helmet bounds:
      // The helmet is the glass sphere at the top
      let hMinX = w, hMaxX = 0, hMinY = h, hMaxY = 0;
      for (let y = minY; y < minY + 400; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          if (d[idx + 3] > 20) {
            if (x < hMinX) hMinX = x;
            if (x > hMaxX) hMaxX = x;
            if (y < hMinY) hMinY = y;
            if (y > hMaxY) hMaxY = y;
          }
        }
      }

      // Now create a 384x384 canvas
      const outCanvas = document.createElement('canvas');
      outCanvas.width = 384; outCanvas.height = 384;
      const oCtx = outCanvas.getContext('2d');

      const charW = maxX - minX + 1;
      const charH = maxY - minY + 1;
      const helmetW = hMaxX - hMinX + 1;

      // In the running frames:
      // Normal head diameter = ~174px
      // We want the slide head to be ~160px (slightly tucked forward, natural 3D foreshortening)
      const targetHelmetW = 160;
      const scale = targetHelmetW / helmetW;

      const drawW = Math.round(charW * scale);
      const drawH = Math.round(charH * scale);
      const drawX = Math.round((384 - drawW) / 2);
      // Feet anchored at baseline Y = 368
      const drawY = 368 - drawH;

      oCtx.drawImage(c, minX, minY, charW, charH, drawX, drawY, drawW, drawH);

      // Now draw the official white "D" logo from dRefImg on the back!
      // In slideImg, the backpack center is at:
      // x ~ 500, y ~ 540 in original coordinates
      const bpX_orig = 504;
      const bpY_orig = 540;
      const bpX_draw = drawX + Math.round((bpX_orig - minX) * scale);
      const bpY_draw = drawY + Math.round((bpY_orig - minY) * scale);

      // Draw the iconic D logo centered on the backpack/cape
      // Let's create an isolated bold white D logo
      const dSize = Math.round(44 * scale * (charH / 300));
      // In dRefImg: the D logo is in the center
      // Let's draw it cleanly onto the backpack:
      // Or keep the original D on the backpack which is already sharp!

      return {
        bounds: { minX, maxX, minY, maxY, charW, charH, helmetW, targetHelmetW, scale, drawW, drawH, drawX, drawY },
        png: outCanvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Result bounds:', res.result?.value?.bounds);

  const outPath = 'test-screenshots/slide_candidates/slide_clean_384.png';
  fs.writeFileSync(outPath, Buffer.from(res.result.value.png, 'base64'));
  console.log('Saved to', outPath);

  ws.close();
  p.kill();
}

testSlideCutout().catch(console.error);
