import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';

export class AutoSprint extends Plugin {
    pluginName = 'AutoSprint';
    pluginDescription = 'Automatically turns on Run/Sprint mode on login';
    author = 'DarkIdol';

    // Tracking of the users logged in our out state
    private loggedIn = false;

    // Initialization
    init(): void {}

    // Startup function when enabled
    start(): void {
        // Run the toggle function
        this.toggleSprintState();
    }

    // Stopping function when disabled
    stop(): void {}

    // Login function when logged in
    SocketManager_loggedIn(): void {
        // Toggle logged in state
        this.isLoggedIn = true;

        // Run the toggle function
        this.toggleSprintState();
    }

    // Logged Out
    SocketManager_handleLoggedOut(): void {
        // Toggled logged out state
        this.isLoggedIn = false;
    }

    // Handle the sprint state toggling
    private toggleSprintState() {
        // Return if not enabled
        if (!this.settings.enable.value) return;

        // Only run if the user is already logged in
        if (this.isLoggedIn) {
            // Find the button (only if not already activated)
            const sprintDisabledButton = document.querySelector(
                'button.hs-button.hs-action-bar-button:not(.hs-action-bar-button--selected):has(.hs-action-bar-item__image--sprint)'
            );

            // If the sprint hasn't been toggled
            if (sprintDisabledButton) {
                // Click the toggle
                sprintDisabledButton.dispatchEvent(
                    new PointerEvent('pointerdown', {
                        bubbles: true,
                        cancelable: true,
                        pointerId: 1,
                        pointerType: 'mouse',
                        isPrimary: true,
                    })
                );

                console.log('Sprint has been successfully toggled on');
            }
        }
    }
}
