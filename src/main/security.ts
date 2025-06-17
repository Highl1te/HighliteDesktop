import { session } from 'electron';
import log from 'electron-log';

export function setupSecurity() {
    // Set up Content Security Policy and handle frame options
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = { ...details.responseHeaders };
        
        // Remove X-Frame-Options for highlite.fanet.dev to allow embedding
        if (details.url.includes('highlite.fanet.dev')) {
            delete responseHeaders['X-Frame-Options'];
            delete responseHeaders['x-frame-options'];
            log.info(`Removed X-Frame-Options for: ${details.url}`);
        }
        
        const headers: Record<string, string[]> = {
            ...responseHeaders,
            'Content-Security-Policy': [
                "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https://kit.fontawesome.com https://ka-f.fontawesome.com https://cdn.pixabay.com https://highspell.com https://*.highspell.com https://fonts.googleapis.com https://fonts.gstatic.com https://highlite.fanet.dev; " +
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://kit.fontawesome.com https://highspell.com https://*.highspell.com https://highlite.fanet.dev; " +
                "worker-src 'self' blob: data:; " +
                "style-src 'self' 'unsafe-inline' https://kit.fontawesome.com https://ka-f.fontawesome.com https://fonts.googleapis.com https://highspell.com https://*.highspell.com https://highlite.fanet.dev; " +
                "font-src 'self' https://kit.fontawesome.com https://ka-f.fontawesome.com https://fonts.gstatic.com; " +
                "media-src 'self' data: blob:; " +
                "img-src 'self' data: blob: https:; " +
                "connect-src 'self' data: blob: https: wss: ws: https://highspell.com https://*.highspell.com wss://*.highspell.com https://highlite.fanet.dev; " +
                "frame-src 'self' https://highspell.com https://*.highspell.com https://highlite.fanet.dev;"
            ],
            'X-Content-Type-Options': ['nosniff'],
            'X-XSS-Protection': ['1; mode=block'],
            'Referrer-Policy': ['strict-origin-when-cross-origin']
        };
        
        // Only add X-Frame-Options if not from highlite.fanet.dev
        if (!details.url.includes('highlite.fanet.dev')) {
            headers['X-Frame-Options'] = ['DENY'];
        }
        
        callback({ responseHeaders: headers });
    });

    // Block navigation to external websites
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const { url } = details;
        
        // Allow local files and specific external resources
        if (url.startsWith('file://') || 
            url.startsWith('https://kit.fontawesome.com') ||
            url.startsWith('https://ka-f.fontawesome.com') ||
            url.startsWith('https://cdn.pixabay.com') ||
            url.startsWith('https://highspell.com') ||
            url.includes('.highspell.com') ||
            url.startsWith('https://fonts.googleapis.com') ||
            url.startsWith('https://fonts.gstatic.com') ||
            url.startsWith('https://highlite.fanet.dev') ||
            url.includes('localhost') ||
            url.includes('127.0.0.1')) {
            callback({});
        } else if (url.startsWith('http://') || url.startsWith('https://')) {
            log.warn(`Blocked external navigation to: ${url}`);
            callback({ cancel: true });
        } else {
            callback({});
        }
    });

    log.info('Security policies initialized');
}
