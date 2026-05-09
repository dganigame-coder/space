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
    // Tone.start() is the magic command that unlocks the browser audio
    await Tone.start();
    gasWind.start();
    solarSizzle.start();
    console.log("Hyper-realistic generative audio online.");
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
