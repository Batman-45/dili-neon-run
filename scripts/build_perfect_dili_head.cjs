const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

async function testHeadComposite() {
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9320',
    '--headless=new',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await new Promise(res => http.get('http://localhost:9320/json/list', r => {
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

  const headBaseB64 = fs.readFileSync('C:\\Users\\SHREE\\.gemini\\antigravity-ide\\brain\\d86d48cc-c83b-4c0a-a996-4889df60c7b4\\dili_rear_head_test_1790327217548.jpg').toString('base64');
  const f1B64 = fs.readFileSync('test-screenshots/frames/frame_1.png').toString('base64');

  const script = `
    (async () => {
      const load = (b64, mime='image/png') => new Promise(res => {
        const img = new Image();
        img.src = \`data:\${mime};base64,\` + b64;
        img.onload = () => res(img);
      });
      const f1 = await load('${f1B64}', 'image/png');
      const baseHead = await load('${headBaseB64}', 'image/jpeg');

      // 1024 x 1024 master canvas for the redesigned rear head
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 1024;
      const ctx = c.getContext('2d');

      const bcX = 512;
      const bcY = 460;
      const bRad = 390;

      // -------------------------------------------------------------
      // 1. GLASS BUBBLE INTERIOR ATMOSPHERE
      // -------------------------------------------------------------
      ctx.save();
      ctx.beginPath();
      ctx.arc(bcX, bcY, bRad, 0, Math.PI * 2);
      ctx.clip();

      const bgGrad = ctx.createRadialGradient(bcX, bcY, 100, bcX, bcY, bRad);
      bgGrad.addColorStop(0, 'rgba(30, 8, 48, 0.45)');
      bgGrad.addColorStop(0.7, 'rgba(18, 4, 32, 0.65)');
      bgGrad.addColorStop(1, 'rgba(8, 2, 16, 0.9)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1024, 1024);

      // -------------------------------------------------------------
      // 2. DILI AFRO HAIR — VIBRANT ROYAL PURPLE & STYLIZED READABLE CURLS
      // Positioned LOW and SNUG into the collar (Y extends to 810)
      // NO NECK STEM!
      // -------------------------------------------------------------
      // Defined curl lobes matching Dili mascot reference:
      // Outer ring of 15 rounded puffy lobes, plus interior volumetric volumes
      const hairCenterY = 510; // Lowered by 50px so hair reaches right down to the collar!
      const lobes = [
        // Top row
        { x: 0, y: -240, r: 125, c: '#7b2cb8', hi: '#9d4edd' },
        { x: -95, y: -220, r: 120, c: '#6a1b9a', hi: '#8e24aa' },
        { x: 95, y: -220, r: 120, c: '#7b2cb8', hi: '#9d4edd' },
        // Upper sides
        { x: -180, y: -160, r: 115, c: '#5e17eb', hi: '#7b2cb8' },
        { x: 180, y: -160, r: 115, c: '#6a1b9a', hi: '#8e24aa' },
        // Mid sides
        { x: -240, y: -70, r: 115, c: '#4a148c', hi: '#6a1b9a' },
        { x: 240, y: -70, r: 115, c: '#5e17eb', hi: '#7b2cb8' },
        { x: -245, y: 35, r: 110, c: '#3b1456', hi: '#5e17eb' },
        { x: 245, y: 35, r: 110, c: '#4a148c', hi: '#6a1b9a' },
        // Lower sides
        { x: -210, y: 135, r: 110, c: '#381454', hi: '#5e17eb' },
        { x: 210, y: 135, r: 110, c: '#3b1456', hi: '#5e17eb' },
        // Bottom base — extends directly into the collar area (Y: 510 + 220 = 730..820)
        { x: -140, y: 220, r: 110, c: '#2b0e40', hi: '#4a148c' },
        { x: 140, y: 220, r: 110, c: '#2b0e40', hi: '#4a148c' },
        { x: -65, y: 260, r: 110, c: '#250c38', hi: '#3b1456' },
        { x: 65, y: 260, r: 110, c: '#250c38', hi: '#3b1456' },
        { x: 0, y: 275, r: 115, c: '#250c38', hi: '#3b1456' },

        // Interior volumetric fill
        { x: 0, y: -100, r: 155, c: '#6a1b9a', hi: '#8e24aa' },
        { x: -85, y: -40, r: 145, c: '#5e17eb', hi: '#7b2cb8' },
        { x: 85, y: -40, r: 145, c: '#6a1b9a', hi: '#8e24aa' },
        { x: 0, y: 40, r: 155, c: '#4a148c', hi: '#6a1b9a' },
        { x: -75, y: 120, r: 140, c: '#3b1456', hi: '#5e17eb' },
        { x: 75, y: 120, r: 140, c: '#3b1456', hi: '#5e17eb' },
        { x: 0, y: 180, r: 145, c: '#2e1065', hi: '#4a148c' },
      ];

      // Base solid silhouette of afro
      ctx.beginPath();
      for (const lobe of lobes) {
        ctx.moveTo(bcX + lobe.x + lobe.r, hairCenterY + lobe.y);
        ctx.arc(bcX + lobe.x, hairCenterY + lobe.y, lobe.r, 0, Math.PI * 2);
      }
      ctx.fillStyle = '#26093d';
      ctx.fill();

      // Render each stylized 3D curl lobe with rich lighting
      for (const lobe of lobes) {
        const lx = bcX + lobe.x;
        const ly = hairCenterY + lobe.y;
        ctx.save();
        ctx.beginPath();
        ctx.arc(lx, ly, lobe.r, 0, Math.PI * 2);

        // 3D sphere gradient: top-left highlight, rich purple core, deep violet ambient shadow
        const lGrad = ctx.createRadialGradient(
          lx - lobe.r * 0.28, ly - lobe.r * 0.35, lobe.r * 0.1,
          lx, ly, lobe.r
        );
        lGrad.addColorStop(0, lobe.hi);
        lGrad.addColorStop(0.35, lobe.c);
        lGrad.addColorStop(0.8, '#2e1065');
        lGrad.addColorStop(1, '#1b072e');

        ctx.fillStyle = lGrad;
        ctx.fill();

        // Subtle soft rim on curl
        ctx.strokeStyle = 'rgba(157, 78, 221, 0.25)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }

      // Add delicate micro-curl texture overlay across the afro for authentic Dili plush look
      ctx.save();
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 90; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.random() * 220;
        const cx = bcX + Math.cos(ang) * dist * 0.95;
        const cy = hairCenterY + Math.sin(ang) * dist * 0.95;
        const cr = 14 + Math.random() * 16;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.strokeStyle = Math.random() > 0.4 ? 'rgba(192, 132, 252, 0.4)' : 'rgba(40, 10, 60, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();

      // -------------------------------------------------------------
      // 3. CRYSTAL-CLEAR GLASS BUBBLE SPECULAR HIGHLIGHTS & REFLECTIONS
      // -------------------------------------------------------------
      // Soft internal glass specular depth
      const glassRef = ctx.createRadialGradient(bcX - 80, bcY - 100, 40, bcX, bcY, bRad);
      glassRef.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      glassRef.addColorStop(0.3, 'rgba(120, 240, 255, 0.08)');
      glassRef.addColorStop(0.8, 'rgba(168, 85, 247, 0.05)');
      glassRef.addColorStop(1, 'rgba(0, 240, 255, 0.45)');
      ctx.fillStyle = glassRef;
      ctx.beginPath();
      ctx.arc(bcX, bcY, bRad, 0, Math.PI * 2);
      ctx.fill();

      // Top-left curved gloss reflection arc (glossy glass marble highlight)
      ctx.beginPath();
      ctx.arc(bcX, bcY, bRad - 20, -Math.PI * 0.82, -Math.PI * 0.36, false);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Bright specular shine center
      ctx.beginPath();
      ctx.arc(bcX, bcY, bRad - 20, -Math.PI * 0.72, -Math.PI * 0.46, false);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Outer cyan glass rim glow (only upper & side perimeter, so it doesn't cross the neck!)
      ctx.beginPath();
      ctx.arc(bcX, bcY, bRad - 5, -Math.PI * 0.95, -Math.PI * 0.05, false);
      ctx.strokeStyle = 'rgba(120, 240, 255, 0.55)';
      ctx.lineWidth = 7;
      ctx.stroke();

      ctx.restore(); // end bubble clip

      // -------------------------------------------------------------
      // 4. PINK HOODIE COLLAR HUG (SEAMLESS INTEGRATION)
      // The soft pink hoodie collar wraps AROUND and IN FRONT OF
      // the base of the glass bubble and hair.
      // -------------------------------------------------------------
      // Draw the hoodie collar fold (Y: 790 to 920, X: 350 to 674)
      ctx.save();
      // Collar contour: soft curved U-shape hugging the bubble
      ctx.beginPath();
      ctx.moveTo(330, 810);
      ctx.bezierCurveTo(410, 825, 470, 835, 512, 835);
      ctx.bezierCurveTo(554, 835, 614, 825, 694, 810);
      ctx.bezierCurveTo(720, 840, 715, 890, 680, 920);
      ctx.bezierCurveTo(600, 940, 424, 940, 344, 920);
      ctx.bezierCurveTo(310, 890, 305, 840, 330, 810);
      ctx.closePath();

      // Pink hoodie fabric gradient
      const cGrad = ctx.createLinearGradient(512, 810, 512, 930);
      cGrad.addColorStop(0, '#f472b6'); // soft pink top rim
      cGrad.addColorStop(0.35, '#ec4899'); // rich pink hoodie body
      cGrad.addColorStop(0.85, '#db2777'); // ambient shadow in fold
      cGrad.addColorStop(1, '#be185d');
      ctx.fillStyle = cGrad;
      ctx.fill();

      // Soft collar seam crease line
      ctx.beginPath();
      ctx.moveTo(380, 840);
      ctx.bezierCurveTo(440, 852, 480, 856, 512, 856);
      ctx.bezierCurveTo(544, 856, 584, 852, 644, 840);
      ctx.strokeStyle = 'rgba(157, 23, 77, 0.45)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Subtle fabric top rim highlight
      ctx.beginPath();
      ctx.moveTo(350, 815);
      ctx.bezierCurveTo(430, 829, 470, 835, 512, 835);
      ctx.bezierCurveTo(554, 835, 594, 829, 674, 815);
      ctx.strokeStyle = 'rgba(255, 230, 245, 0.6)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();

      // Return high-res asset
      return c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
    })()
  `;

  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  fs.writeFileSync('test-screenshots/dili_vibrant_head_asset.png', Buffer.from(res.result.value, 'base64'));
  console.log('Saved dili_vibrant_head_asset.png');
  ws.close();
  p.kill();
}

testHeadComposite().catch(console.error);
