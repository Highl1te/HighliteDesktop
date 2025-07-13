import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';

export class PacketQueue extends Plugin {
    pluginName = 'Packet Queue';
    author = 'JayArrowz';

    private packetQueue: any[] = [];
    private intervalId: NodeJS.Timeout | null = null;
    private originalEmitPacket: Function | null = null;
    private socketManager: any = null;
    private isProcessing: boolean = false;
    private isLoggedIn: boolean = false;
    private lastSentTime: number = 0;

    constructor() {
        super();

        this.settings.packetInterval = {
            text: 'Packet Interval (ms)',
            type: SettingsTypes.range,
            value: 600,
            validation: (value: string | number | boolean) => {
                const numValue = value as number;
                return numValue >= 100 && numValue <= 1000;
            },
            callback: () => {
                this.updateInterval();
            },
        } as any;
    }

    private get PACKET_INTERVAL_MS(): number {
        return (this.settings.packetInterval?.value as number) || 600;
    }

    private updateInterval(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(() => {
                this.processQueue();
            }, this.PACKET_INTERVAL_MS);
            this.log(`Updated packet interval to ${this.PACKET_INTERVAL_MS}ms`);
        }
    }

    init(): void {
        this.log('Initialized');
    }

    start(): void {
        if (!this.settings.enable.value) {
            return;
        }

        try {
            this.socketManager = (
                document as any
            ).highlite.gameHooks.SocketManager.Instance;

            if (!this.socketManager) {
                this.error('Socket manager not found');
                return;
            }

            this.originalEmitPacket = this.socketManager.emitPacket.bind(
                this.socketManager
            );
            this.socketManager.emitPacket = this.queuePacket.bind(this);

            this.intervalId = setInterval(() => {
                this.processQueue();
            }, this.PACKET_INTERVAL_MS);

            this.log(
                `Started - Packet queuing active (${this.PACKET_INTERVAL_MS}ms intervals)`
            );
        } catch (error) {
            this.error('Failed to start packet queuing: ' + error);
        }
    }

    stop(): void {
        try {
            if (this.originalEmitPacket && this.socketManager) {
                this.socketManager.emitPacket = this.originalEmitPacket;
                this.originalEmitPacket = null;
            }

            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }

            this.flushQueue();

            this.packetQueue = [];
            this.socketManager = null;
            this.isProcessing = false;
            this.lastSentTime = 0;

            this.log('Stopped - Packet queuing disabled');
        } catch (error) {
            this.error('Error stopping packet queuing: ' + error);
        }
    }

    SocketManager_loggedIn(): void {
        this.log('Player logged in - resetting packet queue state');

        this.packetQueue = [];
        this.isProcessing = false;
        this.isLoggedIn = true;
        this.lastSentTime = 0;

        this.log('Packet queue state reset for new session');
    }

    SocketManager_handleLoggedOut(): void {
        this.log('Player logged out - cleaning up packet queue');

        this.flushQueue();

        this.packetQueue = [];
        this.isProcessing = false;
        this.isLoggedIn = false;
        this.lastSentTime = 0;

        this.log('Packet queue cleanup complete');
    }

    private queuePacket(packet: any): void {
        if (!packet) {
            return;
        }

        if (!this.isLoggedIn) {
            if (this.originalEmitPacket) {
                this.originalEmitPacket(packet);
            }
            return;
        }

        const currentTime = Date.now();
        const timeSinceLastSent = currentTime - this.lastSentTime;

        if (
            this.packetQueue.length === 0 &&
            timeSinceLastSent >= this.PACKET_INTERVAL_MS
        ) {
            this.sendPacketNow(packet);
            return;
        }

        // Handle walk packets (10) and walk-to-object packets (43) specially
        // Only keep the latest one, remove any existing ones of the same type
        const packetName = packet._name || packet.name;
        if (packetName === 10 || packetName === 43) {
            // Remove any existing packets with the same name
            this.packetQueue = this.packetQueue.filter(queuedPacket => {
                const queuedPacketName =
                    queuedPacket._name || queuedPacket.name;
                return queuedPacketName !== packetName;
            });
        }

        this.packetQueue.push(packet);
    }

    private sendPacketNow(packet: any): void {
        if (!this.originalEmitPacket) {
            return;
        }

        try {
            this.originalEmitPacket(packet);
            this.lastSentTime = Date.now();
            this.log(`Sent packet immediately: ${packet.StrName || 'Unknown'}`);
        } catch (error) {
            this.error(`Error sending packet immediately: ${error}`);
        }
    }

    private processQueue(): void {
        if (
            this.isProcessing ||
            this.packetQueue.length === 0 ||
            !this.originalEmitPacket ||
            !this.isLoggedIn
        ) {
            return;
        }

        const currentTime = Date.now();
        const timeSinceLastSent = currentTime - this.lastSentTime;

        if (timeSinceLastSent < this.PACKET_INTERVAL_MS) {
            return;
        }

        this.isProcessing = true;

        try {
            const packet = this.packetQueue.shift();
            if (packet) {
                this.originalEmitPacket(packet);
                this.lastSentTime = currentTime;
            }
        } catch (error) {
            this.error(`Error sending queued packet: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }

    private flushQueue(): void {
        if (!this.originalEmitPacket) {
            return;
        }

        while (this.packetQueue.length > 0) {
            try {
                const packet = this.packetQueue.shift();
                if (packet) {
                    this.originalEmitPacket(packet);
                }
            } catch (error) {
                this.error(`Error flushing packet: ${error}`);
            }
        }

        if (this.packetQueue.length === 0) {
            this.lastSentTime = Date.now();
        }
    }

    getQueueStatus(): {
        size: number;
        isProcessing: boolean;
        isLoggedIn: boolean;
        lastSentTime: number;
        timeSinceLastSent: number;
        interval: number;
    } {
        return {
            size: this.packetQueue.length,
            isProcessing: this.isProcessing,
            isLoggedIn: this.isLoggedIn,
            lastSentTime: this.lastSentTime,
            timeSinceLastSent: Date.now() - this.lastSentTime,
            interval: this.PACKET_INTERVAL_MS,
        };
    }
}
