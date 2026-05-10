const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  login:          (u, p) => ipcRenderer.invoke('auth:login', { username: u, password: p }),
  addUser:        (d)    => ipcRenderer.invoke('auth:addUser', d),
  updatePassword: (id, pw) => ipcRenderer.invoke('auth:updatePassword', { id, newPassword: pw }),
  listUsers:      ()     => ipcRenderer.invoke('auth:listUsers'),
  deleteUser:     (id)   => ipcRenderer.invoke('auth:deleteUser', { id }),
  getVersion:     ()     => ipcRenderer.invoke('app:getVersion'),
  openDataDir:    ()     => ipcRenderer.invoke('app:openDataDir'),
});
