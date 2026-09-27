const { spawn } = require('child_process');
const http = require('http');

const port = 9336;
const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  `--remote-debugging-port=${port}`,
  '--headless=new',
  'http://localhost:5173/test_workbench.html'
]);

setTimeout(async () => {
  const list = await new Promise(res => http.get(`http://localhost:${port}/json/list`, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
  }));
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(async () => {
        const bounds = [];
        for (let i = 0; i < 8; i++) {
          const img = new Image();
          img.src = '/assets/3d_frames/frame_' + i + '.png';
          await new Promise(r => img.onload = r);
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const id = ctx.getImageData(0, 0, c.width, c.height);
          let minX = c.width, maxX = 0, minY = c.height, maxY = 0;
          for (let y = 0; y < c.height; y++) {
            for (let x = 0; x < c.width; x++) {
              if (id.data[(y * c.width + x) * 4 + 3] > 20) {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
              }
            }
          }
          bounds.push({ frame: i, minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 });
        }
        return bounds;
      })()`,
      awaitPromise: true,
      returnByValue: true
    }
  }));
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id === 1) {
      console.log('Frame bounds:', msg.result.result.value);
      ws.close();
      p.kill();
      process.exit(0);
    }
  };
}, 2000);
