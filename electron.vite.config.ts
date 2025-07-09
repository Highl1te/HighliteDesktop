import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'path';

function pluginHotReloadPlugin() {
    let lastEventTime = 0;
    const debounceMs = 100; // Prevent rapid-fire events

    return {
        name: 'plugin-hot-reload',
        handleHotUpdate({ file, server, read }) {
            if (file.includes('/highlite/plugins/') && file.endsWith('.ts')) {
                const now = Date.now();
                if (now - lastEventTime < debounceMs) {
                    return;
                }
                lastEventTime = now;

                console.log(`[Plugin HMR] Plugin file changed: ${file}`);

                // Read the file content to find the plugin class
                const getPluginClassName = async () => {
                    try {
                        const content = await read();

                        // Look for "export class ClassName extends Plugin"
                        const classMatch = content.match(
                            /export\s+class\s+(\w+)\s+extends\s+Plugin/
                        );
                        if (classMatch) {
                            return classMatch[1];
                        }

                        // look for any class that extends Plugin
                        const fallbackMatch = content.match(
                            /class\s+(\w+)\s+extends\s+Plugin/
                        );
                        if (fallbackMatch) {
                            return fallbackMatch[1];
                        }

                        return null;
                    } catch (error) {
                        console.error(
                            `[Plugin HMR] Error reading file ${file}:`,
                            error
                        );
                        return null;
                    }
                };

                // Get the relative file path for the client
                const pluginsIndex = file.indexOf('/highlite/plugins/');
                if (pluginsIndex === -1) return;

                const relativePath = file.substring(
                    pluginsIndex + '/highlite/plugins/'.length
                );
                const filePathWithoutExt = relativePath.replace('.ts', '');

                getPluginClassName().then((pluginName) => {
                    if (pluginName) {
                        console.log(
                            `[Plugin HMR] Detected plugin class: ${pluginName} (from file: ${filePathWithoutExt})`
                        );

                        // Send custom event to client
                        server.ws.send({
                            type: 'custom',
                            event: 'plugin-hot-reload',
                            data: {
                                pluginName,
                                file: filePathWithoutExt,
                                fullPath: file,
                            },
                        });
                    } else {
                        console.warn(
                            `[Plugin HMR] Could not detect plugin class in ${file}`
                        );
                    }
                });

                return [];
            }
        },
    };
}

export default defineConfig(({ mode }) => {
    const isDev = mode === 'development';

    return {
        main: {
            plugins: [externalizeDepsPlugin()],
        },
        preload: {
            plugins: [externalizeDepsPlugin()],
        },
        renderer: {
            plugins: isDev ? [pluginHotReloadPlugin()] : [],
            resolve: {
                alias: {
                    '@static': resolve(__dirname, 'static'),
                },
            },
            ...(isDev && {
                server: {
                    fs: {
                        allow: ['..'],
                    },
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods':
                            'GET, POST, PUT, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers':
                            'Origin, X-Requested-With, Content-Type, Accept',
                    },
                    proxy: {
                        '/socket.io': {
                            target: 'https://server1.highspell.com:8888',
                            changeOrigin: true,
                            secure: true,
                            headers: {
                                Origin: 'https://highspell.com',
                                Referer: 'https://highspell.com/',
                            },
                        },
                        '/api': {
                            target: 'https://highspell.com',
                            changeOrigin: true,
                            secure: true,
                            headers: {
                                Origin: 'https://highspell.com',
                                Referer: 'https://highspell.com/',
                            },
                        },
                    },
                },
            }),
            publicDir: resolve(__dirname, 'static'),
            root: resolve(__dirname, 'src/renderer'),
            build: {
                rollupOptions: {
                    input: {
                        client: resolve(__dirname, 'src/renderer/client.html'),
                        update: resolve(__dirname, 'src/renderer/update.html'),
                    },
                },
            },
        },
    };
});
