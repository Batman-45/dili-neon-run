const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9228;

async function runVisualTests() {
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1280,720',
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
      const filePath = path.resolve('test-screenshots', filename);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`[CAPTURED] ${filename} (${fs.statSync(filePath).size} bytes)`);
    }

    // Wait for DOM
    await evaluate(`new Promise(r => {
      if (document.readyState === 'complete') r();
      else window.addEventListener('load', () => r());
    })`);
    await new Promise(r => setTimeout(r, 1200));

    // STEP 1 & 10: Start Screen & Static Mascot verification
    console.log('--- Step 1 & 10: Capturing Start Screen with Mascot ---');
    await capture('visual_test_1_start_screen.png');

    // STEP 2: Start the game & Countdown
    console.log('--- Step 2: Clicking START RUN and waiting for countdown ---');
    await evaluate(`document.getElementById('btn-play').click();`);

    // Wait until HUD becomes active
    for (let i = 0; i < 40; i++) {
      const hudActive = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden')`);
      if (hudActive) {
        console.log('Gameplay started! HUD is active.');
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 1000));

    // STEP 3: Normal gameplay speed center lane
    console.log('--- Step 3: Capturing Dili at normal gameplay speed ---');
    await capture('visual_test_2_gameplay_center.png');

    // STEP 4: Lane switching Left
    console.log('--- Step 4: Lane switching LEFT ---');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
    await new Promise(r => setTimeout(r, 350));
    await capture('visual_test_3_lane_switch_left.png');

    // Lane switching Right
    console.log('--- Step 4b: Lane switching RIGHT ---');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
    await new Promise(r => setTimeout(r, 200));
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }));`);
    await new Promise(r => setTimeout(r, 350));
    await capture('visual_test_4_lane_switch_right.png');

    // Return to Center
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));`);
    await new Promise(r => setTimeout(r, 300));

    // STEP 5: Jumping
    console.log('--- Step 5: Jumping (Space) ---');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));`);
    await new Promise(r => setTimeout(r, 240));
    await capture('visual_test_5_jump.png');

    await new Promise(r => setTimeout(r, 600)); // land

    // STEP 6: Sliding
    console.log('--- Step 6: Sliding (ArrowDown) ---');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown' }));`);
    await new Promise(r => setTimeout(r, 220));
    await capture('visual_test_6_slide.png');

    await new Promise(r => setTimeout(r, 650)); // exit slide

    // STEP 7: Hyper Dash
    console.log('--- Step 7: Hyper Dash (ShiftLeft) ---');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }));`);
    await new Promise(r => setTimeout(r, 200));
    await capture('visual_test_7_hyper_dash.png');

    // STEP 8: Game Over screen (trigger crash for testing Game Over UI)
    console.log('--- Step 8: Triggering crash for Game Over UI inspection ---');
    await evaluate(`if (window.__testCrash) window.__testCrash();`);
    
    // Wait for crash animation and Game Over screen transition
    for (let i = 0; i < 30; i++) {
      const gameOverShown = await evaluate(`document.getElementById('screen-gameover').classList.contains('active')`);
      if (gameOverShown) {
        console.log('Game Over screen is active!');
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 600));

    await capture('visual_test_8_game_over.png');

    // STEP 9: Return to Start Screen
    console.log('--- Step 9: Returning to Title / Start Screen ---');
    await evaluate(`document.getElementById('btn-gameover-title').click();`);
    
    for (let i = 0; i < 30; i++) {
      const startActive = await evaluate(`document.getElementById('screen-start').classList.contains('active')`);
      if (startActive) {
        console.log('Returned to Start Screen successfully!');
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 800));
    await capture('visual_test_9_return_to_start.png');

    // RESPONSIVE VIEWPORT TESTS
    console.log('--- Responsive Test 1: 1920x1080 Full HD ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 500));
    await capture('visual_test_10_desktop_1920.png');

    console.log('--- Responsive Test 2: 1366x768 Standard Laptop ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 500));
    await capture('visual_test_11_desktop_1366.png');

    console.log('--- Responsive Test 3: 390x844 Mobile Viewport ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 500));
    await capture('visual_test_12_mobile_390.png');

    // Reset emulation
    await send('Emulation.clearDeviceMetricsOverride');

    ws.close();
    console.log('*** ALL VISUAL TESTS COMPLETED SUCCESSFULLY ***');
  } finally {
    chromeProc.kill();
  }
}

runVisualTests().catch(err => {
  console.error('Visual test error:', err);
  process.exit(1);
});
