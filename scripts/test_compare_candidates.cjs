const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function testBothHeads() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9342',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9342/json/list', r => {
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
  const b64_v3 = fs.readFileSync('C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\d86d48cc-c83b-4c0a-a996-4889df60c7b4\\dili_chibi_head_v3_1790329710577.jpg').toString('base64');
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
      const imgV3 = await load('${b64_v3}', 'image/jpeg');

      // Helper function to build runner frame with a chosen head image
      function buildComposite(srcImg, opts) {
        // srcImg bubble center is ~512, 470, radius ~425
        const bcX = opts.bcX || 512;
        const bcY = opts.bcY || 470;
        const bRad = opts.bRad || 425;
        const hairShiftY = opts.hairShiftY || 0; // downward shift of hair mass

        // 1. Extract hair
        const hCanvas = document.createElement('canvas');
        hCanvas.width = 1024; hCanvas.height = 1024;
        const hCtx = hCanvas.getContext('2d');
        hCtx.drawImage(srcImg, 0, 0);

        const hData = hCtx.getImageData(0, 0, 1024, 1024);
        const hp = hData.data;

        // Mask hair: find purple hair pixels
        for (let y = 0; y < 1024; y++) {
          for (let x = 0; x < 1024; x++) {
            const idx = (y * 1024 + x) * 4;
            const r = hp[idx], g = hp[idx+1], b = hp[idx+2];
            const dx = x - bcX;
            const dy = y - bcY;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // Purple hair condition:
            // Hair is distinctively purple/violet (b > g && r > g) or dark tone inside head radius
            const isHair = (dist < 365) && (y < (opts.hairMaxY || 770)) && (
              (b > g + 10 && r > g + 5) || // purple
              (r < 110 && g < 70 && b < 130 && dist < 340) // deep shadow
            ) && !(r > 160 && g > 120 && b > 140); // exclude pink neck/collar

            if (isHair) {
              hp[idx + 3] = 255;
            } else {
              hp[idx + 3] = 0;
            }
          }
        }
        hCtx.putImageData(hData, 0, 0);

        // 2. Build 1024x1024 clean head
        const headC = document.createElement('canvas');
        headC.width = 1024; headC.height = 1024;
        const headCtx = headC.getContext('2d');

        // Draw glass sphere background
        headCtx.save();
        headCtx.beginPath();
        headCtx.arc(bcX, bcY, bRad, 0, Math.PI * 2);
        headCtx.clip();

        // Subtle crystal glass
        const gGrad = headCtx.createRadialGradient(bcX - 80, bcY - 100, 50, bcX, bcY, bRad);
        gGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        gGrad.addColorStop(0.5, 'rgba(120, 240, 255, 0.04)');
        gGrad.addColorStop(0.85, 'rgba(80, 20, 120, 0.06)');
        gGrad.addColorStop(1, 'rgba(0, 230, 255, 0.22)');
        headCtx.fillStyle = gGrad;
        headCtx.fillRect(0, 0, 1024, 1024);

        // Draw the lowered hair
        headCtx.drawImage(hCanvas, 0, hairShiftY);

        // Spherical gloss highlight arc
        headCtx.beginPath();
        headCtx.arc(bcX, bcY, bRad - 20, -Math.PI * 0.82, -Math.PI * 0.38, false);
        headCtx.strokeStyle = 'rgba(255, 255, 255, 0.70)';
        headCtx.lineWidth = 14;
        headCtx.lineCap = 'round';
        headCtx.stroke();

        headCtx.beginPath();
        headCtx.arc(bcX, bcY, bRad - 20, -Math.PI * 0.72, -Math.PI * 0.48, false);
        headCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        headCtx.lineWidth = 6;
        headCtx.lineCap = 'round';
        headCtx.stroke();

        // Cyan rim on top/sides only (stops at collar level)
        headCtx.beginPath();
        headCtx.arc(bcX, bcY, bRad - 4, -Math.PI * 0.88, -Math.PI * 0.12, false);
        headCtx.strokeStyle = 'rgba(120, 240, 255, 0.60)';
        headCtx.lineWidth = 6;
        headCtx.stroke();

        headCtx.restore();

        // Antialias outer edge
        const imgData = headCtx.getImageData(0, 0, 1024, 1024);
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
        headCtx.putImageData(imgData, 0, 0);

        // 3. Composite onto runner frame
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
        fCtx.drawImage(headC, destX, destY, destW, destH);

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
              bdp[idx + 3] = 0; // erase old head
            } else if (y < neckCutoff + 2) {
              bdp[idx + 3] = Math.round(bdp[idx + 3] * ((y - neckCutoff) / 2));
            }
          }
        }
        bCtx.putImageData(bd, 0, 0);
        fCtx.drawImage(bCanvas, 0, 0);

        return finalC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
      }

      const resV2 = buildComposite(imgV2, { bcX: 512, bcY: 480, bRad: 420, hairShiftY: 70, hairMaxY: 760 });
      const resV3 = buildComposite(imgV3, { bcX: 512, bcY: 480, bRad: 420, hairShiftY: 65, hairMaxY: 760 });

      return { resV2, resV3 };
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/test_compare_v2.png', Buffer.from(res.result.value.resV2, 'base64'));
  fs.writeFileSync('test-screenshots/test_compare_v3.png', Buffer.from(res.result.value.resV3, 'base64'));
  console.log('Saved test_compare_v2.png and test_compare_v3.png');
  ws.close();
  p.kill();
}
testBothHeads().catch(console.error);
