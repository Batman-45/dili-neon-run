const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

async function checkStrip() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9250',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9250/json/list', r => {
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

  const stripB64 = fs.readFileSync('public/assets/dili_3d_strip.jpg').toString('base64');
  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + '${stripB64}';
      await new Promise(r => img.onload = r);
      return { width: img.width, height: img.height };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Strip dimensions:', res.result.value);
  ws.close();
  p.kill();
}
checkStrip();
