declare global {
    interface Window {
        [key: string]: any;
    }

    interface Document {
        highlite: {
            [key: string]: any;
        };

        client: {
            [key: string]: any;
        };

        game: {
            [key: string]: any;
        };
    }
}
