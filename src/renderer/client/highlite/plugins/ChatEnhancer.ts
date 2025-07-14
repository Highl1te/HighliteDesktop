import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';

export class ChatEnhancer extends Plugin {
    pluginName = 'Chat Enhancer';
    author = 'JayArrowz & Answerth & 0rangeYouGlad';

    private observers: MutationObserver[] = [];
    private listeners: {
        el: EventTarget;
        type: string;
        handler: EventListener;
        opts?: any;
    }[] = [];
    private injectedEls: HTMLElement[] = [];
    private isInitialized = false;
    private messageWatchersSetup = false;
    private processedMessages = new Set<HTMLElement>();
    private messageCheckInterval: number | null = null;

    private readonly CONFIG = {
        PUB_LINES: 12,
        PM_LINES: 6,
        WIDTH_PX: 600,
        MIN_W: 350,
        MAX_W: 1200,
        MIN_H: 100,
        MAX_H: 800,
        DEFAULT_OPACITY: 0.6,
    };

    private readonly FILTERS = [
        {
            icon: '📜',
            key: 'chat',
            sections: [
                '#hs-public-message-list__container',
                '#hs-private-message-list',
            ],
        },
        { icon: '🔵', key: 'private', section: '#hs-private-message-list' },
        { icon: '🟠', key: 'global', className: 'hs-text--orange' },
        { icon: '🟡', key: 'local', className: 'hs-text--yellow' },
        { icon: '⚪', key: 'status', className: 'hs-text--white' },
        { icon: '🏁', key: 'opacity' },
    ];

    private active = {
        chat: true,
        private: true,
        global: true,
        local: true,
        status: true,
        opacityEnabled: false,
        opacityValue: this.CONFIG.DEFAULT_OPACITY,
    };

    private prevOpacityEnabled = false;

    constructor() {
        super();

        this.settings.enable = {
            text: 'Enable Chat Enhancer',
            type: SettingsTypes.checkbox,
            value: false, // Default to false
            callback: () => {
                if (this.settings.enable.value) {
                    this.initializePlugin();
                } else {
                    this.disablePlugin();
                }
            },
        };

        this.settings.expandChat = {
            text: 'Expand Chat Box',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {
                if (this.settings.expandChat.value) {
                    this.applyChatDimensions();
                } else {
                    this.resetChatSize();
                }
            },
        };

        this.settings.collapsibleMessages = {
            text: 'Collapsible Messages',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {
                this.scanAllMessages();
            },
        };

        this.settings.colorOverrides = {
            text: 'Color Overrides',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.applyStyles(),
        };

        this.settings.enableFilters = {
            text: 'Enable Message Filters',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.applyFilters(),
        };

        this.settings.enableResizers = {
            text: 'Enable Resizable Chat',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {
                if (this.settings.enableResizers.value) {
                    this.setupResizers();
                } else {
                    this.log(
                        'Resizer disable will take effect on next plugin restart'
                    );
                }
            },
        };

        this.settings.statusMessageColor = {
            text: 'Status Message Color',
            type: SettingsTypes.color,
            value: '#d3d3d3',
            callback: () => this.applyStyles(),
        };

        this.settings.globalMessageColor = {
            text: 'Global Message Color',
            type: SettingsTypes.color,
            value: '#ff8c00',
            callback: () => this.applyStyles(),
        };

        this.settings.localMessageColor = {
            text: 'Local Message Color',
            type: SettingsTypes.color,
            value: '#f0e68c',
            callback: () => this.applyStyles(),
        };

        this.settings.chatWidth = {
            text: 'Chat Width',
            type: SettingsTypes.range,
            value: this.CONFIG.WIDTH_PX,
            callback: () => this.applyChatDimensions(),
        };

        this.settings.publicChatHeight = {
            text: 'Public Chat Height',
            type: SettingsTypes.range,
            value: this.CONFIG.PUB_LINES * 20,
            callback: () => this.applyChatDimensions(),
        };

        this.settings.privateChatHeight = {
            text: 'Private Chat Height',
            type: SettingsTypes.range,
            value: this.CONFIG.PM_LINES * 20,
            callback: () => this.applyChatDimensions(),
        };

        this.settings.showChatFilter = {
            text: 'Show Chat Messages',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.applyFilters(),
        };

        this.settings.showPrivateFilter = {
            text: 'Show Private Messages',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.applyFilters(),
        };

        this.settings.showGlobalFilter = {
            text: 'Show Global Messages',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.applyFilters(),
        };

        this.settings.showLocalFilter = {
            text: 'Show Local Messages',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.applyFilters(),
        };

        this.settings.showStatusFilter = {
            text: 'Show Status Messages',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.applyFilters(),
        };

        this.settings.opacityEnabled = {
            text: 'Enable Chat Opacity',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => this.applyStyles(),
        };

        this.settings.opacityValue = {
            text: 'Chat Opacity',
            type: SettingsTypes.range,
            value: this.CONFIG.DEFAULT_OPACITY * 100,
            callback: () => this.applyStyles(),
        };

        this.settings.extendedBlockList = {
            text: 'Extended Block List',
            type: SettingsTypes.text,
            value: "",
            callback: () => this.applyFilters(),
        };
    }

