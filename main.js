const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = Object.assign({}, details.responseHeaders);
        responseHeaders['Cross-Origin-Opener-Policy'] = ['same-origin'];
        responseHeaders['Cross-Origin-Embedder-Policy'] = ['require-corp'];
        callback({ responseHeaders });
    });

    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});