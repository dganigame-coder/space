import * as Tone from 'tone';
/*
export let gasVolume, voidVolume, beltVolume, solarVolume, anomalyVolume;
let gasWind, solarSizzle, beltGranular, anomalyDrone, voidHum;
let alarmSynth, impactNoise, impactThump;
*/
// 1. Clear, non-duplicated global exports
export let gasVolume, voidVolume, beltVolume, solarVolume, anomalyVolume, hullRainVolume;
// NEW: Fix missing exports for existing supernova/corona states
export let coronaVolume, explosionVolume, nebulaVolume; 

// NEW: Exports for custom config tags
export let debrisVolume, icyVolume, staticVolume, deepGravityVolume, pulsarVolume;

// NEW: Internal Synths
let debrisNoise, icyNoise, staticNoise, deepGravityOsc, pulsarSynth;

let gasWind, solarSizzle, beltGranular, anomalyDrone, voidHum;
let hullRainNoise, hullRainFilter, hullRainModulator, hullRainGain; // Added dedicated Gain node tracking
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
        beltVolume = new T.Volume(-100).toDestination();
        beltGranular = new T.Noise("brown").connect(beltVolume);
        */
        
        /*   */
        // ☄️ FIXED ASTEROID BELT AUDIO CHAIN
        beltVolume = new T.Volume(-100).toDestination();
        beltGranular = new T.Noise("brown").connect(beltVolume);
        
        hullRainVolume = new T.Volume(-100).toDestination();
        hullRainFilter = new T.Filter(800, "lowpass").connect(hullRainVolume); 
        
        // Fix: Connect noise to an independent Gain node, NOT directly to the Volume param
        hullRainGain = new T.Gain(1).connect(hullRainFilter);
        hullRainNoise = new T.Noise("pink").connect(hullRainGain);

        /*makes sielence due to tone.js complex signal
        // Modulator safely controls the intermediate Gain node now
        hullRainModulator = new T.LFO({
            type: "random",
            min: 0.05, // Lower limit of the rock scratching intensity
            max: 0.6,  // Peak burst of the gravel hits
            frequency: 4 
        }).connect(hullRainGain.gain);
        */

        /*   */
        
        anomalyVolume = new T.Volume(-100).toDestination();
        const phaser = new T.Phaser({ frequency: 0.5, octaves: 5 }).connect(anomalyVolume);
        anomalyDrone = new T.Oscillator(110, "sawtooth").connect(phaser);

        voidVolume = new T.Volume(-100).toDestination();
        voidHum = new T.FatOscillator(40, "sine", 40).connect(voidVolume);

        // --- NEW SYNTHS FOR EXOTIC OBJECTS ---
        
        // Fixed previously uninitialized volumes
        coronaVolume = new T.Volume(-100).toDestination();
        explosionVolume = new T.Volume(-100).toDestination();
        nebulaVolume = new T.Volume(-100).toDestination();

        // Custom config synths
        debrisVolume = new T.Volume(-100).toDestination();
        debrisNoise = new T.Noise("brown").connect(new T.Filter(400, "lowpass").connect(debrisVolume));

        icyVolume = new T.Volume(-100).toDestination();
        icyNoise = new T.Noise("pink").connect(new T.Filter(6000, "highpass").connect(icyVolume));

        staticVolume = new T.Volume(-100).toDestination();
        staticNoise = new T.Noise("white").connect(new T.AutoPanner("4n").connect(staticVolume));

        deepGravityVolume = new T.Volume(-100).toDestination();
        deepGravityOsc = new T.FatOscillator(20, "sine", 60).connect(deepGravityVolume);

        pulsarVolume = new T.Volume(-100).toDestination();
        pulsarSynth = new T.Oscillator(150, "square").connect(new T.Tremolo(9, 0.75).start().connect(pulsarVolume));
    }

    await T.context.resume();

    gasWind.start();
    solarSizzle.start();
    beltGranular.start(); 
    hullRainNoise.start();
    //hullRainModulator.start();
    anomalyDrone.start(); 
    voidHum.start();  

    // Start new nodes
    debrisNoise.start();
    icyNoise.start();
    staticNoise.start();
    deepGravityOsc.start();
    pulsarSynth.start();
        
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
        case 'ASTEROID_BELT':
            beltVolume.volume.setTargetAtTime(db - 10, now, 0.5);
            //hullRainVolume.volume.setTargetAtTime(0, now, 0.3);
            hullRainVolume.volume.setTargetAtTime(db, now, 0.3);
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
            // Custom config mappings pulled from the config TXT
        case 'ROCKY_DEBRIS':
            debrisVolume.volume.setTargetAtTime(db - 5, now, 0.5);
            break;
        case 'ICY_WHISPER':
            icyVolume.volume.setTargetAtTime(db - 12, now, 0.5);
            break;
        case 'DEEP_SPACE_STATIC':
        case 'ELECTRO_STATIC':
            staticVolume.volume.setTargetAtTime(db - 20, now, 0.5);
            break;
        case 'LOW_RUMBLE_GRAVITY':
            deepGravityVolume.volume.setTargetAtTime(db, now, 0.5);
            break;
        case 'NEBULA_HUM':
            anomalyVolume.volume.setTargetAtTime(db - 10, now, 0.5); 
            break;
        case 'PULSAR_BEAT':
        case 'QUASAR_BEAM':
            pulsarVolume.volume.setTargetAtTime(db - 5, now, 0.2);
            break;
        case 'STELLAR_CORONA':
            coronaVolume.volume.setTargetAtTime(db - 12, now, 0.8);
            break;
        case 'SUPERNOVA_EXPLOSION_ZONE':
            explosionVolume.volume.setTargetAtTime(db + 2, now, 0.1); // Regelt nur das anhaltende Dröhnen
            break;
        case 'NEBULA_WIND':
            nebulaVolume.volume.setTargetAtTime(db - 15, now, 0.5);
            break;
        case 'SILENCE':
                    [gasVolume, beltVolume, hullRainVolume, anomalyVolume, voidVolume, 
                     solarVolume, coronaVolume, explosionVolume, nebulaVolume, 
                     debrisVolume, icyVolume, staticVolume, deepGravityVolume, pulsarVolume].forEach(v => {
                        if(v) v.volume.rampTo(-100, 0.5);
                    });
            break;
    }
}