    start(): void {
        this.log('ChatEnhancer starting...');
        this.initializePlugin();
    }

    stop(): void {
        this.log('ChatEnhancer stopping...');
        this.cleanup();
    }

    init(): void {
        this.log('ChatEnhancer initialized');
    }

    SocketManager_loggedIn(): void {
        this.log('Player logged in - initializing chat enhancer');
        setTimeout(() => {
            this.initializePlugin();
        }, 1000);
    }

    SocketManager_handleLoggedOut(): void {
        this.log('Player logged out - cleaning up chat enhancer');
        this.cleanup();
    }

    private initializePlugin(): void {
        if (!this.settings.enable?.value) return;

        this.log('Initializing ChatEnhancer plugin');
        this.isInitialized = true;

        this.active.opacityEnabled = this.settings.opacityEnabled
            ?.value as boolean;
        this.active.opacityValue =
            ((this.settings.opacityValue.value as number) || 60) / 100;

        this.applyStyles();
        this.applyFilters();
        this.setupStyleObserver();

        if (this.settings.expandChat?.value) {
            this.applyChatDimensions();
        }

        this.setupMessageWatching();
        this.setupSettingsMenuObserver();

        if (this.settings.enableResizers?.value) {
            this.setupResizers();
        }
    }

    private disablePlugin(): void {
        this.log('Disabling ChatEnhancer plugin');
        this.removeAllToggles();
        this.removeSettingsMenuInjections();
        this.resetAllStyles();
        this.cleanup();
        this.isInitialized = false;
    }

    private removeAllToggles(): void {
        const containers = [
            document.querySelector('#hs-public-message-list__container'),
            document.querySelector('#hs-private-message-list'),
        ];

        containers.forEach(container => {
            if (container) {
                const messages = container.querySelectorAll(
                    '.hs-chat-message-container'
                );
                messages.forEach(msg => {
                    const msgEl = msg as HTMLElement;
                    const toggleBtn = msgEl.querySelector(
                        '[data-chat-enhancer-injected="true"]'
                    );
                    if (toggleBtn) {
                        toggleBtn.remove();
                    }

                    delete msgEl.dataset.toggleInjected;
                    msgEl.style.display = '';
                });
            }
        });
    }

    private removeSettingsMenuInjections(): void {
        const menus = document.querySelectorAll(
            '[data-filters-injected="true"]'
        );
        menus.forEach(menu => {
            const menuEl = menu as HTMLElement;
            delete menuEl.dataset.filtersInjected;
            menuEl.style.position = '';
            menuEl.style.overflow = '';

            const contentContainer = menuEl.querySelector(
                '#hs-chat-settings-menu__content-container'
            ) as HTMLElement;
            if (contentContainer) {
                contentContainer.style.removeProperty('overflow');
            }
        });
    }

