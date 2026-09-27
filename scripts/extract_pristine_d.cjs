const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

async function extractPristineD() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9296',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9296/json/list', r => {
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

    // Let's inspect the D in rear ref:
    // It's located in the window X: 395..615, Y: 460..620
    const w = 240, h = 180;
    const sx = 390, sy = 455;
    const imgData = ctx.getImageData(sx, sy, w, h);
    const d = imgData.data;

    // Create high-res isolated D asset
    const outC = document.createElement('canvas');
    outC.width = w; outC.height = h;
    const outCtx = outC.getContext('2d');
    const outData = outCtx.createImageData(w, h);
    const op = outData.data;

    // We want the pure white D with its subtle cape shadow / purple rim
    // The cape background is magenta/purple: R ~ 180..200, G ~ 30..65, B ~ 180..220
    // The white D is: R > 230, G > 220, B > 230
    // The antialiased boundary is where G transitions from ~60 to ~230
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = d[idx], g = d[idx+1], b = d[idx+2];

        // Is it inside the D region?
        // Note: the top of the window may touch the hood (Y < 15)
        if (y < 12 && r > 210 && g > 150 && b > 190) {
          // Hood edge, ignore
          continue;
        }

        // Color separation:
        // Background purple has high R and B, but LOW G (G < 70)
        // White D has high G (G > 180)
        let alpha = 0;
        if (g > 190) {
          alpha = 1.0;
        } else if (g > 65) {
          alpha = (g - 65) / (190 - 65);
          // Ease alpha
          alpha = Math.max(0, Math.min(1, alpha));
        }

        if (alpha > 0) {
          // Clean white core with subtle soft purple shading at the edge
          // If alpha is high, pure white
          if (alpha > 0.8) {
            op[idx] = 255;
            op[idx+1] = 255;
            op[idx+2] = 255;
            op[idx+3] = Math.round(255 * alpha);
          } else {
            // Edge transition: preserve soft anti-aliased white with subtle tint
            op[idx] = 255;
            op[idx+1] = Math.round(220 + 35 * alpha);
            op[idx+2] = 255;
            op[idx+3] = Math.round(255 * alpha);
          }
        }
      }
    }
    outCtx.putImageData(outData, 0, 0);

    return outC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
  })()`;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/pristine_ref_d.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved pristine extracted D');
  ws.close();
  p.kill();
}
extractPristineD().catch(console.error);
