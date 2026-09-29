const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

async function captureLiveStates() {
  const outDir = 'scratch/live_captures';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9479',
    '--headless=new',
    '--user-data-dir=C:\\Users\\SHREE\\Documents\\dili-neon-run\\scratch\\chrome_live_profile',
    '--window-size=1280,720',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9479/json/list', r => {
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

  await send('Page.enable');
  await send('Runtime.enable');

  const takeScreenshot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${outDir}/${name}.png`, Buffer.from(res.data, 'base64'));
    console.log(`Captured ${name}.png`);
  };

  // 1. Desktop Start Screen
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 2500));
  await takeScreenshot('01_start_screen_desktop');

  // 2. Mobile Viewport Start Screen
  await send('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 840,
    deviceScaleFactor: 1,
    mobile: true
  });
  await new Promise(r => setTimeout(r, 600));
  await takeScreenshot('02_start_screen_mobile');

  // Reset to desktop viewport for gameplay
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false
  });
  await new Promise(r => setTimeout(r, 400));

  // Click start / press Enter or Space to begin game
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await new Promise(r => setTimeout(r, 1500));

  // 3. Normal running gameplay
  await takeScreenshot('03_normal_running_gameplay');

  // 4. Lane switching (press ArrowRight)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await new Promise(r => setTimeout(r, 120)); // mid-switch banking
  await takeScreenshot('04_lane_switching');

  // 5. Slide state (hold ArrowDown)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  await new Promise(r => setTimeout(r, 150));
  await takeScreenshot('05_slide_state');
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  await new Promise(r => setTimeout(r, 600));

  // 6. Pause state (press Escape or P)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'KeyP', code: 'KeyP', windowsVirtualKeyCode: 80 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'KeyP', code: 'KeyP', windowsVirtualKeyCode: 80 });
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('06_paused_gameplay');

  // 7. Mobile Viewport running gameplay
  await send('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 840,
    deviceScaleFactor: 1,
    mobile: true
  });
  // Unpause
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'KeyP', code: 'KeyP', windowsVirtualKeyCode: 80 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'KeyP', code: 'KeyP', windowsVirtualKeyCode: 80 });
  await new Promise(r => setTimeout(r, 800));
  await takeScreenshot('07_mobile_running_gameplay');

  ws.close();
  p.kill();
  console.log('All live state screenshots captured successfully!');
}

captureLiveStates();
