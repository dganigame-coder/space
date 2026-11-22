// Runtime configuration. Keep your existing AWS texture endpoint here.
export const CONFIG = {
  // Your texture-synthesis endpoint (POST {prompt, negative_prompt, width, height} -> {success, image: base64}).
  // Leave empty to use the Pollinations image fallback for AI textures.
  AWS_IMAGE_URL_API: '',

  GEMINI_API_BASE: 'https://generativelanguage.googleapis.com/v1beta',
  GEMINI_DEFAULT_MODEL: 'gemini-2.5-flash',
  GEMINI_LONG_TTS_MODEL: 'gemini-3.8-flash-tts',
  GEMINI_LITE_TTS_MODEL: 'gemini-3.8-flash-lite-tts',

  GROQ_CHAT_URL: 'https://api.groq.com/openai/v1/chat/completions',
  GROQ_SPEECH_URL: 'https://api.groq.com/openai/v1/audio/speech',
  GROQ_FAST_MODEL: 'llama-3.3-70b-versatile',
  GROQ_TTS_MODEL: 'canopylabs/orpheus-v1-english',
  GROQ_TTS_VOICE: 'troy',

  POLLINATIONS_TEXT_URL: 'https://text.pollinations.ai/',
  POLLINATIONS_IMAGE_URL: 'https://image.pollinations.ai/prompt/',

  GEMINI_TIMEOUT_MS: 14000,
  POLLINATIONS_TIMEOUT_MS: 12000,
};
