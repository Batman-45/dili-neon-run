const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

async function testSlideDeformation() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9283',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9283/json/list', r => {
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

  const sheetB64 = fs.readFileSync('public/assets/dili_runner_sheet.png').toString('base64');

  const script = `(async () => {
    const load = (b64) => new Promise(res => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      img.onload = () => res(img);
    });

    const sheet = await load('${sheetB64}');

    // Create canvas (1200 x 500)
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 500;
    const ctx = c.getContext('2d');

    // Dark road background
    ctx.fillStyle = '#0a0a16';
    ctx.fillRect(0, 0, 1200, 500);

    // Ground line at Y = 420
    const groundY = 420;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(1200, groundY);
    ctx.stroke();

    // 1. Draw Normal Standing / Running Frame (Frame 0)
    // Frame 0 is at ox = 0 in sheet
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('1. NORMAL RUNNING (Frame 0)', 40, 50);

    // Height of Dili on screen: ~280px tall for inspection
    // Sprite frame is 384x384. Ground in sprite is Y=360.
    const drawScale = 280 / 384;
    const frameW = 384 * drawScale;
    const frameH = 384 * drawScale;
    const frameY = groundY - (360 * drawScale);

    ctx.drawImage(sheet, 0, 0, 384, 384, 80, frameY, frameW, frameH);

    // 2. Draw OLD SLIDE (Uniform scale.y = 0.48, scale.x = 1.25)
    ctx.fillText('2. OLD SLIDE (Shrunk / Flattened)', 420, 50);
    const oldW = frameW * 1.25;
    const oldH = frameH * 0.48;
    const oldY = groundY - (360 * drawScale * 0.48);
    ctx.drawImage(sheet, 4 * 384, 0, 384, 384, 460 - (oldW - frameW) / 2, oldY, oldW, oldH);

    // 3. Draw NEW ANATOMICAL CROUCH SLIDE
    ctx.fillText('3. NEW ANATOMICAL SLIDE (Head Full Size, Body Folded)', 780, 50);

    // Let's render slice-by-slice deformation of Frame 4
    // Frame 4 is at ox = 4 * 384 = 1536
    // Slice height: 2px
    const slices = 192; // 384 / 2
    const neckSpriteY = 175; // bottom of helmet in sprite
    const groundSpriteY = 360;

    // In slide, body (175..360, 185px) compresses to ~45px
    // Head (58..175, 117px) stays 117px full height!
    // Total character height in slide = 45px + 117px = 162px (vs standing 302px)
    // Ground is at groundY
    const bodySlideH = 48 * drawScale;
    const headSlideH = 117 * drawScale;

    // Draw slice by slice
    for (let s = 0; s < slices; s++) {
      const srcY = s * 2;
      const srcH = 2;

      let destY, destH, destW, destX;

      if (srcY >= neckSpriteY) {
        // Body region: compresses between neck and ground
        const bodyFrac = (srcY - neckSpriteY) / (groundSpriteY - neckSpriteY);
        destY = (groundY - bodySlideH) + bodyFrac * bodySlideH;
        destH = (2 / (groundSpriteY - neckSpriteY)) * bodySlideH;
        // Body widens slightly
        const widthMult = 1.18;
        destW = frameW * widthMult;
        destX = 900 - (destW / 2);
      } else {
        // Head region: full size, sits on top of folded body!
        const headFrac = (neckSpriteY - srcY) / neckSpriteY;
        destY = (groundY - bodySlideH) - (neckSpriteY - srcY) * drawScale;
        destH = srcH * drawScale;
        destW = frameW * 1.0;
        destX = 900 - (destW / 2);
      }

      ctx.drawImage(sheet, 4 * 384, srcY, 384, srcH, destX, destY, destW, destH);
    }

    return c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
  })()`;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/slide_deformation_comparison.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved slide deformation comparison');
  ws.close();
  p.kill();
}
testSlideDeformation().catch(console.error);