    private resetAllStyles(): void {
        document.querySelectorAll('.hs-text--white').forEach(el => {
            (el as HTMLElement).style.removeProperty('color');
        });
        document.querySelectorAll('.hs-text--orange').forEach(el => {
            (el as HTMLElement).style.removeProperty('color');
        });
        document.querySelectorAll('.hs-text--yellow').forEach(el => {
            (el as HTMLElement).style.removeProperty('color');
        });

        const container = document.getElementById(
            'hs-chat-menu-section-container'
        );
        if (container) {
            container.style.removeProperty('background-color');
        }
    }

    private trackObserver(
        fn: MutationCallback,
        target: Node,
        opts: MutationObserverInit
    ): MutationObserver {
        const observer = new MutationObserver(fn);
        observer.observe(target, opts);
        this.observers.push(observer);
        return observer;
    }

    private trackListener(
        el: EventTarget,
        type: string,
        handler: EventListener,
        opts?: any
    ): void {
        el.addEventListener(type, handler, opts);
        this.listeners.push({ el, type, handler, opts });
    }

    private trackInjected(el: HTMLElement): void {
        this.injectedEls.push(el);
    }

    private applyStyles(): void {
        if (!this.settings.colorOverrides?.value) return;

        document.querySelectorAll('.hs-text--white').forEach(el => {
            (el as HTMLElement).style.setProperty(
                'color',
                this.settings.statusMessageColor.value as string,
                'important'
            );
        });
        document.querySelectorAll('.hs-text--orange').forEach(el => {
            (el as HTMLElement).style.setProperty(
                'color',
                this.settings.globalMessageColor.value as string,
                'important'
            );
        });
        document.querySelectorAll('.hs-text--yellow').forEach(el => {
            (el as HTMLElement).style.setProperty(
                'color',
                this.settings.localMessageColor.value as string,
                'important'
            );
        });

        const container = document.getElementById(
            'hs-chat-menu-section-container'
        );
        if (container) {
            if (this.settings.opacityEnabled?.value) {
                const opacity =
                    (this.settings.opacityValue.value as number) / 100;
                container.style.setProperty(
                    'background-color',
                    `rgba(0,0,0,${opacity})`,
                    'important'
                );
            } else {
                container.style.removeProperty('background-color');
            }
        }
    }

    private applyChatDimensions(): void {
        if (!this.settings.expandChat?.value) return;

        const pub = document.querySelector(
            '#hs-public-message-list__container'
        ) as HTMLElement;
        const pm = document.querySelector(
            '#hs-private-message-list'
        ) as HTMLElement;
        const menu = document.querySelector('#hs-chat-menu') as HTMLElement;
        const input = document.querySelector(
            '#hs-chat-input-menu'
        ) as HTMLElement;

        if (!pub || !pm || !menu || !input) return;

        const chatWidth = this.settings.chatWidth.value as number;
        const pubHeight = this.settings.publicChatHeight.value as number;
        const pmHeight = this.settings.privateChatHeight.value as number;

        const boundedWidth = Math.min(
            Math.max(chatWidth, this.CONFIG.MIN_W),
            this.CONFIG.MAX_W
        );
        menu.style.width = boundedWidth + 'px';

        const boundedPubHeight = Math.min(
            Math.max(pubHeight, this.CONFIG.MIN_H),
            this.CONFIG.MAX_H
        );
        const boundedPmHeight = Math.min(
            Math.max(pmHeight, this.CONFIG.MIN_H),
            this.CONFIG.MAX_H
        );

        pub.style.setProperty('height', `${boundedPubHeight}px`);
        pub.style.setProperty('max-height', 'none');
        pub.style.setProperty('overflow-y', 'auto');
        pub.style.setProperty('width', '100%');
        pm.style.setProperty('height', `${boundedPmHeight}px`);
        pm.style.setProperty('max-height', 'none');
        pm.style.setProperty('overflow-y', 'auto');
        pm.style.setProperty('width', '100%');
        menu.style.setProperty('max-height', 'none', 'important');
        menu.style.setProperty(
            'height',
            `${boundedPubHeight + input.offsetHeight + 10}px`,
            'important'
        );

        const chatMenu = document.getElementById('hs-chat-input-menu');
        const chatInput = document.getElementById(
            'hs-chat-input'
        ) as HTMLElement;
        if (chatMenu && chatInput) {
            const gearBtn = chatMenu.querySelector(
                '.hs-chat-input-menu__chat-settings-button'
            ) as HTMLElement;
            const gearW = gearBtn?.offsetWidth || 24;
            const nameW =
                (chatInput.previousElementSibling as HTMLElement)
                    ?.offsetWidth || 0;
            const slack = gearW + 16;
            const room = Math.min(boundedWidth - nameW - slack, 1125);
            chatInput.style.setProperty('max-width', room + 'px', 'important');
        }
    }

