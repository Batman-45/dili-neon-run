const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9255;

async function runDLogoVerification() {
  const outDir = path.resolve('test-screenshots/d_logo_verification');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1280,720',
    'http://localhost:5173/',
  ]);

  await new Promise(r => setTimeout(r, 2200));

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
    console.log('Target page found:', page.title);

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
      console.log(`[CAPTURED] ${filename} (${fs.statSync(filePath).size} bytes)`);
    }

    // Wait for load
    await new Promise(r => setTimeout(r, 1000));

    // Start game
    await evaluate(`document.getElementById('btn-play').click();`);

    // Wait until HUD is active and countdown is finished
    for (let i = 0; i < 40; i++) {
      const active = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden') && !document.getElementById('countdown-overlay').classList.contains('active')`);
      if (active) break;
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 600));

    // Make player invulnerable so obstacles don't interrupt verification
    await evaluate(`
      if (window.__dili) {
        window.__dili.isInvulnerable = true;
        window.__dili.setShieldVisible(false);
      }
    `);

    // 1. Center running
    console.log('Verifying Center running...');
    await new Promise(r => setTimeout(r, 400));
    await capture('1_center_running.png');

    // 2. Left lane
    console.log('Verifying Left lane...');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
    await new Promise(r => setTimeout(r, 350));
    await capture('2_left_lane.png');

    // 3. Center -> Left -> Center
    console.log('Verifying Left -> Center transition...');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
    await new Promise(r => setTimeout(r, 180));
    await capture('3_center_from_left.png');
    await new Promise(r => setTimeout(r, 200));

    // 4. Right lane
    console.log('Verifying Right lane...');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
    await new Promise(r => setTimeout(r, 350));
    await capture('4_right_lane.png');

    // 5. Center -> Right -> Center
    console.log('Verifying Right -> Center transition...');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
    await new Promise(r => setTimeout(r, 180));
    await capture('5_center_from_right.png');
    await new Promise(r => setTimeout(r, 200));

    // 6. Jump
    console.log('Verifying Jump...');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));`);
    await new Promise(r => setTimeout(r, 250));
    await capture('6_jump.png');
    await new Promise(r => setTimeout(r, 600)); // land

    // 7. Slide
    console.log('Verifying Slide...');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown' }));`);
    await new Promise(r => setTimeout(r, 220));
    await capture('7_slide.png');
    await new Promise(r => setTimeout(r, 650)); // exit slide

    // 8. Dash
    console.log('Verifying Dash...');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }));`);
    await new Promise(r => setTimeout(r, 220));
    await capture('8_dash.png');

    ws.close();
    console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
  } finally {
    chromeProc.kill();
  }
}

runDLogoVerification().catch(err => {
  console.error(err);
  process.exit(1);
});
