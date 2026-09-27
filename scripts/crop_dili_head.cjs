const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function cropDiliHead() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9315',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9315/json/list', r => {
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

  const diliB64 = fs.readFileSync('public/assets/dili.png').toString('base64');

  const script = `
    (async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + '${diliB64}';
      await new Promise(r => img.onload = r);

      // Crop head area from dili.png: x: 80..260, y: 15..175 (180x160)
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 70, 15, 200, 200, 0, 0, 200, 200);
      return c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/dili_head_reference_crop.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved dili_head_reference_crop.png');
  ws.close();
  p.kill();
}

cropDiliHead().catch(console.error);
