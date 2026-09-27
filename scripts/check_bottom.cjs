const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9324;

async function checkBottom() {
  const p = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));

  const list = await new Promise(res => http.get(`http://localhost:${port}/json/list`, r => {
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

  const slideB64 = fs.readFileSync('public/assets/dili_slide.png').toString('base64');

  const script = `
    (async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + '${slideB64}';
      await new Promise(r => img.onload = r);
      const c = document.createElement('canvas');
      c.width = 384; c.height = 384;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const d = ctx.getImageData(0, 0, 384, 384).data;
      // Crop bottom region: y in [330, 370]
      const cropC = document.createElement('canvas');
      cropC.width = 384; cropC.height = 50;
      const cctx = cropC.getContext('2d');
      cctx.drawImage(c, 0, 330, 384, 50, 0, 0, 384, 50);

      return cropC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/slide_candidates/bottom_crop.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved bottom_crop.png');

  ws.close();
  p.kill();
}

checkBottom().catch(console.error);
