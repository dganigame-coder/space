// audio.js

/*   10-05-2026 22:17         */
// 1. IMPORTANT: We do not use global Tone nodes here.
let gasFilter, gasVolume, gasWind;
let solarFilter, solarVolume, solarSizzle;
let alarmSynth, impactNoise, impactThump;

export async function loadSoundLibrary() {
    // 2. Check if we need to set the context (Modern Tone.js fix)
    if (Tone.getContext().state !== 'running') {
        await Tone.start();
    }

    // 3. Initialize nodes ONLY inside this function
    if (!gasVolume) {
        // We create the nodes here. Tone will now associate them 
        // with the 'active' user-gestured context.
        gasVolume = new Tone.Volume(-Infinity).toDestination();
        gasWind = new Tone.Noise("brown").connect(gasVolume);
        
        solarVolume = new Tone.Volume(-Infinity).toDestination();
        solarSizzle = new Tone.Noise("white").connect(solarVolume);
        
        alarmSynth = new Tone.PolySynth(Tone.Synth).toDestination();
        
        impactNoise = new Tone.Noise("pink").toDestination();
        impactThump = new Tone.MembraneSynth().toDestination();

        // 1. ASTEROID BELT: Gritty "Brown" noise for debris
        beltVolume = new Tone.Volume(-Infinity).toDestination();
        beltGranular = new Tone.Noise("brown").connect(beltVolume);
        
        // 2. WORMHOLE: A "Metal" drone with a pulsing filter
        anomalyVolume = new Tone.Volume(-Infinity).toDestination();
        const phaser = new Tone.Phaser({ frequency: 0.5, octaves: 5 }).connect(anomalyVolume);
        anomalyDrone = new Tone.Oscillator(110, "sawtooth").connect(phaser);

        // 3. BLACK HOLE: A crushing sub-bass hum
        voidVolume = new Tone.Volume(-Infinity).toDestination();
        voidHum = new Tone.FatOscillator(40, "sine", 40).connect(voidVolume);
    }

    await Tone.context.resume();
    // Start oscillators but keep volume at -Infinity

    gasWind.start();
    solarSizzle.start();
    beltGranular.start();
    anomalyDrone.start();
    voidHum.start();
    
    console.log("Audio System State:", Tone.context.state); 
}

export function playHighFi(key, intensity = 0.5) {
    if (!gasVolume || Tone.context.state !== 'running') return;

    const now = Tone.now();
    switch(key) {
        case 'ASTEROID_BELT':
            // Gritty rumble as asteroids pass by
            beltVolume.volume.setTargetAtTime(Tone.gainToDb(intensity * 0.4), now, 0.5);
            break;
        case 'WORMHOLE_PULSE':
            // Resonant shimmering sound
            anomalyVolume.volume.setTargetAtTime(Tone.gainToDb(intensity), now, 0.3);
            break;
        case 'VOID_GRAVITY':
            // Heavy sub-bass that feels like pressure
            voidVolume.volume.setTargetAtTime(Tone.gainToDb(intensity), now, 0.8);
            break;
        case 'SILENCE':
            // Instant cut for the singularity
            [gasVolume, beltVolume, anomalyVolume, voidVolume].forEach(v => {
                v.volume.rampTo(-Infinity, 0.1);
            });
            break;
        case 'GAS_RUSH':
            gasVolume.volume.setTargetAtTime(Tone.gainToDb(intensity), now, 0.2);
            break;
        case 'COCKPIT_ALARM':
            alarmSynth.triggerAttackRelease(["C5", "E5"], "8n", now);
            break;
        case 'HULL_IMPACT':
            impactNoise.start(now).stop(now + 0.1);
            impactThump.triggerAttackRelease("G1", "4n", now);
            break;
        case 'SOLAR_STATIC':
            solarVolume.volume.setTargetAtTime(Tone.gainToDb(intensity * 0.3), now, 0.1);
            break;
    }
}
