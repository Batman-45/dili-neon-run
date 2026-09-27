const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function testFrame1Replacement() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9298',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9298/json/list', r => {
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

  const f1B64 = fs.readFileSync('test-screenshots/frames/frame_1.png').toString('base64');
  const headB64 = fs.readFileSync('C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\d86d48cc-c83b-4c0a-a996-4889df60c7b4\\dili_rear_head_test_1790327217548.jpg').toString('base64');

  const script = `
    (async () => {
      const load = (b64, mime='image/png') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });
      const f1 = await load('${f1B64}', 'image/png');
      const headImg = await load('${headB64}', 'image/jpeg');

      // 1. Prepare clean head asset (1024x1024)
      const hc = document.createElement('canvas');
      hc.width = 1024; hc.height = 1024;
      const hctx = hc.getContext('2d');
      hctx.drawImage(headImg, 0, 0);

      const hData = hctx.getImageData(0, 0, 1024, 1024);
      const hp = hData.data;

      const bcX = 512;
      const bcY = 460;
      const bRad = 390;

      // Extract helmet & hair with smooth circular antialiased perimeter
      // Keep hood connection at the bottom up to where it meets the hoodie
      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const dx = x - bcX;
          const dy = y - bcY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > bRad + 1) {
            // Check if it's the pink hoodie fold below the helmet (y > 750)
            if (y > bcY + bRad * 0.72 && Math.abs(dx) < bRad * 0.65) {
              const r = hp[idx], g = hp[idx+1], b = hp[idx+2];
              // Background white removal
              if (r > 240 && g > 240 && b > 240) {
                hp[idx + 3] = 0;
              } else if (y > 890) {
                // Soft fade at the bottom of the hood fold
                const fade = Math.max(0, 1 - (y - 890) / 40);
                hp[idx + 3] = Math.round(hp[idx + 3] * fade);
              }
            } else {
              hp[idx + 3] = 0;
            }
          } else if (dist > bRad - 2.5) {
            // Antialias outer edge of glass bubble
            const edgeAlpha = Math.max(0, Math.min(1, (bRad + 1 - dist) / 3.5));
            hp[idx + 3] = Math.round(hp[idx + 3] * edgeAlpha);
          }
        }
      }
      hctx.putImageData(hData, 0, 0);

      // 2. Composite onto frame 1
      const outC = document.createElement('canvas');
      outC.width = 384; outC.height = 384;
      const outCtx = outC.getContext('2d');

      // Draw original frame 1
      outCtx.drawImage(f1, 0, 0);

      // Remove the old head from frame 1
      // Old head center is at (224.5, 101.5), radius ~87.5
      const f1Data = outCtx.getImageData(0, 0, 384, 384);
      const fp = f1Data.data;
      const oldCx = 224.5;
      const oldCy = 101.5;
      const oldRad = 87.5;

      for (let y = 0; y < 185; y++) {
        for (let x = 0; x < 384; x++) {
          const idx = (y * 384 + x) * 4;
          const dx = x - oldCx;
          const dy = y - oldCy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < oldRad - 1) {
            // Only clear pixels that are part of the old head (hair / bubble / old visor edge)
            // But do not erase the cape on the left if y > 165
            if (y < 172 || (x > 180 && x < 280)) {
              fp[idx + 3] = 0;
            }
          }
        }
      }
      outCtx.putImageData(f1Data, 0, 0);

      // Target head position in frame 1:
      // Center at (224.5, 101.5), radius = 87.5
      const targetRad = 87.5;
      const scale = targetRad / bRad;
      const destW = 1024 * scale;
      const destH = 1024 * scale;
      const destX = oldCx - (bcX * scale);
      const destY = oldCy - (bcY * scale);

      outCtx.drawImage(hc, destX, destY, destW, destH);

      return outC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/test_frame1_blend.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved test_frame1_blend.png');
  ws.close();
  p.kill();
}

testFrame1Replacement().catch(console.error);
