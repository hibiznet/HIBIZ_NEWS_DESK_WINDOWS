const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hibiz', {
  providers: {
    list: () => ipcRenderer.invoke('providers:list'),
    save: (p) => ipcRenderer.invoke('providers:save', p),
    delete: (id) => ipcRenderer.invoke('providers:delete', id),
    toggle: (id) => ipcRenderer.invoke('providers:toggle', id),
    test: (id) => ipcRenderer.invoke('providers:test', id)
  },
  news: {
    search: (x) => ipcRenderer.invoke('news:search', x),
    save: (n) => ipcRenderer.invoke('news:save', n),
    list: (x) => ipcRenderer.invoke('news:list', x),
    get: (id) => ipcRenderer.invoke('news:get', id),
    delete: (id) => ipcRenderer.invoke('news:delete', id),
    update: (n) => ipcRenderer.invoke('news:update', n),
    categories: () => ipcRenderer.invoke('news:categories'),
    count: () => ipcRenderer.invoke('news:count')
  },
  openUrl: (url) => ipcRenderer.invoke('open:url', url),
  googleTranslate: (text, target) => ipcRenderer.invoke('translate:google', { text, target }),
  openGoogleTranslatePopup: () => ipcRenderer.invoke('translate:popup')
});
