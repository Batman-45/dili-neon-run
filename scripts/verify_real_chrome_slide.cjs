const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9345;

async function verifyRealChromeSlide() {
  const outDir = path.resolve('test-screenshots/slide_diagnostics');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const userDataDir = path.resolve('scratch/chrome_fresh_profile_' + Date.now());
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  console.log('Launching Real Chrome at 1280x720 with fresh profile...');
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
    const consoleLogs = [];

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const reqId = id++;
        callbacks.set(reqId, { resolve, reject });
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
        consoleLogs.push(text);
        console.log('[BROWSER CONSOLE]', text);
      }
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
      console.log(`[SAVED SCREENSHOT] ${filePath}`);
      return filePath;
    }

    // Wait for initial page and texture load
    await new Promise(r => setTimeout(r, 1500));

    // Verify slide texture loaded in browser
    const textureStatus = await evaluate(`
      (() => {
        const v = window.__dili ? window.__dili.visual : null;
        if (!v) return { error: 'No dili visual' };
        return {
          runnerMeshExists: !!v.runnerMesh,
          slideMeshExists: !!v.slideMesh,
          slideTextureLoaded: !!v.slideTexture?.image?.complete,
          slideTextureSrc: v.slideTexture?.image?.src,
          slideTextureDims: v.slideTexture?.image ? { w: v.slideTexture.image.width, h: v.slideTexture.image.height } : null,
          initialRunnerVisible: v.runnerMesh?.visible,
          initialSlideVisible: v.slideMesh?.visible,
        };
      })()
    `);
    console.log('Initial character runtime state in Chrome:', JSON.stringify(textureStatus, null, 2));

    // Click Play button
    await evaluate(`document.getElementById('btn-play').click();`);

    // Wait through countdown
    for (let i = 0; i < 40; i++) {
      const active = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden') && !document.getElementById('countdown-overlay').classList.contains('active')`);
      if (active) break;
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 600));

    // Make invulnerable so obstacles do not disturb test
    await evaluate(`
      if (window.__dili) {
        window.__dili.isInvulnerable = true;
        window.__dili.setShieldVisible(false);
      }
    `);

    // Wait until RUNNING
    for (let i = 0; i < 30; i++) {
      const state = await evaluate(`window.__dili ? window.__dili.getState() : null`);
      if (state === 'RUNNING') break;
      await new Promise(r => setTimeout(r, 100));
    }

    console.log('Capturing normal running frame...');
    await capture('1_chrome_normal_run.png');

    // Trigger SLIDE via actual keyboard Input event (ArrowDown)
    console.log('Dispatching ArrowDown keydown event...');
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      code: 'ArrowDown',
      key: 'ArrowDown',
      windowsVirtualKeyCode: 40
    });

    // Short wait to ensure active slide
    await new Promise(r => setTimeout(r, 100));

    // Inspect runtime state during active slide
    const activeSlideState = await evaluate(`
      (() => {
        const v = window.__dili ? window.__dili.visual : null;
        return {
          charState: window.__dili.getState(),
          isSliding: v.isSliding,
          runnerMeshVisible: v.runnerMesh.visible,
          slideMeshVisible: v.slideMesh.visible,
          runnerOpacity: v.runnerMesh.material.opacity,
          slideOpacity: v.slideMesh.material.opacity,
          visualChildScale: {
            x: v.visualChild.scale.x,
            y: v.visualChild.scale.y,
            z: v.visualChild.scale.z
          },
          slideTextureSrc: v.slideTexture.image?.src
        };
      })()
    `);
    console.log('Active slide runtime verification in Chrome:', JSON.stringify(activeSlideState, null, 2));

    // Capture the active slide frame
    await capture('2_chrome_active_slide.png');

    // Wait another 150ms (mid-slide)
    await new Promise(r => setTimeout(r, 150));
    await capture('3_chrome_midslide.png');

    // Create side-by-side close-up comparison
    const runImgB64 = fs.readFileSync(path.join(outDir, '1_chrome_normal_run.png')).toString('base64');
    const slideImgB64 = fs.readFileSync(path.join(outDir, '2_chrome_active_slide.png')).toString('base64');

    const compareScript = `(() => {
      const load = (b64) => new Promise(res => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        img.onload = () => res(img);
      });
      return Promise.all([load('${runImgB64}'), load('${slideImgB64}')]).then(([imgRun, imgSlide]) => {
        const c = document.createElement('canvas');
        c.width = 640; c.height = 360;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#0a0a18';
        ctx.fillRect(0, 0, 640, 360);

        // Crop around Dili: X: 520..760, Y: 390..650 (240x260)
        // Left: Normal Run
        ctx.drawImage(imgRun, 520, 390, 240, 260, 40, 60, 240, 260);
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('NORMAL RUNNING (runnerMesh)', 30, 40);

        // Right: Active Slide
        ctx.drawImage(imgSlide, 520, 390, 240, 260, 360, 60, 240, 260);
        ctx.fillStyle = '#ff007f';
        ctx.fillText('ACTIVE SLIDE (slideMesh)', 380, 40);

        // Ground guide line
        ctx.strokeStyle = '#ffffff44';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(10, 315);
        ctx.lineTo(630, 315);
        ctx.stroke();

        return c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
      });
    })()`;

    const compareRes = await send('Runtime.evaluate', { expression: compareScript, awaitPromise: true, returnByValue: true });
    fs.writeFileSync(path.join(outDir, 'verified_slide_comparison.png'), Buffer.from(compareRes.result.value, 'base64'));
    console.log('[SAVED] verified_slide_comparison.png');

    console.log('Console logs recorded during test:');
    consoleLogs.forEach(l => console.log('  ->', l));

    ws.close();
  } finally {
    chromeProc.kill();
  }
}

verifyRealChromeSlide().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
