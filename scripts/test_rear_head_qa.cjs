const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9310;

async function runRearHeadQA() {
  const outDir = path.resolve('test-screenshots/rear_head_qa');
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
      return filePath;
    }

    async function pressKey(key, code) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
      await new Promise(r => setTimeout(r, 60));
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
    }

    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    await new Promise(r => setTimeout(r, 1000));

    // 1. START GAME RUN
    console.log('Starting gameplay...');
    await new Promise(r => setTimeout(r, 2500));
    
    // Click play button and wait until screen-start is hidden
    for (let attempt = 0; attempt < 5; attempt++) {
      await evaluate(`document.getElementById('btn-play')?.click();`);
      await new Promise(r => setTimeout(r, 800));
      const startHidden = await evaluate(`document.getElementById('screen-start')?.classList.contains('screen-hidden')`);
      if (startHidden) {
        console.log('Start screen hidden, game started!');
        break;
      }
    }

    // Wait for countdown to finish & HUD active
    for (let i = 0; i < 40; i++) {
      const hudActive = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden')`);
      if (hudActive) {
        console.log('Gameplay started! HUD active.');
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    await new Promise(r => setTimeout(r, 1500));

    // 2. NORMAL RUNNING GAMEPLAY (Rear View)
    console.log('Capturing normal running gameplay...');
    await capture('01_gameplay_running_rear.png');

    // 3. SILHOUETTE TEST: PAUSE GAMEPLAY AT NORMAL REAR CAMERA ANGLE
    console.log('Triggering pause for SILHOUETTE TEST...');
    await pressKey('Escape', 'Escape');
    await new Promise(r => setTimeout(r, 400));
    await capture('02_silhouette_test_paused.png');

    // Hide pause modal overlay temporarily to get 100% unobstructed view of Dili
    await evaluate(`
      const pauseModal = document.getElementById('screen-pause');
      if (pauseModal) pauseModal.style.opacity = '0';
    `);
    await new Promise(r => setTimeout(r, 200));
    await capture('03_silhouette_test_paused_unobstructed.png');

    // Unpause
    await evaluate(`
      const pauseModal = document.getElementById('screen-pause');
      if (pauseModal) pauseModal.style.opacity = '1';
    `);
    await pressKey('Escape', 'Escape');
    await new Promise(r => setTimeout(r, 600));

    // 4. JUMP ACTION (Airborne rear view)
    console.log('Testing Jump action...');
    await pressKey('Space', 'Space');
    await new Promise(r => setTimeout(r, 160));
    await capture('04_action_jump_rear.png');

    await new Promise(r => setTimeout(r, 800));

    // 5. SLIDE ACTION
    console.log('Testing Slide action...');
    await pressKey('KeyS', 'KeyS');
    await new Promise(r => setTimeout(r, 180));
    await capture('05_action_slide_rear.png');

    await new Promise(r => setTimeout(r, 900));

    // 6. LANE SWITCH LEFT
    console.log('Testing Lane Switch Left...');
    await pressKey('KeyA', 'KeyA');
    await new Promise(r => setTimeout(r, 80));
    await capture('06_action_lane_switch_left.png');

    await new Promise(r => setTimeout(r, 500));

    // 7. LANE SWITCH RIGHT
    console.log('Testing Lane Switch Right...');
    await pressKey('KeyD', 'KeyD');
    await new Promise(r => setTimeout(r, 80));
    await capture('07_action_lane_switch_right.png');

    // 8. Extract close-up crop of Dili's rear head from the paused silhouette screenshot
    const pausedImgB64 = fs.readFileSync(path.join(outDir, '03_silhouette_test_paused_unobstructed.png')).toString('base64');
    const cropRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const img = new Image();
          img.src = 'data:image/png;base64,' + '${pausedImgB64}';
          await new Promise(r => img.onload = r);

          const cropW = 340;
          const cropH = 340;
          const startX = 960 - 170;
          const startY = 700 - 100;

          const c = document.createElement('canvas');
          c.width = cropW;
          c.height = cropH;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, startX, startY, cropW, cropH, 0, 0, cropW, cropH);
          return c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    const b64Val = cropRes.result?.value;
    if (b64Val) {
      fs.writeFileSync(path.join(outDir, '08_rear_head_closeup_crop.png'), Buffer.from(b64Val, 'base64'));
      console.log('Saved 08_rear_head_closeup_crop.png');
    }

    ws.close();
  } finally {
    chromeProc.kill();
  }
}

runRearHeadQA().catch(console.error);
