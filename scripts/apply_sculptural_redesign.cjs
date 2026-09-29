const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

async function applySculpturalRedesign() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9478',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9478/json/list', r => {
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

  const refB64 = fs.readFileSync('public/assets/dili_rear_ref.jpg').toString('base64');
  const oldSheetB64 = fs.readFileSync('scratch/backup_pre_sculptural_redesign/dili_runner_sheet.png').toString('base64');
  const oldSlideB64 = fs.readFileSync('scratch/backup_pre_sculptural_redesign/dili_slide.png').toString('base64');

  const script = `
    (async () => {
      const load = (b64, mime='image/png') => new Promise(res => {
        const img = new Image();
        img.src = 'data:' + mime + ';base64,' + b64;
        img.onload = () => res(img);
      });
      const refImg = await load('${refB64}', 'image/jpeg');
      const sheetImg = await load('${oldSheetB64}', 'image/png');
      const slideImg = await load('${oldSlideB64}', 'image/png');

      const refC = document.createElement('canvas');
      refC.width = 1024; refC.height = 1024;
      const rCtx = refC.getContext('2d');
      rCtx.drawImage(refImg, 0, 0);
      const rp = rCtx.getImageData(0, 0, 1024, 1024).data;

      // Head canvas: 460x490 (extra height for seamless hood cradle)
      const headC = document.createElement('canvas');
      headC.width = 460; headC.height = 490;
      const hCtx = headC.getContext('2d');
      const hImgData = hCtx.createImageData(460, 490);
      const hp = hImgData.data;

      const bcX = 512, bcY = 290, bRad = 196;

      for (let oy = 0; oy < 490; oy++) {
        for (let ox = 0; ox < 460; ox++) {
          const sx = ox + (512 - 230);
          const sy = oy + (290 - 200);
          const sIdx = (sy * 1024 + sx) * 4;
          const oIdx = (oy * 460 + ox) * 4;

          const r = rp[sIdx], g = rp[sIdx+1], b = rp[sIdx+2];
          const dx = sx - bcX;
          const dy = sy - bcY;
          const dist = Math.sqrt(dx*dx + dy*dy);

          if (dist <= bRad) {
            // Authentic 3D hair boundary from canon model
            const isHair = (dist < 164) && (b > g + 4 && r > g && (r+g+b) < 510);
            const isSpecularGlint = (dist > 90 && r > 230 && g > 230 && b > 230 && dx > 15 && dy < -5);

            if (isHair) {
              const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
              if (lum < 0.28) {
                const t = lum / 0.28;
                hp[oIdx]   = Math.round(18 + t * 35);
                hp[oIdx+1] = Math.round(4 + t * 14);
                hp[oIdx+2] = Math.round(36 + t * 50);
              } else if (lum < 0.65) {
                const t = (lum - 0.28) / 0.37;
                hp[oIdx]   = Math.round(53 + t * 77);
                hp[oIdx+1] = Math.round(18 + t * 25);
                hp[oIdx+2] = Math.round(86 + t * 105);
              } else {
                const t = (lum - 0.65) / 0.35;
                hp[oIdx]   = Math.round(130 + t * 65);
                hp[oIdx+1] = Math.round(43 + t * 45);
                hp[oIdx+2] = Math.round(191 + t * 55);
              }
              hp[oIdx+3] = 255;
            } else if (isSpecularGlint) {
              const glintDist = Math.sqrt((dx - 70)*(dx - 70) + (dy - (-100))*(dy - (-100)));
              const glintAlpha = Math.max(0, Math.min(1, (65 - glintDist) / 30));
              hp[oIdx]   = 255;
              hp[oIdx+1] = 255;
              hp[oIdx+2] = 255;
              hp[oIdx+3] = Math.round(240 * glintAlpha);
            } else {
              // Air clearance gap: transparent crystal glass with crisp outer rim
              const rimDist = bRad - dist;
              if (rimDist < 5) {
                const edgeAlpha = rimDist / 5;
                hp[oIdx]   = 180;
                hp[oIdx+1] = 235;
                hp[oIdx+2] = 255;
                hp[oIdx+3] = Math.round(180 * edgeAlpha);
              } else {
                const lum = (r + g + b) / 3;
                if (lum > 240) {
                  hp[oIdx]   = 0;
                  hp[oIdx+1] = 240;
                  hp[oIdx+2] = 255;
                  hp[oIdx+3] = 14;
                } else {
                  const alpha = Math.min(130, Math.max(15, (255 - lum) * 1.1));
                  hp[oIdx]   = r;
                  hp[oIdx+1] = g;
                  hp[oIdx+2] = b;
                  hp[oIdx+3] = Math.round(alpha);
                }
              }
            }
          } else {
            hp[oIdx+3] = 0;
          }
        }
      }
      hCtx.putImageData(hImgData, 0, 0);

      // Sculptural curl lobe ambient occlusion and crest highlights
      hCtx.save();
      hCtx.beginPath();
      hCtx.arc(230, 200, 162, 0, Math.PI * 2);
      hCtx.clip();

      const majorClusters = [
        { cx: 230, cy: 92,  r: 45 },
        { cx: 160, cy: 130, r: 42 },
        { cx: 300, cy: 130, r: 42 },
        { cx: 125, cy: 200, r: 44 },
        { cx: 335, cy: 200, r: 44 },
        { cx: 160, cy: 260, r: 40 },
        { cx: 300, cy: 260, r: 40 },
        { cx: 230, cy: 195, r: 42 }
      ];

      majorClusters.forEach(c => {
        const cg = hCtx.createRadialGradient(
          c.cx + c.r * 0.2, c.cy - c.r * 0.25, 0,
          c.cx, c.cy, c.r
        );
        cg.addColorStop(0.0, 'rgba(195, 85, 255, 0.45)');
        cg.addColorStop(0.5, 'rgba(145, 45, 215, 0.22)');
        cg.addColorStop(0.8, 'rgba(80, 20, 120, 0.0)');
        cg.addColorStop(1.0, 'rgba(15, 3, 25, 0.35)');
        hCtx.fillStyle = cg;
        hCtx.beginPath();
        hCtx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
        hCtx.fill();
      });
      hCtx.restore();

      // Crystal glass dome outer definition
      hCtx.save();
      // Outer glass Fresnel glow
      hCtx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
      hCtx.lineWidth = 3.5;
      hCtx.beginPath();
      hCtx.arc(230, 200, 194.5, 0, Math.PI * 2);
      hCtx.stroke();

      // Inner glass refraction ring
      hCtx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      hCtx.lineWidth = 1.8;
      hCtx.beginPath();
      hCtx.arc(230, 200, 190.5, 0, Math.PI * 2);
      hCtx.stroke();

      // Primary top-right specular arc
      hCtx.strokeStyle = '#ffffff';
      hCtx.lineWidth = 7.5;
      hCtx.lineCap = 'round';
      hCtx.shadowColor = '#ffffff';
      hCtx.shadowBlur = 10;
      hCtx.beginPath();
      hCtx.arc(230, 200, 182, -0.32 * Math.PI, -0.05 * Math.PI);
      hCtx.stroke();

      // Secondary specular glint
      hCtx.lineWidth = 4;
      hCtx.beginPath();
      hCtx.arc(230, 200, 182, -0.42 * Math.PI, -0.36 * Math.PI);
      hCtx.stroke();

      // Neon highway bounce rim on lower left
      hCtx.shadowColor = '#00f0ff';
      hCtx.shadowBlur = 8;
      hCtx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
      hCtx.lineWidth = 4.5;
      hCtx.beginPath();
      hCtx.arc(230, 200, 184, 0.62 * Math.PI, 0.88 * Math.PI);
      hCtx.stroke();
      hCtx.restore();

      // Seamless Volumetric Pink Hood Cradle
      hCtx.save();
      
      // Shadow behind collar
      hCtx.beginPath();
      hCtx.ellipse(230, 400, 125, 42, 0, 0, Math.PI * 2);
      hCtx.fillStyle = 'rgba(60, 15, 45, 0.45)';
      hCtx.fill();

      // Main hood body
      const hoodGrad = hCtx.createRadialGradient(230, 375, 20, 230, 410, 120);
      hoodGrad.addColorStop(0.0, '#ffaed6');
      hoodGrad.addColorStop(0.35, '#f07db6');
      hoodGrad.addColorStop(0.75, '#d6599b');
      hoodGrad.addColorStop(1.0, '#b23d7d');

      hCtx.beginPath();
      hCtx.ellipse(230, 396, 118, 38, 0, 0, Math.PI * 2);
      hCtx.fillStyle = hoodGrad;
      hCtx.fill();

      // Soft center vertical fold crease
      hCtx.strokeStyle = 'rgba(150, 40, 95, 0.55)';
      hCtx.lineWidth = 3.5;
      hCtx.lineCap = 'round';
      hCtx.beginPath();
      hCtx.moveTo(230, 370);
      hCtx.lineTo(230, 428);
      hCtx.stroke();

      // Subtle top rim highlight
      hCtx.strokeStyle = 'rgba(255, 220, 240, 0.75)';
      hCtx.lineWidth = 2.5;
      hCtx.beginPath();
      hCtx.ellipse(230, 375, 95, 14, 0, 0.1 * Math.PI, 0.9 * Math.PI);
      hCtx.stroke();
      hCtx.restore();

      // 2. Build full 8-frame runner sheet (3072 x 384)
      const fullSheetC = document.createElement('canvas');
      fullSheetC.width = 3072; fullSheetC.height = 384;
      const fsCtx = fullSheetC.getContext('2d');
      fsCtx.imageSmoothingEnabled = true;
      fsCtx.imageSmoothingQuality = 'high';
      fsCtx.drawImage(sheetImg, 0, 0);

      const frameHeadCenters = [
        { cx: 180.5, cy: 123.5 },
        { cx: 179.0, cy: 117.0 },
        { cx: 185.0, cy: 117.0 },
        { cx: 186.5, cy: 116.5 },
        { cx: 202.5, cy: 123.5 },
        { cx: 204.0, cy: 117.0 },
        { cx: 198.0, cy: 117.0 },
        { cx: 196.5, cy: 116.5 }
      ];

      const scale = 67.5 / 196;
      const destW = 460 * scale;
      const destH = 490 * scale;

      for (let f = 0; f < 8; f++) {
        const ox = f * 384;
        const hc = frameHeadCenters[f];

        const frameData = fsCtx.getImageData(ox, 0, 384, 384);
        for (let y = 35; y < 192; y++) {
          for (let x = 85; x < 280; x++) {
            const d = Math.sqrt((x - hc.cx)*(x - hc.cx) + (y - hc.cy)*(y - hc.cy));
            if (d <= 68.5 || (y >= (hc.cy + 45) && y <= (hc.cy + 63) && Math.abs(x - hc.cx) < 38)) {
              frameData.data[(y * 384 + x) * 4 + 3] = 0;
            }
          }
        }
        fsCtx.putImageData(frameData, ox, 0);

        const destX = ox + hc.cx - 230 * scale;
        const destY = hc.cy - 200 * scale;
        fsCtx.drawImage(headC, destX, destY, destW, destH);
      }

      // 3. Build slide pose (384 x 384)
      const slideC = document.createElement('canvas');
      slideC.width = 384; slideC.height = 384;
      const slCtx = slideC.getContext('2d');
      slCtx.imageSmoothingEnabled = true;
      slCtx.imageSmoothingQuality = 'high';
      slCtx.drawImage(slideImg, 0, 0);

      const slHc = { cx: 192.5, cy: 202.5 };
      const slData = slCtx.getImageData(0, 0, 384, 384);
      for (let y = 115; y < 272; y++) {
        for (let x = 105; x < 280; x++) {
          const d = Math.sqrt((x - slHc.cx)*(x - slHc.cx) + (y - slHc.cy)*(y - slHc.cy));
          if (d <= 68.5 || (y >= (slHc.cy + 45) && y <= (slHc.cy + 64) && Math.abs(x - slHc.cx) < 38)) {
            slData.data[(y * 384 + x) * 4 + 3] = 0;
          }
        }
      }
      slCtx.putImageData(slData, 0, 0);

      const slDestX = slHc.cx - 230 * scale;
      const slDestY = slHc.cy - 200 * scale;
      slCtx.drawImage(headC, slDestX, slDestY, destW, destH);

      // 4. Generate Comprehensive Verification Sheet
      const verC = document.createElement('canvas');
      verC.width = 1200; verC.height = 700;
      const vCtx = verC.getContext('2d');
      vCtx.fillStyle = '#060714';
      vCtx.fillRect(0, 0, 1200, 700);

      // Titles
      vCtx.font = 'bold 18px sans-serif';
      vCtx.fillStyle = '#00f0ff';
      vCtx.fillText('DILI REAR-VIEW REDESIGN: SCULPTURAL AFRO & CRYSTAL DOME', 40, 40);

      vCtx.font = '13px sans-serif';
      vCtx.fillStyle = '#8a9bb8';
      vCtx.fillText('All 8 Running Frames + Slide Pose at 1x Normal Gameplay Distance (~150px)', 40, 65);

      for (let f = 0; f < 8; f++) {
        const frameX = 40 + f * 140;
        vCtx.font = '11px monospace';
        vCtx.fillStyle = '#ffa3cf';
        vCtx.fillText('Frame ' + f, frameX + 45, 100);
        vCtx.drawImage(fullSheetC, f * 384, 0, 384, 384, frameX, 110, 140, 140);
      }

      vCtx.font = 'bold 15px sans-serif';
      vCtx.fillStyle = '#00f0ff';
      vCtx.fillText('Close-Up Inspection (240px)', 40, 300);
      vCtx.fillText('Slide Pose: Gameplay Distance (150px) & Close-Up', 460, 300);

      vCtx.drawImage(fullSheetC, 0, 0, 384, 384, 40, 320, 240, 240);
      vCtx.drawImage(fullSheetC, 4 * 384, 0, 384, 384, 300, 320, 240, 240);

      vCtx.drawImage(slideC, 0, 0, 384, 384, 570, 360, 150, 150);
      vCtx.drawImage(slideC, 0, 0, 384, 384, 760, 320, 240, 240);

      return {
        runnerSheet: fullSheetC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''),
        slideSheet: slideC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, ''),
        preview: verC.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
      };
    })()`;

  const res = await send('Runtime.evaluate', {
    expression: script,
    awaitPromise: true,
    returnByValue: true
  });

  const data = res.result.value;
  fs.writeFileSync('public/assets/dili_runner_sheet.png', Buffer.from(data.runnerSheet, 'base64'));
  console.log('Updated public/assets/dili_runner_sheet.png');

  fs.writeFileSync('public/assets/dili_slide.png', Buffer.from(data.slideSheet, 'base64'));
  console.log('Updated public/assets/dili_slide.png');

  fs.writeFileSync('scratch/final_redesign_verification.png', Buffer.from(data.preview, 'base64'));
  console.log('Saved scratch/final_redesign_verification.png');

  ws.close();
  p.kill();
}
applySculpturalRedesign();
