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
    }

    await Tone.context.resume();
    gasWind.start();
    solarSizzle.start();
    
    console.log("Audio System State:", Tone.context.state); 
}

export function playHighFi(key, intensity = 0.5) {
    if (!gasVolume || Tone.context.state !== 'running') return;

    const now = Tone.now();
    switch(key) {
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
