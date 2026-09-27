const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function testCollarCut() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9299',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9299/json/list', r => {
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

      // 1. Process head asset (extract pure bubble + hair + neck base)
      const hc = document.createElement('canvas');
      hc.width = 1024; hc.height = 1024;
      const hctx = hc.getContext('2d');
      hctx.drawImage(headImg, 0, 0);

      const hData = hctx.getImageData(0, 0, 1024, 1024);
      const hp = hData.data;

      const bcX = 512;
      const bcY = 460;
      const bRad = 390;

      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const dx = x - bcX;
          const dy = y - bcY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Below the sphere, keep only the collar neck segment (y <= bcY + bRad + 10)
          if (dist > bRad + 0.5) {
            if (y > bcY + bRad * 0.8 && y <= bcY + bRad + 12 && Math.abs(dx) < bRad * 0.45) {
              const r = hp[idx], g = hp[idx+1], b = hp[idx+2];
              if (r > 240 && g > 240 && b > 240) {
                hp[idx+3] = 0;
              }
            } else {
              hp[idx + 3] = 0;
            }
          } else if (dist > bRad - 2.5) {
            const edgeAlpha = Math.max(0, Math.min(1, (bRad + 0.5 - dist) / 3));
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

      // Erase old head from frame 1
      const f1Data = outCtx.getImageData(0, 0, 384, 384);
      const fp = f1Data.data;
      const oldCx = 224.5;
      const oldCy = 101.5;
      const oldRad = 87.5;

      for (let y = 0; y < 184; y++) {
        for (let x = 0; x < 384; x++) {
          const idx = (y * 384 + x) * 4;
          const dx = x - oldCx;
          const dy = y - oldCy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < oldRad) {
            // Keep existing collar pixels near bottom edge (y > 176) to blend smoothly
            if (y <= 176) {
              fp[idx + 3] = 0;
            } else {
              const blend = (y - 176) / 8;
              fp[idx + 3] = Math.round(fp[idx + 3] * blend);
            }
          }
        }
      }
      outCtx.putImageData(f1Data, 0, 0);

      // Draw new head:
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
  fs.writeFileSync('test-screenshots/test_collar_cut.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved test_collar_cut.png');
  ws.close();
  p.kill();
}

testCollarCut().catch(console.error);
