const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9444;

async function main() {
  console.log('Starting Chrome for Leaderboard E2E Test...');
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
    console.log('Target page found:', page?.title);

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const reqId = id++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === reqId) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');

    // Helper to evaluate JS in the page
    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (res.exceptionDetails) {
        throw new Error('Eval error: ' + (res.exceptionDetails.exception?.description || res.exceptionDetails.text));
      }
      return res.result?.value;
    }

    // Helper to capture screenshot
    async function capture(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.resolve('test-screenshots', filename);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`Saved screenshot: ${filename} (${fs.statSync(filePath).size} bytes)`);
    }

    // Wait for page ready
    await new Promise(r => setTimeout(r, 1500));

    // Clear any previous leaderboard in localStorage for clean test run
    await evaluate(`localStorage.removeItem('dili-neon-run-leaderboard');`);

    // 1. Verify Home Screen Leaderboard button
    console.log('1. Checking Home screen...');
    const hasLeaderboardBtn = await evaluate(`!!document.getElementById('btn-open-leaderboard')`);
    console.log('Home screen has LEADERBOARD button:', hasLeaderboardBtn);
    if (!hasLeaderboardBtn) throw new Error('btn-open-leaderboard not found');

    // 2. Open Leaderboard
    console.log('2. Opening Leaderboard modal...');
    await evaluate(`document.getElementById('btn-open-leaderboard').click();`);
    await new Promise(r => setTimeout(r, 400));
    await capture('leaderboard_empty_modal.png');

    const isLbActive = await evaluate(`document.getElementById('screen-leaderboard').classList.contains('active')`);
    const isEmptyVisible = await evaluate(`!document.getElementById('leaderboard-empty-state').classList.contains('hidden')`);
    console.log('Leaderboard screen active:', isLbActive, '| Empty message visible:', isEmptyVisible);
    if (!isLbActive || !isEmptyVisible) throw new Error('Leaderboard modal did not open or empty state not shown');

    // 3. Click BACK to return to title
    console.log('3. Clicking BACK button...');
    await evaluate(`document.getElementById('btn-leaderboard-back').click();`);
    await new Promise(r => setTimeout(r, 400));
    const isStartActive = await evaluate(`document.getElementById('screen-start').classList.contains('active')`);
    console.log('Returned to start screen:', isStartActive);
    if (!isStartActive) throw new Error('Did not return to start screen');

    // 4. Start Run
    console.log('4. Starting Run (Click #btn-play)...');
    await evaluate(`document.getElementById('btn-play').click();`);
    // Wait for countdown
    for (let i = 0; i < 30; i++) {
      const hudVisible = await evaluate(`!document.getElementById('hud-overlay').classList.contains('hud-hidden')`);
      if (hudVisible) break;
      await new Promise(r => setTimeout(r, 200));
    }
    console.log('Gameplay active! Running for 2 seconds to score points...');
    await new Promise(r => setTimeout(r, 2000));

    // 5. Trigger Crash
    console.log('5. Triggering crash to end run...');
    await evaluate(`window.__testCrash ? window.__testCrash() : window.__stateManager.crash();`);
    await new Promise(r => setTimeout(r, 800)); // wait for game over delay

    const isGameOverActive = await evaluate(`document.getElementById('screen-gameover').classList.contains('active')`);
    console.log('Game Over screen active:', isGameOverActive);
    if (!isGameOverActive) throw new Error('Game Over screen not active');

    // 6. Verify High Score prompt is shown
    const isPromptVisible = await evaluate(`!document.getElementById('gameover-leaderboard-entry').classList.contains('hidden')`);
    console.log('High Score prompt visible:', isPromptVisible);
    if (!isPromptVisible) throw new Error('High score prompt not shown for qualifying run');

    // 7. Verify Empty/Whitespace Nickname Validation Rejection
    console.log('7a. Testing empty nickname submission...');
    await evaluate(`(() => {
      const input = document.getElementById('leaderboard-player-input');
      input.value = '';
      document.getElementById('btn-submit-score').click();
    })()`);
    await new Promise(r => setTimeout(r, 200));

    let valMsg = await evaluate(`document.getElementById('leaderboard-entry-feedback').textContent`);
    let valBtnDisabled = await evaluate(`document.getElementById('btn-submit-score').disabled`);
    let savedRaw = await evaluate(`localStorage.getItem('dili-neon-run-leaderboard')`);
    console.log('Empty name validation msg:', valMsg, '| Button disabled:', valBtnDisabled, '| localStorage saved:', !!savedRaw);
    if (valMsg !== 'Enter a callsign.' || valBtnDisabled || savedRaw !== null) {
      throw new Error('Empty nickname was not properly rejected');
    }

    console.log('7b. Testing whitespace-only nickname submission...');
    await evaluate(`(() => {
      const input = document.getElementById('leaderboard-player-input');
      input.value = '    ';
      document.getElementById('btn-submit-score').click();
    })()`);
    await new Promise(r => setTimeout(r, 200));

    valMsg = await evaluate(`document.getElementById('leaderboard-entry-feedback').textContent`);
    valBtnDisabled = await evaluate(`document.getElementById('btn-submit-score').disabled`);
    savedRaw = await evaluate(`localStorage.getItem('dili-neon-run-leaderboard')`);
    console.log('Whitespace validation msg:', valMsg, '| Button disabled:', valBtnDisabled, '| localStorage saved:', !!savedRaw);
    if (valMsg !== 'Enter a callsign.' || valBtnDisabled || savedRaw !== null) {
      throw new Error('Whitespace-only nickname was not properly rejected');
    }

    // 7c. Enter valid player name "Batman" and Submit
    console.log('7c. Entering valid player name "Batman" and saving...');
    await evaluate(`(() => {
      const input = document.getElementById('leaderboard-player-input');
      input.value = 'Batman';
      document.getElementById('btn-submit-score').click();
    })()`);
    await new Promise(r => setTimeout(r, 400));
    await capture('gameover_leaderboard_saved.png');

    const feedbackText = await evaluate(`document.getElementById('leaderboard-entry-feedback').textContent`);
    const btnText = await evaluate(`document.getElementById('btn-submit-score').textContent`);
    console.log('Saved feedback:', feedbackText, '| Button text:', btnText);
    if (!feedbackText.includes('#1') || !btnText.includes('SAVED')) {
      throw new Error('Save feedback or button state incorrect');
    }

    // 8. Return to Home and inspect Leaderboard
    console.log('8. Returning to Home...');
    await evaluate(`document.getElementById('btn-gameover-title').click();`);
    await new Promise(r => setTimeout(r, 400));

    console.log('Opening Leaderboard to verify saved record...');
    await evaluate(`document.getElementById('btn-open-leaderboard').click();`);
    await new Promise(r => setTimeout(r, 400));
    await capture('leaderboard_populated.png');

    const rowsCount = await evaluate(`document.querySelectorAll('#leaderboard-entries-list .leaderboard-row').length`);
    const firstPlayerName = await evaluate(`document.querySelector('#leaderboard-entries-list .col-name')?.textContent`);
    const firstPlayerRank = await evaluate(`document.querySelector('#leaderboard-entries-list .col-rank')?.textContent`);
    console.log('Leaderboard rows:', rowsCount, '| #1 Name:', firstPlayerName, '| Rank:', firstPlayerRank);
    if (rowsCount !== 1 || firstPlayerName !== 'Batman' || firstPlayerRank !== '#1') {
      throw new Error('Leaderboard entry does not match expected Batman record');
    }

    // 9. Test Clear confirmation
    console.log('9. Testing Clear Local Records...');
    await evaluate(`document.getElementById('btn-leaderboard-clear-prompt').click();`);
    const confirmVisible = await evaluate(`!document.getElementById('leaderboard-clear-confirm').classList.contains('hidden')`);
    console.log('Confirm dialog visible:', confirmVisible);

    // Cancel first
    await evaluate(`document.getElementById('btn-clear-cancel').click();`);
    const confirmHidden = await evaluate(`document.getElementById('leaderboard-clear-confirm').classList.contains('hidden')`);
    console.log('Cancel hides dialog:', confirmHidden);

    // Confirm clear
    await evaluate(`document.getElementById('btn-leaderboard-clear-prompt').click();`);
    await evaluate(`document.getElementById('btn-clear-confirm').click();`);
    await new Promise(r => setTimeout(r, 300));
    await capture('leaderboard_cleared.png');

    const emptyAfterClear = await evaluate(`!document.getElementById('leaderboard-empty-state').classList.contains('hidden')`);
    console.log('Leaderboard empty after clear:', emptyAfterClear);
    if (!emptyAfterClear) throw new Error('Leaderboard not empty after clear confirmation');

    ws.close();
    console.log('✅ ALL LEADERBOARD E2E INTEGRATION TESTS PASSED!');
  } finally {
    chromeProc.kill();
  }
}

main().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