    private applyFilters(): void {
        if (!this.settings.enableFilters?.value) return;

        this.active.chat = this.settings.showChatFilter.value as boolean;
        this.active.private = this.settings.showPrivateFilter.value as boolean;
        this.active.global = this.settings.showGlobalFilter.value as boolean;
        this.active.local = this.settings.showLocalFilter.value as boolean;
        this.active.status = this.settings.showStatusFilter.value as boolean;

        const sections = [
            {
                selector: '#hs-public-message-list__container',
                show: this.active.chat,
            },
            { selector: '#hs-private-message-list', show: this.active.private },
        ];

        sections.forEach(({ selector, show }) => {
            const element = document.querySelector(selector) as HTMLElement;
            if (element) {
                element.style.display = show ? '' : 'none';
                if (show) {
                    element.scrollTo(0, 1e9);
                }
            }
        });

        this.scanAllMessages();
    }

    private setupStyleObserver(): void {
        const chatContainer = document.getElementById(
            'hs-chat-menu-section-container'
        );
        if (chatContainer) {
            this.trackObserver(
                () => {
                    this.throttledApplyStyles();
                },
                chatContainer,
                { childList: true, subtree: true }
            );
        }
    }

    private styleApplyTimeout: number | null = null;
    private throttledApplyStyles(): void {
        if (this.styleApplyTimeout) return;

        this.styleApplyTimeout = window.setTimeout(() => {
            this.applyStyles();
            this.styleApplyTimeout = null;
        }, 100);
    }

    private resetChatSize(): void {
        const pub = document.querySelector(
            '#hs-public-message-list__container'
        ) as HTMLElement;
        const pm = document.querySelector(
            '#hs-private-message-list'
        ) as HTMLElement;
        const menu = document.querySelector('#hs-chat-menu') as HTMLElement;

        if (pub) {
            pub.style.cssText = '';
        }
        if (pm) {
            pm.style.cssText = '';
        }
        if (menu) {
            menu.style.cssText = '';
        }
    }

    private setupSettingsMenuObserver(): void {
        this.trackObserver(
            records => {
                records.forEach(record => {
                    record.addedNodes.forEach(node => {
                        if (
                            node instanceof HTMLElement &&
                            node.id === 'hs-chat-settings-menu'
                        ) {
                            this.injectIntoSettingsMenu(node);
                        }
                    });
                });
            },
            document.body,
            { childList: true, subtree: true }
        );
    }

