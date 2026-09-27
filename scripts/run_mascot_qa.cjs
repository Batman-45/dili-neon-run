const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9260;

async function runMascotQA() {
  const outDir = path.resolve('test-screenshots/mascot_qa');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1920,1080',
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

    // Set 1920x1080 viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    await new Promise(r => setTimeout(r, 1000));

    // Start game
    console.log('Starting gameplay...');
    await evaluate(`document.getElementById('btn-play').click();`);

    // Wait for countdown to finish & HUD active
    for (let i = 0; i < 40; i++) {
      const hudActive = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden')`);
      if (hudActive) break;
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 600));

    // Make player invulnerable during QA testing so obstacles don't interrupt
    await evaluate(`window.__dili.isInvulnerable = true;`);

    // 1. Center Running
    console.log('--- 1. CENTER RUNNING ---');
    await new Promise(r => setTimeout(r, 400));
    await capture('01_center_running.png');

    // 2. Lane transition: CENTER -> LEFT
    console.log('--- 2. TRANSITION: CENTER -> LEFT ---');
    await evaluate(`window.__dili.switchLane(-1);`);
    // Capture mid-transition
    await new Promise(r => setTimeout(r, 70));
    await capture('02_transition_center_to_left.png');
    // Wait for lane switch to complete
    await new Promise(r => setTimeout(r, 300));
    await capture('03_left_lane_running.png');

    // 3. Lane transition: LEFT -> CENTER
    console.log('--- 3. TRANSITION: LEFT -> CENTER ---');
    await evaluate(`window.__dili.switchLane(1);`);
    await new Promise(r => setTimeout(r, 70));
    await capture('04_transition_left_to_center.png');
    await new Promise(r => setTimeout(r, 300));
    await capture('05_center_lane_restored.png');

    // 4. Lane transition: CENTER -> RIGHT
    console.log('--- 4. TRANSITION: CENTER -> RIGHT ---');
    await evaluate(`window.__dili.switchLane(1);`);
    await new Promise(r => setTimeout(r, 70));
    await capture('06_transition_center_to_right.png');
    await new Promise(r => setTimeout(r, 300));
    await capture('07_right_lane_running.png');

    // 5. Lane transition: RIGHT -> CENTER
    console.log('--- 5. TRANSITION: RIGHT -> CENTER ---');
    await evaluate(`window.__dili.switchLane(-1);`);
    await new Promise(r => setTimeout(r, 70));
    await capture('08_transition_right_to_center.png');
    await new Promise(r => setTimeout(r, 300));
    await capture('09_center_lane_stable.png');

    // 6. Jump Action
    console.log('--- 6. JUMP ---');
    await evaluate(`window.__dili.jump();`);
    await new Promise(r => setTimeout(r, 220));
    await capture('10_jump_apex.png');
    await new Promise(r => setTimeout(r, 450)); // land

    // 7. Slide Action
    console.log('--- 7. SLIDE ---');
    await evaluate(`window.__dili.slide();`);
    await new Promise(r => setTimeout(r, 180));
    await capture('11_slide_action.png');
    await new Promise(r => setTimeout(r, 650)); // finish slide

    // 8. Dash Action
    console.log('--- 8. DASH ---');
    await evaluate(`window.__dili.dash();`);
    await new Promise(r => setTimeout(r, 200));
    await capture('12_hyper_dash.png');

    // 9. Close up of character running to inspect head detail
    console.log('--- 9. CLOSE UP INSPECTION ---');
    // Zoom camera temporarily for high-res close up inspection of the rear head
    await evaluate(`
      window.__engine.camera.position.set(0, 1.8, 3.2);
      window.__engine.camera.lookAt(0, 1.2, 0);
    `);
    await new Promise(r => setTimeout(r, 150));
    await capture('13_close_up_rear_head.png');

    console.log('QA completed successfully!');
    ws.close();
    chromeProc.kill();
  } catch (err) {
    console.error('QA Error:', err);
    chromeProc.kill();
  }
}

runMascotQA().catch(console.error);
