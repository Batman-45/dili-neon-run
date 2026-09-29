const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9229;

async function main() {
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1200,740',
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
    console.log('Found page target:', page ? page.title : 'none');

    if (page && page.webSocketDebuggerUrl) {
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
      console.log('Connected to CDP WebSocket');

      async function evaluate(expr) {
        const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
        return res.result?.value;
      }

      async function capture(filename) {
        const res = await send('Page.captureScreenshot', { format: 'png' });
        const outDir = path.resolve('test-screenshots');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const filePath = path.join(outDir, filename);
        fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
        console.log(`Saved screenshot: ${filename} (${fs.statSync(filePath).size} bytes)`);
      }

      await send('Page.enable');
      await send('Runtime.enable');

      // Wait for page ready
      await evaluate(`new Promise(r => {
        if (document.readyState === 'complete') r();
        else window.addEventListener('load', () => r());
      })`);
      await new Promise(r => setTimeout(r, 1200));

      // ----------------------------------------------------
      // SEED HIGH SCORES IN LOCALSTORAGE FOR LEADERBOARD
      // ----------------------------------------------------
      console.log('Seeding sample Top 10 high scores...');
      await evaluate(`(() => {
        const entries = [
          { playerName: 'CYBER_GHOST', score: 48200, distance: 3120, timestamp: Date.now() - 100000 },
          { playerName: 'NEON_RACER', score: 32840, distance: 2140, timestamp: Date.now() - 80000 },
          { playerName: 'DILI_SPEED', score: 28450, distance: 1890, timestamp: Date.now() - 60000 },
          { playerName: 'VORTEX_99', score: 24100, distance: 1560, timestamp: Date.now() - 40000 },
          { playerName: 'BATMAN', score: 19800, distance: 1240, timestamp: Date.now() - 20000 }
        ];
        localStorage.setItem('dili-neon-run-leaderboard', JSON.stringify(entries));
      })()`);

      // ----------------------------------------------------
      // TEST 1: HIGHWAY LEADERBOARD (from Start Screen)
      // ----------------------------------------------------
      console.log('Opening Highway Leaderboard from Start Screen...');
      await evaluate(`document.getElementById('btn-open-leaderboard').click()`);
      await new Promise(r => setTimeout(r, 400));

      // 1A. Leaderboard Desktop 1200x740
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1200,
        height: 740,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await new Promise(r => setTimeout(r, 200));
      await capture('phase4_01_leaderboard_desktop_1200x740.png');

      // 1B. Leaderboard Mobile 390x780
      await send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 780,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await new Promise(r => setTimeout(r, 200));
      await capture('phase4_02_leaderboard_mobile_390x780.png');

      // Close Leaderboard back to Start Screen
      console.log('Closing Leaderboard back to Start Screen...');
      await evaluate(`document.getElementById('btn-leaderboard-back').click()`);
      await new Promise(r => setTimeout(r, 300));

      // ----------------------------------------------------
      // TEST 2: PAUSE SCREEN MODAL
      // ----------------------------------------------------
      // Reset to Desktop 1200x740
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1200,
        height: 740,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await new Promise(r => setTimeout(r, 200));

      // Start gameplay
      console.log('Starting gameplay to test Pause Screen...');
      await evaluate(`document.getElementById('btn-play').click()`);
      await new Promise(r => setTimeout(r, 3800)); // wait past countdown

      // Click pause
      console.log('Triggering Pause modal...');
      await evaluate(`document.getElementById('btn-pause').click()`);
      await new Promise(r => setTimeout(r, 400));

      // 2A. Pause Desktop 1200x740
      await capture('phase4_03_pause_desktop_1200x740.png');

      // 2B. Pause Mobile 390x780
      await send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 780,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await new Promise(r => setTimeout(r, 200));
      await capture('phase4_04_pause_mobile_390x780.png');

      // Test RESUME RUN button
      console.log('Testing RESUME RUN button click...');
      await evaluate(`document.getElementById('btn-resume').click()`);
      await new Promise(r => setTimeout(r, 400));

      // Verify resumed gameplay
      const isResumed = await evaluate(`window.__diliGame.stateManager.isPlaying()`);
      console.log('Is gameplay successfully resumed after clicking RESUME?', isResumed);

      // ----------------------------------------------------
      // TEST 3: GAME OVER / RESULTS MODAL
      // ----------------------------------------------------
      console.log('Triggering Game Over modal with debrief stats...');
      await evaluate(`(() => {
        const hud = window.__diliGame.hud;
        const lb = window.__diliGame.leaderboardUI;
        
        // Hide HUD overlay
        hud.hideHUD();

        // Populate results fields and prompt high score
        hud.populateGameOver(32840, 68, 2140, 14, 4.0, 48200, true);
        lb.checkAndPromptHighScore(32840, 2140);

        // Show Game Over screen
        document.querySelectorAll('.game-screen').forEach(s => s.classList.remove('active'));
        document.getElementById('screen-gameover').classList.add('active');
      })()`);
      await new Promise(r => setTimeout(r, 400));

      // 3A. Game Over Desktop 1200x740
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1200,
        height: 740,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await new Promise(r => setTimeout(r, 200));
      await capture('phase4_05_gameover_desktop_1200x740.png');

      // 3B. Game Over Mobile 390x780
      await send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 780,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await new Promise(r => setTimeout(r, 200));
      await capture('phase4_06_gameover_mobile_390x780.png');

      // 3C. Game Over Small Mobile 375x667
      await send('Emulation.setDeviceMetricsOverride', {
        width: 375,
        height: 667,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await new Promise(r => setTimeout(r, 200));
      await capture('phase4_07_gameover_mobile_375x667.png');

      // Verify DOM content of Game Over card
      const resultsStats = await evaluate(`(() => {
        return {
          finalScore: document.getElementById('res-score')?.textContent,
          distance: document.getElementById('res-distance')?.textContent,
          bits: document.getElementById('res-bits')?.textContent,
          nearMisses: document.getElementById('res-near-misses')?.textContent,
          maxCombo: document.getElementById('res-max-combo')?.textContent,
          best: document.getElementById('res-best')?.textContent,
          isLeaderboardEntryVisible: !document.getElementById('gameover-leaderboard-entry')?.classList.contains('hidden'),
        };
      })()`);
      console.log('Game Over debrief stats verification:', resultsStats);

      ws.close();
    }
  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    chromeProc.kill('SIGKILL');
    console.log('Verification completed.');
  }
}

main();
