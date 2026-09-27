const { spawn } = require('child_process');
const http = require('http');

async function findCenters() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9230',
    '--headless=new',
    '--disable-gpu',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const list = await new Promise((res, rej) => {
    http.get('http://localhost:9230/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    });
  });
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (m, p={}) => new Promise(res => {
    const reqId = id++;
    const h = ev => {
      const d = JSON.parse(ev.data);
      if (d.id === reqId) { ws.removeEventListener('message', h); res(d.result); }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: reqId, method: m, params: p }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 1000));
  
  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      const img = new Image();
      img.src = '/assets/dili_rear_strip_raw.jpg';
      await new Promise(r => img.onload = r);
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      
      const proj = new Float64Array(c.width);
      for (let x = 0; x < c.width; x++) {
        let sum = 0;
        for (let y = 0; y < c.height; y++) {
          const idx = (y * c.width + x) * 4;
          if (data[idx] > 20 || data[idx+1] > 20 || data[idx+2] > 20) sum += 1;
        }
        proj[x] = sum;
      }
      
      const nonZeroRanges = [];
      let inChar = false, start = 0;
      for (let x = 0; x < c.width; x++) {
        if (proj[x] > 8 && !inChar) { inChar = true; start = x; }
        else if (proj[x] <= 8 && inChar) { inChar = false; nonZeroRanges.push({ start, end: x, center: (start + x)/2, width: x - start }); }
      }
      if (inChar) nonZeroRanges.push({ start, end: c.width, center: (start + c.width)/2, width: c.width - start });
      
      return { width: c.width, height: c.height, nonZeroRanges };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  
  console.log(JSON.stringify(res.result.value, null, 2));
  chromeProc.kill();
}
findCenters().catch(console.error);
