const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9284;

async function runSlideRealBrowserTest() {
  const outDir = path.resolve('test-screenshots/slide_verification');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const userDataDir = path.resolve('scratch/chrome_slide_profile');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  console.log('Launching REAL Chrome for Slide Visual Verification...');
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
    console.log('Connected to tab:', page.title);

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
      console.log(`[SAVED] ${filename}`);
      return filePath;
    }

    // Wait for load
    await new Promise(r => setTimeout(r, 1200));

    // Click Play
    await evaluate(`document.getElementById('btn-play').click();`);

    // Wait for countdown
    for (let i = 0; i < 40; i++) {
      const active = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden') && !document.getElementById('countdown-overlay').classList.contains('active')`);
      if (active) break;
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 600));

    // Make invulnerable so obstacles don't interrupt inspection
    await evaluate(`
      if (window.__dili) {
        window.__dili.isInvulnerable = true;
        window.__dili.setShieldVisible(false);
      }
    `);

    // Wait until game is actually running
    for (let i = 0; i < 50; i++) {
      const state = await evaluate(`window.__dili ? window.__dili.getState() : null`);
      console.log('Current state:', state);
      if (state === 'RUNNING') break;
      await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 400));

    // 1. Normal running
    console.log('1. Capturing normal running pose...');
    await capture('1_normal_running.png');

    // 2. Trigger SLIDE
    console.log('2. Triggering SLIDE...');
    const slideResult = await evaluate(`
      (() => {
        const slid = window.__dili.slide();
        return {
          slid,
          state: window.__dili.getState(),
          isSliding: window.__dili.visual.isSliding,
          slideMeshVisible: window.__dili.visual.slideMesh.visible,
          slideOpacity: window.__dili.visual.slideMesh.material.opacity,
          runnerOpacity: window.__dili.visual.runnerMesh.material.opacity
        };
      })()
    `);
    console.log('Slide triggered result:', slideResult);

    await new Promise(r => setTimeout(r, 50)); // mid-transition (crouch entering)
    await capture('2_slide_entering.png');

    // 3. In full slide posture
    console.log('3. Capturing full slide posture...');
    await new Promise(r => setTimeout(r, 120)); // full slide
    const fullSlideInfo = await evaluate(`({
      state: window.__dili.getState(),
      isSliding: window.__dili.visual.isSliding,
      slideMeshVisible: window.__dili.visual.slideMesh.visible,
      slideOpacity: window.__dili.visual.slideMesh.material.opacity,
      runnerOpacity: window.__dili.visual.runnerMesh.material.opacity
    })`);
    console.log('Full slide info:', fullSlideInfo);
    await capture('3_slide_full.png');

    // 4. Slide sustained
    console.log('4. Capturing sustained slide...');
    await new Promise(r => setTimeout(r, 150));
    await capture('4_slide_sustained.png');

    // 5. Exiting slide
    console.log('5. Capturing slide exit...');
    await new Promise(r => setTimeout(r, 260)); // exit tween
    await capture('5_slide_exiting.png');

    // 6. Back to upright normal running
    console.log('6. Back to upright normal running...');
    await new Promise(r => setTimeout(r, 200));
    await capture('6_back_to_running.png');

    // Generate 1:1 crops and side-by-side comparison
    const normalB64 = fs.readFileSync(path.join(outDir, '1_normal_running.png')).toString('base64');
    const slideB64 = fs.readFileSync(path.join(outDir, '3_slide_full.png')).toString('base64');

    const compareScript = `(() => {
      const load = (b64) => new Promise(res => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        img.onload = () => res(img);
      });
      return Promise.all([load('${normalB64}'), load('${slideB64}')]).then(([imgNormal, imgSlide]) => {
        const c = document.createElement('canvas');
        c.width = 600; c.height = 360;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#080814';
        ctx.fillRect(0, 0, 600, 360);

        // Crop region around Dili: X: 520..760, Y: 400..660 (240x260)
        // Draw Normal on left
        ctx.drawImage(imgNormal, 520, 400, 240, 260, 30, 60, 240, 260);
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('NORMAL RUNNING', 60, 40);

        // Draw Slide on right
        ctx.drawImage(imgSlide, 520, 400, 240, 260, 330, 60, 240, 260);
        ctx.fillStyle = '#ff007f';
        ctx.fillText('NEW SLIDE / CROUCH', 360, 40);

        // Reference line at road surface
        ctx.strokeStyle = '#ffffff33';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(10, 305);
        ctx.lineTo(590, 305);
        ctx.stroke();

        return c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
      });
    })()`;

    const compareRes = await send('Runtime.evaluate', { expression: compareScript, awaitPromise: true, returnByValue: true });
    fs.writeFileSync(path.join(outDir, 'dili_normal_vs_slide_closeup.png'), Buffer.from(compareRes.result.value, 'base64'));
    console.log('[SAVED] dili_normal_vs_slide_closeup.png');

    ws.close();
    console.log('*** SLIDE VERIFICATION TEST COMPLETED ***');
  } finally {
    chromeProc.kill();
  }
}

runSlideRealBrowserTest().catch(err => {
  console.error(err);
  process.exit(1);
});
