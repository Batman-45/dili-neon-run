const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

async function checkRefBackground() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9245',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9245/json/list', r => {
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

      // Sample corners
      const corners = [
        [10, 10], [500, 10], [1000, 10],
        [10, 500], [1000, 500],
        [10, 1000], [1000, 1000]
      ].map(([x, y]) => {
        const idx = (y * 1024 + x) * 4;
        return { x, y, r: p[idx], g: p[idx+1], b: p[idx+2] };
      });

      // Let's find the helmet top, left, right, bottom
      // In rows y: 50 to 500, find pixels that clearly deviate from pure background (e.g. diff with (248, 248, 250))
      // Sample background at (50, 50):
      const bgR = p[50 * 1024 * 4 + 50 * 4];
      const bgG = p[50 * 1024 * 4 + 50 * 4 + 1];
      const bgB = p[50 * 1024 * 4 + 50 * 4 + 2];

      const edgePoints = [];
      for (let y = 90; y <= 450; y += 15) {
        let leftX = -1, rightX = -1;
        for (let x = 100; x < 900; x++) {
          const idx = (y * 1024 + x) * 4;
          const dr = Math.abs(p[idx] - bgR);
          const dg = Math.abs(p[idx+1] - bgG);
          const db = Math.abs(p[idx+2] - bgB);
          if (dr > 12 || dg > 12 || db > 12) {
            if (leftX === -1) leftX = x;
            rightX = x;
          }
        }
        if (leftX !== -1 && rightX !== -1) {
          edgePoints.push({ y, leftX, rightX, cx: (leftX + rightX) / 2, r: (rightX - leftX) / 2 });
        }
      }

      return { corners, bg: { bgR, bgG, bgB }, edgePoints };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Result:', JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}
checkRefBackground();
