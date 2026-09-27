const { spawn } = require('child_process');
const http = require('http');

const port = 9245;
const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  `--remote-debugging-port=${port}`,
  '--headless=new',
  'http://localhost:5173/'
]);

setTimeout(async () => {
  try {
    const list = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/json/list`, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });

    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    ws.onopen = () => {
      let id = 1;
      function send(m, p = {}) { ws.send(JSON.stringify({ id: id++, method: m, params: p })); }
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === 1) {
          console.log('MEASURED DILI HEIGHT IN SCREENSHOT:', JSON.stringify(msg.result.result.value, null, 2));
          ws.close();
          chromeProc.kill();
          process.exit(0);
        }
      };

      send('Runtime.evaluate', {
        expression: `(async () => {
          async function measureImg(src) {
            const img = new Image();
            img.src = src;
            await new Promise(r => img.onload = r);
            const c = document.createElement('canvas');
            c.width = img.width; c.height = img.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            // Search lower half
            const d = ctx.getImageData(0, Math.floor(img.height * 0.4), img.width, Math.floor(img.height * 0.6));
            let minY = d.height, maxY = 0, minX = d.width, maxX = 0;
            let count = 0;
            for (let y = 0; y < d.height; y++) {
              for (let x = 0; x < d.width; x++) {
                const idx = (y * d.width + x) * 4;
                const r = d.data[idx], g = d.data[idx+1], b = d.data[idx+2];
                // Dili character pink/magenta/purple colors
                if ((r > 160 && b > 140 && g < 140) || (r > 190 && b > 100 && g < 100)) {
                  if (y < minY) minY = y; if (y > maxY) maxY = y;
                  if (x < minX) minX = x; if (x > maxX) maxX = x;
                  count++;
                }
              }
            }
            return {
              src,
              w: img.width,
              h: img.height,
              detectedPixels: count,
              diliH: maxY - minY,
              percentH: ((maxY - minY) / img.height * 100).toFixed(1) + '%'
            };
          }
          return {
            desktop: await measureImg('/test-screenshots/final_qa/02_running_t0.png'),
            mobile: await measureImg('/test-screenshots/final_qa/18_gameplay_mobile_390x844.png')
          };
        })()`,
        awaitPromise: true,
        returnByValue: true
      });
    };
  } catch (err) {
    console.error(err);
    chromeProc.kill();
    process.exit(1);
  }
}, 1500);
