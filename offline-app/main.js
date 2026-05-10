const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Local server ──────────────────────────────────────────────────────────────
const { startServer } = require('./server');
let serverPort = 0;

// ── Data directory ────────────────────────────────────────────────────────────
const DATA_DIR = path.join(app.getPath('userData'), 'najran-data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// ── User management ───────────────────────────────────────────────────────────
function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('admin123', 10);
      const defaults = [
        { id: 1, username: 'admin', password: hash, name: 'المدير العام', role: 'admin', hospital: '', company: '' }
      ];
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaults, null, 2), 'utf8');
      return defaults;
    }
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch { return []; }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

// ── IPC: auth ─────────────────────────────────────────────────────────────────
ipcMain.handle('auth:login', async (_e, { username, password }) => {
  const bcrypt = require('bcryptjs');
  const users = loadUsers();
  const user = users.find(u => u.username === username.trim());
  if (!user) return { success: false, error: 'اسم المستخدم غير صحيح' };
  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return { success: false, error: 'كلمة المرور غير صحيحة' };
  return {
    success: true,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, hospital: user.hospital, company: user.company }
  };
});

ipcMain.handle('auth:addUser', async (_e, { username, password, name, role, hospital, company }) => {
  const bcrypt = require('bcryptjs');
  const users = loadUsers();
  if (users.find(u => u.username === username.trim())) return { success: false, error: 'اسم المستخدم موجود بالفعل' };
  const hash = bcrypt.hashSync(password, 10);
  users.push({ id: Date.now(), username: username.trim(), password: hash, name, role: role || 'user', hospital: hospital || '', company: company || '' });
  saveUsers(users);
  return { success: true };
});

ipcMain.handle('auth:updatePassword', async (_e, { id, newPassword }) => {
  const bcrypt = require('bcryptjs');
  const users = loadUsers();
  const user = users.find(u => u.id === id);
  if (!user) return { success: false, error: 'المستخدم غير موجود' };
  user.password = bcrypt.hashSync(newPassword, 10);
  saveUsers(users);
  return { success: true };
});

ipcMain.handle('auth:listUsers', async () => {
  return loadUsers().map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role, hospital: u.hospital, company: u.company }));
});

ipcMain.handle('auth:deleteUser', async (_e, { id }) => {
  const users = loadUsers().filter(u => u.id !== id);
  saveUsers(users);
  return { success: true };
});

ipcMain.handle('app:getDataDir', () => DATA_DIR);
ipcMain.handle('app:openDataDir', () => shell.openPath(DATA_DIR));
ipcMain.handle('app:getVersion', () => app.getVersion());

// ── Window ────────────────────────────────────────────────────────────────────
let mainWindow;

async function createWindow() {
  serverPort = await startServer(DATA_DIR);

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    title: 'نظام المستخلصات — نجران الصحي',
    icon: path.join(__dirname, 'app', 'assets', 'icon.png'),
    backgroundColor: '#1e3c72',
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(`http://localhost:${serverPort}/login.html`);

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