    private injectIntoSettingsMenu(menu: HTMLElement): void {
        if (
            menu.dataset.filtersInjected ||
            !this.settings.enableFilters?.value ||
            !this.settings.enable?.value ||
            !this.isInitialized
        )
            return;

        menu.dataset.filtersInjected = 'true';
        menu.style.position = 'relative';
        menu.style.overflow = 'visible';

        const contentContainer = menu.querySelector(
            '#hs-chat-settings-menu__content-container'
        ) as HTMLElement;
        if (contentContainer) {
            contentContainer.style.setProperty(
                'overflow',
                'visible',
                'important'
            );
        }

        const controlsBox = document.createElement('div');
        controlsBox.style.cssText =
            'position:absolute; left:70%; top:50%; transform:translateY(-50%); display:flex; align-items:center; gap:10px; z-index:1001; pointer-events:none;';

        const filterButtonBox = document.createElement('div');
        filterButtonBox.style.cssText =
            'display:flex; flex-direction:column; gap:6px; pointer-events:auto;';

        const opacityControlContainer = document.createElement('div');
        opacityControlContainer.style.cssText =
            'display:flex; align-items:center; gap:8px; background:black; padding:5px; border-radius:4px; pointer-events:auto;';

        let opacityToggleButton: HTMLElement, opacitySlider: HTMLInputElement;

        const updateOpacityUI = () => {
            if (!opacityToggleButton || !opacitySlider) return;
            if (this.active.opacityEnabled) {
                opacityToggleButton.style.outline = '2px solid deepskyblue';
                opacitySlider.style.display = 'inline-block';
            } else {
                opacityToggleButton.style.outline = 'none';
                opacitySlider.style.display = 'none';
            }
            this.applyStyles();
        };

        this.FILTERS.forEach(cfg => {
            if (cfg.key === 'opacity') {
                opacityToggleButton = document.createElement('div');
                opacityToggleButton.textContent = cfg.icon;
                opacityToggleButton.style.cssText =
                    'font-size:16px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:white;border-radius:4px;cursor:pointer;';

                opacitySlider = document.createElement('input');
                opacitySlider.type = 'range';
                opacitySlider.min = '0.1';
                opacitySlider.max = '1.0';
                opacitySlider.step = '0.05';
                opacitySlider.value = this.active.opacityValue.toString();
                opacitySlider.style.width = '80px';

                document.highlite.managers.UIManager.bindOnClickBlockHsMask(
                    opacityToggleButton,
                    () => {
                        this.active.opacityEnabled =
                            !this.active.opacityEnabled;
                        this.prevOpacityEnabled = this.active.opacityEnabled;
                        this.settings.opacityEnabled.value =
                            this.active.opacityEnabled;
                        updateOpacityUI();
                        document.highlite.managers.SettingsManager.updatePluginSettingsUI(
                            this
                        );
                    }
                );

                this.trackListener(opacitySlider, 'input', () => {
                    this.active.opacityValue = parseFloat(opacitySlider.value);
                    this.settings.opacityValue.value =
                        this.active.opacityValue * 100;
                    this.applyStyles();
                    document.highlite.managers.SettingsManager.updatePluginSettingsUI(
                        this
                    );
                });

                opacityControlContainer.append(
                    opacityToggleButton,
                    opacitySlider
                );
                this.trackInjected(opacityToggleButton);
                this.trackInjected(opacitySlider);
            } else {
                const button = document.createElement('div');
                button.textContent = cfg.icon;
                button.dataset.key = cfg.key;
                button.style.cssText =
                    'font-size:16px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:black;color:white;border-radius:4px;cursor:pointer;outline:2px solid deepskyblue;';

                if (!this.active[cfg.key as keyof typeof this.active]) {
                    button.style.outline = 'none';
                }

                document.highlite.managers.UIManager.bindOnClickBlockHsMask(
                    button,
                    () => {
                        const key = cfg.key as keyof typeof this.active;
                        (this.active as any)[key] = !(this.active as any)[key];
                        button.style.outline = (this.active as any)[key]
                            ? '2px solid deepskyblue'
                            : 'none';

                        if (key === 'chat')
                            this.settings.showChatFilter.value =
                                this.active.chat;
                        if (key === 'private')
                            this.settings.showPrivateFilter.value =
                                this.active.private;
                        if (key === 'global')
                            this.settings.showGlobalFilter.value =
                                this.active.global;
                        if (key === 'local')
                            this.settings.showLocalFilter.value =
                                this.active.local;
                        if (key === 'status')
                            this.settings.showStatusFilter.value =
                                this.active.status;

                        document.highlite.managers.SettingsManager.updatePluginSettingsUI(
                            this
                        );

                        const sections =
                            cfg.sections || (cfg.section ? [cfg.section] : []);
                        if (sections.length) {
                            sections.forEach(selector => {
                                document
                                    .querySelectorAll(selector)
                                    .forEach(el => {
                                        (el as HTMLElement).style.display = (
                                            this.active as any
                                        )[key]
                                            ? ''
                                            : 'none';
                                    });
                            });
                            if ((this.active as any)[key]) {
                                sections.forEach(selector => {
                                    const element =
                                        document.querySelector(selector);
                                    if (element) {
                                        element.scrollTo(0, 1e9);
                                    }
                                });
                            }
                        } else if (cfg.className) {
                            document
                                .querySelectorAll(
                                    '#hs-public-message-list__container .hs-chat-message-container'
                                )
                                .forEach(msg => {
                                    if (
                                        (msg as HTMLElement).querySelector(
                                            `.${cfg.className}`
                                        )
                                    ) {
                                        (msg as HTMLElement).style.display = (
                                            this.active as any
                                        )[key]
                                            ? ''
                                            : 'none';
                                    }
                                });
                        }

                        if (cfg.key === 'chat') {
                            if (this.active.chat) {
                                this.active.opacityEnabled =
                                    this.prevOpacityEnabled;
                            } else {
                                this.prevOpacityEnabled =
                                    this.active.opacityEnabled;
                                this.active.opacityEnabled = false;
                            }
                            this.settings.opacityEnabled.value =
                                this.active.opacityEnabled;
                            updateOpacityUI();
                            document.highlite.managers.SettingsManager.updatePluginSettingsUI(
                                this
                            );
                        }
                    }
                );

                filterButtonBox.append(button);
                this.trackInjected(button);
            }
        });

        controlsBox.append(filterButtonBox, opacityControlContainer);
        menu.append(controlsBox);
        this.trackInjected(controlsBox);
        updateOpacityUI();
    }

