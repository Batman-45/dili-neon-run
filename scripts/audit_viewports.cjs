const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9240;

const VIEWPORTS = [
  { name: 'desktop_1200x740', width: 1200, height: 740, mobile: false, scale: 1 },
  { name: 'desktop_960x640',  width: 960,  height: 640, mobile: false, scale: 1 },
  { name: 'tablet_768x800',   width: 768,  height: 800, mobile: true,  scale: 1 },
  { name: 'mobile_390x780',   width: 390,  height: 780, mobile: true,  scale: 2 },
  { name: 'mobile_375x667',   width: 375,  height: 667, mobile: true,  scale: 2 },
  { name: 'landscape_780x390', width: 780, height: 390, mobile: true,  scale: 2 },
  { name: 'landscape_667x375', width: 667, height: 375, mobile: true,  scale: 2 },
];

async function main() {
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1200,740',
    'http://localhost:5173/',
  ]);

  await new Promise(r => setTimeout(r, 2000));

  function getList() {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/json/list`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
  }

  try {
    const list = await getList();
    const page = list.find(t => t.type === 'page');
    console.log('Found page target:', page ? page.title : 'none');

    if (page && page.webSocketDebuggerUrl) {
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      let id = 1;
      const callbacks = new Map();

      function send(method, params = {}) {
        return new Promise((resolve, reject) => {
          const reqId = id++;
          callbacks.set(reqId, { resolve, reject });
          ws.send(JSON.stringify({ id: reqId, method, params }));
        });
      }

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && callbacks.has(msg.id)) {
          const { resolve, reject } = callbacks.get(msg.id);
          callbacks.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };

      await new Promise(resolve => ws.onopen = resolve);
      console.log('Connected to CDP');

      async function evaluate(expr) {
        const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
        return res.result?.value;
      }

      await send('Page.enable');
      await send('Runtime.enable');

      // Wait for page ready
      await evaluate(`new Promise(r => {
        if (document.readyState === 'complete') r();
        else window.addEventListener('load', () => r());
      })`);
      await new Promise(r => setTimeout(r, 1500));

      // Seed mock high scores
      await evaluate(`(() => {
        const entries = [
          { playerName: 'CYBER_GHOST', score: 48200, distance: 3120, timestamp: Date.now() - 100000 },
          { playerName: 'NEON_RACER', score: 32840, distance: 2140, timestamp: Date.now() - 80000 },
          { playerName: 'DILI_SPEED', score: 28450, distance: 1890, timestamp: Date.now() - 60000 },
          { playerName: 'VORTEX_99', score: 24100, distance: 1560, timestamp: Date.now() - 40000 },
          { playerName: 'BATMAN', score: 19800, distance: 1240, timestamp: Date.now() - 20000 }
        ];
        localStorage.setItem('dili-neon-run-leaderboard', JSON.stringify(entries));
      })()`);

      console.log('=== RUNNING INITIAL AUDIT ACROSS ALL VIEWPORTS ===');

      for (const vp of VIEWPORTS) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: vp.scale,
          mobile: vp.mobile,
        });
        await new Promise(r => setTimeout(r, 200));

        const audit = await evaluate(`(() => {
          const doc = document.documentElement;
          const body = document.body;
          const hasHScroll = doc.scrollWidth > window.innerWidth || body.scrollWidth > window.innerWidth;
          const hasVScroll = doc.scrollHeight > window.innerHeight || body.scrollHeight > window.innerHeight;

          // Check buttons
          const buttons = Array.from(document.querySelectorAll('button:not(.hidden)'));
          const btnSizes = buttons.map(b => {
            const rect = b.getBoundingClientRect();
            return {
              id: b.id || b.className,
              w: Math.round(rect.width),
              h: Math.round(rect.height),
              visible: rect.width > 0 && rect.height > 0
            };
          }).filter(b => b.visible);

          return {
            hasHScroll,
            hasVScroll,
            docScrollWidth: doc.scrollWidth,
            innerWidth: window.innerWidth,
            docScrollHeight: doc.scrollHeight,
            innerHeight: window.innerHeight,
            btnSizes
          };
        })()`);

        console.log(`[Viewport: ${vp.name}] HScroll: ${audit.hasHScroll}, VScroll: ${audit.hasVScroll}`);
        const smallBtns = audit.btnSizes.filter(b => b.w < 44 || b.h < 44);
        if (smallBtns.length > 0) {
          console.log(`  Small buttons (<44px):`, smallBtns);
        }
      }

      ws.close();
    }
  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

main();
