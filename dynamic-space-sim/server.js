import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { HfInference } from '@huggingface/inference';

dotenv.config();

const app = express();
const hf = new HfInference(process.env.HF_TOKEN);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/voice-command', async (req, res) => {
  try {
    const { voiceTranscript } = req.body;

    const systemPrompt = `You are a real-time 3D Space Game Engine.
The user gave this voice command: "${voiceTranscript}".

Generate an exact JSON object specifying scene changes AND custom executable runtime JavaScript.
Return ONLY RAW JSON:
{
"sectorTitle": "Short creative title",
"lore": "One sentence summary of what was generated",
"fogColor": "#hexColor",
"lightColor": "#hexColor",
"prompt": "FLUX image prompt for background texture",
"rotationJs": "mesh.rotation.x += 0.02; mesh.rotation.y += 0.01; mesh.scale.setScalar(1 + Math.sin(time) * 0.2);"
}`;

    const llmResponse = await hf.chatCompletion({
      model: "Qwen/Qwen2.5-Coder-32B-Instruct",
      messages: [{ role: "user", content: systemPrompt }],
      max_tokens: 400
    });

    const worldConfig = JSON.parse(llmResponse.choices[0].message.content.trim());

    // Generate texture via FLUX
    const imageBlob = await hf.textToImage({
      model: 'black-forest-labs/FLUX.1-schnell',
      inputs: worldConfig.prompt,
      parameters: { num_inference_steps: 4 }
    });

    const buffer = Buffer.from(await imageBlob.arrayBuffer());
    const textureUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;

    res.json({ worldConfig, textureUrl });

  } catch (err) {
    console.error("AI Bridge Error:", err);
    res.status(500).json({ error: "Failed to parse voice command" });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server online at http://localhost:3000`);
});
