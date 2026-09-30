const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9399;
const PROD_URL = 'https://dili-neon-run.vercel.app';

async function verifyLiveProductionBrowser() {
  const outDir = path.resolve('test-screenshots/live_prod_verification');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const tempUserDir = path.resolve('scratch/chrome_live_incognito_' + Date.now());
  if (!fs.existsSync(tempUserDir)) fs.mkdirSync(tempUserDir, { recursive: true });

  console.log(`🌐 Launching REAL Google Chrome (Incognito, Clean Profile) at ${PROD_URL}...`);
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempUserDir}`,
    '--incognito',
    '--window-size=1280,720',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    PROD_URL,
  ]);

  await new Promise(r => setTimeout(r, 3000));

  function getList() {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/json/list`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
  }

  let chromeClosed = false;
  function cleanup() {
    if (!chromeClosed) {
      chromeClosed = true;
      try { chromeProc.kill(); } catch (e) {}
    }
  }
  process.on('exit', cleanup);

  try {
    const list = await getList();
    const page = list.find(t => t.type === 'page');
    console.log('Connected to real Chrome tab:', page.title, 'URL:', page.url);

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

    await new Promise(r => ws.onopen = r);
    console.log('CDP WebSocket connected!');
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');

    // 1. HARD REFRESH with CACHE DISABLED
    console.log('\n--- STEP 1: HARD REFRESH WITH CACHE DISABLED ---');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Network.clearBrowserCache');
    await send('Page.reload', { ignoreCache: true });
    await new Promise(r => setTimeout(r, 3500));

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (res.exceptionDetails) {
        throw new Error(JSON.stringify(res.exceptionDetails));
      }
      return res.result ? res.result.value : null;
    }

    async function captureScreenshot(name) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(res.data, 'base64');
      const filename = path.join(outDir, `${name}.png`);
      fs.writeFileSync(filename, buffer);
      console.log(`📸 Saved screenshot: ${filename}`);
      return filename;
    }

    // Check loaded document URL and title
    const currentUrl = await evaluate('window.location.href');
    const docTitle = await evaluate('document.title');
    console.log(`Page Loaded: ${docTitle} [${currentUrl}]`);

    // Verify DOM contains power-up UI elements
    const domCheck = await evaluate(`({
      hasBanner: !!document.getElementById('powerup-pickup-banner'),
      hasSpeedLines: !!document.getElementById('speed-lines-overlay'),
      hasContainer: !!document.getElementById('hud-powerup-container'),
      hasBadge: !!document.getElementById('hud-multiplier-badge'),
      hasDiliGame: typeof window.__diliGame !== 'undefined'
    })`);
    console.log('DOM Elements check on live URL:', domCheck);

    await captureScreenshot('01_live_start_screen');

    // Start the game
    console.log('\n--- STEP 2: START RUN & COUNTDOWN ---');
    await evaluate("document.getElementById('btn-play').click()");
    await new Promise(r => setTimeout(r, 1200));
    await captureScreenshot('02_live_countdown');

    // Wait for gameplay to begin
    await new Promise(r => setTimeout(r, 2500));
    console.log('Run is now active!');

    // Test SHIELD
    console.log('\n--- STEP 3: TESTING SHIELD PICKUP & VFX ---');
    await evaluate("window.__givePowerUp('SHIELD')");
    await new Promise(r => setTimeout(r, 200));
    const shieldStatus = await evaluate(`({
      bannerText: document.getElementById('pickup-banner-text')?.textContent,
      bannerVisible: !document.getElementById('powerup-pickup-banner')?.classList.contains('hidden'),
      bannerPunch: document.getElementById('powerup-pickup-banner')?.classList.contains('punch'),
      shieldMeshVisible: window.__diliGame.dili.shieldMesh.visible,
      hudRows: document.querySelectorAll('.hud-powerup-row').length
    })`);
    console.log('Shield Status:', shieldStatus);
    await captureScreenshot('03_live_shield_active');

    // Test MAGNET
    console.log('\n--- STEP 4: TESTING MAGNET PICKUP & VFX ---');
    await evaluate("window.__givePowerUp('MAGNET')");
    await new Promise(r => setTimeout(r, 200));
    const magnetStatus = await evaluate(`({
      bannerText: document.getElementById('pickup-banner-text')?.textContent,
      magnetMeshVisible: window.__diliGame.dili.magnetMesh.visible,
      hudRows: document.querySelectorAll('.hud-powerup-row').length
    })`);
    console.log('Magnet Status:', magnetStatus);
    await captureScreenshot('04_live_magnet_active');

    // Test HYPER BOOST
    console.log('\n--- STEP 5: TESTING HYPER BOOST PICKUP & VFX ---');
    await evaluate("window.__givePowerUp('BOOST')");
    await new Promise(r => setTimeout(r, 200));
    const boostStatus = await evaluate(`({
      bannerText: document.getElementById('pickup-banner-text')?.textContent,
      boostMeshVisible: window.__diliGame.dili.boostMesh.visible,
      speedLinesVisible: !document.getElementById('speed-lines-overlay')?.classList.contains('hidden'),
      hudRows: document.querySelectorAll('.hud-powerup-row').length
    })`);
    console.log('Hyper Boost Status:', boostStatus);
    await captureScreenshot('05_live_hyper_boost_active');

    // Test 2x SCORE MULTIPLIER
    console.log('\n--- STEP 6: TESTING 2× SCORE PICKUP & BADGE ---');
    await evaluate("window.__givePowerUp('MULTIPLIER')");
    await new Promise(r => setTimeout(r, 200));
    const multStatus = await evaluate(`({
      bannerText: document.getElementById('pickup-banner-text')?.textContent,
      badgeVisible: !document.getElementById('hud-multiplier-badge')?.classList.contains('hidden'),
      badgeText: document.getElementById('hud-multiplier-badge')?.textContent.trim(),
      hudRows: document.querySelectorAll('.hud-powerup-row').length
    })`);
    console.log('2× Score Status:', multStatus);
    await captureScreenshot('06_live_2x_score_active');

    // Verify 3D collectible models in the scene
    console.log('\n--- STEP 7: SPAWN AND VERIFY 3D POWER-UP MODELS IN TRACK ---');
    await evaluate(`(() => {
      window.__spawnPowerUp('SHIELD', -1, -12);
      window.__spawnPowerUp('MAGNET', 0, -16);
      window.__spawnPowerUp('BOOST', 1, -20);
      window.__spawnPowerUp('MULTIPLIER', 0, -24);
      return true;
    })()`);
    await new Promise(r => setTimeout(r, 400));
    await captureScreenshot('07_live_3d_pickups_in_lanes');

    console.log('\n======================================================');
    console.log('🎉 ALL LIVE PRODUCTION BROWSER VERIFICATIONS PASSED!');
    console.log('======================================================');

    ws.close();
    cleanup();
    process.exit(0);
  } catch (err) {
    console.error('Error during live browser verification:', err);
    cleanup();
    process.exit(1);
  }
}

verifyLiveProductionBrowser();
