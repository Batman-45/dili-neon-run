const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9323;

async function checkCyberHighway() {
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

  const bgB64 = fs.readFileSync('test-screenshots/slide_verification/1_normal_running.png').toString('base64');
  const slideB64 = fs.readFileSync('public/assets/dili_slide.png').toString('base64');

  const script = `
    (async () => {
      const load = (b64) => new Promise(res => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        img.onload = () => res(img);
      });

      const [bgImg, slideImg] = await Promise.all([load('${bgB64}'), load('${slideB64}')]);

      // 1280x720 canvas
      const c = document.createElement('canvas');
      c.width = 1280; c.height = 720;
      const ctx = c.getContext('2d');

      // Draw original gameplay background
      ctx.drawImage(bgImg, 0, 0);

      // In 1_normal_running.png, Dili center is at x ~ 640, baseline y ~ 640
      // In 384x384 sprite, drawn on plane size 2.65m
      // Let's crop just the road region around Dili to erase the standing Dili:
      // Let's draw slideImg over Dili at the exact same lane center & baseline!
      // In 1_normal_running.png, standing Dili head is at y ~ 450, feet at y ~ 640. Height ~ 190 screen px
      // For slide: feet at y ~ 640, height ~ 145 screen px!
      const targetScreenH = 190 * (224 / 294); // ~145px
      const targetScreenW = targetScreenH * (384 / 384);
      const drawX = 640 - (targetScreenW / 2);
      const drawY = 640 - targetScreenH;

      // Dark patch to cover upright runner
      ctx.fillStyle = '#060a14';
      ctx.beginPath();
      ctx.ellipse(640, 540, 60, 100, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw road lane markings
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(640, 500); ctx.lineTo(640, 650);
      ctx.stroke();

      // Draw slide sprite
      ctx.drawImage(slideImg, drawX, drawY, targetScreenW, targetScreenH);

      return c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/slide_candidates/preview_in_cyber_highway.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved preview_in_cyber_highway.png');

  ws.close();
  p.kill();
}

checkCyberHighway().catch(console.error);
