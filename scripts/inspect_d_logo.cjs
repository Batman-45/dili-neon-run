const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

async function sliceAndCrop() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9299',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9299/json/list', r => {
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
  const script = `(async () => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + '${sheetB64}';
    await new Promise(r => img.onload = r);
    const c = document.createElement('canvas');
    c.width = 384; c.height = 384;
    const ctx = c.getContext('2d');

    const crops = [];
    for (let f = 0; f < 8; f++) {
      ctx.clearRect(0, 0, 384, 384);
      ctx.drawImage(img, f * 384, 0, 384, 384, 0, 0, 384, 384);
      const fullFrame = c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');

      // crop back/torso region (X: 112..272, Y: 170..290)
      const cc = document.createElement('canvas');
      cc.width = 160; cc.height = 120;
      const cctx = cc.getContext('2d');
      cctx.drawImage(c, 112, 170, 160, 120, 0, 0, 160, 120);
      const crop = cc.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');

      crops.push({ f, fullFrame, crop });
    }
    return crops;
  })()`;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  const outDir = path.resolve('test-screenshots/current_sheet_frames');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const item of res.result.value) {
    fs.writeFileSync(path.join(outDir, `frame_${item.f}.png`), Buffer.from(item.fullFrame, 'base64'));
    fs.writeFileSync(path.join(outDir, `crop_${item.f}.png`), Buffer.from(item.crop, 'base64'));
  }
  console.log('Saved 8 frames and crops');
  ws.close();
  p.kill();
}
sliceAndCrop().catch(console.error);
