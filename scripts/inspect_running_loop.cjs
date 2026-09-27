const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function inspectRunningLoop() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9302',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9302/json/list', r => {
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
      const load = (b64) => new Promise(res => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        img.onload = () => res(img);
      });
      const sheet = await load('${sheetB64}');

      // In each frame, find the collar/neck center
      // The neck is at Y ~ 170-178
      const neckPositions = [];
      const c = document.createElement('canvas');
      c.width = 384; c.height = 384;
      const ctx = c.getContext('2d');

      for (let f = 0; f < 8; f++) {
        ctx.clearRect(0, 0, 384, 384);
        ctx.drawImage(sheet, f * 384, 0, 384, 384, 0, 0, 384, 384);

        // Find the pink hoodie collar center around y = 175
        let sumX = 0, count = 0;
        let minY = 384, maxY = 0;
        for (let y = 165; y <= 185; y++) {
          for (let x = 0; x < 384; x++) {
            const p = ctx.getImageData(x, y, 1, 1).data;
            // pink hoodie color: r > 180, g in 90..160, b > 140
            if (p[3] > 150 && p[0] > 170 && p[1] < 165 && p[2] > 130) {
              sumX += x;
              count++;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        neckPositions.push({
          frame: f,
          collarX: count ? Math.round(sumX / count) : 192,
          collarMinY: minY,
          collarMaxY: maxY,
          count
        });
      }
      return neckPositions;
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Neck positions per frame:', JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}

inspectRunningLoop().catch(console.error);
