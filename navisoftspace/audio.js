// audio.js
export const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Professional Sound Library URLs (High-Fidelity)
const SOUND_LIB = {
    COCKPIT_ALARM: 'https://cdn.pixabay.com/audio/2022/03/24/audio_77a9043233.mp3', // Sharp, digital warning
    HULL_IMPACT: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c9725f053d.mp3',   // Deep metallic crunch
    GAS_RUSH: 'https://cdn.pixabay.com/audio/2022/01/26/audio_d0c6ff1bab.mp3',      // Low-frequency wind/roar
    SOLAR_STATIC: 'https://cdn.pixabay.com/audio/2021/08/04/audio_12345678.mp3'    // Radiation static
};

const audioBuffers = {};

/**
 * Preloads all professional sounds into memory
 */
export async function loadSoundLibrary() {

    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
    for (const [key, url] of Object.entries(SOUND_LIB)) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            audioBuffers[key] = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error(`Failed to load high-fi sound: ${key}`, e);
        }
    }
}

/**
 * Plays a high-fidelity sample with optional pitch/volume control
 */
export function playHighFi(key, volume = 0.5, pitch = 1.0) {
    if (!audioBuffers[key]) return;

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffers[key];

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);

    // Realistic variation: slightly randomize pitch so it doesn't sound repetitive
    source.playbackRate.value = pitch + (Math.random() * 0.05);

    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    source.start(0);
}
