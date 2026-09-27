const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9319;

async function testProportionalSlide() {
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

  const img2Path = 'C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\e1da6ab2-d590-402c-a5f4-7e543392a40f\\dili_slide_rear_clean_1790501174086.jpg';
  const b64_2 = fs.readFileSync(img2Path).toString('base64');
  const runnerSheetB64 = fs.readFileSync('public/assets/dili_runner_sheet.png').toString('base64');

  const script = `
    (async () => {
      const load = (b64, mime='image/jpeg') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });

      const [slideImg, runnerSheet] = await Promise.all([
        load('${b64_2}', 'image/jpeg'),
        load('${runnerSheetB64}', 'image/png')
      ]);

      // 1. Extract official head from frame 0 of runnerSheet
      // In frame 0: head center cx = 180, cy = 125, width = 137, height = 119
      const headCanvas = document.createElement('canvas');
      headCanvas.width = 137; headCanvas.height = 119;
      const hCtx = headCanvas.getContext('2d');
      // Frame 0 source
      hCtx.drawImage(runnerSheet, 112, 66, 137, 119, 0, 0, 137, 119);

      // Clean head bottom so it feathers into collar
      const hData = hCtx.getImageData(0, 0, 137, 119);
      for (let y = 0; y < 119; y++) {
        for (let x = 0; x < 137; x++) {
          const idx = (y * 137 + x) * 4;
          if (y > 115) {
            hData.data[idx + 3] = 0;
          } else if (y > 108) {
            hData.data[idx + 3] = Math.round(hData.data[idx + 3] * ((115 - y) / 7));
          }
        }
      }
      hCtx.putImageData(hData, 0, 0);

      // 2. Cut out body from slideImg
      // From y = 420 down to y = 960
      const sw = slideImg.width, sh = slideImg.height;
      const bCanvas = document.createElement('canvas');
      bCanvas.width = sw; bCanvas.height = sh;
      const bCtx = bCanvas.getContext('2d');
      bCtx.drawImage(slideImg, 0, 0);

      const bData = bCtx.getImageData(0, 0, sw, sh);
      const bp = bData.data;

      // Flood fill background from border (x=0, x=sw-1, y=sh-1)
      const visited = new Uint8Array(sw * sh);
      const queue = new Int32Array(sw * sh);
      let qHead = 0, qTail = 0;

      for (let y = 350; y < sh; y++) {
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
          cy > 350 ? (cy - 1) * sw + cx : -1,
          cy < sh - 1 ? (cy + 1) * sw + cx : -1,
          cx > 0 ? cy * sw + (cx - 1) : -1,
          cx < sw - 1 ? cy * sw + (cx + 1) : -1
        ];

        for (const n of neighbors) {
          if (n >= 0 && visited[n] === 0) {
            const idx = n * 4;
            const r = bp[idx], g = bp[idx+1], b = bp[idx+2];
            const maxV = Math.max(r, g, b);
            const minV = Math.min(r, g, b);
            const diff = maxV - minV;
            const avg = (r + g + b) / 3;

            let isBg = false;
            if (avg > 200 && diff < 20) isBg = true;
            else if (avg > 185 && diff < 12) isBg = true;
            else if (cy > sh - 70 && avg > 160 && diff < 14) isBg = true;

            if (isBg) {
              visited[n] = 1;
              queue[qTail++] = n;
            }
          }
        }
      }

      for (let y = 350; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const idx = (y * sw + x) * 4;
          if (visited[y * sw + x] === 1) {
            const avg = (bp[idx] + bp[idx+1] + bp[idx+2]) / 3;
            if (avg > 225) bp[idx + 3] = 0;
            else if (avg > 180) bp[idx + 3] = Math.round(((225 - avg) / 45) * 255);
            else bp[idx + 3] = 0;
          } else {
            bp[idx + 3] = 255;
          }
        }
      }

      // Zero out above collar (y < 420)
      for (let y = 0; y < 420; y++) {
        for (let x = 0; x < sw; x++) {
          bp[(y * sw + x) * 4 + 3] = 0;
        }
      }
      bCtx.putImageData(bData, 0, 0);

      // Find tight bounds of body
      let bMinX = sw, bMaxX = 0, bMinY = sh, bMaxY = 0;
      for (let y = 420; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          if (bp[(y * sw + x) * 4 + 3] > 20) {
            if (x < bMinX) bMinX = x;
            if (x > bMaxX) bMaxX = x;
            if (y < bMinY) bMinY = y;
            if (y > bMaxY) bMaxY = y;
          }
        }
      }

      const bodyW = bMaxX - bMinX + 1;
      const bodyH = bMaxY - bMinY + 1;

      // 3. Assemble on 384x384 canvas
      // Proportions:
      // In normal standing: total height = 294px (Y=66 to Y=359).
      // In slide:
      // Ground baseline: Y = 359
      // Body height: 135px (from Y=224 to Y=359)
      // Body width: proportional to bodyW/bodyH ~ 180px
      // Head bottom sits at Y = 242 (overlaps 18px into collar at Y=224)
      // Head top is at Y = 242 - 119 = 123
      // Total slide height = 359 - 123 = 236px!
      // This lowers character from 294px to 236px (or even lower if bodyH is 120px)
      // That is ~1.25m in world units, easily clearing the overhead laser scanner!
      // AND gives 135px of solid body mass!

      const targetBodyH = 125;
      const bodyScale = targetBodyH / bodyH;
      const drawBodyW = Math.round(bodyW * bodyScale);
      const drawBodyH = targetBodyH;
      const drawBodyX = Math.round((384 - drawBodyW) / 2);
      const drawBodyY = 359 - drawBodyH; // grounded at 359 (drawBodyY = 234)

      const outCanvas = document.createElement('canvas');
      outCanvas.width = 384; outCanvas.height = 384;
      const outCtx = outCanvas.getContext('2d');

      // Step A: Draw head
      // Head sits on collar:
      const headBottom = drawBodyY + 22; // overlaps into collar
      const headTop = headBottom - 119;
      const headLeft = Math.round((384 - 137) / 2);
      outCtx.drawImage(headCanvas, 0, 0, 137, 119, headLeft, headTop, 137, 119);

      // Step B: Draw body in front so pink collar hugs the head
      outCtx.drawImage(bCanvas, bMinX, bMinY, bodyW, bodyH, drawBodyX, drawBodyY, drawBodyW, drawBodyH);

      // Step C: Draw official D logo on backpack
      const dX = 192;
      const dY = drawBodyY + Math.round(drawBodyH * 0.38);
      outCtx.save();
      outCtx.font = '900 24px "Inter", "Arial Black", sans-serif';
      outCtx.textAlign = 'center';
      outCtx.textBaseline = 'middle';
      outCtx.fillStyle = '#ffffff';
      outCtx.fillText('D', dX, dY);
      outCtx.restore();

      // Comparison canvas with Frame 0
      const compCanvas = document.createElement('canvas');
      compCanvas.width = 384 * 2; compCanvas.height = 384;
      const cCtx = compCanvas.getContext('2d');
      cCtx.fillStyle = '#0a0b14';
      cCtx.fillRect(0, 0, 384 * 2, 384);

      // Draw road guide
      cCtx.strokeStyle = '#00f0ff';
      cCtx.lineWidth = 1;
      cCtx.setLineDash([4, 4]);
      cCtx.beginPath();
      cCtx.moveTo(0, 359);
      cCtx.lineTo(384 * 2, 359);
      cCtx.stroke();
      cCtx.setLineDash([]);

      // Overhead laser height guide at Y = 210
      cCtx.strokeStyle = '#ff0055';
      cCtx.beginPath();
      cCtx.moveTo(0, 210);
      cCtx.lineTo(384 * 2, 210);
      cCtx.stroke();

      cCtx.drawImage(runnerSheet, 0, 0, 384, 384, 0, 0, 384, 384);
      cCtx.drawImage(outCanvas, 384, 0);

      cCtx.fillStyle = '#00f0ff';
      cCtx.font = 'bold 16px sans-serif';
      cCtx.fillText('NORMAL RUNNING (UPRIGHT)', 20, 35);

      cCtx.fillStyle = '#ff3dbb';
      cCtx.fillText('SLIDE / CROUCH POSE', 384 + 20, 35);

      return {
        stats: {
          bMinX, bMaxX, bMinY, bMaxY, bodyW, bodyH,
          drawBodyX, drawBodyY, drawBodyW, drawBodyH,
          headTop, headBottom,
          standingHeight: 294,
          slideHeight: 359 - headTop
        },
        compPng: compCanvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''),
        slidePng: outCanvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Stats:', JSON.stringify(res.result?.value?.stats, null, 2));

  fs.writeFileSync('test-screenshots/slide_candidates/proportional_slide_comp.png', Buffer.from(res.result.value.compPng, 'base64'));
  fs.writeFileSync('test-screenshots/slide_candidates/dili_slide_final.png', Buffer.from(res.result.value.slidePng, 'base64'));
  console.log('Saved to test-screenshots/slide_candidates/proportional_slide_comp.png');

  ws.close();
  p.kill();
}

testProportionalSlide().catch(console.error);
