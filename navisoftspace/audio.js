// audio.js

// 1. Declare variables at the top (without initializing)
let gasFilter, gasVolume, gasWind;
let solarFilter, solarVolume, solarSizzle;
let alarmSynth, impactNoise, impactThump;

export async function loadSoundLibrary() {
    // 2. The standard unlock (Must happen inside the click event)
    await Tone.start();
    
    // 3. Initialize nodes only IF they don't exist yet
    if (!gasVolume) {
        // GAS_RUSH
        gasFilter = new Tone.AutoFilter("4n").start();
        gasVolume = new Tone.Volume(-Infinity).toDestination();
        gasWind = new Tone.Noise("brown").connect(gasFilter).connect(gasVolume);

        // SOLAR_STATIC
        solarFilter = new Tone.Filter(5000, "highpass").toDestination();
        solarVolume = new Tone.Volume(-Infinity).connect(solarFilter);
        solarSizzle = new Tone.Noise("white").connect(solarVolume);

        // COCKPIT_ALARM
        alarmSynth = new Tone.PolySynth(Tone.Synth).toDestination();

        // HULL_IMPACT
        impactNoise = new Tone.Noise("pink").connect(new Tone.Filter(500, "lowpass").toDestination());
        impactThump = new Tone.MembraneSynth().toDestination();
    }

    // 4. Force Resume
    if (Tone.context.state !== 'running') {
        await Tone.context.resume();
    }

    // 5. Start generators
    gasWind.start();
    solarSizzle.start();
    
    console.log("Audio System State:", Tone.context.state); 
    console.log("Hyper-realistic generative audio online.");
}

export function playHighFi(key, intensity = 0.5) {
    // Safety check: skip if library hasn't been initialized by a click
    if (!gasVolume) return;

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
        case 'OFF':
            gasVolume.volume.setTargetAtTime(-Infinity, now, 1);
            solarVolume.volume.setTargetAtTime(-Infinity, now, 1);
            break;
    }
}
