// nasaService.js - The Dedicated Communications Hub

const NASA_KEY = 'DEMO_KEY'; // Replace with your free key from api.nasa.gov

export const NasaService = {
    // Storage cache for retrieved data
    telemetry: {
        imagery: null,
        solarStorms: null,
        asteroids: null
    },

    // The single activation function to download everything
    async activateFeeds() {
        console.log("🛰️ Connecting to NASA data streams...");

        const endpoints = {
            apod: `https://api.nasa.gov/planetary/apod?api_key=${NASA_KEY}`,
            cme: `https://api.nasa.gov/DONKI/CME?api_key=${NASA_KEY}`,
            neo: `https://api.nasa.gov/neo/rest/v1/feed/today?api_key=${NASA_KEY}`
        };

        try {
            // Fetch everything at once in parallel
            const [apodRes, cmeRes, neoRes] = await Promise.allSettled([
                fetch(endpoints.apod).then(r => r.json()),
                fetch(endpoints.cme).then(r => r.json()),
                fetch(endpoints.neo).then(r => r.json())
            ]);

            // Save the successful results to our telemetry cache
            this.telemetry.imagery = apodRes.status === "fulfilled" ? apodRes.value : null;
            this.telemetry.solarStorms = cmeRes.status === "fulfilled" ? cmeRes.value : null;
            this.telemetry.asteroids = neoRes.status === "fulfilled" ? neoRes.value : null;

            console.log("🛰️ NASA Feeds successfully synced!", this.telemetry);
            return this.telemetry;

        } catch (error) {
            console.error("⚠️ NASA Network error. Running on offline data arrays.", error);
            return null;
        }
    },

    // Quick helper to see if the Sun has active solar flares right now
    isSunActive() {
        return this.telemetry.solarStorms && this.telemetry.solarStorms.length > 0;
    }
};
