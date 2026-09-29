const fs = require('fs');
const path = require('path');

const cssPath = path.resolve('src/style.css');
let css = fs.readFileSync(cssPath, 'utf8');

const regexMobile = /  \.pause-card\s*\{[\s\S]*?\.gameover-buttons\s*\{[\s\S]*?\}\s*\}/;

const newMobile = `  .modal-panel {
    max-width: 100%;
  }

  .modal-panel-inner {
    padding: 20px 16px 16px;
    gap: 12px;
  }

  .modal-title {
    font-size: 22px;
  }

  .score-hero-digits,
  .result-hero-value {
    font-size: 32px;
  }

  .modal-actions-row,
  .gameover-buttons {
    flex-direction: row;
    gap: 8px;
  }
}`;

if (regexMobile.test(css)) {
  css = css.replace(regexMobile, newMobile);
  console.log('Successfully replaced mobile modal rules with regex.');
} else {
  console.log('Regex mobile did not match.');
}

fs.writeFileSync(cssPath, css, 'utf8');
