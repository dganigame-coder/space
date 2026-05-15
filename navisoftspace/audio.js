import * as Tone from 'tone';

// 1. EXPORT these so your engine.js and index.html can see them!
// This fixes the "ReferenceError: gasVolume is not defined"
/*
export let gasVolume, voidVolume, beltVolume, solarVolume, anomalyVolume; 

let gasFilter, gasWind;
let solarFilter, solarSizzle;
let alarmSynth, impactNoise, impactThump;
let anomalyDrone; 
let voidHum;         
let beltGranular;
*/
// 1. Must be EXPORTED and LET (not const)
export let gasVolume, voidVolume, beltVolume, solarVolume, anomalyVolume;
let gasWind, solarSizzle, beltGranular, anomalyDrone, voidHum;

export async function loadSoundLibrary() {
    await Tone.start();
    if (!gasVolume) {

         // Use -40 instead of -Infinity for the 'base' level
         gasVolume = new Tone.Volume(-40).toDestination();
         gasWind = new Tone.Noise("brown").connect(gasVolume);

        /*
        // 3. FIX: Start at -100 (silent) instead of -Infinity. 
        // Some browsers refuse to "ramp" up from a mathematical Infinity.
        gasVolume = new Tone.Volume(-100).toDestination();
        gasWind = new Tone.Noise("brown").connect(gasVolume);
        */
        solarVolume = new Tone.Volume(-100).toDestination();
        solarSizzle = new Tone.Noise("white").connect(solarVolume);
        
        alarmSynth = new Tone.PolySynth(Tone.Synth).toDestination();
        
        // Connect these to a volume or Destination so they can be heard
        impactNoise = new Tone.Noise("pink").toDestination();
        impactThump = new Tone.MembraneSynth().toDestination();

        beltVolume = new Tone.Volume(-100).toDestination();
        beltGranular = new Tone.Noise("brown").connect(beltVolume);
        
        anomalyVolume = new Tone.Volume(-100).toDestination();
        const phaser = new Tone.Phaser({ frequency: 0.5, octaves: 5 }).connect(anomalyVolume);
        anomalyDrone = new Tone.Oscillator(110, "sawtooth").connect(phaser);

        voidVolume = new Tone.Volume(-100).toDestination();
        voidHum = new Tone.FatOscillator(40, "sine", 40).connect(voidVolume);
    }

    await Tone.context.resume();

    // 4. IMPORTANT: Start the sound engines
    gasWind.start();
    solarSizzle.start();
    beltGranular.start(); 
    anomalyDrone.start(); 
    voidHum.start();      
    
    console.log("Audio System State:", Tone.context.state);
    // Change this:
    gasVolume.volume.value = -60; 
    
    // To this (Immediate Ramp):
    gasVolume.volume.setValueAtTime(-60, Tone.now()); 
    // And add this to ensure the "Master" isn't muted
    Tone.Destination.mute = false;
    Tone.Destination.volume.value = 0;
}

export function playHighFi(key, intensity = 0.5) {
    // Safety check: if system isn't ready, don't try to play
    if (!gasVolume || Tone.context.state !== 'running') return;

    const now = Tone.now();
    // Convert 0-1 intensity to Decibels (0 intensity = -100dB, 1 intensity = 0dB)
    const db = Tone.gainToDb(Math.max(intensity, 0.0001));

    switch(key) {
        case 'ASTEROID_BELT':
            beltVolume.volume.setTargetAtTime(db - 10, now, 0.5);
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
            impactNoise.start(now).stop(now + 0.1);
            impactThump.triggerAttackRelease("G1", "4n", now);
            break;
        case 'SILENCE':
            [gasVolume, beltVolume, anomalyVolume, voidVolume, solarVolume].forEach(v => {
                if(v) v.volume.rampTo(-100, 0.5);
            });
            break;
    }
}
