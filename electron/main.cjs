const { app, BrowserWindow, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 5501;
const APP_ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

let server;

function startAppServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((request, response) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD', 'X-Content-Type-Options': 'nosniff' }).end('Method not allowed');
        return;
      }

      let requestPath;

      try {
        requestPath = decodeURIComponent(
          new URL(request.url, `http://${HOST}:${PORT}`).pathname
        );
      } catch {
        response.writeHead(400).end('Bad request');
        return;
      }

      const relativePath =
        requestPath === '/'
          ? 'index.html'
          : requestPath.replace(/^\/+/, '');

      // Serve only runtime assets. Never expose package files, SQL, Git metadata,
      // backups, environment files, or documentation through the local HTTP server.
      const topLevel = relativePath.split(/[\\/]/)[0];
      const isAllowed = relativePath === 'index.html' ||
        ['css', 'js', 'download'].includes(topLevel);
      if (!isAllowed || relativePath.split(/[\\/]/).some(part => !part || part.startsWith('.'))) {
        response.writeHead(404, { 'X-Content-Type-Options': 'nosniff' }).end('Not found');
        return;
      }

      const filePath = path.resolve(APP_ROOT, relativePath);

      if (
        filePath !== APP_ROOT &&
        !filePath.startsWith(`${APP_ROOT}${path.sep}`)
      ) {
        response.writeHead(403).end('Forbidden');
        return;
      }

      fs.readFile(filePath, (error, content) => {
        if (error) {
          response
            .writeHead(error.code === 'ENOENT' ? 404 : 500, { 'X-Content-Type-Options': 'nosniff' })
            .end(error.code === 'ENOENT' ? 'Not found' : 'Unable to read asset');
          return;
        }

        response.writeHead(200, {
          'Content-Type':
            MIME_TYPES[path.extname(filePath).toLowerCase()] ||
            'application/octet-stream',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'X-Frame-Options': 'DENY'
        });

        response.end(content);
      });
    });

    server.once('error', reject);
    server.listen(PORT, HOST, resolve);
  });
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#f5f7f1',
    icon: path.join(APP_ROOT, 'css', 'easybill-logo.ico'),
    autoHideMenuBar: true,

    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.once('ready-to-show', () => window.show());

  // Diagnostics: print app errors to the terminal so problems are easy to report.
  window.webContents.on('console-message', (event) => {
    const { level, message, lineNumber, sourceId } = event;
    if (level === 'error' || level === 3) {
      console.error(`[EasyBill renderer error] ${message} (${sourceId}:${lineNumber})`);
    }
  });
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[EasyBill] Page failed to load: ${description} (${code}) ${url}`);
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('[EasyBill] Renderer crashed:', details.reason);
  });
  // Press F12 or Ctrl+Shift+I to open DevTools and see the Console tab.
  window.webContents.on('before-input-event', (event, input) => {
    const devKey = input.key === 'F12' ||
      (input.control && input.shift && input.key.toLowerCase() === 'i');
    if (input.type === 'keyDown' && devKey) {
      window.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  await window.loadURL(`http://${HOST}:${PORT}`);
}


// ==========================================
// EASYBILL AUTO UPDATE
// ==========================================

function setupAutoUpdater() {

  autoUpdater.on('checking-for-update', () => {
    console.log('EasyBill: Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`EasyBill: Update available - ${info.version}`);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log(
      `EasyBill: Version ${info.version} is up to date.`
    );
  });

  autoUpdater.on('error', (error) => {
    console.error(
      'EasyBill auto-update error:',
      error
    );
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(
      `EasyBill: Downloading update ${Math.round(progress.percent)}%`
    );
  });

  autoUpdater.on('update-downloaded', (info) => {

    console.log(
      `EasyBill: Update ${info.version} downloaded.`
    );

    // Install on the next normal quit instead of closing the app mid-sale.
  });

  autoUpdater.autoInstallOnAppQuit = true;
  if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify();
}


// ==========================================
// START EASYBILL
// ==========================================

app.whenReady().then(async () => {

  try {

    await startAppServer();

    await createWindow();

    setupAutoUpdater();

  } catch (error) {

    console.error(
      'EasyBill desktop startup failed:',
      error
    );

    const inUse = error && error.code === 'EADDRINUSE';
    dialog.showErrorBox(
      'EasyBill could not start',
      inUse
        ? 'EasyBill is already running (port 5501 is in use). Close every EasyBill window, then open it again.'
        : String((error && error.message) || error)
    );
    app.quit();
  }

});

app.on('window-all-closed', () => app.quit());

app.on('before-quit', () => server?.close());