import { app, ipcMain, safeStorage } from 'electron';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';

const getStorePath = () => {
    return path.join(app.getPath('userData'), 'user-passwords.json');
};

function loadStore(): Record<string, string> {
    const storePath = getStorePath();
    if (!fs.existsSync(storePath)) return {};
    try {
        const raw = fs.readFileSync(storePath, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        log.error('Failed to load password store:', e);
        return {};
    }
}

function saveStore(store: Record<string, string>) {
    const storePath = getStorePath();
    try {
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), {
            encoding: 'utf8',
            mode: 0o600,
        });
    } catch (e) {
        log.error('Failed to save password store:', e);
    }
}

function encode(str: string): Buffer {
    return safeStorage.encryptString(str);
}

function decode(buf: Buffer): string {
    return safeStorage.decryptString(buf);
}

// In-memory store as safeStorage is not a credential manager, just encryption
let credentialStore = loadStore();

ipcMain.handle('save-username-password', async (_event, username, password) => {
    try {
        const encrypted = encode(password);
        credentialStore[username] = encrypted.toString('base64');
        saveStore(credentialStore);
        log.info(`Saved credential for ${username}`);
    } catch (err) {
        log.error('Failed to save credential:', err);
    }
});

ipcMain.handle('get-saved-usernames', async () => {
    try {
        return Object.keys(credentialStore);
    } catch (err) {
        log.error('Failed to list usernames:', err);
        return [];
    }
});

ipcMain.handle('get-saved-password', async (_event, username) => {
    try {
        const base64 = credentialStore[username];
        if (!base64) return '';
        const buf = Buffer.from(base64, 'base64');
        return decode(buf);
    } catch (err) {
        log.error(`Failed to get password for ${username}:`, err);
        return '';
    }
});

ipcMain.handle('delete-username-password', async (_event, username) => {
    try {
        delete credentialStore[username];
        saveStore(credentialStore);
        log.info(`Deleted credential for ${username}`);
    } catch (err) {
        log.error(`Failed to delete credential for ${username}:`, err);
    }
});

// Ensure file permissions are correct on load (in case file already exists)
(function ensureStorePermissions() {
    const storePath = getStorePath();
    if (fs.existsSync(storePath)) {
        try {
            fs.chmodSync(storePath, 0o600);
        } catch (e) {
            log.error('Failed to set permissions on password store:', e);
        }
    }
})();
