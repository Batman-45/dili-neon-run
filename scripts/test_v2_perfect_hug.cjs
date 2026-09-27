const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function testV2PerfectHug() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9343',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9343/json/list', r => {
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
  await send('Runtime.enable');

  const b64_v2 = fs.readFileSync('C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\d86d48cc-c83b-4c0a-a996-4889df60c7b4\\dili_rear_head_chibi_v2_1790329622771.jpg').toString('base64');
  const f1B64 = fs.readFileSync('test-screenshots/frames/frame_1.png').toString('base64');

  const script = `
    (async () => {
      const load = (b64, mime='image/png') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });
      const f1 = await load('${f1B64}', 'image/png');
      const imgV2 = await load('${b64_v2}', 'image/jpeg');

      // 1. Isolate the hair from v2 with clean mask
      const rawC = document.createElement('canvas');
      rawC.width = 1024; rawC.height = 1024;
      const rawCtx = rawC.getContext('2d');
      rawCtx.drawImage(imgV2, 0, 0);

      const rawData = rawCtx.getImageData(0, 0, 1024, 1024);
      const rp = rawData.data;

      // Extract hair center & bounds
      // In v2, hair center is roughly (512, 450)
      const hcX = 512, hcY = 450;
      
      const hairOnlyC = document.createElement('canvas');
      hairOnlyC.width = 1024; hairOnlyC.height = 1024;
      const hoCtx = hairOnlyC.getContext('2d');

      const hairData = hoCtx.createImageData(1024, 1024);
      const hp = hairData.data;

      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const r = rp[idx], g = rp[idx+1], b = rp[idx+2];
          const dx = x - hcX, dy = y - hcY;
          const dist = Math.sqrt(dx*dx + dy*dy);

          // Hair is purple or shadowed purple, stopping before the pink neck
          // The pink neck has high red and green (e.g. r > 180, g > 115, b > 145)
          const isPinkNeck = (r > 165 && g > 110 && b > 140 && y > 720);
          const isHair = (dist < 370) && !isPinkNeck && (
            (b > g + 8 && r > g + 4) || // purple tones
            (r < 110 && g < 70 && b < 130 && dist < 340) // shadow
          );

          if (isHair) {
            hp[idx] = r;
            hp[idx + 1] = g;
            hp[idx + 2] = b;
            hp[idx + 3] = 255;
          }
        }
      }
      hoCtx.putImageData(hairData, 0, 0);

      // Now add 2 bottom curl lobes at the bottom of the hair to round out the bottom!
      // Center bottom curl lobes fill any neck cavity with natural curly lobes
      const bottomLobes = [
        { x: -50, y: 740, r: 85, color: '#451662' },
        { x: 50,  y: 740, r: 85, color: '#451662' },
        { x: 0,   y: 770, r: 80, color: '#381050' },
      ];
      hoCtx.save();
      for (const lb of bottomLobes) {
        const lx = hcX + lb.x, ly = lb.y;
        const g = hoCtx.createRadialGradient(lx - 20, ly - 20, 5, lx, ly, lb.r);
        g.addColorStop(0, '#7528a8');
        g.addColorStop(0.5, lb.color);
        g.addColorStop(1, '#2b0c3d');
        hoCtx.fillStyle = g;
        hoCtx.beginPath();
        hoCtx.arc(lx, ly, lb.r, 0, Math.PI * 2);
        hoCtx.fill();
      }
      hoCtx.restore();

      // 2. Build 1024x1024 Head Dome
      // Bubble center (512, 470), bubble radius 420
      const bcX = 512, bcY = 470, bRad = 420;

      const masterHead = document.createElement('canvas');
      masterHead.width = 1024; masterHead.height = 1024;
      const mhCtx = masterHead.getContext('2d');

      // Clip to bubble
      mhCtx.save();
      mhCtx.beginPath();
      mhCtx.arc(bcX, bcY, bRad, 0, Math.PI * 2);
      mhCtx.clip();

      // Subtle glass back-sheen
      const gGrad = mhCtx.createRadialGradient(bcX - 80, bcY - 100, 50, bcX, bcY, bRad);
      gGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      gGrad.addColorStop(0.5, 'rgba(120, 240, 255, 0.04)');
      gGrad.addColorStop(0.85, 'rgba(80, 20, 120, 0.06)');
      gGrad.addColorStop(1, 'rgba(0, 230, 255, 0.22)');
      mhCtx.fillStyle = gGrad;
      mhCtx.fillRect(0, 0, 1024, 1024);

      // Scale hair so it fills ~84% of the bubble (just like official Dili mascot)
      // Original hair radius was ~330, bubble is 420. Hair scale ~ 1.08.
      const hairScale = 1.08;
      // Position hair: downward so bottom curl lobes reach y = 880 (well past collar line!)
      const hDestW = 1024 * hairScale;
      const hDestH = 1024 * hairScale;
      const hDestX = bcX - (hcX * hairScale);
      const hDestY = (bcY - (hcY * hairScale)) + 45; // lower hair by 45px!

      mhCtx.drawImage(hairOnlyC, hDestX, hDestY, hDestW, hDestH);

      // Spherical gloss highlight arc (top right / top left)
      mhCtx.beginPath();
      mhCtx.arc(bcX, bcY, bRad - 20, -Math.PI * 0.82, -Math.PI * 0.38, false);
      mhCtx.strokeStyle = 'rgba(255, 255, 255, 0.70)';
      mhCtx.lineWidth = 14;
      mhCtx.lineCap = 'round';
      mhCtx.stroke();

      mhCtx.beginPath();
      mhCtx.arc(bcX, bcY, bRad - 20, -Math.PI * 0.72, -Math.PI * 0.48, false);
      mhCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      mhCtx.lineWidth = 6;
      mhCtx.lineCap = 'round';
      mhCtx.stroke();

      // Cyan rim on top/sides only (stops at collar level so NO line cuts across hoodie)
      mhCtx.beginPath();
      mhCtx.arc(bcX, bcY, bRad - 4, -Math.PI * 0.88, -Math.PI * 0.12, false);
      mhCtx.strokeStyle = 'rgba(120, 240, 255, 0.60)';
      mhCtx.lineWidth = 6;
      mhCtx.stroke();

      mhCtx.restore();

      // Antialias outer edge
      const imgData = mhCtx.getImageData(0, 0, 1024, 1024);
      const pData = imgData.data;
      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const idx = (y * 1024 + x) * 4;
          const dx = x - bcX;
          const dy = y - bcY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > bRad + 1) {
            pData[idx + 3] = 0;
          } else if (dist > bRad - 2) {
            pData[idx + 3] = Math.round(pData[idx + 3] * Math.max(0, Math.min(1, (bRad + 1 - dist) / 3)));
          }
        }
      }
      mhCtx.putImageData(imgData, 0, 0);

      // 3. Composite onto runner frame 1
      const finalC = document.createElement('canvas');
      finalC.width = 384; finalC.height = 384;
      const fCtx = finalC.getContext('2d');

      const oldCx = 224.5;
      const oldCy = 101.5;
      const oldRad = 87.5;

      const scale = oldRad / bRad;
      const destW = 1024 * scale;
      const destH = 1024 * scale;
      const destX = oldCx - (bcX * scale);
      const destY = oldCy - (bcY * scale);

      // Draw new head
      fCtx.drawImage(masterHead, destX, destY, destW, destH);

      // Draw existing runner body, keeping collar in front
      const bCanvas = document.createElement('canvas');
      bCanvas.width = 384; bCanvas.height = 384;
      const bCtx = bCanvas.getContext('2d');
      bCtx.drawImage(f1, 0, 0);

      const bd = bCtx.getImageData(0, 0, 384, 384);
      const bdp = bd.data;
      for (let y = 0; y < 384; y++) {
        for (let x = 0; x < 384; x++) {
          const idx = (y * 384 + x) * 4;
          const dx = Math.abs(x - oldCx);
          // Collar crest boundary in frame 1
          const neckCutoff = (dx < 30) ? 172 : (dx < 60 ? 168 : 162);
          if (y < neckCutoff) {
            bdp[idx + 3] = 0; // erase old head & old neck stem
          } else if (y < neckCutoff + 2) {
            bdp[idx + 3] = Math.round(bdp[idx + 3] * ((y - neckCutoff) / 2));
          }
        }
      }
      bCtx.putImageData(bd, 0, 0);
      fCtx.drawImage(bCanvas, 0, 0);

      return finalC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/test_v2_perfect_hug.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved test_v2_perfect_hug.png');
  ws.close();
  p.kill();
}
testV2PerfectHug().catch(console.error);
