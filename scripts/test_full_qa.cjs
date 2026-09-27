const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9255;

async function main() {
  const outDir = path.resolve('test-screenshots/final_qa');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1280,720',
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

  const list = await getList();
  const page = list.find(t => t.type === 'page');
  if (!page) throw new Error('Target page not found');

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
  console.log('Connected to Chrome DevTools Protocol!');

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

  await send('Page.enable');
  await send('Runtime.enable');

  // Wait for page ready
  await evaluate(`new Promise(r => {
    if (document.readyState === 'complete') r();
    else window.addEventListener('load', () => r());
  })`);
  await new Promise(r => setTimeout(r, 1000));

  // 0. Title screen
  await capture('00_title_screen.png');

  // Click START RUN
  console.log('Clicking #btn-play...');
  await evaluate(`document.getElementById('btn-play').click();`);

  // Wait for countdown (3 -> 2 -> 1 -> GO! takes ~3.2s)
  console.log('Waiting for countdown to finish...');
  for (let i = 0; i < 40; i++) {
    const hudVisible = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden')`);
    if (hudVisible) {
      console.log('HUD is active! Gameplay has started.');
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => setTimeout(r, 600)); // Let run settle

  // 1. Center Lane Running
  console.log('1. Center lane running...');
  await new Promise(r => setTimeout(r, 400));
  await capture('01_center_lane_running.png');

  // 2. Jump action
  console.log('2. Jump action...');
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));`);
  await new Promise(r => setTimeout(r, 260)); // peak of jump
  await capture('02_action_jump.png');
  await new Promise(r => setTimeout(r, 550)); // land

  // 3. Slide action
  console.log('3. Slide action...');
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown' }));`);
  await new Promise(r => setTimeout(r, 180)); // mid-slide crouch
  await capture('03_action_slide.png');
  await new Promise(r => setTimeout(r, 600)); // recover

  // 4. Dash action
  console.log('4. Dash action...');
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }));`);
  await new Promise(r => setTimeout(r, 200)); // active dash with speed trail
  await capture('04_action_dash.png');
  await new Promise(r => setTimeout(r, 700));

  // 5. Center -> Left transition
  console.log('5. Center -> Left transition...');
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
  await new Promise(r => setTimeout(r, 80)); // mid-transition bank
  await capture('05_center_to_left_transition.png');

  // 6. Left Lane Running
  await new Promise(r => setTimeout(r, 200)); // settle in left lane
  console.log('6. Left lane running...');
  await capture('06_left_lane_running.png');

  // 7. Left -> Center transition
  console.log('7. Left -> Center transition...');
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
  await new Promise(r => setTimeout(r, 80));
  await capture('07_left_to_center_transition.png');
  await new Promise(r => setTimeout(r, 200));

  // 8. Center -> Right transition
  console.log('8. Center -> Right transition...');
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
  await new Promise(r => setTimeout(r, 80));
  await capture('08_center_to_right_transition.png');

  // 9. Right Lane Running
  await new Promise(r => setTimeout(r, 200));
  console.log('9. Right lane running...');
  await capture('09_right_lane_running.png');

  // 10. Right -> Center transition
  console.log('10. Right -> Center transition...');
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
  await new Promise(r => setTimeout(r, 80));
  await capture('10_right_to_center_transition.png');
  await new Promise(r => setTimeout(r, 200));

  // 11. Stride burst: capture 4 running frames in sequence to verify alternating leg stride
  console.log('11. Capturing stride cycle frames...');
  for (let s = 0; s < 4; s++) {
    await capture(`11_run_stride_frame_${s}.png`);
    await new Promise(r => setTimeout(r, 70));
  }

  // 12. Pause / Resume
  console.log('12. Pause modal...');
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p' }));`);
  await new Promise(r => setTimeout(r, 300));
  await capture('12_pause_modal.png');

  await evaluate(`document.getElementById('btn-resume').click();`);
  await new Promise(r => setTimeout(r, 400));

  // 13. Mobile viewport capture (390x844)
  console.log('13. Mobile viewport...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await new Promise(r => setTimeout(r, 400));
  await capture('13_mobile_running.png');

  // Reset viewport
  await send('Emulation.clearDeviceMetricsOverride');

  console.log('============================================');
  console.log('FULL QA AUTOMATION SUITE COMPLETED WITH CODE 0');
  console.log('============================================');

  ws.close();
  chromeProc.kill();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
