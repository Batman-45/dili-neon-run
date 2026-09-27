const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

async function testRobustDLogo() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9285',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9285/json/list', r => {
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

  const refRearB64 = fs.readFileSync('public/assets/dili_rear_ref.jpg').toString('base64');

  const script = `(async () => {
    const load = (b64, mime='image/png') => new Promise(res => {
      const img = new Image();
      img.src = 'data:' + mime + ';base64,' + b64;
      img.onload = () => res(img);
    });

    const refRear = await load('${refRearB64}', 'image/jpeg');

    // Create comparison canvas (1200 x 400)
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 400;
    const ctx = c.getContext('2d');

    // Dark road / purple background
    ctx.fillStyle = '#220828';
    ctx.fillRect(0, 0, 1200, 400);

    // 1. Draw original crop from reference for comparison
    ctx.drawImage(refRear, 380, 440, 260, 200, 20, 50, 260, 200);

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('1. Official Reference Crop', 20, 35);

    // Helper: draw vector official D
    function drawD(targetCtx, cx, cy, w, h, slant=-0.04) {
      targetCtx.save();
      targetCtx.translate(cx, cy);
      if (slant !== 0) targetCtx.transform(1, 0, Math.tan(slant), 1, 0, 0);

      const halfW = w / 2;
      const halfH = h / 2;
      const r = Math.min(w, h) * 0.14; // corner radius

      // Stroke thickness proportions (matching mascot D):
      // Stem is ~24% of width
      // Top bar is ~22% of height
      // Bottom bar is ~24% of height
      // Outer bow reaches right edge
      const stemW = w * 0.26;
      const topBarH = h * 0.22;
      const botBarH = h * 0.25;

      // Outer path
      targetCtx.beginPath();
      // Start top-left
      targetCtx.moveTo(-halfW + r, -halfH);
      // Top horizontal to bow start
      targetCtx.lineTo(halfW * 0.25, -halfH);
      // Top-right curve of bow
      targetCtx.bezierCurveTo(halfW * 0.72, -halfH, halfW, -halfH * 0.55, halfW, 0);
      // Bottom-right curve of bow
      targetCtx.bezierCurveTo(halfW, halfH * 0.55, halfW * 0.72, halfH, halfW * 0.25, halfH);
      // Bottom contour with subtle mascot cape wave
      targetCtx.bezierCurveTo(0, halfH * 1.04, -halfW * 0.4, halfH * 0.94, -halfW + r, halfH);
      // Bottom-left rounded corner
      targetCtx.arcTo(-halfW, halfH, -halfW, halfH - r, r);
      // Left vertical stem going up
      targetCtx.lineTo(-halfW, -halfH + r);
      // Top-left rounded corner
      targetCtx.arcTo(-halfW, -halfH, -halfW + r, -halfH, r);
      targetCtx.closePath();

      // Inner counter path (counter-clockwise for hole in evenodd fill)
      const holeLeft = -halfW + stemW;
      const holeTop = -halfH + topBarH;
      const holeBot = halfH - botBarH;
      const holeRight = halfW * 0.56;
      const holeR = r * 0.6;

      targetCtx.moveTo(holeLeft, holeTop + holeR);
      targetCtx.lineTo(holeLeft, holeBot - holeR);
      targetCtx.arcTo(holeLeft, holeBot, holeLeft + holeR, holeBot, holeR);
      targetCtx.lineTo(holeRight * 0.4, holeBot);
      targetCtx.bezierCurveTo(holeRight, holeBot, holeRight * 1.15, holeTop * 0.2, holeRight * 0.4, holeTop);
      targetCtx.lineTo(holeLeft + holeR, holeTop);
      targetCtx.arcTo(holeLeft, holeTop, holeLeft, holeTop + holeR, holeR);
      targetCtx.closePath();

      // 1. Crisp deep-purple edge / contact shadow (1.5px)
      targetCtx.shadowColor = 'rgba(40, 5, 45, 0.85)';
      targetCtx.shadowBlur = 4;
      targetCtx.shadowOffsetX = 0.5;
      targetCtx.shadowOffsetY = 2;

      // Fill with pure white using nonzero/evenodd rule
      targetCtx.fillStyle = '#ffffff';
      targetCtx.fill('evenodd');

      targetCtx.restore();
    }

    // 2. Large standalone rendering
    ctx.fillText('2. High-Res Simplified Official D', 320, 35);
    // Draw purple cape patch
    ctx.fillStyle = '#b520a0';
    ctx.beginPath();
    ctx.arc(450, 150, 110, 0, Math.PI * 2);
    ctx.fill();
    drawD(ctx, 450, 150, 140, 100);

    // 3. Medium scale (as on 384x384 sprite frame, W=70, H=50)
    ctx.fillText('3. Sprite Frame Scale (W=70, H=50)', 620, 35);
    ctx.fillStyle = '#b520a0';
    ctx.beginPath();
    ctx.arc(720, 150, 60, 0, Math.PI * 2);
    ctx.fill();
    drawD(ctx, 720, 150, 70, 50);

    // 4. Actual Gameplay Screen Scale (1:1 zoom as seen by player: W=18, H=13)
    ctx.fillText('4. REAL GAMEPLAY SCALE (1:1 Screen Pixels)', 870, 35);
    ctx.fillStyle = '#b520a0';
    ctx.beginPath();
    ctx.arc(970, 150, 25, 0, Math.PI * 2);
    ctx.fill();
    drawD(ctx, 970, 150, 22, 16);

    // Also draw a 4x magnified version of that 1:1 scale
    ctx.fillText('5. 4x Magnified View of Gameplay Scale', 870, 230);
    const miniC = document.createElement('canvas');
    miniC.width = 50; miniC.height = 50;
    const mCtx = miniC.getContext('2d');
    mCtx.fillStyle = '#b520a0';
    mCtx.fillRect(0, 0, 50, 50);
    drawD(mCtx, 25, 25, 22, 16);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(miniC, 870, 250, 140, 140);

    return c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
  })()`;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/robust_d_test.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved robust D comparison test');
  ws.close();
  p.kill();
}
testRobustDLogo().catch(console.error);
