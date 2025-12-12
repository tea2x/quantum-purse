const { app, BrowserWindow, session, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function isUpgradeToMainnet() {
    const userData = app.getPath('userData');
    const versionFile = path.join(userData, 'version.json');
    const currentVersion = app.getVersion();

    let previousVersion = "0.0.0";
    if (fs.existsSync(versionFile)) {
        try {
            previousVersion = JSON.parse(fs.readFileSync(versionFile, 'utf8')).version || "0.0.0";
        } catch (e) {
            previousVersion = "0.0.0";
        }
    }

    // V0.3.0 marks the first transition from testnet to mainnet
    const fromTestnet = previousVersion < "0.3.0";
    const toMainnet = currentVersion >= "0.3.0";

    // Store version in a local file
    if (previousVersion !== currentVersion) {
        fs.writeFileSync(versionFile, JSON.stringify({ version: currentVersion }));
    }

    return (fromTestnet && toMainnet);
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            devTools: !app.isPackaged,
        },
    });

    mainWindow.setMinimumSize(1010, 760);
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.protocol !== 'file:') {
            event.preventDefault();
            shell.openExternal(navigationUrl);
        }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
                shell.openExternal(url);
            }
        } catch (e) {
            // nothing
        }
        return { action: 'deny' };
    });
}

app.whenReady().then(() => {
    /* The actual data cleaning happens in App.tsx.
       Here only shows a dialog to inform the user. */
    if (isUpgradeToMainnet()) {
        dialog.showMessageBoxSync({
            type: 'info',
            title: 'Quantum Purse Mainnet Upgrade Detected',
            message: `Your wallet has been upgraded from testnet to mainnet.
            \n\nPre-release/testnet light client data has been reset to ensure compatibility and your keys are now in control of mainnet assets.
            \n\nBe sure you intend to continue using this wallet otherwise it is recommended to delete the current wallet instance and create a new one.
            \n\nIn case you would like to keep using the current wallet for mainnet, you have to manually set starting blocks for each account (in account settings) to start syncing.`,
        });
    }

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = Object.assign({}, details.responseHeaders);
        responseHeaders['Cross-Origin-Opener-Policy'] = ['same-origin'];
        responseHeaders['Cross-Origin-Embedder-Policy'] = ['require-corp'];

        responseHeaders['Content-Security-Policy'] = [
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "font-src 'self'; " +
            "img-src 'self'; " +
            "connect-src 'self' https://ckb-faucet-proxy.vercel.app ws: wss:; " +
            "worker-src 'self' blob:; " +
            "manifest-src 'self'; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self'; " +
            "frame-ancestors 'none';"
        ];

        responseHeaders['X-Content-Type-Options'] = ['nosniff'];
        responseHeaders['X-Frame-Options'] = ['DENY'];

        callback({ responseHeaders });
    });

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['clipboard-read', 'clipboard-write'];
        callback(allowedPermissions.includes(permission));
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
