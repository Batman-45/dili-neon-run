const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function testExtractAndBlend() {
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

  const sheetB64 = fs.readFileSync('public/assets/dili_runner_sheet.png').toString('base64');
  const headB64 = fs.readFileSync('C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\d86d48cc-c83b-4c0a-a996-4889df60c7b4\\dili_rear_head_test_1790327217548.jpg').toString('base64');

  const script = `
    (async () => {
      const load = (b64, mime='image/png') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });
      const sheet = await load('${sheetB64}', 'image/png');
      const headImg = await load('${headB64}', 'image/jpeg');

      // 1. Process head image: extract helmet + hair with clean circular glass boundary
      // Bubble center in headImg: (512, 460), radius = 390
      const headSize = 1024;
      const hc = document.createElement('canvas');
      hc.width = headSize; hc.height = headSize;
      const hctx = hc.getContext('2d');
      hctx.drawImage(headImg, 0, 0);

      const hData = hctx.getImageData(0, 0, headSize, headSize);
      const hp = hData.data;

      // Extract with circular glass antialiased mask
      const bcX = 512;
      const bcY = 460;
      const bRad = 390;

      // Also clean white background outside the bubble and above the hoodie
      for (let y = 0; y < headSize; y++) {
        for (let x = 0; x < headSize; x++) {
          const idx = (y * headSize + x) * 4;
          const dx = x - bcX;
          const dy = y - bcY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Outside sphere
          if (dist > bRad + 1) {
            // Is it below the sphere (the pink hoodie)?
            if (y > bcY + bRad * 0.7 && Math.abs(dx) < bRad * 0.75) {
              // Part of the hoodie collar / hood fold
              const r = hp[idx], g = hp[idx+1], b = hp[idx+2];
              if (r > 245 && g > 245 && b > 245) {
                hp[idx+3] = 0; // white background
              }
            } else {
              hp[idx + 3] = 0; // fully transparent outside bubble
            }
          } else if (dist > bRad - 2) {
            // Antialias outer edge
            const alpha = Math.max(0, Math.min(1, (bRad + 1 - dist) / 3));
            hp[idx + 3] = Math.round(hp[idx + 3] * alpha);
          }
        }
      }
      hctx.putImageData(hData, 0, 0);

      // Now create a test composite for frame 0
      const testC = document.createElement('canvas');
      testC.width = 384; testC.height = 384;
      const tctx = testC.getContext('2d');

      // Draw original frame 0
      tctx.drawImage(sheet, 0, 0, 384, 384, 0, 0, 384, 384);

      // Clear the old head from frame 0 (everything inside the old head circle or above y=175)
      // Old head center in frame 0 is around (192, 100), radius ~88
      // But we keep cape and shoulders below y=180
      const oldData = tctx.getImageData(0, 0, 384, 384);
      const op = oldData.data;

      // In frame 0: old head is at cx=192, cy=100, radius=88
      for (let y = 0; y < 185; y++) {
        for (let x = 0; x < 384; x++) {
          const idx = (y * 384 + x) * 4;
          const dx = x - 192;
          const dy = y - 100;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 88) {
            op[idx + 3] = 0; // erase old head
          }
        }
      }
      tctx.putImageData(oldData, 0, 0);

      // Draw new head:
      // Target center: (192, 100), target diameter: 88 * 2 = 176
      // In hc: bubble center is (512, 460), radius = 390 (diameter 780)
      const targetRad = 86;
      const targetD = targetRad * 2;
      const scale = targetD / (bRad * 2);

      const destW = headSize * scale;
      const destH = headSize * scale;
      const destX = 192 - (bcX * scale);
      const destY = 100 - (bcY * scale);

      tctx.drawImage(hc, destX, destY, destW, destH);

      return testC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/test_frame0_blend.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved test_frame0_blend.png');
  ws.close();
  p.kill();
}

testExtractAndBlend().catch(console.error);
