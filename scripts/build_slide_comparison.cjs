const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9318;

async function buildSlideComparison() {
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
  const img2Path = 'C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\e1da6ab2-d590-402c-a5f4-7e543392a40f\\dili_slide_rear_clean_1790501174086.jpg';

  const b64_1 = fs.readFileSync(img1Path).toString('base64');
  const b64_2 = fs.readFileSync(img2Path).toString('base64');
  const runnerSheetB64 = fs.readFileSync('public/assets/dili_runner_sheet.png').toString('base64');

  const script = `
    (async () => {
      const load = (b64, mime='image/jpeg') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });

      const [slideImg1, slideImg2, runnerSheet] = await Promise.all([
        load('${b64_1}', 'image/jpeg'),
        load('${b64_2}', 'image/jpeg'),
        load('${runnerSheetB64}', 'image/png')
      ]);

      // Extract official master head from frame 0 of runnerSheet
      const frame0Canvas = document.createElement('canvas');
      frame0Canvas.width = 384; frame0Canvas.height = 384;
      const f0Ctx = frame0Canvas.getContext('2d');
      f0Ctx.drawImage(runnerSheet, 0, 0, 384, 384, 0, 0, 384, 384);

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

      // Clean background cutout function for candidate 1 and 2
      function cleanCutoutBody(img, startY = 400) {
        const sw = img.width, sh = img.height;
        const c = document.createElement('canvas');
        c.width = sw; c.height = sh;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const idata = ctx.getImageData(0, 0, sw, sh);
        const sp = idata.data;

        // Flood fill from edges
        const visited = new Uint8Array(sw * sh);
        const queue = new Int32Array(sw * sh);
        let qHead = 0, qTail = 0;

        for (let y = startY; y < sh; y++) {
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
            cy > startY ? (cy - 1) * sw + cx : -1,
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

              let isBg = false;
              if (avg > 200 && diff < 22) isBg = true;
              else if (avg > 180 && diff < 14) isBg = true;
              else if (cy > sh - 80 && avg > 165 && diff < 16) isBg = true; // floor shadow

              if (isBg) {
                visited[n] = 1;
                queue[qTail++] = n;
              }
            }
          }
        }

        for (let y = startY; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const idx = (y * sw + x) * 4;
            if (visited[y * sw + x] === 1) {
              const avg = (sp[idx] + sp[idx+1] + sp[idx+2]) / 3;
              if (avg > 230) sp[idx + 3] = 0;
              else if (avg > 190) sp[idx + 3] = Math.round(((230 - avg) / 40) * 255);
              else sp[idx + 3] = 0;
            } else {
              sp[idx + 3] = 255;
            }
          }
        }

        for (let y = 0; y < startY; y++) {
          for (let x = 0; x < sw; x++) {
            sp[(y * sw + x) * 4 + 3] = 0;
          }
        }

        ctx.putImageData(idata, 0, 0);

        // Find bounding box
        let bMinX = sw, bMaxX = 0, bMinY = sh, bMaxY = 0;
        for (let y = startY; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            if (sp[(y * sw + x) * 4 + 3] > 20) {
              if (x < bMinX) bMinX = x;
              if (x > bMaxX) bMaxX = x;
              if (y < bMinY) bMinY = y;
              if (y > bMaxY) bMaxY = y;
            }
          }
        }

        return { canvas: c, bMinX, bMaxX, bMinY, bMaxY, w: bMaxX - bMinX + 1, h: bMaxY - bMinY + 1 };
      }

      // Build Option 1 (Athletic lunge slide)
      const b1 = cleanCutoutBody(slideImg1, 420);
      const opt1Canvas = document.createElement('canvas');
      opt1Canvas.width = 384; opt1Canvas.height = 384;
      const ctx1 = opt1Canvas.getContext('2d');

      const targetH1 = 110;
      const scale1 = targetH1 / b1.h;
      const dw1 = Math.round(b1.w * scale1);
      const dh1 = targetH1;
      const dx1 = Math.round((384 - dw1) / 2);
      const dy1 = 359 - dh1;

      // Draw head
      ctx1.drawImage(headCanvas, 112, 66, 137, 119, Math.round(192 - 137/2), dy1 + 14 - 119, 137, 119);
      // Draw body
      ctx1.drawImage(b1.canvas, b1.bMinX, b1.bMinY, b1.w, b1.h, dx1, dy1, dw1, dh1);
      // Draw crisp D logo
      ctx1.save();
      ctx1.font = '900 22px "Inter", "Arial Black", sans-serif';
      ctx1.textAlign = 'center';
      ctx1.textBaseline = 'middle';
      ctx1.fillStyle = '#ffffff';
      ctx1.fillText('D', 190, dy1 + Math.round(dh1 * 0.36));
      ctx1.restore();

      // Build Option 2 (Aerodynamic wide slide)
      const b2 = cleanCutoutBody(slideImg2, 400);
      const opt2Canvas = document.createElement('canvas');
      opt2Canvas.width = 384; opt2Canvas.height = 384;
      const ctx2 = opt2Canvas.getContext('2d');

      const targetH2 = 106;
      const scale2 = targetH2 / b2.h;
      const dw2 = Math.round(b2.w * scale2);
      const dh2 = targetH2;
      const dx2 = Math.round((384 - dw2) / 2);
      const dy2 = 359 - dh2;

      // Draw head
      ctx2.drawImage(headCanvas, 112, 66, 137, 119, Math.round(192 - 137/2), dy2 + 14 - 119, 137, 119);
      // Draw body
      ctx2.drawImage(b2.canvas, b2.bMinX, b2.bMinY, b2.w, b2.h, dx2, dy2, dw2, dh2);
      // Draw crisp D logo
      ctx2.save();
      ctx2.font = '900 22px "Inter", "Arial Black", sans-serif';
      ctx2.textAlign = 'center';
      ctx2.textBaseline = 'middle';
      ctx2.fillStyle = '#ffffff';
      ctx2.fillText('D', 192, dy2 + Math.round(dh2 * 0.40));
      ctx2.restore();

      // Side-by-side comparison with Normal Running Frame 0
      const compCanvas = document.createElement('canvas');
      compCanvas.width = 384 * 3; compCanvas.height = 384;
      const compCtx = compCanvas.getContext('2d');

      // Dark cyber background to check transparency
      compCtx.fillStyle = '#0b0c16';
      compCtx.fillRect(0, 0, 384 * 3, 384);

      // Road baseline guide at Y = 359
      compCtx.strokeStyle = '#00f0ff';
      compCtx.lineWidth = 1;
      compCtx.setLineDash([4, 4]);
      compCtx.beginPath();
      compCtx.moveTo(0, 359);
      compCtx.lineTo(384 * 3, 359);
      compCtx.stroke();
      compCtx.setLineDash([]);

      // 1. Normal running
      compCtx.drawImage(frame0Canvas, 0, 0);
      compCtx.fillStyle = '#00f0ff';
      compCtx.font = 'bold 16px sans-serif';
      compCtx.fillText('1. NORMAL RUNNING (UPRIGHT)', 20, 30);

      // 2. Candidate A (Lunge Slide)
      compCtx.drawImage(opt1Canvas, 384, 0);
      compCtx.fillStyle = '#ff3dbb';
      compCtx.fillText('2. CANDIDATE A (LUNGE SLIDE)', 384 + 20, 30);

      // 3. Candidate B (Wide Aerodynamic Slide)
      compCtx.drawImage(opt2Canvas, 384 * 2, 0);
      compCtx.fillStyle = '#00ff88';
      compCtx.fillText('3. CANDIDATE B (WIDE SLIDE)', 384 * 2 + 20, 30);

      return {
        compPng: compCanvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''),
        opt1Png: opt1Canvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''),
        opt2Png: opt2Canvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/slide_candidates/slide_comparison.png', Buffer.from(res.result.value.compPng, 'base64'));
  fs.writeFileSync('test-screenshots/slide_candidates/opt1.png', Buffer.from(res.result.value.opt1Png, 'base64'));
  fs.writeFileSync('test-screenshots/slide_candidates/opt2.png', Buffer.from(res.result.value.opt2Png, 'base64'));
  console.log('Saved comparison to test-screenshots/slide_candidates/slide_comparison.png');

  ws.close();
  p.kill();
}

buildSlideComparison().catch(console.error);
