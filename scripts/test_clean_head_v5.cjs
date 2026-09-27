const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function testCleanHead() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9325',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9325/json/list', r => {
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

  const f1B64 = fs.readFileSync('test-screenshots/frames/frame_1.png').toString('base64');

  const script = `
    (async () => {
      const load = (b64, mime='image/png') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });
      const f1 = await load('${f1B64}', 'image/png');

      // Test canvas at standard frame size (384x384)
      const c = document.createElement('canvas');
      c.width = 384; c.height = 384;
      const ctx = c.getContext('2d');

      // Draw original frame 1 (has body, backpack, cape, boots)
      ctx.drawImage(f1, 0, 0);

      // In frame 1:
      // Old head center is (224.5, 101.5), radius ~87.5
      // The pink hoodie collar is at Y ~ 176..185
      const hx = 224.5;
      const hy = 101.5;
      const hr = 87.5;

      // 1. Cleanly clear old head pixels above collar (Y <= 176)
      const imgData = ctx.getImageData(0, 0, 384, 384);
      const d = imgData.data;
      for (let y = 0; y < 185; y++) {
        for (let x = 0; x < 384; x++) {
          const idx = (y * 384 + x) * 4;
          const dx = x - hx;
          const dy = y - hy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < hr + 1) {
            if (y <= 175) {
              d[idx + 3] = 0;
            } else {
              // Soft gradient transition into existing 3D hoodie collar
              const alpha = (y - 175) / 10;
              d[idx + 3] = Math.round(d[idx + 3] * alpha);
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // -------------------------------------------------------------
      // DRAW REDESIGNED DILI REAR HEAD
      // -------------------------------------------------------------
      ctx.save();

      // Clip to spherical glass dome
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.clip();

      // 1. Interior Glass Atmosphere (subtle deep violet/ambient space)
      const voidGrad = ctx.createRadialGradient(hx - 15, hy - 25, 20, hx, hy, hr);
      voidGrad.addColorStop(0, 'rgba(40, 12, 60, 0.40)');
      voidGrad.addColorStop(0.7, 'rgba(25, 6, 42, 0.60)');
      voidGrad.addColorStop(1, 'rgba(12, 2, 22, 0.85)');
      ctx.fillStyle = voidGrad;
      ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);

      // 2. Dili Afro Hair — LOWERED & SNUG INTO HOODIE (ZERO NECK STEM!)
      // Hair center is shifted down so the bottom reaches Y = 178 (collar)
      // Hair vertical extent: from Y = 38 to Y = 178 (height 140px)
      // Hair horizontal extent: from X = hx - 68 to X = hx + 68
      const hairCY = hy + 6; // 107.5 (lowered towards collar)

      // 14 Stylized volumetric curl lobes around perimeter + 7 interior body lobes
      const curlLobes = [
        // Top perimeter lobes (softer violet-lilac highlight)
        { dx: 0,   dy: -54, r: 27, hi: '#c084fc', mid: '#9333ea', base: '#581c87' },
        { dx: -24, dy: -50, r: 25, hi: '#a855f7', mid: '#7e22ce', base: '#4c1d95' },
        { dx: 24,  dy: -50, r: 25, hi: '#c084fc', mid: '#9333ea', base: '#581c87' },
        // Upper-side lobes
        { dx: -45, dy: -36, r: 24, hi: '#9333ea', mid: '#6b21a8', base: '#3b0764' },
        { dx: 45,  dy: -36, r: 24, hi: '#a855f7', mid: '#7e22ce', base: '#4c1d95' },
        // Mid-side lobes
        { dx: -58, dy: -16, r: 24, hi: '#7e22ce', mid: '#581c87', base: '#2e1065' },
        { dx: 58,  dy: -16, r: 24, hi: '#9333ea', mid: '#6b21a8', base: '#3b0764' },
        { dx: -60, dy: 8,   r: 24, hi: '#6b21a8', mid: '#4c1d95', base: '#2e1065' },
        { dx: 60,  dy: 8,   r: 24, hi: '#7e22ce', mid: '#581c87', base: '#3b0764' },
        // Lower-side lobes
        { dx: -50, dy: 32,  r: 25, hi: '#581c87', mid: '#3b0764', base: '#240640' },
        { dx: 50,  dy: 32,  r: 25, hi: '#6b21a8', mid: '#4c1d95', base: '#2e1065' },
        // BOTTOM BASE LOBES — SIT SNUGLY IN COLLAR (Y extends down to 178!)
        // NO NECK GAP!
        { dx: -34, dy: 50,  r: 26, hi: '#4c1d95', mid: '#3b0764', base: '#1e0535' },
        { dx: 34,  dy: 50,  r: 26, hi: '#581c87', mid: '#3b0764', base: '#240640' },
        { dx: -15, dy: 56,  r: 26, hi: '#3b0764', mid: '#2e1065', base: '#18032b' },
        { dx: 15,  dy: 56,  r: 26, hi: '#3b0764', mid: '#2e1065', base: '#18032b' },
        { dx: 0,   dy: 60,  r: 26, hi: '#380a5e', mid: '#280645', base: '#140224' },

        // Interior volumetric fill
        { dx: 0,   dy: -24, r: 35, hi: '#a855f7', mid: '#7e22ce', base: '#4c1d95' },
        { dx: -22, dy: -6,  r: 32, hi: '#9333ea', mid: '#6b21a8', base: '#3b0764' },
        { dx: 22,  dy: -6,  r: 32, hi: '#a855f7', mid: '#7e22ce', base: '#4c1d95' },
        { dx: 0,   dy: 12,  r: 35, hi: '#7e22ce', mid: '#581c87', base: '#2e1065' },
        { dx: -18, dy: 30,  r: 30, hi: '#581c87', mid: '#3b0764', base: '#240640' },
        { dx: 18,  dy: 30,  r: 30, hi: '#6b21a8', mid: '#4c1d95', base: '#2e1065' },
      ];

      // Base solid dark purple afro shape
      ctx.beginPath();
      for (const lobe of curlLobes) {
        ctx.moveTo(hx + lobe.dx + lobe.r, hairCY + lobe.dy);
        ctx.arc(hx + lobe.dx, hairCY + lobe.dy, lobe.r, 0, Math.PI * 2);
      }
      ctx.fillStyle = '#26073d';
      ctx.fill();

      // Render each lobe with smooth 3D spherical shading (NO flat discs, NO hard strokes)
      for (const lobe of curlLobes) {
        const lx = hx + lobe.dx;
        const ly = hairCY + lobe.dy;
        const grad = ctx.createRadialGradient(
          lx - lobe.r * 0.30, ly - lobe.r * 0.35, lobe.r * 0.1,
          lx, ly, lobe.r
        );
        grad.addColorStop(0, lobe.hi);
        grad.addColorStop(0.35, lobe.mid);
        grad.addColorStop(0.75, lobe.base);
        grad.addColorStop(1, '#1a042a');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lx, ly, lobe.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Subtle volumetric curl swirl texture inside lobes (gives organic 3D curly depth)
      ctx.save();
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      for (const lobe of curlLobes) {
        const lx = hx + lobe.dx;
        const ly = hairCY + lobe.dy;
        ctx.strokeStyle = lobe.hi + '55'; // 33% opacity highlight
        ctx.beginPath();
        ctx.arc(lx - 2, ly - 3, lobe.r * 0.45, -Math.PI * 0.8, Math.PI * 0.1);
        ctx.stroke();

        ctx.strokeStyle = '#12022066'; // shadow crescent
        ctx.beginPath();
        ctx.arc(lx + 2, ly + 3, lobe.r * 0.55, Math.PI * 0.2, Math.PI * 1.1);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Delicate Glass Specular Highlights (Upper hemisphere only!)
      // Top-left curved gloss arc
      ctx.beginPath();
      ctx.arc(hx, hy, hr - 5, -Math.PI * 0.82, -Math.PI * 0.38, false);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Central specular shine dot
      ctx.beginPath();
      ctx.arc(hx - hr * 0.52, hy - hr * 0.38, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();

      // Cyan outer rim glow along upper perimeter and sides ONLY
      // Strictly stops at angles -0.92pi to -0.08pi, so NO LINE cuts across the neck!
      ctx.beginPath();
      ctx.arc(hx, hy, hr - 2, -Math.PI * 0.92, -Math.PI * 0.08, false);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.restore(); // end clip

      return c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/test_clean_head_v5.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved test_clean_head_v5.png');
  ws.close();
  p.kill();
}

testCleanHead().catch(console.error);