    private setupMessageWatching(): void {
        if (this.messageWatchersSetup) return;
        this.messageWatchersSetup = true;

        this.scanAllMessages();

        const watchPairs = [
            ['#hs-public-message-list', '#hs-public-message-list__container'],
            ['#hs-private-message-list', '#hs-private-message-list'],
        ];

        watchPairs.forEach(([listSel, wrapSel]) => {
            const list = document.querySelector(listSel);
            const wrap = document.querySelector(wrapSel) as HTMLElement;
            if (list && wrap) {
                this.trackObserver(
                    records => {
                        records.forEach(record => {
                            if (record.addedNodes.length) {
                                setTimeout(() => this.scanAllMessages(), 10);
                            }
                            if (record.removedNodes.length) {
                                this.cleanupRemovedMessages(
                                    record.removedNodes
                                );
                            }
                        });
                    },
                    list,
                    { childList: true, subtree: true }
                );
            }
        });

        this.messageCheckInterval = window.setInterval(() => {
            this.scanAllMessages();
        }, 2000);
    }

    private scanAllMessages(): void {
        if (!this.settings.enable?.value || !this.isInitialized) return;

        const containers = [
            document.querySelector('#hs-public-message-list__container'),
            document.querySelector('#hs-private-message-list'),
        ];

        containers.forEach(container => {
            if (container) {
                this.processNewMessages(container as HTMLElement);
            }
        });
    }

    private processNewMessages(container: HTMLElement): void {
        if (!container) return;
        if (!this.settings.enable?.value || !this.isInitialized) return;

        const messages = container.querySelectorAll(
            '.hs-chat-message-container'
        );
        let foundNewMessages = false;

        messages.forEach(msg => {
            const msgEl = msg as HTMLElement;

            if (this.processedMessages.has(msgEl)) return;

            foundNewMessages = true;
            this.processedMessages.add(msgEl);

            // Extended block list handling
            const playerNameContainer = msgEl.querySelector(
                '.hs-chat-menu__player-name'
            ); 
            const playerName = `${playerNameContainer?.textContent}`.replace("From ", "").replace(":", "").trim();
            if((this.settings.extendedBlockList.value as string).split(',').some((name) => playerName && name.toUpperCase() === playerName?.toUpperCase())) {
                msgEl.style.display = 'none';
                this.log("Blocking message from " + playerName);
            }

            if (
                !msgEl.dataset.toggleInjected &&
                this.settings.collapsibleMessages?.value
            ) {
                msgEl.dataset.toggleInjected = 'true';
                const span = document.createElement('span');
                span.textContent = '[–]';
                span.style.cssText =
                    'margin-right:6px;cursor:pointer;color:gray;font-size:12px';

                document.highlite.managers.UIManager.bindOnClickBlockHsMask(
                    span,
                    () => {
                        const hidden = msgEl.style.display === 'none';
                        msgEl.style.display = hidden ? '' : 'none';
                        span.textContent = hidden ? '[–]' : '[+]';
                    }
                );

                const textContainer = msgEl.querySelector(
                    '.hs-chat-menu__message-text-container'
                );
                if (textContainer) {
                    span.setAttribute('data-chat-enhancer-injected', 'true');
                    textContainer.prepend(span);
                    this.trackInjected(span);
                }
            }

            if (this.settings.enableFilters?.value) {
                this.FILTERS.forEach(filter => {
                    if (
                        !filter.section &&
                        filter.key !== 'opacity' &&
                        !this.active[filter.key as keyof typeof this.active]
                    ) {
                        if (
                            filter.className &&
                            msgEl.querySelector(`.${filter.className}`)
                        ) {
                            msgEl.style.display = 'none';
                        }
                    }
                });
            }
        });

        if (foundNewMessages) {
            this.cleanupProcessedMessages();
        }
    }

