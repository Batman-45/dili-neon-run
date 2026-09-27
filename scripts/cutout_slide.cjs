const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9312;

async function cutoutSlide() {
  const outDir = path.resolve('test-screenshots/slide_candidates');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

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

  const img1Path = 'C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\e1da6ab2-d590-402c-a5f4-7e543392a40f\\dili_slide_rear_1790500941746.jpg';
  const b64_1 = fs.readFileSync(img1Path).toString('base64');

  const script = `
    (async () => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + '${b64_1}';
      await new Promise(r => img.onload = r);

      const w = img.width, h = img.height;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;

      // The background is pure white/light-gray (R,G,B > 240)
      // We will perform a flood fill or distance threshold from outer boundary
      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let head = 0, tail = 0;

      // Seed all border pixels
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

      while (head < tail) {
        const curr = queue[head++];
        const cx = curr % w;
        const cy = Math.floor(curr / w);
        const idx = curr * 4;

        // Check 4 neighbors
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
            // Light background check
            // For shadow under feet / floor marks:
            // if it's near white/light grey, it is background
            const isBg = (nr > 220 && ng > 220 && nb > 220) ||
                         (Math.abs(nr - ng) < 12 && Math.abs(ng - nb) < 12 && nr > 200);
            if (isBg) {
              visited[n] = 1;
              queue[tail++] = n;
            }
          }
        }
      }

      // Now set alpha based on visited
      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        if (visited[i] === 1) {
          const r = d[idx], g = d[idx+1], b = d[idx+2];
          // Smooth edge alpha
          const brightness = (r + g + b) / 3;
          if (brightness > 245) {
            d[idx + 3] = 0;
          } else if (brightness > 210) {
            d[idx + 3] = Math.max(0, Math.min(255, Math.round((245 - brightness) / 35 * 255)));
          } else {
            d[idx + 3] = 0;
          }
        } else {
          // Inner subject
          d[idx + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Also find bounds of subject
      let minX = w, maxX = 0, minY = h, maxY = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          if (d[idx + 3] > 10) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      return {
        bounds: { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY },
        png: c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/slide_candidates/slide_candidate_1.png', Buffer.from(res.result.value.png, 'base64'));
  console.log('Saved slide candidate 1. Bounds:', res.result.value.bounds);

  ws.close();
  p.kill();
}

cutoutSlide().catch(console.error);
