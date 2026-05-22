import * as Tone from 'tone';

export let gasVolume, voidVolume, beltVolume, solarVolume, anomalyVolume, hullRainVolume;
let gasWind, solarSizzle, beltGranular, anomalyDrone, voidHum, hullRainFilter, hullRainNoise, hullRainModulator;


export async function loadSoundLibrary() {
    const T = Tone.default || Tone;

    if (T.getContext().state !== 'running') {
        await T.start();
    }
    
    if (!gasVolume) {
        gasVolume = new T.Volume(-40).toDestination();
        gasWind = new T.Noise("brown").connect(gasVolume);

        solarVolume = new T.Volume(-100).toDestination();
        solarSizzle = new T.Noise("white").connect(solarVolume);
        
        alarmSynth = new T.PolySynth(T.Synth).toDestination();
        
        impactNoise = new T.Noise("pink").toDestination();
        impactThump = new T.MembraneSynth().toDestination();

        // Find this existing block:
        beltVolume = new T.Volume(-100).toDestination();
        beltGranular = new T.Noise("brown").connect(beltVolume);
        
        // Add this EXACTLY right beneath it:
        hullRainVolume = new T.Volume(-100).toDestination();
        hullRainFilter = new T.Filter(800, "lowpass").connect(hullRainVolume); 
        hullRainNoise = new T.Noise("pink").connect(hullRainFilter);
        
        hullRainModulator = new T.LFO({
            type: "random",
            min: -25, 
            max: -5,  
            frequency: 4 
        }).connect(hullRainVolume.volume);
        
        anomalyVolume = new T.Volume(-100).toDestination();
        const phaser = new T.Phaser({ frequency: 0.5, octaves: 5 }).connect(anomalyVolume);
        anomalyDrone = new T.Oscillator(110, "sawtooth").connect(phaser);

        voidVolume = new T.Volume(-100).toDestination();
        voidHum = new T.FatOscillator(40, "sine", 40).connect(voidVolume);
    }

    await T.context.resume();

    gasWind.start();
    solarSizzle.start();
    // Find these existing start triggers:
    beltGranular.start(); 
    anomalyDrone.start(); 
    voidHum.start();      
    
    // Add these right below them:
    hullRainNoise.start();
    hullRainModulator.start();
         
    console.log("Audio System State:", T.context.state);

    gasVolume.volume.setValueAtTime(-60, T.now()); 
    T.Destination.mute = false;
    T.Destination.volume.value = 0;
}

export function playHighFi(key, intensity = 0.5) {
    const T = Tone.default || Tone; 
    if (!gasVolume || T.context.state !== 'running') return;

    const now = T.now();
    const db = T.gainToDb(Math.max(intensity, 0.0001));

    switch(key) {
        // Replace it completely with these two cases:
        case 'ASTEROID_BELT':
            beltVolume.volume.setTargetAtTime(db - 10, now, 0.5); // Deep rumble
            hullRainVolume.volume.setTargetAtTime(0, now, 0.3);    // Automatic rock pitting
            break;
        
        case 'LEAVE_ASTEROID_BELT':
            beltVolume.volume.setTargetAtTime(-100, now, 0.4); 
            hullRainVolume.volume.setTargetAtTime(-100, now, 0.4);
            break;
        case 'WORMHOLE_PULSE':
            anomalyVolume.volume.setTargetAtTime(db, now, 0.3);
            break;
        case 'VOID_GRAVITY':
            voidVolume.volume.setTargetAtTime(db, now, 0.8);
            break;
        case 'GAS_RUSH':
            gasVolume.volume.setTargetAtTime(db, now, 0.2);
            break;
        case 'SOLAR_STATIC':
            solarVolume.volume.setTargetAtTime(db - 15, now, 0.1);
            break;
        case 'COCKPIT_ALARM':
            alarmSynth.triggerAttackRelease(["C5", "E5"], "8n", now);
            break;
        case 'HULL_IMPACT':
            // Plain audio crash sound for crashing into planets (NO VIBRATION)
            try {
                impactThump.triggerAttackRelease("G1", "4n", now, intensity);
            } catch (e) { console.warn(e); }
            break;
        case 'BELT_ROCK':
            // 👇 EXCLUSIVE TO ASTEROID BELT: Plays a lighter gravel sound + physical vibration
            try {
                impactThump.triggerAttackRelease("A1", "8n", now, intensity * 0.5);
            } catch (e) { console.warn(e); }

            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                const vibrationDuration = Math.floor(Math.random() * 25) + 15; 
                navigator.vibrate(vibrationDuration);
            }
            break;
         case 'SILENCE':
            [gasVolume, beltVolume, anomalyVolume, voidVolume, solarVolume, hullRainVolume].forEach(v => {
                // This safety check prevents the "Cannot read properties of undefined" error!
                if (v && v.volume) {
                    v.volume.rampTo(-100, 0.5);
                }
            });
            break;
    }
}
