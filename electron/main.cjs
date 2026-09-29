const { app, BrowserWindow, shell } = require('electron');
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
            .writeHead(error.code === 'ENOENT' ? 404 : 500)
            .end('Not found');
          return;
        }

        response.writeHead(200, {
          'Content-Type':
            MIME_TYPES[path.extname(filePath).toLowerCase()] ||
            'application/octet-stream',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
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
    backgroundColor: '#f4f5f6',
    autoHideMenuBar: true,

    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.once('ready-to-show', () => window.show());

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

    autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.checkForUpdatesAndNotify();
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

    app.quit();
  }

});

app.on('window-all-closed', () => app.quit());

app.on('before-quit', () => server?.close());