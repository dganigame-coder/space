export const SaveSystem = {
    // Save current state including Velocity (if your engine uses it)
    save: (camera, currentVelocity = 0) => {
        const flightData = {
            pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            rot: { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z },
            velocity: currentVelocity,
            time: new Date().toLocaleString()
        };
        
        localStorage.setItem('deep_space_flight_log', JSON.stringify(flightData));
        console.log("%c💾 Flight Log Updated: Coordinates secured.", "color: #00ffff; font-weight: bold;");
    },

    // Load saved state
    load: (camera) => {
        const data = localStorage.getItem('deep_space_flight_log');
        if (!data) return null; // Return null so index.html knows to start at Earth

        const saved = JSON.parse(data);
        
        // 1. Restore Position & Rotation
        camera.position.set(saved.pos.x, saved.pos.y, saved.pos.z);
        camera.rotation.set(saved.rot.x, saved.rot.y, saved.rot.z);
        
        // 2. CRITICAL: Force the camera to calculate its new view immediately
        camera.updateMatrixWorld();
        
        console.log(`%c🛰️ Resuming flight from: ${saved.time}`, "color: #00ff00;");
        
        return saved; // Return the whole object so we can use the saved velocity
    },

    // Delete save (Reset mission)
    clear: () => {
        if(confirm("⚠️ This will teleport you back to Earth. Are you sure?")) {
            localStorage.removeItem('deep_space_flight_log');
            location.reload(); 
        }
    }
};
