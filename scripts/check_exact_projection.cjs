const { spawn } = require('child_process');
const http = require('http');

const port = 9249;
const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  `--remote-debugging-port=${port}`,
  '--headless=new',
  'http://localhost:5173/'
]);

setTimeout(async () => {
  try {
    const list = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/json/list`, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });

    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    ws.onopen = async () => {
      let id = 1;
      const callbacks = new Map();
      function send(m, p = {}) {
        return new Promise((resolve, reject) => {
          const reqId = id++;
          callbacks.set(reqId, { resolve, reject });
          ws.send(JSON.stringify({ id: reqId, method: m, params: p }));
        });
      }
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id && callbacks.has(msg.id)) {
          const { resolve, reject } = callbacks.get(msg.id);
          callbacks.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };

      await send('Runtime.enable');
      await send('Page.enable');

      // Test 1: Desktop 1920x1080
      await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
      await new Promise(r => setTimeout(r, 600));

      const desktopResult = await send('Runtime.evaluate', {
        expression: `(() => {
          const engine = window.__engine;
          const camera = engine.camera.clone();
          camera.aspect = 1920 / 1080;
          camera.fov = 55;
          camera.position.set(0, 3.3, 6.2);
          camera.lookAt(0, 1.35, -20);
          camera.updateProjectionMatrix();

          const boots = camera.position.clone().set(0, 0, 0).project(camera);
          const head = camera.position.clone().set(0, 1.85, 0).project(camera);
          const screenHeightPct = ((head.y - boots.y) / 2) * 100;
          
          return {
            cameraPos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            cameraFov: camera.fov,
            bootsNdcY: boots.y,
            headNdcY: head.y,
            screenHeightPct: screenHeightPct.toFixed(1) + '%'
          };
        })()`,
        returnByValue: true
      });

      // Test 2: Mobile 390x844
      const mobileResult = await send('Runtime.evaluate', {
        expression: `(() => {
          const engine = window.__engine;
          const camera = engine.camera.clone();
          camera.aspect = 390 / 844;
          camera.fov = 64;
          camera.position.set(0, 3.5, 6.4);
          camera.lookAt(0, 1.35, -20);
          camera.updateProjectionMatrix();

          const boots = camera.position.clone().set(0, 0, 0).project(camera);
          const head = camera.position.clone().set(0, 1.85, 0).project(camera);
          const screenHeightPct = ((head.y - boots.y) / 2) * 100;
          return {
            cameraPos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            cameraFov: camera.fov,
            bootsNdcY: boots.y,
            headNdcY: head.y,
            screenHeightPct: screenHeightPct.toFixed(1) + '%'
          };
        })()`,
        returnByValue: true
      });

      console.log('Desktop 1920x1080:', desktopResult.result.value);
      console.log('Mobile 390x844:', mobileResult.result.value);

      ws.close();
      chromeProc.kill();
      process.exit(0);
    };
  } catch (err) {
    console.error(err);
    chromeProc.kill();
    process.exit(1);
  }
}, 1500);
