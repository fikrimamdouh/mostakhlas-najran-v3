/**
 * build.js — يجمع ملفات النسخة الأوفلاين
 * ينسخ HTML/JS من public/original ويعدّل مراجع المكتبات
 */
const fs   = require('fs');
const path = require('path');

const SRC_DIR  = path.resolve(__dirname, '../artifacts/mustaklassat/public/original');
const DEST_DIR = path.resolve(__dirname, 'app/original');
const ASSETS_SRC = path.resolve(__dirname, '../artifacts/mustaklassat/public');

// ── Ensure destination exists ─────────────────────────────────────────────────
fs.mkdirSync(DEST_DIR, { recursive: true });
fs.mkdirSync(path.join(__dirname, 'app/assets'), { recursive: true });

// ── Copy all files from public/original ──────────────────────────────────────
let copiedCount = 0;
const files = fs.readdirSync(SRC_DIR);
files.forEach(file => {
  const srcFile  = path.join(SRC_DIR, file);
  const destFile = path.join(DEST_DIR, file);
  const stat = fs.statSync(srcFile);
  if (!stat.isFile()) return;
  fs.copyFileSync(srcFile, destFile);
  copiedCount++;
});
console.log(`✅ Copied ${copiedCount} files from public/original`);

// ── Patch HTML files ──────────────────────────────────────────────────────────
// Replace online scripts with offline equivalents
const htmlFiles = files.filter(f => f.endsWith('.html'));
let patchedCount = 0;
htmlFiles.forEach(file => {
  const destFile = path.join(DEST_DIR, file);
  let content = fs.readFileSync(destFile, 'utf8');

  // Remove user-storage-proxy (offline version has its own)
  content = content.replace(/<script src="\/original\/user-storage-proxy\.js"><\/script>\n?/g, '');

  // Replace auth-check with offline version
  content = content.replace(
    /src="\/original\/auth-check\.js"/g,
    'src="/original/offline-auth-check.js"'
  );
  // Replace cloud-sync with offline version
  content = content.replace(
    /src="\/original\/cloud-sync\.js"/g,
    'src="/original/offline-cloud-sync.js"'
  );

  // Inject offline-user-proxy as first script after <head>
  if (!content.includes('offline-user-proxy.js')) {
    content = content.replace(
      '<head>',
      '<head>\n<script src="/original/offline-user-proxy.js"></script>'
    );
  }

  fs.writeFileSync(destFile, content, 'utf8');
  patchedCount++;
});
console.log(`✅ Patched ${patchedCount} HTML files`);

// ── Copy logo / assets ────────────────────────────────────────────────────────
const logoSrc = path.join(ASSETS_SRC, 'logo.png');
if (fs.existsSync(logoSrc)) {
  fs.copyFileSync(logoSrc, path.join(__dirname, 'app/assets/icon.png'));
  console.log('✅ Copied logo.png → app/assets/icon.png');
} else {
  // Create a placeholder icon
  console.log('⚠️  logo.png not found, skipping icon copy');
}

// ── Copy MP4 videos if present ────────────────────────────────────────────────
const videosToCheck = ['pattern-1.mp4'];
videosToCheck.forEach(v => {
  const src = path.join(ASSETS_SRC, v);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(__dirname, 'app/assets', v));
    console.log('✅ Copied ' + v);
  }
});

// ── Report ────────────────────────────────────────────────────────────────────
console.log('\n🚀 Build complete! Run: electron . to test');
console.log('   dist:win   → Windows 32+64 installer');
