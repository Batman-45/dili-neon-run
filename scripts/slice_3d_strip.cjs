const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9229;

async function sliceStrip() {
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1920,1080',
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
    const targets = await getList();
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
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
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 1500));

    // Evaluate in page
    const evalRes = await send('Runtime.evaluate', {
      expression: `(async () => {
        const img = new Image();
        img.src = '/assets/dili_rear_strip_raw.jpg';
        await new Promise(r => img.onload = r);
        const w = img.width;
        const h = img.height;
        
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = w;
        srcCanvas.height = h;
        const sctx = srcCanvas.getContext('2d');
        sctx.drawImage(img, 0, 0);
        const sData = sctx.getImageData(0, 0, w, h);
        
        // Find helmet centers: Y in [240, 420]
        const headProjections = new Float32Array(w);
        for (let x = 0; x < w; x++) {
          let sum = 0;
          for (let y = 240; y < 420; y++) {
            const idx = (y * w + x) * 4;
            if (sData.data[idx] > 25 || sData.data[idx+1] > 25 || sData.data[idx+2] > 25) sum += 1;
          }
          headProjections[x] = sum;
        }

        // Find 8 peak centers in headProjections
        const approxSlot = w / 8;
        const centers = [];
        for (let i = 0; i < 8; i++) {
          const start = Math.floor(i * approxSlot);
          const end = Math.floor((i + 1) * approxSlot);
          let maxVal = -1, bestX = start;
          for (let x = start; x < end; x++) {
            if (headProjections[x] > maxVal) {
              maxVal = headProjections[x];
              bestX = x;
            }
          }
          centers.push(bestX);
        }
        console.log('Detected centers:', centers);

        // Find boundary cuts between adjacent centers: find valley with minimum column brightness
        const boundaries = [0];
        for (let i = 0; i < 7; i++) {
          const c1 = centers[i];
          const c2 = centers[i+1];
          let minVal = 999999, cutX = Math.round((c1 + c2) / 2);
          for (let x = c1 + 20; x < c2 - 20; x++) {
            let colSum = 0;
            for (let y = 0; y < h; y++) {
              const idx = (y * w + x) * 4;
              colSum += (sData.data[idx] + sData.data[idx+1] + sData.data[idx+2]);
            }
            if (colSum < minVal) {
              minVal = colSum;
              cutX = x;
            }
          }
          boundaries.push(cutX);
        }
        boundaries.push(w);
        console.log('Boundaries:', boundaries);

        // Extract 4 key stride phases (0 to 3) from the 3D capture:
        // Frame 0: Kickback / sole visible
        // Frame 1: Drive phase / knee flexion
        // Frame 2: Passing phase / leg passing under body
        // Frame 3: Foot plant / forward reach
        // Then mirror horizontally for Frames 4, 5, 6, 7 (opposite leg stride)
        const fw = 384;
        const fh = 384;
        const sheetCanvas = document.createElement('canvas');
        sheetCanvas.width = fw * 8;
        sheetCanvas.height = fh;
        const sheetCtx = sheetCanvas.getContext('2d');
        const frames = [];

        // Extract base 4 frames
        const baseCanvases = [];
        for (let i = 0; i < 4; i++) {
          const minBoundX = boundaries[i];
          const maxBoundX = boundaries[i+1];

          let minX = maxBoundX, maxX = minBoundX, minY = h, maxY = 0;
          for (let y = 0; y < h; y++) {
            for (let x = minBoundX; x < maxBoundX; x++) {
              const idx = (y * w + x) * 4;
              const r = sData.data[idx];
              const g = sData.data[idx+1];
              const b = sData.data[idx+2];
              if (r > 20 || g > 20 || b > 20) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          if (minX > maxX) { minX = minBoundX; maxX = maxBoundX; }
          const charW = maxX - minX + 1;
          const charH = maxY - minY + 1;

          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = charW;
          cropCanvas.height = charH;
          const cropCtx = cropCanvas.getContext('2d');
          cropCtx.drawImage(img, minX, minY, charW, charH, 0, 0, charW, charH);

          // Alpha matte pure black background
          const cropData = cropCtx.getImageData(0, 0, charW, charH);
          for (let p = 0; p < cropData.data.length; p += 4) {
            const cr = cropData.data[p];
            const cg = cropData.data[p+1];
            const cb = cropData.data[p+2];
            const maxVal = Math.max(cr, cg, cb);
            if (maxVal < 18) {
              cropData.data[p+3] = 0;
            } else if (maxVal < 42) {
              cropData.data[p+3] = Math.round(((maxVal - 18) / 24) * 255);
            }
          }
          cropCtx.putImageData(cropData, 0, 0);

          const fCanvas = document.createElement('canvas');
          fCanvas.width = fw;
          fCanvas.height = fh;
          const fCtx = fCanvas.getContext('2d');

          // Standardize height and anchor at Y = 360
          const targetH = 300;
          const scale = targetH / 290;
          const drawW = Math.round(charW * scale);
          const drawH = Math.round(charH * scale);
          const drawX = Math.round((fw - drawW) / 2);
          const drawY = Math.round(360 - drawH);

          fCtx.drawImage(cropCanvas, 0, 0, charW, charH, drawX, drawY, drawW, drawH);
          baseCanvases.push(fCanvas);
        }

        // Now assemble all 8 frames:
        // Frames 0-3: Stride A (Right leg kickback / Left leg plant)
        // Frames 4-7: Stride B (Left leg kickback / Right leg plant, perfect horizontal mirror)
        for (let i = 0; i < 8; i++) {
          const fCanvas = document.createElement('canvas');
          fCanvas.width = fw;
          fCanvas.height = fh;
          const fCtx = fCanvas.getContext('2d');

          if (i < 4) {
            // Forward stride A
            fCtx.drawImage(baseCanvases[i], 0, 0);
          } else {
            // Opposite stride B: horizontal mirror
            const baseIdx = i - 4;
            fCtx.save();
            fCtx.translate(fw, 0);
            fCtx.scale(-1, 1);
            fCtx.drawImage(baseCanvases[baseIdx], 0, 0);
            fCtx.restore();
          }

          sheetCtx.drawImage(fCanvas, i * fw, 0);

          frames.push({
            frameIndex: i,
            dataUrl: fCanvas.toDataURL('image/png')
          });
        }

        return {
          width: w,
          height: h,
          centers,
          boundaries,
          sheetDataUrl: sheetCanvas.toDataURL('image/png'),
          frames
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    const result = evalRes.result.value;
    console.log('Result dimensions:', result.width, result.height, 'SlotW:', result.slotW);

    // Save individual frames
    if (!fs.existsSync('test-screenshots/3d_frames')) {
      fs.mkdirSync('test-screenshots/3d_frames', { recursive: true });
    }
    for (const f of result.frames) {
      const base64 = f.dataUrl.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(`test-screenshots/3d_frames/frame_${f.frameIndex}.png`, Buffer.from(base64, 'base64'));
      console.log(`Saved 3d_frames/frame_${f.frameIndex}.png (charW: ${f.charW}, charH: ${f.charH})`);
    }

    // Save full sheet
    const sheetBase64 = result.sheetDataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync('public/assets/dili_runner_sheet.png', Buffer.from(sheetBase64, 'base64'));
    console.log('Saved public/assets/dili_runner_sheet.png (3072x384 RGBA)');

    ws.close();
  } finally {
    chromeProc.kill();
  }
}

sliceStrip().catch(e => {
  console.error(e);
  process.exit(1);
});
