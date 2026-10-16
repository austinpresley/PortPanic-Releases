import { initialState, transition } from "./demo-state.mjs?v=redesign-1";
import { cable, clampPlug, dragCrossing, restingX, stepSpring, wirePath } from "./tether-cable.mjs?v=redesign-1";

import { releaseView } from "./release-view.mjs?v=beta-1";

import { displayContour } from "./display-contour.mjs?v=notch-1";

const stage = document.querySelector("#demo-screen");
const stageWrap = document.querySelector(".demo-stage");
const area = document.querySelector(".demo-area");
const panel = document.querySelector(".tether-panel");
const cableButton = document.querySelector("#tether-toggle");
const drawing = document.querySelector(".tether-drawing");
const plugGroup = document.querySelector(".tether-plug");
const plugShadow = document.querySelector(".plug-shadow");
const wire = document.querySelector(".wire");
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
let soundEnabled = false;
let soundFailed = false;
let motion = null;
let confirmationTimer;
let expiryTimer;
let frame;
let audioGeneration = 0;
let audioPrimed = false;
for (const audio of [lossAudio, recoveryAudio]) audio.volume = 0.45;

// The plug's position in drawing units. It follows the pointer during a drag
// and springs to the state's resting place otherwise.
const plug = { x: cable.seatedX, velocity: 0, target: cable.seatedX, dragging: false, pointerId: null,
  grabOffset: 0, startClientX: 0, moved: 0, frame: 0, last: 0 };
