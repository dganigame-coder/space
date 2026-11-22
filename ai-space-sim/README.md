# A.I. World Engine v36 — Hyper-Real Space Simulator

Voice-driven, AI-generated, physically based real-time space renderer (three.js r160, WebGL2).

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
