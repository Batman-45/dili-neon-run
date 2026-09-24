const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve('test-screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const viewports = [
  { name: 'desktop_1920x1080', width: 1920, height: 1080 },
  { name: 'desktop_1280x720',  width: 1280, height: 720 },
  { name: 'mobile_390x844',    width: 390,  height: 844 },
  { name: 'mobile_375x667',    width: 375,  height: 667 },
  { name: 'landscape_844x390', width: 844,  height: 390 },
  { name: 'landscape_667x375', width: 667,  height: 375 },
];

for (const vp of viewports) {
  const outFile = path.join(outDir, `${vp.name}.png`);
  const cmd = `"${chromePath}" --headless=new --disable-gpu --hide-scrollbars --window-size=${vp.width},${vp.height} --screenshot="${outFile}" http://localhost:5173/`;
  try {
    execSync(cmd, { stdio: 'pipe' });
    const stat = fs.statSync(outFile);
    console.log(`[PASS] ${vp.name}: ${vp.width}x${vp.height} (${stat.size} bytes)`);
  } catch (err) {
    console.error(`[FAIL] ${vp.name}:`, err.message);
  }
}
