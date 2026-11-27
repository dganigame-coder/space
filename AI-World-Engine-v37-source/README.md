# A.I. World Engine v37 — Hyper-Real Space Simulator

Voice-driven, AI-generated, physically based real-time space renderer (three.js r160, WebGL2).

## What's new in v37
- **Earth launch boot sequence** - every session starts on a coastal pad at sunrise: terminal count, ignition, liftoff, Max-Q, stage separation, the Kármán line (100 km) and orbit insertion, then a pull-back to the full Earth. True metre-scale two-stage rocket (9 engines, grid fins, Mach-diamond plume that balloons in vacuum), particle exhaust trail, high-resolution terrain patch, in-atmosphere sky, stars fading in with altitude, live telemetry HUD. "Skip launch" or any command ends it.
- **Six more theoretical destinations** - Cosmic String, Brane Worlds, Dyson Swarm, Planet Nine, Quark Star, Alcubierre Warp Bubble (see below).
- Fixes: stars no longer draw over planets; scene light falloff for tiny-scale objects.

## Run
Serve the folder over HTTP (ES modules): `python3 -m http.server` then open `http://localhost:8000`.
Optional: `?quality=performance|high|ultra`.

## Structure
- `config.js` — endpoints, models, your `AWS_IMAGE_URL_API` texture endpoint
- `src/core` — Engine (HDR pipeline, bloom, cinematic pass, 4K capture), CameraDirector, storage, utils
- `src/world` — Planet, GasGiant, Rings, Star, Galaxy, Nebula, BlackHole, Minor bodies, Skybox, Atmosphere, catalog, World
- `src/ai` — AIRouter (Gemini/Groq/Pollinations), TextureService, prompts
- `src/audio` — AmbientSynth (WebAudio), Voice (speech recognition + Groq/Gemini/browser TTS)
- `src/ui` — DOM layer and language list

## Notes
- Pollinations keyless endpoints now require a Turnstile token for browser requests, so a Gemini key
  (or your AWS image endpoint for textures) is needed for live AI results. Offline synthesis and
  NASA-referenced presets always work.

## Theoretical mode

Toggle **Theoretical mode** (or tap any theory chip) to visit structures that are predicted by theory but never observed. Every theoretical sector carries a "Hypothesis" badge plus a card describing the theory's basis and why it is unobserved. With the toggle off, the AI is restricted to the observed universe.

- **Multiverse** - eternal-inflation bubble universes in a false vacuum: per-bubble raymarched cosmic web, shimmering domain walls, collision rings (the signature searched for in WMAP data by Feeney et al. 2011), and a bubble nucleating in real time.
- **Wormhole** - Ellis / Morris-Thorne traversable throat rendered with exact null geodesics of ds² = -dt² + dl² + (l² + a²)dΩ² (elliptic integrals): our sky is lensed from a cube-map capture, rays below the throat radius exit into another universe's sky.
- **White hole** - time-reversed Schwarzschild: geodesic-traced outflow disk with Doppler shift, polar jets, expanding lensed radiation shells and a blinding past horizon.
- **Cosmic string** - conical-deficit lensing: rays passing a straight string are bent by half the deficit angle 8πGμ, producing undistorted double images of background galaxies and a quasar. The angle is exaggerated (~10⁵×) for visibility.
- **Brane worlds** - Randall-Sundrum style 3-branes in a 5-D bulk, each with its own cosmic web; gravitons stream through the bulk, and two branes periodically collide (ekpyrotic).
- **Dyson swarm** - thousands of instanced collectors on inclined orbits around an M dwarf plus a partial geodesic frame; the red glow is false colour for infrared waste heat (the signature searched for by Project Hephaistos, 2024).
- **Planet Nine** - a cold mini-Neptune hundreds of AU out under a dimmed Sun (lighting brightened for visibility).
- **Quark star** - strange-matter compact star (Bodmer 1971 / Witten 1984), very hot and enlarged for viewing.
- **Warp bubble** - Alcubierre metric: raymarched negative-energy density ρ ∝ (ρ⊥²/r²)(df/dr)² around a ship, with the sky squeezed/blueshifted ahead and stretched/redshifted behind.
