const express = require('express');
const path = require('path');
const fs = require('fs');

const APP_DIR = path.join(__dirname, 'app');

function startServer(dataDir) {
  return new Promise((resolve, reject) => {
    const app = express();
    app.use(express.json());

    // ── Intercept offline replacements ────────────────────────────────────────
    app.get('/original/auth-check.js',   (_req, res) => res.sendFile(path.join(APP_DIR, 'original', 'offline-auth-check.js')));
    app.get('/original/cloud-sync.js',   (_req, res) => res.sendFile(path.join(APP_DIR, 'original', 'offline-cloud-sync.js')));
    app.get('/original/user-storage-proxy.js', (_req, res) => res.sendFile(path.join(APP_DIR, 'original', 'offline-user-proxy.js')));

    // ── Static files ──────────────────────────────────────────────────────────
    app.use('/original', express.static(path.join(APP_DIR, 'original')));
    app.use('/assets',   express.static(path.join(APP_DIR, 'assets')));
    app.use(express.static(APP_DIR));

    // ── Stub API endpoints (silent fail for offline mode) ─────────────────────
    app.all('/api/*', (_req, res) => res.status(200).json({ ok: true, extracts: [], users: [], offline: true }));

    // ── SPA fallback ──────────────────────────────────────────────────────────
    app.get('/', (_req, res) => res.redirect('/login.html'));

    const server = app.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
    server.on('error', reject);
  });
}

module.exports = { startServer };
