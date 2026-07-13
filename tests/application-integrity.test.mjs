import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoDir = fileURLToPath(new URL('../', import.meta.url));
const webDir = path.join(repoDir, 'artifacts/mustaklassat');
const publicDir = path.join(webDir, 'public');
const originalDir = path.join(publicDir, 'original');

function walk(dir, predicate, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['.git', 'dist', 'node_modules'].includes(entry.name)) continue;
      walk(fullPath, predicate, result);
    }
    else if (predicate(fullPath)) result.push(fullPath);
  }
  return result;
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoDir, relativePath), 'utf8');
}

test('every shipped classic JavaScript file has valid browser syntax', () => {
  const failures = [];
  const scripts = walk(publicDir, (file) => file.endsWith('.js'));
  assert.ok(scripts.length >= 150, 'expected the complete legacy script set');

  for (const script of scripts) {
    try {
      new vm.Script(fs.readFileSync(script, 'utf8'), { filename: script });
    } catch (error) {
      failures.push(`${path.relative(publicDir, script)}: ${error.message}`);
    }
  }

  assert.deepEqual(failures, []);
});

test('all original HTML pages reference files that exist in the deployment', () => {
  const htmlFiles = walk(originalDir, (file) => file.endsWith('.html'));
  assert.equal(htmlFiles.length, 38);
  const missing = [];

  for (const htmlFile of htmlFiles) {
    const source = fs.readFileSync(htmlFile, 'utf8');
    const references = [
      ...source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi),
      ...source.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/gi),
    ].map((match) => match[1]);

    for (const reference of references) {
      if (/^(?:https?:)?\/\//i.test(reference) || /^(?:data|blob):/i.test(reference)) continue;
      const cleanReference = reference.split(/[?#]/, 1)[0];
      if (!cleanReference) continue;
      const target = cleanReference.startsWith('/')
        ? path.join(publicDir, cleanReference.slice(1))
        : path.resolve(path.dirname(htmlFile), cleanReference);
      if (!fs.existsSync(target)) {
        missing.push(`${path.relative(originalDir, htmlFile)} -> ${reference}`);
      }
    }
  }

  assert.deepEqual(missing, []);
});

test('source tree contains no unresolved merge markers', () => {
  const sourceFiles = walk(repoDir, (file) => {
    if (file.includes(`${path.sep}node_modules${path.sep}`) || file.includes(`${path.sep}.git${path.sep}`)) return false;
    return /\.(?:html|js|mjs|cjs|ts|tsx|jsx|json|ya?ml)$/.test(file);
  });
  const failures = [];

  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    if (/^(?:<{7}|={7}|>{7})/m.test(source)) failures.push(`${path.relative(repoDir, file)}: merge marker`);
  }

  assert.deepEqual(failures, []);
});

test('support messages require an approved authorized user and are rate limited', () => {
  const supportRoute = read('artifacts/api-server/src/routes/support.ts');
  assert.match(supportRoute, /router\.post\("\/", requireAuth, requireSupportAccess, supportRateLimit/);
  assert.match(supportRoute, /user\.status !== "approved"/);
  assert.match(supportRoute, /modules\.includes\("support"\)/);
  assert.match(supportRoute, /SUPPORT_RATE_MAX = 5/);
  assert.match(supportRoute, /subject\.length > 200/);
  assert.match(supportRoute, /message\.length > 5000/);
  assert.match(supportRoute, /name: String\(user\.name/);
  assert.match(supportRoute, /email: String\(user\.email/);

  const supportPage = read('artifacts/mustaklassat/src/pages/support.tsx');
  assert.doesNotMatch(supportPage, /body:\s*JSON\.stringify\(\{[\s\S]*?\b(?:name|email):/);
  assert.ok(
    supportPage.indexOf('const [form, setForm] = useState') < supportPage.indexOf('if (dbUser && !hasAccess)'),
    'React hooks must run before the conditional access response',
  );
});

test('detailed health data and cross-origin access remain restricted', () => {
  const healthRoute = read('artifacts/api-server/src/routes/health.ts');
  const appSource = read('artifacts/api-server/src/app.ts');
  assert.match(healthRoute, /router\.get\("\/healthz\/full", requireAuth, requireAdmin/);
  assert.match(healthRoute, /user\.role !== "admin"/);
  assert.match(appSource, /allowed\.includes\(origin\)/);
  assert.doesNotMatch(appSource, /replit\.app|repl\.co/);
});

test('production deployment allows the same-origin extract viewer while blocking external framing', () => {
  const config = JSON.parse(read('vercel.json'));
  const originalViewer = read('artifacts/mustaklassat/src/pages/OriginalViewer.tsx');
  assert.equal(config.installCommand, 'pnpm install --frozen-lockfile');
  const globalHeaders = Object.fromEntries(
    config.headers.find(({ source }) => source === '/(.*)').headers.map(({ key, value }) => [key, value]),
  );
  assert.match(originalViewer, /<iframe[\s\S]*?src=\{`\/original\/\$\{page\}`\}/);
  assert.equal(globalHeaders['Content-Security-Policy'], "frame-ancestors 'self'");
  assert.equal(globalHeaders['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(globalHeaders['X-Content-Type-Options'], 'nosniff');
  assert.equal(globalHeaders['Referrer-Policy'], 'strict-origin-when-cross-origin');
});
