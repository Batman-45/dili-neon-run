const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function inspect() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9290',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9290/json/list', r => {
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
  const diliB64 = fs.readFileSync('public/assets/dili.png').toString('base64');

  const script = `
    (async () => {
      const load = (b64) => new Promise(res => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        img.onload = () => res(img);
      });
      const sheet = await load('${sheetB64}');
      const dili = await load('${diliB64}');

      // Inspect dili.png head
      const dc = document.createElement('canvas');
      dc.width = dili.width; dc.height = dili.height;
      const dctx = dc.getContext('2d');
      dctx.drawImage(dili, 0, 0);

      // Inspect frame 0 of sheet
      const sc = document.createElement('canvas');
      sc.width = 384; sc.height = 384;
      const sctx = sc.getContext('2d');
      sctx.drawImage(sheet, 0, 0, 384, 384, 0, 0, 384, 384);

      // Find bounds of head in frame 0 (Y from 0 to 200)
      const sd = sctx.getImageData(0, 0, 384, 200).data;
      let minX = 384, maxX = 0, minY = 200, maxY = 0;
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 384; x++) {
          const a = sd[(y * 384 + x) * 4 + 3];
          if (a > 15) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }

      return {
        dili: { w: dili.width, h: dili.height },
        frame0_head_bounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX)/2, cy: (minY + maxY)/2 }
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Result:', JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}

inspect().catch(console.error);
