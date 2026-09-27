const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

async function inspectRef() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9244',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9244/json/list', r => {
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

  const refB64 = fs.readFileSync('public/assets/dili_rear_ref.jpg').toString('base64');
  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + '${refB64}';
      await new Promise(r => img.onload = r);
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height);
      const p = d.data;

      // Find bounding box of non-white pixels (where r,g,b < 240)
      let minX = img.width, maxX = 0, minY = img.height, maxY = 0;
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const idx = (y * img.width + x) * 4;
          const r = p[idx], g = p[idx+1], b = p[idx+2];
          if (r < 240 || g < 240 || b < 240) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Find helmet glass rim edge:
      // Helmet is at the top of the character.
      // Let's check rows y from 80 to 450 to find the left and right glass rim edges
      const glassPoints = [];
      for (let y = 110; y < 450; y += 10) {
        let leftX = -1, rightX = -1;
        for (let x = 200; x < 820; x++) {
          const idx = (y * img.width + x) * 4;
          const r = p[idx], g = p[idx+1], b = p[idx+2];
          // Check for darker glass rim or reflection against white background (< 245)
          if (r < 245 || g < 245 || b < 245) {
            if (leftX === -1) leftX = x;
            rightX = x;
          }
        }
        if (leftX !== -1 && rightX !== -1) {
          glassPoints.push({ y, leftX, rightX, cx: (leftX + rightX)/2, width: rightX - leftX });
        }
      }

      // Also let's inspect the hood / neck connection at y: 400 to 520
      const neckInfo = [];
      for (let y = 410; y <= 490; y += 10) {
        let hairLeft = -1, hairRight = -1;
        let hoodLeft = -1, hoodRight = -1;
        for (let x = 300; x < 720; x++) {
          const idx = (y * img.width + x) * 4;
          const r = p[idx], g = p[idx+1], b = p[idx+2];
          // Purple hair: b > 80, g < 100, r > 60
          if (b > g + 15 && r > g) {
            if (hairLeft === -1) hairLeft = x;
            hairRight = x;
          }
          // Pink hoodie: r > 180, g > 120, b > 150
          if (r > 180 && g > 110 && b > 140 && Math.abs(r - b) < 60) {
            if (hoodLeft === -1) hoodLeft = x;
            hoodRight = x;
          }
        }
        neckInfo.push({ y, hairLeft, hairRight, hoodLeft, hoodRight });
      }

      return { width: img.width, height: img.height, minX, maxX, minY, maxY, glassPoints, neckInfo };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Result:', JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}
inspectRef();
