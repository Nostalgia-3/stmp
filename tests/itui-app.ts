export interface ItuiApp {
    /**
     * Called when the application starts
     */
    start?(): void;

    /**
     * Called when a key is pressed
     */
    keypress?(): void;
}

export abstract class ItuiApp {
    constructor() {

    }

    initialize() {
        return;
    }
}