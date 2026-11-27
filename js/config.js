/* Public page config. NO SECRETS HERE: this file is visible to everyone.
   brainUrl: an HTTPS endpoint that accepts POST {"bot":"hyperion","message":"...","history":[...]}
             and returns {"text":"...","mood":"..."}. The Groq key stays on that server, never here.
   ttsUrl:   an HTTPS endpoint that accepts POST {"bot":"hyperion","text":"..."} and returns audio (wav/mp3)
             in Hyperion's voice (voice/tts_server.py).
   Leave both empty for demo mode (pre-rendered voiced replies). See ORBHUB.md, "Going live". */
window.HYPERION_CONFIG = {
  brainUrl: "",
  ttsUrl: "",
};
