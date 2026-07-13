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

test('classic scripts do not redeclare top-level functions that silently override earlier behavior', () => {
  const duplicates = [];
  const scripts = walk(publicDir, (file) => file.endsWith('.js'));

  for (const script of scripts) {
    const source = fs.readFileSync(script, 'utf8');
    const names = [...source.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map((match) => match[1]);
    const repeated = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
    if (repeated.length) duplicates.push(`${path.relative(publicDir, script)}: ${repeated.join(', ')}`);
  }

  assert.deepEqual(duplicates, []);
});

test('persistent browser storage can only be cleared by the reviewed explicit recovery and reset flows', () => {
  const sourceRoots = [path.join(webDir, 'src'), publicDir];
  const files = sourceRoots.flatMap((root) => walk(root, (file) => /\.(?:html|js|ts|tsx)$/.test(file)));
  const clearLocations = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (/(?:localStorage|sessionStorage)\.clear\s*\(/.test(source)) {
      clearLocations.push(path.relative(repoDir, file));
    }
  }

  assert.deepEqual(clearLocations.sort(), [
    'artifacts/mustaklassat/public/original/backup.js',
    'artifacts/mustaklassat/public/original/cloud-sync.js',
    'artifacts/mustaklassat/public/original/production-client-monitor.js',
    'artifacts/mustaklassat/public/original/settings-user-backup-guard.js',
    'artifacts/mustaklassat/public/reviewer-hospital-menu-guard.js',
    'artifacts/mustaklassat/src/pages/admin/users.tsx',
  ]);

  assert.match(read('artifacts/mustaklassat/public/original/backup.js'), /if \(!await window\.NajranDialogs\.confirm\(msg\)\) return/);
  assert.match(read('artifacts/mustaklassat/public/original/settings-user-backup-guard.js'), /await window\.NajranDialogs\.confirm/);
  assert.match(read('artifacts/mustaklassat/src/pages/admin/users.tsx'), /confirmation: "تأكيد التهيئة الكاملة"/);
});

test('hospital switching never changes context before a verified complete save', () => {
  const sidebar = read('artifacts/mustaklassat/src/components/layout/Sidebar.tsx');
  const switchStart = sidebar.indexOf('const handleSwitchReviewHospital');
  const switchEnd = sidebar.indexOf('const isAdmin =', switchStart);
  const reviewSwitch = sidebar.slice(switchStart, switchEnd);

  assert.ok(switchStart > -1 && switchEnd > switchStart, 'review switch handler must exist');
  assert.match(sidebar, /confirmCurrentWorkSavedBeforeHospitalSwitch/);
  assert.match(sidebar, /najranSyncNow/);
  assert.match(sidebar, /REVISION_ACTIVE/);
  assert.match(sidebar, /syncResult\.ok !== true/);
  assert.match(sidebar, /syncResult\.conflict === true/);
  assert.match(sidebar, /syncResult\.reason === "SYNC_ALREADY_RUNNING"/);
  assert.ok(
    reviewSwitch.indexOf('await confirmCurrentWorkSavedBeforeHospitalSwitch()') < reviewSwitch.indexOf('sess.hospital = h'),
    'review context must only change after save confirmation'
  );
  assert.doesNotMatch(reviewSwitch, /localStorage\.removeItem/);

  const cloudSync = read('artifacts/mustaklassat/public/original/cloud-sync.js');
  assert.match(cloudSync, /if \(includeOperational\) \{[\s\S]*localStorage\.length[\s\S]*shouldSyncKey\(normalizedKey\)/);

  const appBoot = read('artifacts/mustaklassat/index.html');
  assert.doesNotMatch(appBoot, /changedUser \|\| changedHospital/);
  assert.match(appBoot, /hospital changed — preserved local work until verified sync\/context handoff/);

  const legacyReviewSwitch = read('artifacts/mustaklassat/public/reviewer-hospital-menu-guard.js');
  assert.doesNotMatch(legacyReviewSwitch, /localStorage\.removeItem\('najran_active_hospital_context'\)/);
  assert.doesNotMatch(legacyReviewSwitch, /indexOf\('attendance'\)/);
});

test('every mutating API route requires verified authentication', () => {
  const failures = [];
  const routeFiles = walk(path.join(repoDir, 'artifacts/api-server/src/routes'), (file) => file.endsWith('.ts'));

  for (const routeFile of routeFiles) {
    const source = fs.readFileSync(routeFile, 'utf8');
    const declarations = source.matchAll(/router\.(post|put|patch|delete)\s*\(([\s\S]*?)(?:async\s*\(|async\s+function)/g);
    for (const declaration of declarations) {
      if (!declaration[2].includes('requireAuth')) {
        failures.push(`${path.relative(repoDir, routeFile)}: ${declaration[1].toUpperCase()}`);
      }
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
  assert.doesNotMatch(config.buildCommand, /(?:push-force|drizzle-kit\s+push)/);
  const globalHeaders = Object.fromEntries(
    config.headers.find(({ source }) => source === '/(.*)').headers.map(({ key, value }) => [key, value]),
  );
  assert.match(originalViewer, /<iframe[\s\S]*?src=\{frameSrc\}/);
  assert.equal(globalHeaders['Content-Security-Policy'], "frame-ancestors 'self'");
  assert.equal(globalHeaders['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(globalHeaders['X-Content-Type-Options'], 'nosniff');
  assert.equal(globalHeaders['Referrer-Policy'], 'strict-origin-when-cross-origin');
});

test('settings pages use a cache-busted same-origin frame with live token renewal', () => {
  const sidebar = read('artifacts/mustaklassat/src/components/layout/Sidebar.tsx');
  const dashboard = read('artifacts/mustaklassat/src/pages/dashboard.tsx');
  const originalViewer = read('artifacts/mustaklassat/src/pages/OriginalViewer.tsx');
  const authCheck = read('artifacts/mustaklassat/public/original/auth-check.js');

  assert.match(sidebar, /const href = `\/original-viewer\?page=\$\{m\.file\}`/);
  assert.match(dashboard, /function ov\(page: string\) \{ return `\/original-viewer\?page=\$\{page\}`; \}/);
  assert.match(originalViewer, /FRAME_POLICY_CACHE_VERSION = "20260713_self_v2"/);
  assert.match(originalViewer, /`\/original\/\$\{page\}\?framePolicy=\$\{FRAME_POLICY_CACHE_VERSION\}`/);
  assert.match(originalViewer, /najranGetFreshToken/);
  assert.match(originalViewer, /getToken\(options\?\.skipCache/);
  assert.match(authCheck, /'settings_main\.html': 'settings_main'/);
  assert.match(authCheck, /'settings_advanced\.html': 'settings_advanced'/);
  assert.match(authCheck, /if \(!isOriginalPageAllowed\(\)\)/);
});

test('the authenticated app fails closed and the original viewer accepts only shipped pages', () => {
  const appSource = read('artifacts/mustaklassat/src/App.tsx');
  const originalViewer = read('artifacts/mustaklassat/src/pages/OriginalViewer.tsx');
  const pagePolicy = JSON.parse(read('artifacts/mustaklassat/src/config/original-pages.json'));
  const shippedPages = fs.readdirSync(originalDir).filter((file) => file.endsWith('.html')).sort();
  const allowedPages = [
    ...pagePolicy.modulePages,
    ...pagePolicy.auxiliaryPages,
    ...pagePolicy.adminOnlyPages,
  ].sort();

  assert.deepEqual(allowedPages, shippedPages);
  assert.equal(new Set(allowedPages).size, allowedPages.length, 'original page policy must not contain duplicates');
  assert.match(appSource, /if \(\(error && !isNotFound\) \|\| syncState === "error" \|\| !dbUser\) return <AccessCheckFailedPage \/>/);
  assert.match(appSource, /if \(dbUser\?\.status !== "approved"\) return <AccessCheckFailedPage \/>/);
  assert.match(originalViewer, /KNOWN_ORIGINAL_PAGES\.has\(requestedPage\)/);
  assert.match(originalViewer, /ADMIN_ONLY_ORIGINAL_PAGES\.has\(page\) \|\| role === "admin"/);
});

test('user and hospital sync share one complete storage scope definition', () => {
  const userStorage = read('artifacts/api-server/src/routes/storage.ts');
  const hospitalStorage = read('artifacts/api-server/src/routes/hospital-storage.ts');
  const storageScope = read('artifacts/api-server/src/lib/storage-scope.ts');

  for (const route of [userStorage, hospitalStorage]) {
    assert.match(route, /from "\.\.\/lib\/storage-scope"/);
    assert.doesNotMatch(route, /const PAGE_FILTERS/);
    assert.doesNotMatch(route, /const COMMON_PAGE_KEYS/);
  }

  assert.match(storageScope, /"paymentNumber"/);
  assert.match(storageScope, /"najranSignatureStyleSettings_v1"/);
  assert.match(storageScope, /"sb_style_prefs_"/);
  assert.match(storageScope, /"attendanceData"/);
  assert.match(storageScope, /"adminOfficesAttendanceData_v1"/);
  assert.match(storageScope, /"healthCentersAttendanceData"/);
});

test('API routes resolve the authenticated database user through one helper', () => {
  const helper = read('artifacts/api-server/src/lib/current-user.ts');
  const routeSources = walk(path.join(repoDir, 'artifacts/api-server/src/routes'), (file) => file.endsWith('.ts'))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');

  assert.match(helper, /if \(!req\.clerkUserId\) return undefined/);
  assert.match(helper, /where\(eq\(usersTable\.clerkId, req\.clerkUserId\)\)/);
  assert.doesNotMatch(
    routeSources,
    /(?:const|let) \[(?:user|dbUser|currentUser|existingUser|existing)\] = await db\.select\(\)\.from\(usersTable\)\.where\(eq\(usersTable\.clerkId, req\.clerkUserId\)\)\.limit\(1\)/,
  );
  assert.ok((routeSources.match(/findCurrentUser\(req\)/g) || []).length >= 30);
});

test('all backend company scoping uses the current and legacy site aliases from one source', () => {
  const scope = read('artifacts/api-server/src/lib/extract-scope.ts');
  const exportRoute = read('artifacts/api-server/src/routes/export.ts');
  const usersRoute = read('artifacts/api-server/src/routes/users.ts');

  assert.match(scope, /export function companySitesForKey/);
  assert.match(scope, /مستشفى نجران العام الجديد ومركز طب الأسنان التخصصي/);
  assert.match(scope, /مستشفى غرب نجران للولادة والأطفال والعيادات التخصصية/);
  assert.match(scope, /المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة/);
  assert.match(exportRoute, /companySitesFor\(req\.currentUser\)/);
  assert.match(usersRoute, /companySitesForKey\(company\)/);
  assert.doesNotMatch(exportRoute, /const COMPANY_SITES/);
  assert.doesNotMatch(usersRoute, /const COMPANY_SITES/);
});

test('registration is isolated from the application shell without losing its required fields', () => {
  const appSource = read('artifacts/mustaklassat/src/App.tsx');
  const registration = read('artifacts/mustaklassat/src/components/auth/PreRegistrationForm.tsx');

  assert.match(appSource, /import \{ PRE_REG_KEY, PreRegistrationForm \}/);
  assert.doesNotMatch(appSource, /const COMPANY_SITES/);
  assert.match(registration, /export const PRE_REG_KEY = "najran_prereg"/);
  assert.match(registration, /fullName: ""/);
  assert.match(registration, /phone: ""/);
  assert.match(registration, /hospital: ""/);
  assert.match(registration, /jobTitle: ""/);
  assert.match(registration, /contractNumber: ""/);
  assert.match(registration, /sessionStorage\.setItem\(PRE_REG_KEY/);
  assert.match(registration, /localStorage\.setItem\(PRE_REG_KEY/);
});

test('sidebar notification polling and acknowledgement are isolated in one hook', () => {
  const sidebar = read('artifacts/mustaklassat/src/components/layout/Sidebar.tsx');
  const notificationsHook = read('artifacts/mustaklassat/src/hooks/useNotifications.ts');

  assert.match(sidebar, /import \{ useNotifications \} from "@\/hooks\/useNotifications"/);
  assert.doesNotMatch(sidebar, /function useNotifications/);
  assert.match(notificationsHook, /10 \* 60_000/);
  assert.match(notificationsHook, /"\/api\/notifications"/);
  assert.match(notificationsHook, /`\/api\/notifications\/\$\{serverNotification\._srvId\}\/read`/);
  assert.match(notificationsHook, /"\/api\/notifications\/read-all"/);
});
