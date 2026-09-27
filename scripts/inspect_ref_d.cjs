const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

async function inspectRefD() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9297',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9297/json/list', r => {
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

    // Let's find bounding box of the white D in dili_rear_ref.jpg
    // In dili_rear_ref.jpg, cape is around X: 350..650, Y: 440..650
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const d = imgData.data;

    let minX = 1024, maxX = 0, minY = 1024, maxY = 0;
    for (let y = 450; y < 650; y++) {
      for (let x = 380; x < 620; x++) {
        const idx = (y * 1024 + x) * 4;
        const r = d[idx], g = d[idx+1], b = d[idx+2];
        // White D has high RGB, whereas cape is purple (R ~ 180, G ~ 40, B ~ 190)
        // Check whiteness:
        if (r > 210 && g > 200 && b > 210) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Now extract the D into an isolated RGBA canvas
    // Bounding box with margin:
    const pad = 20;
    const cropX = minX - pad;
    const cropY = minY - pad;
    const cropW = (maxX - minX) + pad * 2;
    const cropH = (maxY - minY) + pad * 2;

    const dCanvas = document.createElement('canvas');
    dCanvas.width = cropW;
    dCanvas.height = cropH;
    const dCtx = dCanvas.getContext('2d');
    dCtx.drawImage(c, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    // Also extract cleanly with alpha (color separation from purple cape)
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = cropW;
    alphaCanvas.height = cropH;
    const aCtx = alphaCanvas.getContext('2d');
    const aData = aCtx.createImageData(cropW, cropH);
    const ap = aData.data;

    const sourceData = dCtx.getImageData(0, 0, cropW, cropH).data;

    for (let i = 0; i < sourceData.length; i += 4) {
      const r = sourceData[i];
      const g = sourceData[i+1];
      const b = sourceData[i+2];

      // In the purple cape:
      // Cape color is around R: 180..200, G: 35..65, B: 180..220
      // White D is R: 250..255, G: 245..255, B: 250..255
      // Key discriminator is G (green channel): cape has G < 75, white D has G > 200!
      // In transition pixels, green channel smoothly interpolates from ~55 up to ~250!
      const capeG = 50;
      const whiteG = 240;
      const alpha = Math.max(0, Math.min(1, (g - capeG) / (whiteG - capeG)));

      if (alpha > 0.01) {
        ap[i] = 255;
        ap[i+1] = 255;
        ap[i+2] = 255;
        ap[i+3] = Math.round(alpha * 255);
      } else {
        ap[i+3] = 0;
      }
    }
    aCtx.putImageData(aData, 0, 0);

    return {
      bounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
      rawCrop: dCanvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''),
      isolatedAlpha: alphaCanvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
    };
  })()`;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('D bounds in ref:', res.result.value.bounds);
  fs.writeFileSync('test-screenshots/ref_d_raw.png', Buffer.from(res.result.value.rawCrop, 'base64'));
  fs.writeFileSync('test-screenshots/ref_d_isolated.png', Buffer.from(res.result.value.isolatedAlpha, 'base64'));
  console.log('Saved isolated D logo');
  ws.close();
  p.kill();
}
inspectRefD().catch(console.error);
