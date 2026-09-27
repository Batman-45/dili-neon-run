const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function findWhite() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9354',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9354/json/list', r => {
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

  const b64_v2 = fs.readFileSync('C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\d86d48cc-c83b-4c0a-a996-4889df60c7b4\\dili_rear_head_chibi_v2_1790329622771.jpg').toString('base64');
  const script = `
    (async () => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + '${b64_v2}';
      await new Promise(r => img.onload = r);
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 1024;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, 1024, 1024).data;
      const brightInHair = [];
      for (let y = 100; y < 600; y++) {
        for (let x = 600; x < 900; x++) {
          const dx = x - 512, dy = y - 450;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 340) {
            const idx = (y * 1024 + x) * 4;
            const r = data[idx], g = data[idx+1], b = data[idx+2];
            if (r > 190 && g > 180 && b > 190) {
              brightInHair.push({ x, y, r, g, b });
            }
          }
        }
      }
      return { total: brightInHair.length, minX: Math.min(...brightInHair.map(b => b.x)), maxX: Math.max(...brightInHair.map(b => b.x)), minY: Math.min(...brightInHair.map(b => b.y)), maxY: Math.max(...brightInHair.map(b => b.y)) };
    })()
  `;
  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Bright in hair bounds:', res.result.value);
  ws.close();
  p.kill();
}
findWhite().catch(console.error);
