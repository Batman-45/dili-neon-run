const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function findCollar() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9346',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9346/json/list', r => {
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
  const script = `
    (async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + '${f1B64}';
      await new Promise(r => img.onload = r);
      const c = document.createElement('canvas');
      c.width = 384; c.height = 384;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, 384, 384).data;

      const res = {};
      [220, 230, 240, 250, 260].forEach(x => {
        const rows = [];
        for (let y = 170; y <= 195; y++) {
          const idx = (y * 384 + x) * 4;
          rows.push({ y, rgba: [data[idx], data[idx+1], data[idx+2], data[idx+3]] });
        }
        res[x] = rows;
      });
      return res;
    })()
  `;
  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}
findCollar().catch(console.error);