let interacted = false;
let pointerHandledAt = -Infinity;
let nudgeTimer;
let visible = true;

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
  // A blocked or paused player rejoins the active cue instead of restarting it.
  const elapsed = Math.max(0, (performance.now() - state.epoch) / 1000);
  if (role === "recovery" && elapsed >= 3) return;
  try { audio.currentTime = role === "loss" ? elapsed % 2.8 : elapsed; } catch { /* The player can start before metadata arrives. */ }
  const generation = audioGeneration;
  audio.play().then(() => {
    if (generation !== audioGeneration || state.alert !== role) {
      if (state.alert !== role) audio.pause();
      return;
    }
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
  soundButton.setAttribute("aria-label", soundFailed ? "Try preview sound again" : soundEnabled ? "Mute preview sound" : "Enable preview sound");
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
  soundButton.querySelector("span").textContent = soundEnabled ? "Sound on" : "Sound off";
  soundButton.dataset.muted = String(!soundEnabled);
  document.querySelector(".card-speaker").innerHTML = soundEnabled
    ? '<path d="M3 8h4l4-4v12l-4-4H3zM14 7a5 5 0 0 1 0 6"/>'
    : '<path d="M3 8h4l4-4v12l-4-4H3zM14 7l4 6m0-6-4 6"/>';
  caption.textContent = soundEnabled ? "Example camera. Plays PortPanic's Swell and Bloom sounds."
    : "Example camera. Turn sound on to hear the alert.";
  document.querySelector("#sound-feedback").textContent = soundFailed
    ? "Sound could not play. Turn sound on to try again. The visual preview still works." : "";
}
function cableLabel() {
  if (state.pending) return "Checking the example tether in Capture One.";
  if (state.alert === "recovery") return "Connected again.";
  if (state.dismissed) return "Alert dismissed. Camera still disconnected.";
  if (state.connection === "lost") return "Reconnect to see Recovery.";
  return "Pull the plug to try the alert.";
}
function render() {
  stage.dataset.state = state.connection;
  stage.dataset.alert = state.alert || "none";
  stage.dataset.pending = String(state.pending);
  area.dataset.plugged = String(state.plugged);
  panel.dataset.plugged = String(state.plugged);
  panel.dataset.state = state.connection;
  panel.dataset.pending = String(state.pending);
  panel.dataset.hint = String(!interacted);
  cableButton.setAttribute("aria-label", state.plugged ? "Unplug example camera by dragging or pressing" : "Reconnect example camera by dragging or pressing");
  document.querySelector("#tether-action").textContent = cableLabel();
  document.querySelector("#tether-action-button").textContent = state.plugged ? "Unplug camera" : "Reconnect camera";
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
  if (!state.alert) {
    Object.values(layers).forEach(layer => { layer.style.opacity = "0"; });
    stageWrap.style.setProperty("--ambient", "0");
    return;
  }
  const role = state.alert;
  const curve = motion?.[role];
  const elapsed = Math.max(0, (performance.now() - state.epoch) / 1000);
  const audio = role === "loss" ? lossAudio : recoveryAudio;
  const time = role === "loss" && !audio.paused ? audio.currentTime % 2.8
    : role === "loss" ? elapsed % 2.8 : Math.min(3, elapsed);
  const steady = motionPreference.matches;
  if (curve) {
    document.querySelector(".edge-light").style.opacity = String(steady ? curve.steadyOpacity : curve.opacity);
    if (curve.color) {
      const color = curve.color.map(c => Math.round(c * 255)).join(" ");
      stage.style.setProperty("--glow-color", color);
      stageWrap.style.setProperty("--ambient-color", color);
    }
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
  // The page around the screen catches a little of the same light.
  const edgeOpacity = curve ? (steady ? curve.steadyOpacity : curve.opacity) : 0.8;
  stageWrap.style.setProperty("--ambient", (Math.min(1, (steady ? 0.5 : 0.18 + 0.7 * halo) * edgeOpacity)).toFixed(3));
  if (!steady) frame = requestAnimationFrame(drawGlow);
}

// Cable drawing and motion.
function drawPlug() {
  const transform = `translate(${plug.x.toFixed(2)} 0)`;
  plugGroup.setAttribute("transform", transform);
  plugShadow.setAttribute("transform", transform);
  wire.setAttribute("d", wirePath(plug.x));
}
function animatePlug(now) {
  plug.frame = 0;
  if (plug.dragging) { plug.last = 0; return; }
  const dt = plug.last ? (now - plug.last) / 1000 : 1 / 60;
  plug.last = now;
  if (motionPreference.matches) { plug.x = plug.target; plug.velocity = 0; plug.last = 0; drawPlug(); return; }
  const next = stepSpring(plug.x, plug.velocity, plug.target, dt);
  plug.x = next.position; plug.velocity = next.velocity;
  drawPlug();
  if (next.settled) plug.last = 0; else plug.frame = requestAnimationFrame(animatePlug);
}
function startPlugMotion() {
  if (plug.frame || plug.dragging) return;
  plug.last = 0;
  plug.frame = requestAnimationFrame(animatePlug);
}
function settlePlug() {
  plug.target = restingX(state.plugged);
  startPlugMotion();
}
// The plug leans toward the port and settles back, as if asking to be plugged in.
let leanTimer;
function nudgePlug() {
  if (plug.dragging || state.plugged || motionPreference.matches) return;
  clearTimeout(leanTimer);
  plug.target = cable.leanX;
  startPlugMotion();
  leanTimer = setTimeout(() => { if (!plug.dragging) settlePlug(); }, 420);
}
// Until someone touches the cable, the plug beckons now and then.
function scheduleNudge(delay = 2800) {
  clearTimeout(nudgeTimer);
  if (interacted || state.plugged || motionPreference.matches || document.hidden || !visible) return;
  nudgeTimer = setTimeout(() => { nudgePlug(); scheduleNudge(); }, delay);
}
function markInteracted() {
  if (interacted) return;
  interacted = true;
  clearTimeout(nudgeTimer); clearTimeout(leanTimer);
  panel.dataset.hint = "false";
}
function drawingX(clientX) {
  const rect = drawing.getBoundingClientRect();
  return rect.width ? (clientX - rect.left) * cable.width / rect.width : plug.x;
}
function toggleCable() {
  primeAudio();
  dispatch({ type: "toggle" });
}
function releasePlug(event) {
  if (!plug.dragging || event.pointerId !== plug.pointerId) return;
  plug.dragging = false;
  plug.pointerId = null;
  panel.dataset.dragging = "false";
  pointerHandledAt = performance.now();
  if (event.type === "pointerup" && plug.moved < 6) toggleCable();
  settlePlug();
}
cableButton.addEventListener("pointerdown", event => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  markInteracted();
  plug.dragging = true;
  plug.pointerId = event.pointerId;
  plug.moved = 0;
  plug.startClientX = event.clientX;
  plug.grabOffset = plug.x - drawingX(event.clientX);
  plug.velocity = 0;
  plug.target = restingX(state.plugged);
  cancelAnimationFrame(plug.frame); plug.frame = 0; plug.last = 0;
  panel.dataset.dragging = "true";
  try { cableButton.setPointerCapture(event.pointerId); } catch { /* capture is a nicety */ }
});
cableButton.addEventListener("pointermove", event => {
  if (!plug.dragging || event.pointerId !== plug.pointerId) return;
  plug.moved = Math.max(plug.moved, Math.abs(event.clientX - plug.startClientX));
  plug.x = clampPlug(drawingX(event.clientX) + plug.grabOffset);
  drawPlug();
  if (dragCrossing(state.plugged, plug.x)) toggleCable();
});
cableButton.addEventListener("pointerup", releasePlug);
cableButton.addEventListener("pointercancel", releasePlug);
cableButton.addEventListener("click", () => {
  // Pointer sequences are handled above. This path serves keyboards and assistive tech.
  if (performance.now() - pointerHandledAt < 700) return;
  markInteracted();
  toggleCable();
});
document.querySelector("#tether-action-button").addEventListener("click", () => {
  markInteracted(); toggleCable();
});
document.querySelectorAll("[data-section-link]").forEach(link => link.addEventListener("click", event => {
  if (!link.hash || link.origin !== location.origin || link.pathname !== location.pathname) return;
  const target = document.querySelector(link.hash);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: motionPreference.matches ? "auto" : "smooth", block: "start" });
  const heading = target.querySelector('[tabindex="-1"]');
  heading?.focus({ preventScroll: true });
  history.replaceState(null, "", link.hash);
}));

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
    soundEnabled = false; audioPrimed = false;
    for (const audio of [lossAudio, recoveryAudio]) audio.muted = true;
    plug.dragging = false; plug.pointerId = null; panel.dataset.dragging = "false";
    clearTimeout(nudgeTimer); clearTimeout(leanTimer);
  }
  if (action.type === "reset") { interacted = false; scheduleNudge(1800); }
  render(); drawGlow(); settlePlug();
  if (action.type === "toggle" && state.pending) {
    const generation = state.generation;
    confirmationTimer = setTimeout(() => dispatch({ type: "confirmed", generation }), 550);
  }
}
document.querySelectorAll("[data-dismiss-preview]").forEach(button => button.addEventListener("click", () => dispatch({ type: "dismiss" })));
document.querySelector("#demo-reset").addEventListener("click", () => dispatch({ type: "reset" }));
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  for (const audio of [lossAudio, recoveryAudio]) audio.muted = !soundEnabled;
  if (soundEnabled && state.alert && (state.alert === "loss" ? lossAudio : recoveryAudio).paused) playAlert(state.alert);
  renderSound();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) dispatch({ type: "pause" }); else if (visible) dispatch({ type: "resume" });
});
window.addEventListener("pagehide", () => dispatch({ type: "pause" }));
new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  if (!visible) dispatch({ type: "pause" });
  else if (!document.hidden) dispatch({ type: "resume" });
}, { threshold: 0 }).observe(area);
motionPreference.addEventListener("change", () => { drawGlow(); settlePlug(); scheduleNudge(); });
let contourKey = "";
function updateDisplayContour() {
  const width = stage.clientWidth, height = stage.clientHeight;
  const style = getComputedStyle(stage);
  const notchWidth = parseFloat(style.getPropertyValue("--notch-width"));
  const notchHeight = parseFloat(style.getPropertyValue("--notch-height"));
  const topRadius = parseFloat(style.getPropertyValue("--display-radius"));
  const key = [width, height, notchWidth, notchHeight, topRadius].join(":");
  if (key === contourKey) return;
  const contour = displayContour({ width, height, notchWidth, notchHeight, topRadius });
  if (!contour) return;
  contourKey = key;
  const svg = stage.querySelector(".display-glow");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.querySelector("#display-outline").setAttribute("d", contour.path);
  svg.querySelector("#display-exterior").setAttribute("d", contour.exterior);
  svg.querySelector(".notch-housing").setAttribute("d", contour.housing);
  const glow = Math.max(6, Math.min(14, width * 28 / 1280));
  for (const [layer, filter, spread, blur] of [
    [layers.band, "glow-band-filter", .24, .275],
    [layers.compact, "glow-compact-filter", .08, .225],
    [layers.expanded, "glow-expanded-filter", .7, .95]
  ]) {
    layer.querySelector("use").setAttribute("stroke-width", String(glow * spread));
    const effect = svg.querySelector("#" + filter);
    effect.setAttribute("x", "-64"); effect.setAttribute("y", "-64");
    effect.setAttribute("width", String(width + 128)); effect.setAttribute("height", String(height + 128));
    effect.querySelector("feGaussianBlur").setAttribute("stdDeviation", String(glow * blur));
  }
}
new ResizeObserver(updateDisplayContour).observe(stage);
updateDisplayContour();
motionReady.then(() => { if (state.alert) drawGlow(); });
render(); drawGlow(); drawPlug(); scheduleNudge(1600);

