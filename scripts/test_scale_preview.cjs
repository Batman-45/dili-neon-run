const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function testScale() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9350',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9350/json/list', r => {
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

  const b64 = fs.readFileSync('test-screenshots/test_v2_perfect_hug_v4.png').toString('base64');
  const script = `
    (async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + '${b64}';
      await new Promise(r => img.onload = r);

      // Create a comparison canvas: full size (384), 180px, 120px, 90px
      const c = document.createElement('canvas');
      c.width = 768; c.height = 384;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, 768, 384);

      // Full
      ctx.drawImage(img, 0, 0, 384, 384);
      // 180px
      ctx.drawImage(img, 400, 10, 180, 180);
      // 120px
      ctx.drawImage(img, 600, 10, 120, 120);
      // 90px (typical gameplay size!)
      ctx.drawImage(img, 600, 150, 90, 90);

      return c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
    })()
  `;
  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/test_gameplay_sizes.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved test_gameplay_sizes.png');
  ws.close();
  p.kill();
}
testScale().catch(console.error);
