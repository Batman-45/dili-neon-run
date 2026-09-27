const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function testNaturalBlend() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9301',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9301/json/list', r => {
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

      // Head bubble center: (512, 460), radius = 390
      // In headImg, the bottom of the glass sphere is at Y = 460 + 390 = 850.
      // The neck is inside the sphere from Y = 710 to 850.
      // Below Y = 850 is the pink hoodie collar (850 to 920).
      
      const hc = document.createElement('canvas');
      hc.width = 1024; hc.height = 1024;
      const hctx = hc.getContext('2d');
      hctx.drawImage(headImg, 0, 0);

      const hData = hctx.getImageData(0, 0, 1024, 1024);
      const hp = hData.data;

      const bcX = 512;
      const bcY = 460;
      const bRad = 390;

      // Extract the head:
      // The sphere is kept for all points with dist <= bRad.
      // At the bottom of the sphere (near Y=850), the glass bubble has its lower rim.
      // Below the sphere, the hoodie collar is in the center (|dx| < 180) from y = 850 to 890.
      // We create a smooth U-shaped fade for the collar so it drapes naturally over the existing hood.
      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const dx = x - bcX;
          const dy = y - bcY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= bRad - 2) {
            // Inside glass sphere: 100% keep!
          } else if (dist <= bRad + 1) {
            // Antialias outer sphere edge
            const alpha = (bRad + 1 - dist) / 3;
            hp[idx + 3] = Math.round(hp[idx + 3] * Math.max(0, Math.min(1, alpha)));
          } else {
            // Outside sphere:
            // Only keep the soft collar directly under the helmet center
            const collarCenterY = 850;
            const collarBottomY = 895;
            if (y >= collarCenterY && y <= collarBottomY && Math.abs(dx) < 160) {
              const r = hp[idx], g = hp[idx+1], b = hp[idx+2];
              if (r > 240 && g > 240 && b > 240) {
                hp[idx + 3] = 0; // white background
              } else {
                // Soft radial/vertical falloff towards collar bottom
                const dyCollar = (y - collarCenterY) / (collarBottomY - collarCenterY);
                const dxCollar = Math.abs(dx) / 160;
                const falloff = Math.max(0, 1 - Math.sqrt(dyCollar * dyCollar + dxCollar * dxCollar));
                hp[idx + 3] = Math.round(hp[idx + 3] * falloff);
              }
            } else {
              hp[idx + 3] = 0;
            }
          }
        }
      }
      hctx.putImageData(hData, 0, 0);

      // Now composite onto frame 1:
      const outC = document.createElement('canvas');
      outC.width = 384; outC.height = 384;
      const outCtx = outC.getContext('2d');
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
            if (y <= 174) {
              fp[idx + 3] = 0;
            } else {
              const blend = (y - 174) / 10;
              fp[idx + 3] = Math.round(fp[idx + 3] * blend);
            }
          }
        }
      }
      outCtx.putImageData(f1Data, 0, 0);

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
  fs.writeFileSync('test-screenshots/test_natural_blend.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved test_natural_blend.png');
  ws.close();
  p.kill();
}

testNaturalBlend().catch(console.error);
