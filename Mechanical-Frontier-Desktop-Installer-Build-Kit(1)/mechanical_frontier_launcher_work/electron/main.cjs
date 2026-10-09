'use strict';

const { app, BrowserWindow, dialog, shell } = require('electron');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const next = require('next');

const PRODUCT_NAME = 'Mechanical Frontier';
let mainWindow = null;
let nextApp = null;
let localServer = null;
let localUrl = null;
let quitting = false;

app.setName(PRODUCT_NAME);
app.setAppUserModelId('com.mechanicalfrontier.game');

// Each installed user gets their own writable save directory. Nothing is saved
// to Program Files or to the read-only game installation directory.
function configureUserData() {
  const dataDir = path.join(app.getPath('userData'), 'world-data');
  process.env.MECHANICAL_FRONTIER_DATA_DIR = dataDir;
  return fs.mkdir(dataDir, { recursive: true });
}

function openExternalSafely(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      void shell.openExternal(parsed.href);
    }
  } catch {
    // Ignore malformed URLs rather than opening them in the game window.
  }
}

async function startGameServer() {
  const appRoot = app.isPackaged
    ? app.getAppPath()
    : path.resolve(__dirname, '..');

  await configureUserData();

  // Development mode can run the desktop wrapper without a prebuilt .next.
  const dev = !app.isPackaged;
  nextApp = next({ dev, dir: appRoot, hostname: '127.0.0.1' });
  await nextApp.prepare();

  const handler = nextApp.getRequestHandler();
  localServer = http.createServer((request, response) => {
    // The embedded game is local-only; don't expose it to the network.
    handler(request, response);
  });

  await new Promise((resolve, reject) => {
    localServer.once('error', reject);
    localServer.listen(0, '127.0.0.1', () => {
      localServer.removeListener('error', reject);
      resolve();
    });
  });

  const address = localServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('The local game server did not provide a usable address.');
  }
  localUrl = `http://127.0.0.1:${address.port}`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: PRODUCT_NAME,
    backgroundColor: '#10151b',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!localUrl || url.startsWith(`${localUrl}/`) || url === localUrl) return;
    event.preventDefault();
    openExternalSafely(url);
  });

  mainWindow.once('ready-to-show', () => mainWindow && mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (!quitting) app.quit();
  });

  mainWindow.loadURL(localUrl).catch(async (error) => {
    console.error('Could not open Mechanical Frontier:', error);
    await dialog.showMessageBox({
      type: 'error',
      title: `${PRODUCT_NAME} could not start`,
      message: 'Mechanical Frontier could not open its game window.',
      detail: String(error && error.message ? error.message : error),
    });
    app.quit();
  });
}

async function stopGameServer() {
  const server = localServer;
  localServer = null;
  if (server && server.listening) {
    await new Promise((resolve) => server.close(() => resolve()));
  }
  if (nextApp && typeof nextApp.close === 'function') {
    try { await nextApp.close(); } catch (error) { console.error(error); }
  }
  nextApp = null;
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      await startGameServer();
      createWindow();
    } catch (error) {
      console.error('Mechanical Frontier startup failed:', error);
      await dialog.showMessageBox({
        type: 'error',
        title: `${PRODUCT_NAME} could not start`,
        message: 'The game failed during startup.',
        detail: `${error && error.stack ? error.stack : String(error)}`,
      });
      app.quit();
    }
  });

  app.on('before-quit', () => {
    quitting = true;
    void stopGameServer();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
