(function () {
  "use strict";
  const L = window.LINES;
  const orbs = {};
  document.querySelectorAll(".pod").forEach(p => { orbs[p.dataset.bot] = Holo.create(p.querySelector("canvas"), p.dataset.bot); });
  const audio = new Audio(); audio.preload = "auto";
  const who = document.getElementById("who"), line = document.getElementById("line");
  const NAMES = { hyperion: "Hyperion", iris: "Iris", hermes: "Hermes" };
  const next = { hyperion: 0, iris: 0, hermes: 0, react: 0 };
  let speaker = null, analysed = false;
  window.__hub = { audio, orbs, played: [] };

  function stopAll() {
    Object.values(orbs).forEach(o => o.setState("idle"));
    document.querySelectorAll(".pod").forEach(p => p.classList.remove("speaking"));
  }
  function play(bot, item) {
    if (!item) return;
    audio.pause();
    stopAll();
    speaker = bot;
    if (!analysed) analysed = Holo.attachAudio(audio, orbs[bot]); else Holo.attachAudio(audio, orbs[bot]);
    orbs[bot].setState("thinking");
    who.textContent = NAMES[bot];
    line.textContent = item.text;
    audio.src = item.audio;
    audio.play().then(() => {
      orbs[bot].setState("talking");
      document.querySelector(`.pod[data-bot=${bot}]`).classList.add("speaking");
      window.__hub.played.push(item.audio);
    }).catch(err => { console.warn("audio blocked", err); orbs[bot].setState("idle"); line.textContent = item.text + "  (tap again to hear it)"; });
  }
  audio.addEventListener("ended", () => { if (speaker) orbs[speaker].setState("idle"); stopAll(); });
  function greet(bot) { const list = L[bot].greet; play(bot, list[next[bot]++ % list.length]); }
  document.querySelectorAll(".pod").forEach(p => p.addEventListener("click", () => greet(p.dataset.bot)));
  document.getElementById("wake").addEventListener("click", () => greet("hyperion"));
  document.getElementById("react").addEventListener("click", () => { const r = L.hyperion.react; play("hyperion", r[next.react++ % r.length]); });
})();
