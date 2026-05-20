import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve('dist');
const PUBLIC_DIR = path.resolve('public');

function bundle() {
  console.log('📦 Starting Single-Page Web Bundle Process...');

  // 1. Read dist/index.html
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('❌ dist/index.html not found! Please run npm run build first.');
    process.exit(1);
  }
  let html = fs.readFileSync(indexPath, 'utf-8');

  // 2. Parse and inline CSS stylesheets
  const cssRegex = /<link rel="stylesheet" crossorigin href="\/sphere-trainer\/assets\/([^"]+)">/g;
  html = html.replace(cssRegex, (match, cssFile) => {
    const cssPath = path.join(DIST_DIR, 'assets', cssFile);
    if (fs.existsSync(cssPath)) {
      console.log(`⚡ Inlining CSS: ${cssFile}`);
      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      return `<style>\n${cssContent}\n</style>`;
    } else {
      console.warn(`⚠️ CSS asset not found: ${cssPath}`);
      return match;
    }
  });

  // 3. Parse and inline JS scripts
  const jsRegex = /<script type="module" crossorigin src="\/sphere-trainer\/assets\/([^"]+)"><\/script>/g;
  html = html.replace(jsRegex, (match, jsFile) => {
    const jsPath = path.join(DIST_DIR, 'assets', jsFile);
    if (fs.existsSync(jsPath)) {
      console.log(`⚡ Inlining JS: ${jsFile}`);
      const jsContent = fs.readFileSync(jsPath, 'utf-8');
      return `<script type="module">\n${jsContent}\n</script>`;
    } else {
      console.error(`❌ Critical JS asset not found: ${jsPath}`);
      process.exit(1);
    }
  });

  // 4. Convert and inline favicon to base64 Data URI
  const faviconPath = path.join(PUBLIC_DIR, 'favicon.svg');
  if (fs.existsSync(faviconPath)) {
    console.log('⚡ Inlining favicon.svg as Base64...');
    const base64Favicon = fs.readFileSync(faviconPath).toString('base64');
    html = html.replace(
      /<link rel="icon" type="image\/svg\+xml" href="\/sphere-trainer\/favicon.svg" \/>/,
      `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${base64Favicon}" />`
    );
  }

  // 5. Clean up relative path service worker & manifest references (since they run in a static context)
  html = html.replace(/<link rel="manifest" href="\/sphere-trainer\/manifest.webmanifest">/, '');
  html = html.replace(/<script id="vite-plugin-pwa:register-sw" src="\/sphere-trainer\/registerSW.js"><\/script>/, '');

  // 6. Output single file HTML
  const singleFileDistPath = path.join(DIST_DIR, 'sphere-trainer-single-web.html');
  const singleFileRootPath = path.resolve('sphere-trainer-single-web.html');

  fs.writeFileSync(singleFileDistPath, html, 'utf-8');
  fs.writeFileSync(singleFileRootPath, html, 'utf-8');

  console.log('✨ Success! Standalone single-page web game created at:');
  console.log(`   👉 ${singleFileRootPath}`);
  console.log('   (You can open this HTML file directly in any browser without a local server!)');
}

bundle();
