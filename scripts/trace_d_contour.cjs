const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function traceDContour() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9291',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9291/json/list', r => {
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

  const b64 = fs.readFileSync('test-screenshots/official_d_tight.png').toString('base64');
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + '${b64}';
      return new Promise(res => {
        img.onload = () => {
          const w = img.width, h = img.height;
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const d = ctx.getImageData(0, 0, w, h).data;

          // Find row-by-row spans:
          const outerSpans = [];
          const innerSpans = [];

          for (let y = 0; y < h; y++) {
            let firstX = -1, lastX = -1;
            let holeFirstX = -1, holeLastX = -1;

            // Find first and last solid pixel on this row
            for (let x = 0; x < w; x++) {
              const a = d[(y * w + x) * 4 + 3];
              if (a > 128) {
                if (firstX === -1) firstX = x;
                lastX = x;
              }
            }

            if (firstX !== -1) {
              // Now look for hole between firstX and lastX
              let inHole = false;
              for (let x = firstX; x <= lastX; x++) {
                const a = d[(y * w + x) * 4 + 3];
                if (a <= 128) {
                  if (holeFirstX === -1) holeFirstX = x;
                  holeLastX = x;
                }
              }
            }

            outerSpans.push({ y, firstX, lastX, holeFirstX, holeLastX });
          }

          res(outerSpans.filter(s => s.firstX !== -1));
        };
      });
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  fs.writeFileSync('test-screenshots/d_spans.json', JSON.stringify(res.result.value, null, 2));
  console.log('Saved D spans, total rows:', res.result.value.length);
  ws.close();
  p.kill();
}
traceDContour().catch(console.error);
