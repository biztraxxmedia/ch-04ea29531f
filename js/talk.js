(function () {
  "use strict";
  const CFG = window.HYPERION_CONFIG || {};
  const L = window.LINES;
  const orb = Holo.create(document.getElementById("holo"), "hyperion");
  const log = document.getElementById("log"), input = document.getElementById("msg"), form = document.getElementById("dock");
  const statusEl = document.getElementById("status"), modeEl = document.getElementById("mode"), mic = document.getElementById("mic");
  const LIVE = /^https:\/\//.test(CFG.brainUrl || "") || /^http:\/\/(localhost|127\.0\.0\.1)/.test(CFG.brainUrl || "");
  const audio = new Audio(); audio.preload = "auto";
  let history = [], busy = false, wired = false;
  window.__talk = { audio, played: [], live: LIVE };

  if (LIVE) { modeEl.textContent = "Live"; modeEl.classList.add("live"); document.getElementById("demoNote").hidden = true; }

  function status(s) { statusEl.textContent = s; }
  function add(cls, text, item) {
    const d = document.createElement("div"); d.className = "msg " + cls; d.textContent = text;
    if (item && item.audio) {
      const b = document.createElement("button"); b.className = "replay"; b.type = "button"; b.textContent = "▶ replay";
      b.addEventListener("click", () => speakFile(item.audio)); d.appendChild(b);
    }
    log.appendChild(d); d.scrollIntoView({ block: "end", behavior: "smooth" });
  }

  function speakFile(src) {
    return new Promise(resolve => {
      if (!src) { resolve(); return; }
      if (!wired) wired = Holo.attachAudio(audio, orb);
      audio.pause(); audio.src = src;
      const done = () => { orb.setState("idle"); status("Standing by"); resolve(); };
      audio.onended = done; audio.onerror = done;
      audio.play().then(() => { orb.setState("talking"); status("Speaking"); window.__talk.played.push(src); })
        .catch(err => { console.warn("audio blocked", err); done(); });
    });
  }

  // Spoken text never says the name for now (TTS mispronounces it); on-screen text keeps it.
  // Mirrors voice/pron.py strip_name, which the voice server also applies.
  const NAME_STRIP = [
    [/\bThis is Hyperion[.!]\s*/gi, ""],
    [/\bHyperion here\b[.,!]?\s*/gi, "Standing by. "],
    [/\b(I am|I'm) Hyperion([.!?])/gi, "$1 here$2"],
    [/\b(I am|I'm) Hyperion\b,?\s*/gi, "$1 your "],
    [/\bHyperion's\b/gi, "my"],
    [/\bHyperion is\b/gi, "I am"],
    [/\bHyperion has\b/gi, "I have"],
    [/\bHyperion (was|will|can|knows|remembers)\b/gi, "I $1"],
    [/\b(ask|tell|thank|call|ping|message) Hyperion\b/gi, "$1 me"],
    [/,?\s*\bHyperion\b,?/gi, ""],
  ];
  function speechText(text) {
    let t = String(text || "");
    for (const [rx, rep] of NAME_STRIP) t = t.replace(rx, rep);
    t = t.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim().replace(/^[,.;:!?\s]+/, "");
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  window.__speechText = speechText;

  // Live replies: his cloned voice from the TTS server when configured, otherwise the browser's voice.
  async function speakReply(text) {
    text = speechText(text);
    if (!text) return;
    if (/^https?:\/\//.test(CFG.ttsUrl || "")) {
      try {
        const r = await fetch(CFG.ttsUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bot: "hyperion", text }) });
        if (r.ok) { const url = URL.createObjectURL(await r.blob()); await speakFile(url); URL.revokeObjectURL(url); return; }
      } catch (e) { console.warn("tts unavailable", e); }
    }
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; u.pitch = 0.75;
    orb.setState("talking"); status("Speaking");
    const pulse = setInterval(() => orb.setLevel(0.25 + Math.random() * 0.5), 110);
    await new Promise(res => { u.onend = u.onerror = res; speechSynthesis.speak(u); });
    clearInterval(pulse); orb.setState("idle"); status("Standing by");
  }

  const INTENTS = [
    [/\b(who|what) (are|r) (you|u)\b|\bintroduce|\byour name\b/i, "who"],
    [/\bwhat can you do\b|\bhelp\b|\bcommands?\b|\bfeatures?\b/i, "help"],
    [/\bfarm|\bdrop|\bwhere (do|can) i (get|find)|\bresources?\b/i, "farm"],
    [/\bbaro|void trader|ki.?teer/i, "baro"],
    [/\bjoke|funny|roast|laugh/i, "joke"],
    [/\bthank|thx|ty\b|appreciate/i, "thanks"],
    [/\bbye|goodbye|see (you|ya)|later|good ?night/i, "bye"],
    [/\b(hi|hello|hey|yo|greetings|sup)\b/i, "hello"],
  ];
  let fb = 0;
  function demoReply(text) {
    const hit = INTENTS.find(([rx]) => rx.test(text));
    if (hit) return L.talk[hit[1]];
    return L.talk.fallback[fb++ % L.talk.fallback.length];
  }

  async function send(text) {
    text = String(text || "").trim().slice(0, 500);
    if (!text || busy) return;
    busy = true; add("you", text); input.value = "";
    orb.setState("thinking"); status("Thinking");
    try {
      if (LIVE) {
        const r = await fetch(CFG.brainUrl, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot: "hyperion", message: text, history: history.slice(-10) }) });
        const data = await r.json();
        const reply = (data && (data.text || data.reply) || "").trim();
        if (!r.ok || !reply) throw new Error("no reply");
        history.push({ role: "user", content: text }, { role: "assistant", content: reply });
        add("hyp", reply);
        await speakReply(reply);
      } else {
        await new Promise(r => setTimeout(r, 650 + Math.random() * 500));
        const item = demoReply(text);
        add("hyp", item.text, item);
        await speakFile(item.audio);
      }
    } catch (e) {
      console.warn(e);
      const item = L.talk.offline;
      add("hyp", item.text, item);
      await speakFile(item.audio);
    } finally { busy = false; orb.setState("idle"); status("Standing by"); }
  }

  form.addEventListener("submit", e => { e.preventDefault(); send(input.value); });
  document.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => send(c.textContent)));

  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) mic.hidden = true;
  else mic.addEventListener("click", () => {
    if (mic.classList.contains("hot")) return;
    const rec = new Rec(); rec.lang = "en-US"; rec.interimResults = false;
    mic.classList.add("hot"); orb.setState("thinking"); status("Listening");
    rec.onresult = ev => { const t = ev.results[0][0].transcript; mic.classList.remove("hot"); send(t); };
    rec.onerror = rec.onend = () => { mic.classList.remove("hot"); if (!busy) { orb.setState("idle"); status("Standing by"); } };
    try { rec.start(); } catch (_) { mic.classList.remove("hot"); }
  });

  // greet once, on the first interaction (browsers block sound before a tap)
  add("hyp", L.talk.welcome.text, L.talk.welcome);
})();
