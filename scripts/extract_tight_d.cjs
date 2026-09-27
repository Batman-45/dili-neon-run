const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function extractOnlyD() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9295',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9295/json/list', r => {
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

  const rearB64 = fs.readFileSync('public/assets/dili_rear_ref.jpg').toString('base64');

  const script = `(async () => {
    const load = (b64, mime) => new Promise(res => {
      const img = new Image();
      img.src = 'data:' + mime + ';base64,' + b64;
      img.onload = () => res(img);
    });

    const rear = await load('${rearB64}', 'image/jpeg');

    const c = document.createElement('canvas');
    c.width = 1024; c.height = 1024;
    const ctx = c.getContext('2d');
    ctx.drawImage(rear, 0, 0);

    // In 1024x1024 dili_rear_ref.jpg, cape D is in X: 370..630, Y: 460..650
    // Let's find all pixels in the D using color clustering
    const sx = 370, sy = 460, w = 260, h = 200;
    const imgData = ctx.getImageData(sx, sy, w, h);
    const d = imgData.data;

    // Find all pixels with g > 160 (ONLY the white D satisfies this in the cape region)
    const isCoreD = new Uint8Array(w * h);
    for (let y = 35; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (d[idx+1] > 160) {
          isCoreD[y * w + x] = 1;
        }
      }
    }

    // Now find the connected component of isCoreD
    // Any stray pixel is filtered out, keep the main D component
    const visited = new Uint8Array(w * h);
    const dComponent = new Uint8Array(w * h);
    const queue = [];

    // Find seed in center of D
    for (let y = 40; y < h; y++) {
      for (let x = 20; x < w - 20; x++) {
        if (isCoreD[y * w + x]) {
          queue.push(x, y);
          visited[y * w + x] = 1;
          break;
        }
      }
      if (queue.length > 0) break;
    }

    while (queue.length > 0) {
      const cy = queue.pop();
      const cx = queue.pop();
      dComponent[cy * w + cx] = 1;

      for (const [nx, ny] of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]) {
        if (nx >= 0 && nx < w && ny >= 35 && ny < h) {
          const nidx = ny * w + nx;
          if (!visited[nidx] && isCoreD[nidx]) {
            visited[nidx] = 1;
            queue.push(nx, ny);
          }
        }
      }
    }

    // Now calculate distance to the core D to capture the perfect anti-aliased edge (radius 3.5px)
    let minX = w, maxX = 0, minY = h, maxY = 0;
    const outC = document.createElement('canvas');
    outC.width = w; outC.height = h;
    const outCtx = outC.getContext('2d');
    const outData = outCtx.createImageData(w, h);
    const op = outData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const nidx = y * w + x;

        // Check if inside or near dComponent
        if (dComponent[nidx]) {
          op[idx] = 255;
          op[idx+1] = 255;
          op[idx+2] = 255;
          op[idx+3] = 255;

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        } else {
          // Check distance to closest dComponent pixel (up to 4px)
          let minDist = 999;
          for (let dy = -4; dy <= 4; dy++) {
            const py = y + dy;
            if (py < 0 || py >= h) continue;
            for (let dx = -4; dx <= 4; dx++) {
              const px = x + dx;
              if (px < 0 || px >= w) continue;
              if (dComponent[py * w + px]) {
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < minDist) minDist = dist;
              }
            }
          }

          if (minDist <= 3.2) {
            // Anti-aliased boundary pixel
            const g = d[idx+1];
            // Compute smooth alpha
            const edgeAlpha = Math.max(0, Math.min(1, 1.0 - (minDist - 0.5) / 2.5));
            // Blend with green channel ratio
            const gRatio = Math.max(0, Math.min(1, (g - 50) / (160 - 50)));
            const alpha = Math.max(edgeAlpha * 0.5, gRatio);

            op[idx] = 255;
            op[idx+1] = 255;
            op[idx+2] = 255;
            op[idx+3] = Math.round(255 * alpha);

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
    outCtx.putImageData(outData, 0, 0);

    const pad = 2;
    const tightX = Math.max(0, minX - pad);
    const tightY = Math.max(0, minY - pad);
    const tightW = (maxX - minX + 1) + pad * 2;
    const tightH = (maxY - minY + 1) + pad * 2;

    const tightC = document.createElement('canvas');
    tightC.width = tightW; tightC.height = tightH;
    const tCtx = tightC.getContext('2d');
    tCtx.drawImage(outC, tightX, tightY, tightW, tightH, 0, 0, tightW, tightH);

    return {
      tightW,
      tightH,
      dUrl: tightC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
    };
  })()`;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Tight D size:', res.result.value.tightW, res.result.value.tightH);
  fs.writeFileSync('test-screenshots/official_d_tight.png', Buffer.from(res.result.value.dUrl, 'base64'));
  console.log('Saved official tight D');
  ws.close();
  p.kill();
}
extractOnlyD().catch(console.error);
