export class SoundManager {
    private static instance: SoundManager;

    currentlyPlaying: {
        [key: string]: HTMLAudioElement;
    } = {};

    constructor() {
        if (SoundManager.instance) {
            return SoundManager.instance;
        }
        SoundManager.instance = this;
        document.highlite.managers.SoundManager = this;
    }

    playSound(resource: string, volume: number = 1) {
        if (!this.currentlyPlaying[resource]) {
            const audio = this.createAudioElement(resource, volume);
            audio.play();
        }
    }

    createAudioElement(resource: string, volume: number = 1): HTMLAudioElement {
        const audio = new Audio(resource);
        audio.volume = volume;
        audio.play();
        audio.onended = () => {
            this.currentlyPlaying[resource]?.remove();
            delete this.currentlyPlaying[resource];
        };
        this.currentlyPlaying[resource] = audio;
        return audio;
    }
}
