const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function test() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9292',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9292/json/list', r => {
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

  const b64 = fs.readFileSync('test-screenshots/official_d_tight.png').toString('base64');
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + '${b64}';
      return new Promise(res => {
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const d = ctx.getImageData(0, 0, img.width, img.height).data;
          
          // Check center of the D (inner hole)
          const midX = Math.round(img.width * 0.45);
          const midY = Math.round(img.height * 0.45);
          const holeIdx = (midY * img.width + midX) * 4;
          
          res({
            width: img.width,
            height: img.height,
            centerAlpha: d[holeIdx + 3],
            sampleWhite: [d[10 * 4], d[10 * 4 + 1], d[10 * 4 + 2], d[10 * 4 + 3]]
          });
        };
      });
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Tight D stats:', res.result.value);
  ws.close();
  p.kill();
}
test().catch(console.error);
