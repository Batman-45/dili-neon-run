const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9311;

async function prepareSlideAssets() {
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

  const img1Path = 'C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\e1da6ab2-d590-402c-a5f4-7e543392a40f\\dili_slide_rear_1790500941746.jpg';
  const img2Path = 'C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\e1da6ab2-d590-402c-a5f4-7e543392a40f\\dili_slide_rear_straight_1790501004777.jpg';

  const b64_1 = fs.readFileSync(img1Path).toString('base64');
  const b64_2 = fs.readFileSync(img2Path).toString('base64');

  const script = `
    (async () => {
      const load = (b64) => new Promise(res => {
        const img = new Image();
        img.src = 'data:image/jpeg;base64,' + b64;
        img.onload = () => res(img);
      });

      const [img1, img2] = await Promise.all([load('${b64_1}'), load('${b64_2}')]);

      // Function to isolate character on white background
      function cutout(img, isStraight = false) {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const idata = ctx.getImageData(0, 0, c.width, c.height);
        const d = idata.data;
        const w = c.width, h = c.height;

        // Flood fill from corners (0,0) and (w-1, 0)
        // Background is light grey/white or asphalt road at bottom
        // For isStraight: top is white/grey studio, bottom is road
        return { w, h };
      }

      return { res1: cutout(img1, false), res2: cutout(img2, true) };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Result:', res.result?.value);

  ws.close();
  p.kill();
}

prepareSlideAssets().catch(console.error);
