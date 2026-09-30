const https = require('https');

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function verify() {
  console.log('Fetching https://dili-neon-run.vercel.app with no-cache...');
  const res = await fetchUrl('https://dili-neon-run.vercel.app/?t=' + Date.now(), { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' });
  console.log('HTTP Status:', res.status);
  console.log('HTML Length:', res.body.length);
  console.log('Age header:', res.headers['age']);
  console.log('x-vercel-id:', res.headers['x-vercel-id']);
  
  const hasBanner = res.body.includes('powerup-pickup-banner');
  const hasSpeedLines = res.body.includes('speed-lines-overlay');
  const hasStack = res.body.includes('hud-powerup-container');
  const hasBadge = res.body.includes('hud-multiplier-badge');

  console.log('HTML checks:');
  console.log('  powerup-pickup-banner:', hasBanner);
  console.log('  speed-lines-overlay:', hasSpeedLines);
  console.log('  hud-powerup-container:', hasStack);
  console.log('  hud-multiplier-badge:', hasBadge);

  const jsMatch = res.body.match(/src="\/assets\/(index-[^"]+\.js)"/);
  if (!jsMatch) {
    console.error('Could not find index-*.js in live HTML!');
    process.exit(1);
  }
  const jsUrl = 'https://dili-neon-run.vercel.app/assets/' + jsMatch[1];
  console.log('\nFetching live bundle:', jsUrl);
  const jsRes = await fetchUrl(jsUrl);
  console.log('Live JS Status:', jsRes.status);
  console.log('Live JS Length:', jsRes.body.length);

  const checks = [
    ['createShieldModel', jsRes.body.includes('createShieldModel')],
    ['createMagnetModel', jsRes.body.includes('createMagnetModel')],
    ['createBoostModel', jsRes.body.includes('createBoostModel')],
    ['createMultiplierModel', jsRes.body.includes('createMultiplierModel')],
    ['showPickupAnnouncement', jsRes.body.includes('showPickupAnnouncement')],
    ['SHIELD!', jsRes.body.includes('SHIELD!')],
    ['MAGNET!', jsRes.body.includes('MAGNET!')],
    ['HYPER BOOST!', jsRes.body.includes('HYPER BOOST!')],
    ['2× SCORE!', jsRes.body.includes('2× SCORE!')],
    ['createMagnetVfxMesh', jsRes.body.includes('createMagnetVfxMesh')],
    ['createHyperBoostVfxMesh', jsRes.body.includes('createHyperBoostVfxMesh')],
    ['setMagnetVisible', jsRes.body.includes('setMagnetVisible')],
    ['setHyperBoostVisible', jsRes.body.includes('setHyperBoostVisible')],
    ['hud-powerup-row', jsRes.body.includes('hud-powerup-row')]
  ];

  let passed = true;
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✓' : '✗'} ${name}`);
    if (!ok) passed = false;
  }

  if (passed && hasBanner && hasSpeedLines && hasStack && hasBadge) {
    console.log('\n>>> LIVE OLD PRODUCTION URL IS SERVING THE NEW BUILD 100% CORRECTLY! <<<');
  } else {
    console.error('\n>>> LIVE VERIFICATION FAILED <<<');
    process.exit(1);
  }
}

verify().catch(console.error);
