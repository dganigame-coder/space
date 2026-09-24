// instructions.js

export const manualContent = `
    <div id="help-modal" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0, 15, 25, 0.95); border: 2px solid #00ffcc; color: #88ccff; padding: 30px; width: 450px; max-height: 80vh; overflow-y: auto; font-family: monospace; z-index: 1000; box-shadow: 0 0 20px rgba(0, 255, 204, 0.2);">
        
        <button id="close-help" style="position: absolute; top: 10px; right: 10px; background: transparent; color: #ff3300; border: 1px solid #ff3300; cursor: pointer; font-family: monospace;">[ X ]</button>
        
        <h2 style="color: #00ffcc; margin-top: 0; border-bottom: 1px solid #00ffcc; padding-bottom: 10px;">>> FLIGHT OPERATIONS MANUAL</h2>
        
        <h3 style="color: #00ffcc;">1. DESKTOP CONTROLS</h3>
        <p><b>[ W ] / [ S ]</b> : Main Engines (Hold to thrust/brake)</p>
        <p><b>[ A ] / [ D ]</b> : Yaw (Left/Right)</p>
        <p><b>[ ↑ ] / [ ↓ ]</b> : Pitch (Up/Down)</p>
        <p><b>[ SPACEBAR ]</b> : Nitro Boost (Massive acceleration spike)</p>
        <p><b>[ SHIFT ]</b> : Warp Drive (Hold with thrust for 10x Speed)</p>
        
        <h3 style="color: #00ffcc;">2. MOBILE CONTROLS</h3>
        <p><b>Left Screen:</b> Drag thumb to steer (Pitch & Yaw).</p>
        <p><b>Right Screen:</b> Drag up to accelerate, down to reverse.</p>
        
        <h3 style="color: #00ffcc;">3. HUD TELEMETRY & INTEL</h3>
        <p><b>Scanning:</b> Fly within 50 units of any planet, star, or anomaly to automatically download its local intel data.</p>
        <p><b>Safety Protocol:</b> The ship's collision-avoidance system will automatically brake and stabilize your orbit if you impact a solid surface.</p>

        <h3 style="color: #00ffcc;">4. AUTOPILOT NAVIGATION</h3>
        <p>Space is vast (1:1000 scale). Flying manually between star systems can take hours. Use the <b>Autopilot Dropdown Menu</b> in the top right of your screen to instantly initiate a hyperspace jump to known coordinates like the Voyager 1 probe or the Rigel System.</p>
    </div>
`;