    private cleanupProcessedMessages(): void {
        this.processedMessages.forEach(msgEl => {
            if (!document.contains(msgEl)) {
                this.processedMessages.delete(msgEl);
            }
        });
    }

    private cleanupRemovedMessages(removedNodes: NodeList): void {
        removedNodes.forEach(node => {
            if (node instanceof HTMLElement) {
                const injectedElements = node.querySelectorAll(
                    '[data-chat-enhancer-injected]'
                );
                injectedElements.forEach(el => {
                    const index = this.injectedEls.indexOf(el as HTMLElement);
                    if (index > -1) {
                        this.injectedEls.splice(index, 1);
                    }
                });
            }
        });
    }

    private setupResizers(): void {
        if (!this.settings.enable?.value || !this.isInitialized) return;

        const pub = document.querySelector(
            '#hs-public-message-list__container'
        ) as HTMLElement;
        const pm = document.querySelector(
            '#hs-private-message-list'
        ) as HTMLElement;
        const menu = document.querySelector('#hs-chat-menu') as HTMLElement;
        const input = document.querySelector(
            '#hs-chat-input-menu'
        ) as HTMLElement;

        if (!pub || !pm || !menu || !input) return;

        const blocker = document.createElement('div');
        blocker.style.cssText =
            'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9998;display:none;';

        ['mousedown', 'click', 'pointerdown'].forEach(ev => {
            this.trackListener(
                blocker,
                ev,
                (e: Event) => {
                    e.stopPropagation();
                    e.preventDefault();
                },
                true
            );
        });

        document.body.append(blocker);
        this.trackInjected(blocker);

        this.makeVerticalGrip(
            pub,
            (height: number) => {
                pub.style.height = height + 'px';
                menu.style.height = height + input.offsetHeight + 10 + 'px';
                this.settings.publicChatHeight.value = height;
                document.highlite.managers.SettingsManager.updatePluginSettingsUI(
                    this
                );
            },
            blocker
        );

        this.makeVerticalGrip(
            pm,
            (height: number) => {
                pm.style.height = height + 'px';
                this.settings.privateChatHeight.value = height;
                document.highlite.managers.SettingsManager.updatePluginSettingsUI(
                    this
                );
            },
            blocker
        );

        menu.style.position = 'relative';
        const widthGrip = document.createElement('div');
        widthGrip.style.cssText =
            'position:absolute;top:0;right:0;width:10px;height:100%;cursor:ew-resize;z-index:999;';

        this.trackListener(widthGrip, 'mouseenter', () => {
            widthGrip.style.background = 'rgba(255,255,255,0.2)';
        });
        this.trackListener(widthGrip, 'mouseleave', () => {
            widthGrip.style.background = 'transparent';
        });

        menu.append(widthGrip);
        this.trackInjected(widthGrip);

        const adjustInputWidth = () => {
            const chatMenu = document.getElementById('hs-chat-input-menu');
            const chatInput = document.getElementById(
                'hs-chat-input'
            ) as HTMLElement;
            if (!chatMenu || !chatInput) return;

            const gearBtn = chatMenu.querySelector(
                '.hs-chat-input-menu__chat-settings-button'
            ) as HTMLElement;
            const gearW = gearBtn?.offsetWidth || 24;
            const nameW =
                (chatInput.previousElementSibling as HTMLElement)
                    ?.offsetWidth || 0;
            const slack = gearW + 16;
            const room = Math.min(menu.offsetWidth - nameW - slack, 1125);
            chatInput.style.setProperty('max-width', room + 'px', 'important');
        };

        adjustInputWidth();

        let resizingWidth = false;
        let startX = 0;
        let startWidth = 0;

        this.trackListener(widthGrip, 'mousedown', e => {
            const mouseEvent = e as MouseEvent;
            resizingWidth = true;
            startX = mouseEvent.clientX;
            startWidth = menu.offsetWidth;
            blocker.style.cursor = 'ew-resize';
            blocker.style.display = 'block';
            e.preventDefault();
            e.stopPropagation();
        });

        this.trackListener(document, 'mousemove', e => {
            if (!resizingWidth) return;
            const mouseEvent = e as MouseEvent;
            const newWidth = Math.min(
                Math.max(
                    startWidth + (mouseEvent.clientX - startX),
                    this.CONFIG.MIN_W
                ),
                this.CONFIG.MAX_W
            );
            menu.style.width = newWidth + 'px';
            adjustInputWidth();
            this.settings.chatWidth.value = newWidth;
            document.highlite.managers.SettingsManager.updatePluginSettingsUI(
                this
            );
        });

        this.trackListener(document, 'mouseup', () => {
            if (resizingWidth) {
                resizingWidth = false;
                blocker.style.display = 'none';
            }
        });
    }

