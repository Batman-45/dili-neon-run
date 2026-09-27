const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

async function inspectBodies() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9248',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9248/json/list', r => {
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
  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + '${sheetB64}';
      await new Promise(r => img.onload = r);

      // Create a 8-frame body strip (below y=140) to inspect the running cycle
      const c = document.createElement('canvas');
      c.width = 384; c.height = 384;
      const ctx = c.getContext('2d');

      const bodyImages = [];
      for (let f = 0; f < 8; f++) {
        ctx.clearRect(0, 0, 384, 384);
        ctx.drawImage(img, f * 384, 0, 384, 384, 0, 0, 384, 384);
        bodyImages.push(c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''));
      }
      return bodyImages;
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  const frames = res.result.value;
  if (!fs.existsSync('test-screenshots/current_sheet_frames')) fs.mkdirSync('test-screenshots/current_sheet_frames', { recursive: true });
  frames.forEach((b64, i) => {
    fs.writeFileSync(`test-screenshots/current_sheet_frames/frame_${i}.png`, Buffer.from(b64, 'base64'));
  });
  console.log('Saved 8 frames to test-screenshots/current_sheet_frames/');
  ws.close();
  p.kill();
}
inspectBodies();
