const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function inspectAllFrames() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9351',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9351/json/list', r => {
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
  const script = `
    (async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + '${sheetB64}';
      await new Promise(r => img.onload = r);

      const c = document.createElement('canvas');
      c.width = 3072; c.height = 384;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const frames = [];
      for (let f = 0; f < 8; f++) {
        const frameData = ctx.getImageData(f * 384, 0, 384, 384);
        const data = frameData.data;

        // Find collar top crest (search for pink hoodie cloth: r > 160, g > 90, b > 140, r - g > 40)
        let minCollarY = 384;
        let collarX = -1;
        for (let x = 120; x < 280; x++) {
          for (let y = 140; y < 220; y++) {
            const idx = (y * 384 + x) * 4;
            const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
            if (a > 200 && r > 165 && g > 90 && b > 140 && (r - g > 40) && !(Math.abs(r - g) < 25)) {
              if (y < minCollarY) {
                minCollarY = y;
                collarX = x;
              }
            }
          }
        }
        frames.push({ frame: f, minCollarY, collarX });
      }
      return frames;
    })()
  `;
  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('All frames collar points:', res.result.value);
  ws.close();
  p.kill();
}
inspectAllFrames().catch(console.error);
