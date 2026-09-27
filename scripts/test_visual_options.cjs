const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9334;

async function run() {
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1600,1200',
    'about:blank',
  ]);

  await new Promise(r => setTimeout(r, 1500));

  const list = await new Promise((res, rej) => http.get(`http://localhost:${port}/json/list`, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
  }).on('error', rej));

  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (m, params = {}) => new Promise((res, rej) => {
    const i = id++;
    const onm = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === i) { ws.removeEventListener('message', onm); if (msg.error) rej(msg.error); else res(msg.result); }
    };
    ws.addEventListener('message', onm);
    ws.send(JSON.stringify({ id: i, method: m, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');

  // Load the 8 original 3D frames
  const frameB64s = [];
  for (let i = 0; i < 8; i++) {
    const p = path.join(__dirname, '..', 'test-screenshots', '3d_frames', `frame_${i}.png`);
    frameB64s.push(fs.readFileSync(p).toString('base64'));
  }

  // Load 01-original.png to sample colors and D logo
  const originalB64 = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', '01-original.png')).toString('base64');
  const rearViewB64 = fs.readFileSync('C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\4fff2623-b932-42f8-a7a0-82fd85cdea87\\dili_mascot_rear_view_1790355607832.jpg').toString('base64');

  const evalCode = `(async () => {
    const load = (b64, mime='image/png') => new Promise(res => {
      const img = new Image();
      img.src = 'data:' + mime + ';base64,' + b64;
      img.onload = () => res(img);
    });

    const frames = await Promise.all(${JSON.stringify(frameB64s)}.map(b => load(b, 'image/png')));
    const orig = await load('${originalB64}', 'image/png');
    const rear = await load('${rearViewB64}', 'image/jpeg');

    // Create a canvas to process frames
    // Each frame in 3d_frames is 384x384.
    // Let's inspect frame dimensions
    const fw = frames[0].width;
    const fh = frames[0].height;

    // Build enhanced frames:
    // 1. In 3d_frames, the head/helmet/body are perfectly unified.
    // 2. We color-grade the purple brain curls to match official Dili (#3b1458 - #682098).
    // 3. We draw the official bold white 'D' logo on the back of the cape/hoodie with bevel/shadow.
    // 4. We fix any backpack glare.
    // 5. We produce an 8-frame spritesheet (3072 x 384).

    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = fw * 8;
    sheetCanvas.height = fh;
    const sCtx = sheetCanvas.getContext('2d');

    // Also create single frame comparison canvas
    const compCanvas = document.createElement('canvas');
    compCanvas.width = 1200;
    compCanvas.height = 600;
    const cCtx = compCanvas.getContext('2d');

    // Fill dark road background on comparison
    cCtx.fillStyle = '#0a0a14';
    cCtx.fillRect(0, 0, 1200, 600);

    for (let i = 0; i < 8; i++) {
      const fc = document.createElement('canvas');
      fc.width = fw; fc.height = fh;
      const ctx = fc.getContext('2d');

      // Draw base 3d frame
      ctx.drawImage(frames[i], 0, 0);

      // Pixel processing:
      // A. Deepen and enrich the purple hair color
      // Hair is inside helmet: approx X in [100, 280], Y in [60, 210]
      const imgData = ctx.getImageData(0, 0, fw, fh);
      const d = imgData.data;

      for (let y = 50; y < 220; y++) {
        for (let x = 90; x < 290; x++) {
          const idx = (y * fw + x) * 4;
          const a = d[idx + 3];
          if (a < 30) continue;

          const r = d[idx], g = d[idx + 1], b = d[idx + 2];

          // Check if pixel is part of the hair/brain (purple/lavender/blue tones inside helmet)
          // Hair has r and b higher than g, or blue sky tint on purple
          const isHair = (b > g && (r > g || b > 60)) && !(r > 190 && g > 150 && b > 180 && y > 185);

          if (isHair) {
            // Enhance purple richness: reduce excess green, boost magenta/purple ratio
            // Official Dili purple hair has deep violet shadow: R=60, G=20, B=90; highlight: R=110, G=35, B=155
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            
            // Re-map to vibrant Dili purple spectrum
            const targetR = Math.min(255, lum * 0.95 + 15);
            const targetG = Math.max(0, lum * 0.25);
            const targetB = Math.min(255, lum * 1.35 + 25);

            // Blend 65% toward target vibrant purple
            d[idx] = Math.round(r * 0.35 + targetR * 0.65);
            d[idx + 1] = Math.round(g * 0.35 + targetG * 0.65);
            d[idx + 2] = Math.round(b * 0.35 + targetB * 0.65);
          }
        }
      }

      // Remove the white specular glare spot on the backpack in frames 3, 6, 7
      // That glare is around X in [160, 215], Y in [200, 255]
      for (let y = 195; y < 265; y++) {
        for (let x = 150; x < 230; x++) {
          const idx = (y * fw + x) * 4;
          const r = d[idx], g = d[idx + 1], b = d[idx + 2];
          // If it's a bright white spot on the dark backpack
          if (r > 180 && g > 180 && b > 180) {
            // Darken it to match surrounding dark backpack/strap tone
            d[idx] = 45;
            d[idx + 1] = 30;
            d[idx + 2] = 45;
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Now add the official large bold white 'D' branding on the back!
      // In 01-original.png, the 'D' has thick rounded geometry.
      // Position on the back/cape: center around X=192 (or slightly shifted with torso bob), Y=210-235
      // Let's determine torso position for this frame:
      // Look at cape/back position in frame i:
      const capeCenterY = 222 + (i === 1 || i === 5 ? 4 : (i === 3 || i === 7 ? -3 : 0));
      const capeCenterX = 192 + (i % 2 === 0 ? -1 : 1);

      ctx.save();
      ctx.translate(capeCenterX, capeCenterY);
      
      // Draw bold 3D 'D' Logo
      // Outer drop shadow
      ctx.font = '900 48px "Arial Black", "Impact", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 1. Soft dark magenta / purple drop shadow
      ctx.fillStyle = 'rgba(40, 10, 50, 0.7)';
      ctx.fillText('D', 1, 3);

      // 2. Neon pink outline/bevel (matching Dili branding in 01-original.png)
      ctx.strokeStyle = '#e03dbb';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.strokeText('D', 0, 0);

      // 3. Bright crisp white core
      ctx.fillStyle = '#ffffff';
      ctx.fillText('D', 0, 0);

      // 4. Subtle inner highlight on top curve of D
      ctx.restore();

      // Draw onto sheet
      sCtx.drawImage(fc, i * fw, 0);

      // Draw onto comparison
      if (i < 3) {
        cCtx.drawImage(fc, 100 + i * 350, 100);
      }
    }

    return {
      sheetData: sheetCanvas.toDataURL('image/png'),
      compData: compCanvas.toDataURL('image/png')
    };
  })()`;

  const res = await send('Runtime.evaluate', { expression: evalCode, awaitPromise: true, returnByValue: true });
  
  // Save comparison and sheet
  const compBuf = Buffer.from(res.value.compData.replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(__dirname, '..', 'test-screenshots', 'enhanced_dili_compare.png'), compBuf);

  const sheetBuf = Buffer.from(res.value.sheetData.replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(__dirname, '..', 'test-screenshots', 'enhanced_dili_sheet.png'), sheetBuf);

  console.log('Successfully saved enhanced_dili_compare.png and enhanced_dili_sheet.png');

  ws.close();
  chromeProc.kill();
}

run().catch(console.error);
