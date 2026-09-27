const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9322;

async function buildPristineSlideAsset() {
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

  const script = `
    (async () => {
      const load = (b64, mime='image/jpeg') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });

      const [slideImg, runnerSheet] = await Promise.all([
        load('${slideB64}', 'image/jpeg'),
        load('${runnerSheetB64}', 'image/png')
      ]);

      const sw = slideImg.width, sh = slideImg.height; // 1024 x 1024
      const sCanvas = document.createElement('canvas');
      sCanvas.width = sw; sCanvas.height = sh;
      const sCtx = sCanvas.getContext('2d');
      sCtx.drawImage(slideImg, 0, 0);

      const sData = sCtx.getImageData(0, 0, sw, sh);
      const sp = sData.data;

      // Extract official head from frame 0 of runnerSheet
      // Frame 0 head: cx = 180, cy = 125, width = 137, height = 119
      const headCanvas = document.createElement('canvas');
      headCanvas.width = 137; headCanvas.height = 119;
      const hCtx = headCanvas.getContext('2d');
      hCtx.drawImage(runnerSheet, 112, 66, 137, 119, 0, 0, 137, 119);
      const hData = hCtx.getImageData(0, 0, 137, 119);
      for (let y = 0; y < 119; y++) {
        for (let x = 0; x < 137; x++) {
          const idx = (y * 137 + x) * 4;
          if (y > 115) hData.data[idx + 3] = 0;
          else if (y > 108) hData.data[idx + 3] = Math.round(hData.data[idx + 3] * ((115 - y) / 7));
        }
      }
      hCtx.putImageData(hData, 0, 0);

      // Clean background cutout for slide body:
      // Boot soles end at Y = 902 in 1024x1024 image
      const bootFloorY = 902;

      // Flood fill background from 3 sides (x=0, x=sw-1, y=bootFloorY)
      const visited = new Uint8Array(sw * sh);
      const queue = new Int32Array(sw * sh);
      let qHead = 0, qTail = 0;

      for (let y = 380; y <= bootFloorY; y++) {
        queue[qTail++] = y * sw + 0;
        queue[qTail++] = y * sw + (sw - 1);
        visited[y * sw + 0] = 1;
        visited[y * sw + (sw - 1)] = 1;
      }
      // Seed between boots at floor level (x between 440 and 555 at y=bootFloorY)
      for (let x = 440; x <= 555; x++) {
        queue[qTail++] = bootFloorY * sw + x;
        visited[bootFloorY * sw + x] = 1;
      }
      // Seed outside left boot (x < 270) and outside right boot (x > 720) at floor level
      for (let x = 0; x <= 270; x++) {
        queue[qTail++] = bootFloorY * sw + x;
        visited[bootFloorY * sw + x] = 1;
      }
      for (let x = 720; x < sw; x++) {
        queue[qTail++] = bootFloorY * sw + x;
        visited[bootFloorY * sw + x] = 1;
      }

      while (qHead < qTail) {
        const curr = queue[qHead++];
        const cx = curr % sw;
        const cy = Math.floor(curr / sw);

        const neighbors = [
          cy > 380 ? (cy - 1) * sw + cx : -1,
          cy < bootFloorY ? (cy + 1) * sw + cx : -1,
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

            // Background is bright neutral
            let isBg = false;
            if (avg > 218 && diff < 16) isBg = true;
            // Clear space between boots and outside boots
            if (cy > 760) {
              if (cx < 275 || cx > 715) isBg = true;
              if (cx > 440 && cx < 555) isBg = true;
            }

            if (isBg) {
              visited[n] = 1;
              queue[qTail++] = n;
            }
          }
        }
      }

      // Apply transparency
      for (let y = 380; y <= bootFloorY; y++) {
        for (let x = 0; x < sw; x++) {
          const idx = (y * sw + x) * 4;
          if (visited[y * sw + x] === 1) {
            const avg = (sp[idx] + sp[idx+1] + sp[idx+2]) / 3;
            if (avg >= 238) sp[idx + 3] = 0;
            else if (avg >= 218) sp[idx + 3] = Math.round(((238 - avg) / 20) * 255);
            else sp[idx + 3] = 0;
          } else {
            sp[idx + 3] = 255;
          }
        }
      }

      // Clip everything below bootFloorY
      for (let y = bootFloorY + 1; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          sp[(y * sw + x) * 4 + 3] = 0;
        }
      }

      // Clip above collar (y < 425) - we use the official head
      for (let y = 0; y < 425; y++) {
        for (let x = 0; x < sw; x++) {
          sp[(y * sw + x) * 4 + 3] = 0;
        }
      }

      sCtx.putImageData(sData, 0, 0);

      // Find tight bounds of clean body
      let bMinX = sw, bMaxX = 0, bMinY = sh, bMaxY = 0;
      for (let y = 425; y <= bootFloorY; y++) {
        for (let x = 0; x < sw; x++) {
          if (sp[(y * sw + x) * 4 + 3] > 20) {
            if (x < bMinX) bMinX = x;
            if (x > bMaxX) bMaxX = x;
            if (y < bMinY) bMinY = y;
            if (y > bMaxY) bMaxY = y;
          }
        }
      }

      const bodyW = bMaxX - bMinX + 1;
      const bodyH = bMaxY - bMinY + 1; // 918 - 425 = 493

      // Compose into final 384x384 canvas
      // Target sizing:
      // Baseline Y = 359 (exact same as normal running frames)
      // Body height = 125px (solid chibi body mass!)
      // Body width = Math.round(bodyW * (125 / bodyH))
      const targetBodyH = 125;
      const scale = targetBodyH / bodyH;
      const drawBodyW = Math.round(bodyW * scale);
      const drawBodyH = targetBodyH;
      const drawBodyX = Math.round((384 - drawBodyW) / 2);
      const drawBodyY = 359 - drawBodyH; // 359 - 125 = 234

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = 384; finalCanvas.height = 384;
      const fCtx = finalCanvas.getContext('2d');

      // 1. Draw head first
      // Head bottom sits nestled 20px inside the pink collar at Y = 234:
      const headBottom = drawBodyY + 20; // 254
      const headTop = headBottom - 119;  // 135
      const headLeft = Math.round((384 - 137) / 2); // 123.5
      fCtx.drawImage(headCanvas, 0, 0, 137, 119, headLeft, headTop, 137, 119);

      // 2. Draw body in front so the pink collar hugs the bubble helmet
      fCtx.drawImage(sCanvas, bMinX, bMinY, bodyW, bodyH, drawBodyX, drawBodyY, drawBodyW, drawBodyH);

      // Total height = 359 - headTop = 224px (normal is 294px)
      // 224px / 294px = 76% height, visibly ducking low while retaining full chibi mass!

      return {
        stats: {
          bMinX, bMaxX, bMinY, bMaxY, bodyW, bodyH,
          drawBodyX, drawBodyY, drawBodyW, drawBodyH,
          headTop, headBottom,
          standingHeight: 294,
          slideHeight: 359 - headTop
        },
        png: finalCanvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Slide stats:', JSON.stringify(res.result?.value?.stats, null, 2));

  const outPath = 'public/assets/dili_slide.png';
  fs.writeFileSync(outPath, Buffer.from(res.result.value.png, 'base64'));
  fs.writeFileSync('test-screenshots/slide_candidates/pristine_slide.png', Buffer.from(res.result.value.png, 'base64'));
  console.log('Saved to', outPath);

  ws.close();
  p.kill();
}

buildPristineSlideAsset().catch(console.error);