    private makeVerticalGrip(
        container: HTMLElement,
        onResize: (height: number) => void,
        blocker: HTMLElement
    ): void {
        container.style.position = 'relative';
        const grip = document.createElement('div');
        grip.style.cssText =
            'position:sticky;top:0;left:0;width:100%;height:10px;cursor:ns-resize;z-index:999;background:transparent;';

        this.trackListener(grip, 'mouseenter', () => {
            grip.style.background = 'rgba(255,255,255,0.2)';
        });
        this.trackListener(grip, 'mouseleave', () => {
            grip.style.background = 'transparent';
        });

        container.prepend(grip);
        this.trackInjected(grip);

        let resizing = false;
        let startY = 0;
        let startHeight = 0;

        this.trackListener(grip, 'mousedown', (e: Event) => {
            const mouseEvent = e as MouseEvent;
            resizing = true;
            startY = mouseEvent.clientY;
            startHeight = container.offsetHeight;
            blocker.style.cursor = 'ns-resize';
            blocker.style.display = 'block';
            e.preventDefault();
            e.stopPropagation();
        });

        this.trackListener(document, 'mousemove', (e: Event) => {
            if (!resizing) return;
            const mouseEvent = e as MouseEvent;
            const newHeight = Math.min(
                Math.max(
                    startHeight - (mouseEvent.clientY - startY),
                    this.CONFIG.MIN_H
                ),
                this.CONFIG.MAX_H
            );
            onResize(newHeight);
        });

        this.trackListener(document, 'mouseup', () => {
            if (resizing) {
                resizing = false;
                blocker.style.display = 'none';
            }
        });
    }

    private cleanup(): void {
        this.log('Cleaning up ChatEnhancer...');

        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];

        this.listeners.forEach(({ el, type, handler, opts }) => {
            el.removeEventListener(type, handler, opts);
        });
        this.listeners = [];

        this.injectedEls.forEach(el => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
        this.injectedEls = [];

        this.resetChatSize();

        if (this.styleApplyTimeout) {
            window.clearTimeout(this.styleApplyTimeout);
            this.styleApplyTimeout = null;
        }
        if (this.messageCheckInterval) {
            window.clearInterval(this.messageCheckInterval);
            this.messageCheckInterval = null;
        }

        this.processedMessages.clear();

        this.isInitialized = false;
        this.messageWatchersSetup = false;
        this.log('ChatEnhancer cleanup complete');
    }
}
