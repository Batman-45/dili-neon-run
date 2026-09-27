const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9314;

async function checkPixels() {
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

  const slideJpgPath = 'C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\e1da6ab2-d590-402c-a5f4-7e543392a40f\\dili_slide_rear_clean_1790501174086.jpg';
  const slideB64 = fs.readFileSync(slideJpgPath).toString('base64');

  const script = `
    (async () => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + '${slideB64}';
      await new Promise(r => img.onload = r);
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height).data;

      const p1 = [d[0], d[1], d[2], d[3]]; // 0,0
      const p2 = [d[512*4], d[512*4+1], d[512*4+2]]; // 512,0
      const p3 = [d[(1023*1024 + 10)*4], d[(1023*1024 + 10)*4+1], d[(1023*1024 + 10)*4+2]]; // 10, 1023
      return { p1, p2, p3 };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Pixels:', res.result?.value);
  ws.close();
  p.kill();
}
checkPixels().catch(console.error);
