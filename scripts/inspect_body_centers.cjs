const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function inspectBodyCenters() {
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

  const sheetB64 = fs.readFileSync('public/assets/dili_runner_sheet.png').toString('base64');

  const script = `
    (async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + '${sheetB64}';
      await new Promise(r => img.onload = r);

      const c = document.createElement('canvas');
      c.width = 384 * 8; c.height = 384;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const frames = [];
      for (let f = 0; f < 8; f++) {
        const ox = f * 384;

        // Measure backpack center (y: 200..260, black backpack)
        let bpMinX = 384, bpMaxX = 0;
        let bpCount = 0;
        let bpSumX = 0;

        for (let y = 200; y < 270; y++) {
          for (let x = 0; x < 384; x++) {
            const idx = (y * (384 * 8) + (ox + x)) * 4;
            const r = ctx.getImageData(ox + x, y, 1, 1).data[0];
            const g = ctx.getImageData(ox + x, y, 1, 1).data[1];
            const b = ctx.getImageData(ox + x, y, 1, 1).data[2];
            const a = ctx.getImageData(ox + x, y, 1, 1).data[3];
            if (a > 100 && r < 55 && g < 55 && b < 55) {
              if (x < bpMinX) bpMinX = x;
              if (x > bpMaxX) bpMaxX = x;
              bpSumX += x;
              bpCount++;
            }
          }
        }

        // Measure old head center (y: 40..140)
        let headMinX = 384, headMaxX = 0;
        let headCount = 0;
        let headSumX = 0;
        for (let y = 40; y < 140; y++) {
          for (let x = 0; x < 384; x++) {
            const a = ctx.getImageData(ox + x, y, 1, 1).data[3];
            if (a > 100) {
              if (x < headMinX) headMinX = x;
              if (x > headMaxX) headMaxX = x;
              headSumX += x;
              headCount++;
            }
          }
        }

        frames.push({
          f,
          backpack: { minX: bpMinX, maxX: bpMaxX, avgX: bpCount ? (bpSumX/bpCount) : 0 },
          head: { minX: headMinX, maxX: headMaxX, avgX: headCount ? (headSumX/headCount) : 0, cx: (headMinX+headMaxX)/2 }
        });
      }
      return frames;
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Frame centers:', JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}

inspectBodyCenters().catch(console.error);
