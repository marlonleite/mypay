const { app, BrowserWindow } = require('electron')
const path = require('path')

const VITE_DEV_PORT = process.env.VITE_DEV_PORT || 3000
const DEV_SERVER_URL = `http://localhost:${VITE_DEV_PORT}`

/**
 * @param {boolean} isDev
 */
function createWindow(isDev) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  // Google OAuth + links: allow in-app window (required for signInWithPopup in Electron)
  win.webContents.setWindowOpenHandler(() => ({ action: 'allow' }))

  if (isDev) {
    win.loadURL(DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  const isDev = !app.isPackaged
  createWindow(isDev)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(isDev)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
