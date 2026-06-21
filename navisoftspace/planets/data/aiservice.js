// aiService.js - Your Ship's Onboard Artificial Intelligence Hub

const HF_TOKEN = "hf_your_free_token_here"; // Replace with your actual Hugging Face Access Token
const MODEL_URL = "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta";

export const AiService = {
    // 🧠 System Prompt forces the AI to always stay in character as a starship computer
    systemInstructions: "You are the onboard navigation AI computer of a deep space starship simulator. Respond concisely, with a sci-fi theme, using terms like '[TELEMETRY UPDATE]', '[COGNITIVE SYNC]', or 'Captain'. Keep replies under 3 sentences.",

    async askOnboardComputer(userMessage) {
        console.log("🧠 Transmitting prompt to Hugging Face arrays...");

        try {
            const response = await fetch(MODEL_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${HF_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    inputs: `<|system|>\n${this.systemInstructions}</s>\n<|user|>\n${userMessage}</s>\n<|assistant|>`
                })
            });

            if (!response.ok) throw new Error(`HF API Error: ${response.status}`);

            const result = await response.json();
            
            // Extract the generated text from the Hugging Face payload return array
            let aiReply = result[0]?.generated_text || ">> ERROR: COGNITIVE OVERLINK TIMEOUT.";
            
            // Clean up the model output tags if they show up in the text string
            aiReply = aiReply.split("<|assistant|>").pop().trim();

            return aiReply;

        } catch (error) {
            console.error("🚨 AI link severed:", error);
            return ">> SYSTEM FAILURE: COGNITIVE CORE OFFLINE. CHECK HF GATEWAY KEY.";
        }
    }
};
