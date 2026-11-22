// Ephemeris prompt. Extends the original schema with explicit body types so the
// renderer can pick physically appropriate shaders instead of guessing from names.
export function buildEphemerisPrompt(commandText, locale) {
  return `
You are a precise, scientifically accurate astronomical ephemeris generator for a real-time 3D renderer.
User Navigation Command: "${commandText}"
Target Language Locale Code: "${locale}"

RULES:
1. STRICT ASTRONOMICAL ACCURACY: Use real NASA/IAU facts. Never invent catalog numbers or fictional protocols. Pluto is a dwarf planet in the Kuiper Belt.
2. MULTI-OBJECT BREAKDOWN: Star systems, moons, belts and clusters must be broken into multiple objects. Moons set "parent" to the planet name and "distance" relative to that parent.
3. BODY TYPES: "bodyType" MUST be one of: star, terran, desert, barren, ice, lava, cloudy, gas_giant, asteroid, asteroid_belt, comet, spiral_galaxy, nebula, black_hole.
   Use "hasRings": true for ringed planets instead of separate ring objects.
4. SCALE: Scene units. Central star radius 3-8. Planets radius 0.3-4. Orbital "distance" 8-120 from the system center, increasing outward. Single-planet scenes: the planet radius 4 at distance 0.
5. COLORS: Provide "color" (hex) and a 5-color "palette" (hex, dark to light) that matches real imagery, plus "colorDescription" in English.
6. ATMOSPHERE: For bodies with atmospheres provide "atmosphere": {"color": hex of scattered sky color, "density": 0.1-2}.
7. MULTILINGUAL: "sectorTitle", "lore", "speechResponse" are written natively in locale "${locale}". "prompt" and "colorDescription" stay in English.

Return ONLY raw JSON:
{
  "sectorTitle": "Name & classification",
  "lore": "Factual description: composition, size, distance, moons",
  "speechResponse": "Concise arrival statement",
  "objects": [
    {
      "name": "Factual Object Name",
      "bodyType": "terran",
      "radius": 2.0,
      "distance": 0,
      "parent": null,
      "axialTilt": 23.4,
      "color": "#197da8",
      "palette": ["#031330", "#0b4d6e", "#203d12", "#5b4a35", "#eef2f6"],
      "colorDescription": "English palette description",
      "atmosphere": {"color": "#6fa0ff", "density": 1.0},
      "hasClouds": true,
      "hasRings": false,
      "temperatureK": null,
      "prompt": "Detailed English surface description for texture synthesis"
    }
  ],
  "audioParams": { "baseFreq": 60.0, "filterCutoff": 400.0, "lfoRate": 1.0 }
}
`;
}

export const COCKPIT_SYSTEM_PROMPT =
  'You are a fast starship flight computer. Return JSON only: {"callout": "short <= 150 char English callout, optional tag like [authoritatively]"}.';
