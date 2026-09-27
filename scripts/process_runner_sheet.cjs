const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9249;

async function processInbetweenSheet() {
  const imgPath = 'C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\f9aa1e5a-c2f5-4c1d-b0e2-46b7668abe78\\dili_inbetween_sheet_1790321993045.jpg';
  const imgData = fs.readFileSync(imgPath).toString('base64');

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    'about:blank',
  ]);

  await new Promise(r => setTimeout(r, 2000));

  function getList() {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/json/list`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
  }

  try {
    const list = await getList();
    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 1;
    const callbacks = new Map();

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const reqId = id++;
        callbacks.set(reqId, { resolve, reject });
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise(resolve => ws.onopen = resolve);
    await send('Runtime.enable');

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      return res.result?.value;
    }

    await evaluate(`window.__base64 = "${imgData}";`);

    const resultPngBase64 = await evaluate(`
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const srcW = img.naturalWidth;
          const srcH = img.naturalHeight;

          // 1. Draw source image
          const srcCanvas = document.createElement('canvas');
          srcCanvas.width = srcW;
          srcCanvas.height = srcH;
          const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
          srcCtx.drawImage(img, 0, 0);

          const srcImgData = srcCtx.getImageData(0, 0, srcW, srcH);
          const pixels = srcImgData.data;

          // 2. Exterior BFS Flood Fill to remove background white and floor shadows
          const isBg = new Uint8Array(srcW * srcH);
          const queue = [];

          for (let x = 0; x < srcW; x++) {
            queue.push(x, 0);
            queue.push(x, srcH - 1);
          }
          for (let y = 1; y < srcH - 1; y++) {
            queue.push(0, y);
            queue.push(srcW - 1, y);
          }

          let head = 0;
          while (head < queue.length) {
            const x = queue[head++];
            const y = queue[head++];
            const idx = y * srcW + x;

            if (isBg[idx]) continue;

            const pIdx = idx * 4;
            const r = pixels[pIdx];
            const g = pixels[pIdx + 1];
            const b = pixels[pIdx + 2];

            // Floor shadow regions: y in [345..385] (row 0) or y >= 685 (row 1)
            const isGroundBand = (y >= 345 && y <= 385) || (y >= 685);
            const thresh = isGroundBand ? 175 : 235;

            if (r >= thresh && g >= thresh && b >= thresh) {
              isBg[idx] = 1;

              if (x > 0 && !isBg[idx - 1]) { queue.push(x - 1, y); }
              if (x < srcW - 1 && !isBg[idx + 1]) { queue.push(x + 1, y); }
              if (y > 0 && !isBg[idx - srcW]) { queue.push(x, y - 1); }
              if (y < srcH - 1 && !isBg[idx + srcW]) { queue.push(x, y + 1); }
            }
          }

          // Apply transparency & antialiasing
          for (let y = 0; y < srcH; y++) {
            for (let x = 0; x < srcW; x++) {
              const idx = y * srcW + x;
              const pIdx = idx * 4;

              if (isBg[idx]) {
                pixels[pIdx + 3] = 0;
              } else {
                let bgNeighborCount = 0;
                if (x > 0 && isBg[idx - 1]) bgNeighborCount++;
                if (x < srcW - 1 && isBg[idx + 1]) bgNeighborCount++;
                if (y > 0 && isBg[idx - srcW]) bgNeighborCount++;
                if (y < srcH - 1 && isBg[idx + srcW]) bgNeighborCount++;

                if (bgNeighborCount > 0) {
                  const r = pixels[pIdx];
                  const g = pixels[pIdx + 1];
                  const b = pixels[pIdx + 2];
                  const lum = (r + g + b) / 3;
                  if (lum > 215) {
                    pixels[pIdx + 3] = Math.max(0, Math.min(255, Math.floor(255 * (1 - (lum - 215) / 40))));
                  }
                }
              }
            }
          }

          srcCtx.putImageData(srcImgData, 0, 0);

          // 3. Select the 8 frames for the full alternating running cycle
          // Top row: cols 0, 1, 2, 3, 4
          // Bottom row: cols 0, 1, 2
          const selectedFrames = [
            { row: 0, col: 0 }, // Contact A (left foot planted, right foot lifted)
            { row: 0, col: 1 }, // Passing A
            { row: 0, col: 2 }, // Drive A
            { row: 0, col: 3 }, // Contact B (right foot planted, left foot lifted)
            { row: 0, col: 4 }, // Passing B
            { row: 1, col: 0 }, // Drive B
            { row: 1, col: 1 }, // Plant B
            { row: 1, col: 2 }, // Recovery
          ];

          const cellW = srcW / 5; // 275.2
          const cellH = srcH / 2; // 384
          const cleanData = srcCtx.getImageData(0, 0, srcW, srcH).data;

          const charBoxes = selectedFrames.map(f => {
            const startX = Math.floor(f.col * cellW);
            const endX = Math.floor((f.col + 1) * cellW);
            const startY = Math.floor(f.row * cellH);
            const endY = Math.floor((f.row + 1) * cellH);

            let minX = endX, maxX = startX, minY = endY, maxY = startY;
            for (let y = startY; y < endY; y++) {
              for (let x = startX; x < endX; x++) {
                const a = cleanData[(y * srcW + x) * 4 + 3];
                if (a > 30) {
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                }
              }
            }

            // Trim any faint shadow remnant at bottom
            while (maxY > minY) {
              let hasSolidPixel = false;
              for (let x = minX; x <= maxX; x++) {
                const a = cleanData[(maxY * srcW + x) * 4 + 3];
                if (a > 200) {
                  hasSolidPixel = true;
                  break;
                }
              }
              if (hasSolidPixel) break;
              maxY--;
            }

            return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
          });

          // 4. Composite onto 3072 x 384 canvas
          const targetW = 384;
          const targetH = 384;
          const totalW = targetW * 8; // 3072

          const finalCanvas = document.createElement('canvas');
          finalCanvas.width = totalW;
          finalCanvas.height = targetH;
          const finalCtx = finalCanvas.getContext('2d');
          finalCtx.imageSmoothingEnabled = true;
          finalCtx.imageSmoothingQuality = 'high';

          // Target scale and ground plane anchor
          // Scale ~1.04 keeps character nicely filling the 384 frame with 16px bottom padding
          const scale = 1.04;
          const groundAnchorY = 368;

          selectedFrames.forEach((f, i) => {
            const box = charBoxes[i];
            const charCanvas = document.createElement('canvas');
            charCanvas.width = box.w;
            charCanvas.height = box.h;
            const charCtx = charCanvas.getContext('2d');
            charCtx.drawImage(
              srcCanvas,
              box.minX, box.minY, box.w, box.h,
              0, 0, box.w, box.h
            );

            const scaledW = Math.round(box.w * scale);
            const scaledH = Math.round(box.h * scale);

            const slotX = i * targetW;
            const destX = slotX + Math.round((targetW - scaledW) / 2);
            const destY = groundAnchorY - scaledH;

            finalCtx.drawImage(charCanvas, destX, destY, scaledW, scaledH);
          });

          const dataUrl = finalCanvas.toDataURL('image/png');
          resolve(dataUrl.replace(/^data:image\\/png;base64,/, ''));
        };
        img.src = 'data:image/jpeg;base64,' + window.__base64;
      })
    `);

    const outPath = path.resolve('public/assets/dili_runner_sheet.png');
    fs.writeFileSync(outPath, Buffer.from(resultPngBase64, 'base64'));
    console.log(`Saved updated chibi runner sheet to ${outPath} (${fs.statSync(outPath).size} bytes)`);

    ws.close();
  } finally {
    chromeProc.kill();
  }
}

processInbetweenSheet().catch(console.error);
