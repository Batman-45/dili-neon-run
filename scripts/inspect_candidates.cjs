const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9333;

async function run() {
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    'about:blank',
  ]);

  await new Promise(r => setTimeout(r, 1500));

  const list = await new Promise((res, rej) => http.get(`http://localhost:${port}/json/list`, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
  }).on('error', rej));

  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (m, params = {}) => new Promise((res, rej) => {
    const i = id++;
    const onm = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === i) { ws.removeEventListener('message', onm); if (msg.error) rej(msg.error); else res(msg.result); }
    };
    ws.addEventListener('message', onm);
    ws.send(JSON.stringify({ id: i, method: m, params }));
  });
  await send('Runtime.enable');

  const img1Path = 'C:\\Users\\SHREE\\.gemini\antigravity-ide\\brain\\4fff2623-b932-42f8-a7a0-82fd85cdea87\\dili_3d_runner_8frames_1790355758616.jpg';
  const img2Path = 'C:\\Users\\SHREE\\.gemini\antigravity-ide\\brain\\4fff2623-b932-42f8-a7a0-82fd85cdea87\\dili_3d_running_spritesheet_1790355677508.jpg';
  const rearViewPath = 'C:\\Users\\SHREE\\.gemini\antigravity-ide\\brain\\4fff2623-b932-42f8-a7a0-82fd85cdea87\\dili_mascot_rear_view_1790355607832.jpg';

  const b64_1 = fs.readFileSync(img1Path).toString('base64');
  const b64_2 = fs.readFileSync(img2Path).toString('base64');
  const b64_rear = fs.readFileSync(rearViewPath).toString('base64');

  const evalCode = `(async () => {
    const load = (b64, mime='image/jpeg') => new Promise(res => {
      const img = new Image();
      img.src = 'data:' + mime + ';base64,' + b64;
      img.onload = () => res(img);
    });

    const img1 = await load('${b64_1}');
    const img2 = await load('${b64_2}');
    const imgRear = await load('${b64_rear}');

    return {
      img1: { w: img1.width, h: img1.height },
      img2: { w: img2.width, h: img2.height },
      imgRear: { w: imgRear.width, h: imgRear.height },
    };
  })()`;

  const result = await send('Runtime.evaluate', { expression: evalCode, awaitPromise: true, returnByValue: true });
  console.log('Image dimensions:', result.value);

  ws.close();
  chromeProc.kill();
}

run().catch(console.error);
