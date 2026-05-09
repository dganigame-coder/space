// audio.js
// 1. GAS_RUSH (Brown Noise for deep planetary rumble)
const gasFilter = new Tone.AutoFilter("4n").start();
const gasVolume = new Tone.Volume(-Infinity).toDestination();
const gasWind = new Tone.Noise("brown").connect(gasFilter).connect(gasVolume);

// 2. SOLAR_STATIC (White Noise for high-frequency radiation)
const solarFilter = new Tone.Filter(5000, "highpass").toDestination();
const solarVolume = new Tone.Volume(-Infinity).connect(solarFilter);
const solarSizzle = new Tone.Noise("white").connect(solarVolume);

// 3. COCKPIT_ALARM (Two-tone digital synth)
const alarmSynth = new Tone.PolySynth(Tone.Synth).toDestination();

// 4. HULL_IMPACT (Pink noise crunch + Membrane thud)
const impactNoise = new Tone.Noise("pink").connect(new Tone.Filter(500, "lowpass").toDestination());
const impactThump = new Tone.MembraneSynth().toDestination();

export async function loadSoundLibrary() {
    // 1. The standard unlock
    await Tone.start();
    
    // 2. FORCE RESUME: Sometimes Tone.start() leaves the hardware "suspended"
    if (Tone.context.state !== 'running') {
        await Tone.context.resume();
    }

    // 3. START THE ENGINES: These stay silent (-Infinity dB) until playHighFi is called
    gasWind.start();
    solarSizzle.start();
    
    // 4. DIAGNOSTIC: Check your console for "running"
    console.log("Audio System State:", Tone.context.state); 
    console.log("Hyper-realistic generative audio online.");

    // 5. TEST BEEP (Optional: Remove after you hear it)
    // const testOsc = new Tone.Oscillator(440, "sine").toDestination().start();
    // setTimeout(() => testOsc.stop(), 200); 
}

export function playHighFi(key, intensity = 0.5) {
    const now = Tone.now();

    switch(key) {
        case 'GAS_RUSH':
            // Ramps volume from silence to the intensity level
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
