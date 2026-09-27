const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function findGlare() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9286',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9286/json/list', r => {
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

  const f3B64 = fs.readFileSync('public/assets/3d_frames/frame_3.png').toString('base64');
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + '${f3B64}';
      return new Promise(res => {
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = 384; c.height = 384;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const d = ctx.getImageData(0, 0, 384, 384).data;
          const whitePixels = [];
          for (let y = 190; y < 270; y++) {
            for (let x = 140; x < 260; x++) {
              const idx = (y * 384 + x) * 4;
              const r = d[idx], g = d[idx+1], b = d[idx+2];
              if (r > 150 && g > 150 && b > 150) {
                whitePixels.push({ x, y, r, g, b });
              }
            }
          }
          res({
            count: whitePixels.length,
            minX: Math.min(...whitePixels.map(p => p.x)),
            maxX: Math.max(...whitePixels.map(p => p.x)),
            minY: Math.min(...whitePixels.map(p => p.y)),
            maxY: Math.max(...whitePixels.map(p => p.y))
          });
        };
      });
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Frame 3 glare bounds:', res.result.value);
  ws.close();
  p.kill();
}
findGlare().catch(console.error);
