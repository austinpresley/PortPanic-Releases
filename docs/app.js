import { initialState, transition } from "./demo-state.mjs";

const stage = document.querySelector("#demo-screen");
const area = document.querySelector(".demo-area");
const cable = document.querySelector("#tether-toggle");
const caption = document.querySelector("#demo-caption");
const soundButton = document.querySelector("#demo-sound");
const lossAudio = document.querySelector("#loss-audio");
const recoveryAudio = document.querySelector("#recovery-audio");
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
const layers = {
  core: document.querySelector(".glow-core"), band: document.querySelector(".glow-band"),
  compact: document.querySelector(".glow-halo-compact"), expanded: document.querySelector(".glow-halo-expanded")
};
let state = initialState();
let soundEnabled = true;
let soundFailed = false;
let motion = null;
let confirmationTimer;
let expiryTimer;
let frame;
let audioGeneration = 0;
let audioPrimed = false;
for (const audio of [lossAudio, recoveryAudio]) audio.volume = 0.45;

const motionReady = fetch("assets/demo-motion.json").then(response => {
  if (!response.ok) throw new Error("Motion unavailable");
  return response.json();
}).then(value => {
  motion = value; stage.dataset.motionReady = "true"; return value;
}).catch(() => null);

function stopAudio() {
  audioGeneration += 1;
  soundFailed = false;
  for (const audio of [lossAudio, recoveryAudio]) { audio.pause(); audio.currentTime = 0; }
}
function playAlert(role) {
  stopAudio(); soundFailed = false;
  const audio = role === "loss" ? lossAudio : recoveryAudio;
  audio.muted = !soundEnabled;
  const generation = audioGeneration;
  audio.play().then(() => {
    if (generation !== audioGeneration || state.alert !== role) return;
    soundFailed = false; renderSound();
  }).catch(() => {
    if (generation !== audioGeneration) return;
    soundFailed = true; soundEnabled = false;
    for (const media of [lossAudio, recoveryAudio]) media.muted = true;
    renderSound();
  });
}
function primeAudio() {
  if (audioPrimed || state.alert) return;
  audioPrimed = true;
  const generation = audioGeneration;
  for (const audio of [lossAudio, recoveryAudio]) {
    audio.muted = true;
    audio.play().then(() => {
      if (generation !== audioGeneration || state.alert) return;
      audio.pause(); audio.currentTime = 0; audio.muted = !soundEnabled;
    }).catch(() => {});
  }
}
function renderSound() {
  soundButton.setAttribute("aria-label", soundEnabled ? "Mute preview sound" : "Enable preview sound");
  soundButton.querySelector("span").textContent = soundEnabled ? "Sound on" : "Sound off";
  soundButton.dataset.muted = String(!soundEnabled);
  document.querySelector("#sound-feedback").textContent = soundFailed
    ? "Sound could not start. Turn sound on to retry. The visual preview still works." : "";
}
function render() {
  stage.dataset.state = state.connection;
  stage.dataset.alert = state.alert || "none";
  stage.dataset.pending = String(state.pending);
  area.dataset.plugged = String(state.plugged);
  cable.setAttribute("aria-label", state.plugged ? "Unplug camera" : "Plug in camera");
  document.querySelector("#tether-action").textContent = state.plugged ? "Unplug camera" : "Plug in camera";
  document.querySelector("#tether-connection").textContent = state.plugged ? "Cable connected" : "Cable disconnected";
  const title = document.querySelector("#camera-name");
  title.replaceChildren();
  const hasCamera = state.connection !== "waiting" || state.plugged;
  for (const line of hasCamera ? ["Canon", "EOS R5"] : ["No camera", "tethered"]) {
    const span = document.createElement("span"); span.textContent = line; title.append(span);
  }
  document.querySelector("#card-status-text").textContent = state.connection === "connected" ? "Connected" : state.connection === "lost" ? "Lost" : "Waiting";
  document.querySelector("#card-status-symbol").dataset.symbol = state.connection;
  const source = document.querySelector("#card-source");
  if (state.pending) source.innerHTML = 'Mac <span class="source-check" aria-label="detected">✓</span><span class="source-arrow" aria-hidden="true">→</span> Capture One <span class="pending-circle" aria-label="pending"></span>';
  else if (state.connection === "connected") source.textContent = "Capture One";
  else source.innerHTML = 'Capture One <span class="pending-circle" aria-label="pending"></span>';
  document.querySelector("#card-speed-row").hidden = !(state.connection === "connected" || (state.connection === "waiting" && state.pending));
  document.querySelector("#card-loss-row").hidden = state.connection !== "lost";
  document.querySelector("#card-notice").textContent = state.dismissed ? "Alert dismissed" : "";
  document.querySelector("#card-dismiss").disabled = state.alert !== "loss";
  document.querySelector("#overlay-dismiss").hidden = state.alert !== "loss";
  document.querySelector("#menu-camera").dataset.symbol = state.connection;
  let message;
  if (state.paused) message = "Preview paused. Use the cable or reset to try again.";
  else if (state.pending) message = state.connection === "lost"
    ? "USB is back. Lost stays on until Capture One confirms the tether."
    : "The Mac sees the camera. Waiting for Capture One to confirm the tether.";
  else if (state.alert === "loss") message = "Camera lost. Swell repeats with the red glow. Reconnect or Dismiss to stop it.";
  else if (state.alert === "recovery") message = "Camera recovered. Loss stops, Bloom plays once and the green glow fades over three seconds.";
  else if (state.dismissed) message = "Alert dismissed. The camera is still Lost until it reconnects.";
  else if (state.connection === "connected") message = "Tethered to Capture One. Unplug the camera to try the Loss alert.";
  else message = "Plug in the camera to start. This interactive preview uses sound.";
  caption.textContent = message;
  renderSound();
}
function sample(values, time, duration) {
  const position = Math.max(0, Math.min(1, time / duration)) * (values.length - 1);
  const index = Math.min(values.length - 2, Math.floor(position));
  const fraction = position - index;
  return values[index] * (1 - fraction) + values[index + 1] * fraction;
}
function drawGlow() {
  cancelAnimationFrame(frame);
  if (!state.alert) { Object.values(layers).forEach(layer => { layer.style.opacity = "0"; }); return; }
  const role = state.alert;
  const curve = motion?.[role];
  const elapsed = Math.max(0, (performance.now() - state.epoch) / 1000);
  const audio = role === "loss" ? lossAudio : recoveryAudio;
  const time = role === "loss" && !audio.paused ? audio.currentTime % 2.8
    : role === "loss" ? elapsed % 2.8 : Math.min(3, elapsed);
  const steady = motionPreference.matches;
  if (curve) {
    document.querySelector(".edge-light").style.opacity = String(steady ? curve.steadyOpacity : curve.opacity);
    if (curve.color) stage.style.setProperty("--glow-color", curve.color.map(c => Math.round(c * 255)).join(" "));
  }
  const core = steady || !curve ? 1 : sample(curve.core, time, curve.duration);
  const band = steady || !curve ? 1 : sample(curve.band, time, curve.duration);
  const entrance = Math.min(1, elapsed / 0.15);
  const entranceWeight = 0.15 + 0.85 * entrance * entrance * (3 - 2 * entrance);
  const halo = steady || !curve ? 1 : sample(curve.halo, time, curve.duration) * (role === "loss" ? entranceWeight : 1);
  const movement = steady || !curve ? 1 : sample(curve.movement, time, curve.duration);
  layers.core.style.opacity = String(core); layers.band.style.opacity = String(band);
  layers.compact.style.opacity = String(halo * (1 - movement));
  layers.expanded.style.opacity = String(halo * movement);
  if (!steady) frame = requestAnimationFrame(drawGlow);
}
function dispatch(action) {
  const previous = state;
  state = transition(state, action, performance.now());
  if (state === previous) return;
  if (state.generation !== previous.generation) clearTimeout(confirmationTimer);
  if (state.alert !== previous.alert || state.epoch !== previous.epoch) {
    clearTimeout(expiryTimer);
    if (state.alert) playAlert(state.alert); else stopAudio();
    if (state.alert === "recovery") {
      const epoch = state.epoch;
      expiryTimer = setTimeout(() => dispatch({ type: "expired", epoch }), 3000);
    }
  }
  if (action.type === "reset" || action.type === "pause") {
    clearTimeout(confirmationTimer); clearTimeout(expiryTimer); stopAudio();
  }
  render(); drawGlow();
  if (action.type === "toggle" && state.pending) {
    const generation = state.generation;
    confirmationTimer = setTimeout(() => dispatch({ type: "confirmed", generation }), 550);
  }
}
cable.addEventListener("click", () => { primeAudio(); dispatch({ type: "toggle" }); });
document.querySelectorAll("[data-dismiss-preview]").forEach(button => button.addEventListener("click", () => dispatch({ type: "dismiss" })));
document.querySelector("#demo-reset").addEventListener("click", () => dispatch({ type: "reset" }));
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  for (const audio of [lossAudio, recoveryAudio]) audio.muted = !soundEnabled;
  if (soundEnabled && state.alert && (state.alert === "loss" ? lossAudio : recoveryAudio).paused) playAlert(state.alert);
  renderSound();
});
document.addEventListener("visibilitychange", () => { if (document.hidden) dispatch({ type: "pause" }); });
window.addEventListener("pagehide", () => dispatch({ type: "pause" }));
new IntersectionObserver(entries => {
  if (!entries[0].isIntersecting && (state.alert || state.pending)) dispatch({ type: "pause" });
}, { threshold: 0 }).observe(area);
motionPreference.addEventListener("change", drawGlow);
new ResizeObserver(() => stage.style.setProperty("--glow-size", `${Math.max(6, Math.min(14, stage.clientWidth * 28 / 1280))}px`)).observe(stage);
motionReady.then(() => { if (state.alert) drawGlow(); });
render(); drawGlow();

fetch("release.json", { cache: "no-cache" }).then(response => response.ok ? response.json() : null).then(release => {
  if (!release || !release.available || !/^https:\/\/github\.com\/austinpresley\/PortPanic-Releases\/releases\/download\//.test(release.url)) return;
  const link = document.querySelector("#download-link");
  link.href = release.url;
  link.firstChild.textContent = "Download for Mac ";
  document.querySelector("#download-status").textContent = `Free. Version ${release.version}. ${release.size || "Signed and notarized."}`;
}).catch(() => {});
