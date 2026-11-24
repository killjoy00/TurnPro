const { app, BrowserWindow, protocol, session } = require('electron')
const { readFile } = require('node:fs/promises')
const { join } = require('node:path')

const gameUrl = 'turnpro://game/index.html'
app.setName('Turn Pro')
protocol.registerSchemesAsPrivileged([{ scheme: 'turnpro', privileges: { standard: true, secure: true } }])

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let window
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore()
    window?.focus()
  })
  app.whenReady().then(async () => {
    const page = await readFile(join(__dirname, 'index.html'), 'utf8')
    protocol.handle('turnpro', request => request.method === 'GET' && request.url === gameUrl
      ? new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      : new Response('Not found', { status: 404 }))
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, answer) => answer(false))
    session.defaultSession.setPermissionCheckHandler(() => false)

    window = new BrowserWindow({
      title: 'Turn Pro',
      width: 1280, height: 800, minWidth: 640, minHeight: 480,
      backgroundColor: '#10191e',
      autoHideMenuBar: true,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    window.removeMenu()
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', event => event.preventDefault())
    await window.loadURL(gameUrl)
  }).catch(error => {
    console.error('Could not start Turn Pro.', error)
    app.exit(1)
  })
  app.on('window-all-closed', () => app.quit())
}
