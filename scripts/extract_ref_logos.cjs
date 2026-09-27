const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

async function extractReferenceLogos() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9298',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9298/json/list', r => {
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

  const origB64 = fs.readFileSync('public/assets/01-original.png').toString('base64');
  const rearB64 = fs.readFileSync('public/assets/dili_rear_ref.jpg').toString('base64');

  const script = `(async () => {
    const load = (b64, mime) => new Promise(res => {
      const img = new Image();
      img.src = 'data:' + mime + ';base64,' + b64;
      img.onload = () => res(img);
    });

    const orig = await load('${origB64}', 'image/png');
    const rear = await load('${rearB64}', 'image/jpeg');

    // Rear D logo in dili_rear_ref.jpg (1024x1024)
    // Cape is around center Y: 450..650, X: 400..600
    const rearC = document.createElement('canvas');
    rearC.width = 400; rearC.height = 400;
    const rCtx = rearC.getContext('2d');
    rCtx.drawImage(rear, 380, 440, 300, 300, 0, 0, 400, 400);

    // Front D logo in 01-original.png (300x300)
    // Chest logo is around center
    const origC = document.createElement('canvas');
    origC.width = 160; origC.height = 160;
    const oCtx = origC.getContext('2d');
    oCtx.drawImage(orig, 150, 140, 60, 60, 0, 0, 160, 160);

    return {
      rearLogo: rearC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''),
      origLogo: origC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
    };
  })()`;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/ref_rear_d_logo.png', Buffer.from(res.result.value.rearLogo, 'base64'));
  fs.writeFileSync('test-screenshots/ref_front_d_logo.png', Buffer.from(res.result.value.origLogo, 'base64'));
  console.log('Saved reference logos');
  ws.close();
  p.kill();
}
extractReferenceLogos().catch(console.error);
