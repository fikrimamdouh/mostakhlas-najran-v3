#!/usr/bin/env node
/*
 * scripts/cache-bust-cloud-sync.js
 * Scope: artifacts/mustaklassat/public/original/**/*.html only.
 * Replaces only: src="/original/cloud-sync.js"
 * With:         src="/original/cloud-sync.js?v=20260614c"
 * Does not touch offline-app or any JS/CSS/API files.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIR = path.join(ROOT, 'artifacts', 'mustaklassat', 'public', 'original');
const FROM = 'src="/original/cloud-sync.js"';
const TO = 'src="/original/cloud-sync.js?v=20260614c"';

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (stat.isFile() && full.endsWith('.html')) out.push(full);
  }
  return out;
}

function main() {
  if (!fs.existsSync(TARGET_DIR)) {
    console.error('Target directory not found:', TARGET_DIR);
    process.exit(1);
  }

  const files = walk(TARGET_DIR);
  const changes = [];

  for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const count = (before.match(new RegExp(FROM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (!count) continue;
    changes.push({ file, count });
  }

  console.log('Files to update:', changes.length);
  for (const item of changes) {
    console.log(`${path.relative(ROOT, item.file)}: ${item.count}`);
  }

  if (process.argv.includes('--check')) return;

  for (const item of changes) {
    const before = fs.readFileSync(item.file, 'utf8');
    const after = before.split(FROM).join(TO);
    fs.writeFileSync(item.file, after, 'utf8');
  }

  console.log('Done. Run git diff and verify only ?v=20260614c was added.');
}

main();