const settingsDialog = document.querySelector("#settings-dialog");
const settingsOpener = document.querySelector("#settings-enlarge");
settingsOpener.addEventListener("click", () => {
  dispatch({ type: "pause" });
  settingsDialog.showModal();
  document.querySelector("#settings-close").focus();
});
document.querySelector("#settings-close").addEventListener("click", () => settingsDialog.close());
settingsDialog.addEventListener("close", () => settingsOpener.focus({ preventScroll: true }));
settingsDialog.addEventListener("click", event => { if (event.target === settingsDialog) settingsDialog.close(); });

function showRelease(metadata) {
  const release = releaseView(metadata);
  const link = document.querySelector("#download-link");
  link.href = release.href; link.textContent = release.action;
  document.querySelector("#download-status").textContent = release.status.replace("Free for Mac.", "Free.");
  document.querySelector("#release-detail").textContent = release.detail;
  document.querySelector(".availability-desktop").textContent = release.status;
  document.querySelector(".availability-mobile").textContent = release.available ? release.status : "Free for Mac. Download coming soon.";
  if (release.available) {
    const hero = document.querySelector("#hero-action");
    hero.href = release.href; hero.textContent = release.action;
  }
}
showRelease(null);
fetch("release.json", { cache: "no-cache" }).then(response => response.ok ? response.json() : null)
  .then(showRelease).catch(() => showRelease(null));
