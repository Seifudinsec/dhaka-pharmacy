const fs = require('fs');

const cssPath = 'frontend/src/index.css';
let css = fs.readFileSync(cssPath, 'utf8');

// Replace html and body tags for overflow issues
css = css.replace(
  /html\s*{\s*font-size:\s*15px;\s*}/g,
  'html { font-size: 15px; box-sizing: border-box; max-width: 100%; overflow-x: hidden; }\n*, *::before, *::after { box-sizing: inherit; }'
);

css = css.replace(
  /body\s*{([^}]*)-webkit-font-smoothing:\s*antialiased;\s*}/g,
  'body {$1-webkit-font-smoothing: antialiased;\n  max-width: 100%;\n  overflow-x: hidden;\n}'
);

// Add table wrap behavior if it exists, otherwise replace
if (css.includes('.table-wrap { overflow-x: auto; }')) {
  css = css.replace(
    /\.table-wrap\s*{\s*overflow-x:\s*auto;\s*}/g,
    '.table-wrap { width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }'
  );
} else if (!css.includes('-webkit-overflow-scrolling: touch;')) {
  css += '\n.table-wrap { width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }\n';
}

// Ensure .btn touch targets at least 44px on mobile via min-height inside a media query
css += '\n@media (max-width: 768px) { .btn { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; } }\n';

fs.writeFileSync(cssPath, css);
console.log('CSS preprocessing done!');
