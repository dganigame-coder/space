import * as Tone from 'tone';

export let gasVolume, voidVolume, beltVolume, solarVolume, anomalyVolume;
let gasWind, solarSizzle, beltGranular, anomalyDrone, voidHum,hullRainVolume,hullRainFilter,hullRainNoise,hullRainModulator;
let alarmSynth, impactNoise, impactThump;

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

        /*
        beltVolume.volume.setTargetAtTime(-100, now, 0.4); // Smooth 0.4s fade out
        hullRainVolume.volume.setTargetAtTime(-100, now, 0.4);
        beltVolume = new T.Volume(-100).toDestination();
        beltGranular = new T.Noise("brown").connect(beltVolume);
        beltVolume.volume.setTargetAtTime(-100, now, 0.4); // Smooth 0.4s fade out
        hullRainVolume.volume.setTargetAtTime(-100, now, 0.4);
        */
        // --- INITIALIZATION (Put this with your other global variables/setup) ---
        beltVolume = new T.Volume(-100).toDestination();
        beltGranular = new T.Noise("brown").connect(beltVolume);
        
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
    // Start the generators right away
    beltGranular.start();
    hullRainNoise.start();
    hullRainModulator.start();
    anomalyDrone.start(); 
    voidHum.start();      
    
    console.log("Audio System State:", T.context.state);

    beltVolume.volume.setTargetAtTime(-100, now, 0.4); 
    hullRainVolume.volume.setTargetAtTime(-100, now, 0.4);

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
        case 'ASTEROID_BELT':
            // If we are actually in the belt, override the fade out and turn them up!
            beltVolume.volume.setTargetAtTime(db - 10, now, 0.5);
            hullRainVolume.volume.setTargetAtTime(0, now, 0.3);
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
            [gasVolume, beltVolume, anomalyVolume, voidVolume, solarVolume].forEach(v => {
                if(v) v.volume.rampTo(-100, 0.5);
            });
            break;
    }
}
