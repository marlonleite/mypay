const { app, BrowserWindow, dialog } = require('electron')
const http = require('http')
const fs = require('fs')
const path = require('path')

const VITE_DEV_PORT = process.env.VITE_DEV_PORT || 3000
const DEV_SERVER_URL = `http://localhost:${VITE_DEV_PORT}`

/**
 * Packaged app must not use file:// — Firebase Auth (Google popup) rejects that origin.
 * Serve dist over loopback with a **fixed** port so FastAPI CORS can list a single origin.
 *
 * Use 127.0.0.1 for bind + loadURL: on macOS, listen('localhost') may bind only to ::1 while
 * Chromium resolves "localhost" to 127.0.0.1 first → connection refused / blank window.
 *
 * Ops (production API + Firebase):
 * - mypay-api CORS: CORS_ORIGIN_REGEX covers localhost and 127.0.0.1 with any port.
 * - Firebase Auth → Authorized domains: `localhost` is default; avoid needing `127.0.0.1`
 *   by loading the UI at http://localhost:<port> while the server still listens on 127.0.0.1.
 */
const PACKAGED_STATIC_PORT_DEFAULT = 47382

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json'
}

function mimeTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

function resolveSafeFileUnderRoot(rootDir, reqUrl) {
  try {
    const pathname = new URL(reqUrl, 'http://127.0.0.1').pathname
    const relative = pathname.replace(/^\/+/, '') || 'index.html'
    const fullPath = path.resolve(rootDir, relative)
    const rootResolved = path.resolve(rootDir)
    if (fullPath !== rootResolved && !fullPath.startsWith(rootResolved + path.sep)) {
      return null
    }
    return fullPath
  } catch {
    return null
  }
}

function getPackagedDistDir() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..', 'dist')
  }
  const fromAppPath = path.join(app.getAppPath(), 'dist')
  const indexPath = path.join(fromAppPath, 'index.html')
  if (fs.existsSync(indexPath)) {
    return fromAppPath
  }
  const fromParent = path.join(__dirname, '..', 'dist')
  if (fs.existsSync(path.join(fromParent, 'index.html'))) {
    return fromParent
  }
  return fromAppPath
}

function startPackagedDistServer(distDir, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const filePath = resolveSafeFileUnderRoot(distDir, req.url || '/')
      if (!filePath) {
        res.writeHead(403).end()
        return
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404).end('Not found')
          return
        }
        res.writeHead(200, { 'Content-Type': mimeTypeFor(filePath) })
        res.end(data)
      })
    })

    const onListenError = (err) => {
      console.error(
        `[myPay Electron] Static server failed (port ${port}).`,
        err.code === 'EADDRINUSE'
          ? `Free the port or set MYPAY_ELECTRON_STATIC_PORT. CORS allow http://localhost:${port}`
          : err.message
      )
      reject(err)
    }

    server.once('error', onListenError)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onListenError)
      // Document origin http://localhost — Firebase includes "localhost" in authorized domains by default.
      const url = `http://localhost:${port}/`
      resolve({ server, url })
    })
  })
}

let packagedDistServer = null
let packagedBaseUrlPromise = null

function getPackagedBaseUrl() {
  if (!app.isPackaged) {
    return Promise.resolve(null)
  }
  if (!packagedBaseUrlPromise) {
    const port = Number(process.env.MYPAY_ELECTRON_STATIC_PORT) || PACKAGED_STATIC_PORT_DEFAULT
    const distDir = getPackagedDistDir()
    packagedBaseUrlPromise = startPackagedDistServer(distDir, port).then(({ server, url }) => {
      packagedDistServer = server
      return url
    })
  }
  return packagedBaseUrlPromise
}

function showStartupError(title, detail) {
  console.error(`[myPay Electron] ${title}`, detail)
  try {
    dialog.showErrorBox(title, detail)
  } catch {
    /* no display */
  }
}

/**
 * @param {boolean} isDev
 */
async function createWindow(isDev) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'allow' }))

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    showStartupError(
      'Falha ao carregar o myPay',
      `Não foi possível carregar a interface.\n\nCódigo: ${code}\n${desc}\n\nURL: ${url}`
    )
  })

  try {
    if (isDev) {
      await win.loadURL(DEV_SERVER_URL)
      win.webContents.openDevTools({ mode: 'detach' })
    } else {
      const baseUrl = await getPackagedBaseUrl()
      await win.loadURL(baseUrl)
    }
    win.show()
  } catch (err) {
    const detail =
      err && err.code === 'EADDRINUSE'
        ? `Porta em uso. Libere a porta ${PACKAGED_STATIC_PORT_DEFAULT} ou defina MYPAY_ELECTRON_STATIC_PORT.\n\n${err.message}`
        : err && err.message
          ? err.message
          : String(err)
    showStartupError('myPay não pôde iniciar', detail)
    win.show()
    return
  }

}

app.whenReady().then(async () => {
  const isDev = !app.isPackaged
  try {
    await createWindow(isDev)
  } catch (err) {
    showStartupError('myPay não pôde iniciar', err && err.message ? err.message : String(err))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow(!app.isPackaged)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  if (packagedDistServer) {
    packagedDistServer.close()
    packagedDistServer = null
    packagedBaseUrlPromise = null
  }
})
