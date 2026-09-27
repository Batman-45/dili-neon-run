const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function inspectNeckTransition() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9294',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9294/json/list', r => {
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

      // In each frame, find where the purple hair ends at the bottom
      // and where the pink hoodie/cape begins
      const frames = [];
      for (let f = 0; f < 8; f++) {
        const ox = f * 384;
        let lowestPurpleY = 0;
        let highestPinkY = 384;
        let highestCapeY = 384;
        let highestBackpackY = 384;

        for (let y = 50; y < 240; y++) {
          for (let x = ox + 100; x < ox + 284; x++) {
            const idx = (y * (384 * 8) + x) * 4;
            const r = ctx.getImageData(x, y, 1, 1).data[0];
            const g = ctx.getImageData(x, y, 1, 1).data[1];
            const b = ctx.getImageData(x, y, 1, 1).data[2];
            const a = ctx.getImageData(x, y, 1, 1).data[3];
            if (a < 50) continue;

            // Hair (dark purple)
            if (r < 100 && b > 40 && b > g && r > g) {
              if (y > lowestPurpleY) lowestPurpleY = y;
            }
            // Pink hoodie (bright pink/rose)
            if (r > 180 && g < 160 && b > 140) {
              if (y < highestPinkY) highestPinkY = y;
            }
            // Cape (deep magenta/violet)
            if (r > 140 && g < 50 && b > 140) {
              if (y < highestCapeY) highestCapeY = y;
            }
            // Backpack (dark grey / black)
            if (r < 60 && g < 60 && b < 60) {
              if (y < highestBackpackY) highestBackpackY = y;
            }
          }
        }
        frames.push({ frame: f, lowestPurpleY, highestPinkY, highestCapeY, highestBackpackY });
      }
      return frames;
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Neck transition across frames:', JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}

inspectNeckTransition().catch(console.error);
