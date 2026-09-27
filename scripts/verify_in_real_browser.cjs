const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9280;

async function runRealBrowserVerification() {
  const outDir = path.resolve('test-screenshots/real_browser_verification');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const userDataDir = path.resolve('scratch/chrome_qa_profile');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  console.log('Launching REAL (non-headless) Google Chrome window...');
  // Non-headless normal browser window with hardware acceleration
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1280,720',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:5173/',
  ]);

  await new Promise(r => setTimeout(r, 2500));

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
    console.log('Connected to real Chrome tab:', page.title);

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
    await send('Page.enable');
    await send('Runtime.enable');

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      return res.result?.value;
    }

    async function capture(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(outDir, filename);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`[REAL BROWSER CAPTURE] ${filename} (${fs.statSync(filePath).size} bytes)`);
    }

    // Wait for load
    await new Promise(r => setTimeout(r, 1200));

    // Start game
    await evaluate(`document.getElementById('btn-play').click();`);

    // Wait until countdown is complete
    for (let i = 0; i < 40; i++) {
      const active = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden') && !document.getElementById('countdown-overlay').classList.contains('active')`);
      if (active) break;
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 600));

    // Invulnerable for unobstructed visual verification
    await evaluate(`
      if (window.__dili) {
        window.__dili.isInvulnerable = true;
        window.__dili.setShieldVisible(false);
      }
    `);

    // 1. Center running
    console.log('1. Real Browser: Center running');
    await new Promise(r => setTimeout(r, 500));
    await capture('1_real_center_running.png');

    // 2. Left lane
    console.log('2. Real Browser: Left lane');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
    await new Promise(r => setTimeout(r, 380));
    await capture('2_real_left_lane.png');

    // 3. Center -> Left -> Center
    console.log('3. Real Browser: Center from Left transition');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
    await new Promise(r => setTimeout(r, 180));
    await capture('3_real_center_from_left.png');
    await new Promise(r => setTimeout(r, 200));

    // 4. Right lane
    console.log('4. Real Browser: Right lane');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
    await new Promise(r => setTimeout(r, 380));
    await capture('4_real_right_lane.png');

    // 5. Center -> Right -> Center
    console.log('5. Real Browser: Center from Right transition');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
    await new Promise(r => setTimeout(r, 180));
    await capture('5_real_center_from_right.png');
    await new Promise(r => setTimeout(r, 200));

    // 6. Jump
    console.log('6. Real Browser: Jump (Space)');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));`);
    await new Promise(r => setTimeout(r, 260));
    await capture('6_real_jump.png');
    await new Promise(r => setTimeout(r, 600)); // land

    // 7. Slide
    console.log('7. Real Browser: Slide (ArrowDown)');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown' }));`);
    await new Promise(r => setTimeout(r, 220));
    await capture('7_real_slide.png');
    await new Promise(r => setTimeout(r, 650)); // exit slide

    // 8. Dash
    console.log('8. Real Browser: Dash (ShiftLeft)');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }));`);
    await new Promise(r => setTimeout(r, 240));
    await capture('8_real_dash.png');

    // Also take a 1:1 pixel crop around Dili at actual gameplay scale
    // to prove readability at 100% actual screen pixels without scaling
    const centerImgB64 = fs.readFileSync(path.join(outDir, '1_real_center_running.png')).toString('base64');
    const cropScript = `(() => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + '${centerImgB64}';
      return new Promise(res => {
        img.onload = () => {
          // Find Dili's position around center bottom of screen
          // At 1280x720, Dili is around X: 590..690, Y: 460..620
          const c = document.createElement('canvas');
          c.width = 200; c.height = 200;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 540, 430, 200, 200, 0, 0, 200, 200);
          res(c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''));
        };
      });
    })()`;

    const cropRes = await send('Runtime.evaluate', { expression: cropScript, awaitPromise: true, returnByValue: true });
    fs.writeFileSync(path.join(outDir, 'dili_real_gameplay_scale_1to1.png'), Buffer.from(cropRes.result.value, 'base64'));
    console.log('[REAL BROWSER CAPTURE] dili_real_gameplay_scale_1to1.png');

    ws.close();
    console.log('*** REAL BROWSER VERIFICATION COMPLETED SUCCESSFULLY ***');
  } finally {
    chromeProc.kill();
  }
}

runRealBrowserVerification().catch(err => {
  console.error(err);
  process.exit(1);
});
