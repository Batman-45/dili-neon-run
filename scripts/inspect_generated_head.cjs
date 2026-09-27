const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function inspectGeneratedHead() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9293',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9293/json/list', r => {
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

  const headImgPath = 'C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\d86d48cc-c83b-4c0a-a996-4889df60c7b4\\dili_rear_head_test_1790327217548.jpg';
  const headB64 = fs.readFileSync(headImgPath).toString('base64');

  const script = `
    (async () => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + '${headB64}';
      await new Promise(r => img.onload = r);

      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Measure background around corners
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const cornerPixel = [d[0], d[1], d[2], d[3]];

      // Find bubble bounding circle:
      // The outer circle of the glass bubble
      // Sample horizontal scan across the middle (y = img.height * 0.4)
      const midY = Math.floor(img.height * 0.43);
      let leftGlassX = 0, rightGlassX = img.width;
      for (let x = 0; x < img.width; x++) {
        const idx = (midY * img.width + x) * 4;
        const r = d[idx], g = d[idx+1], b = d[idx+2];
        if (r < 240 || g < 240 || b < 240) {
          leftGlassX = x;
          break;
        }
      }
      for (let x = img.width - 1; x >= 0; x--) {
        const idx = (midY * img.width + x) * 4;
        const r = d[idx], g = d[idx+1], b = d[idx+2];
        if (r < 240 || g < 240 || b < 240) {
          rightGlassX = x;
          break;
        }
      }

      // Top of glass bubble
      const midX = Math.floor((leftGlassX + rightGlassX) / 2);
      let topGlassY = 0;
      for (let y = 0; y < img.height; y++) {
        const idx = (y * img.width + midX) * 4;
        const r = d[idx], g = d[idx+1], b = d[idx+2];
        if (r < 240 || g < 240 || b < 240) {
          topGlassY = y;
          break;
        }
      }

      return {
        width: img.width,
        height: img.height,
        cornerPixel,
        leftGlassX,
        rightGlassX,
        topGlassY,
        bubbleCenterX: midX,
        bubbleRadius: (rightGlassX - leftGlassX) / 2
      };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log('Generated Head Info:', JSON.stringify(res.result.value, null, 2));
  ws.close();
  p.kill();
}

inspectGeneratedHead().catch(console.error);
