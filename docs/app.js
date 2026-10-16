"use strict";
const screen = document.querySelector("#demo-screen");
const status = document.querySelector("#card-status");
const detail = document.querySelector("#card-detail");
const speed = document.querySelector("#card-speed");
const caption = document.querySelector("#demo-caption");
let recoveryTimer;
const descriptions = {
  connected: ["Connected", "Tethered to Capture One", "An illustration of the app. This preview stays silent."],
  loss: ["Lost", "Camera disconnected", "Loss repeats until you dismiss it or the camera returns. This preview stays silent."],
  recovery: ["Connected", "Tethered to Capture One", "Recovery confirms the camera is back, then fades away. This preview stays silent."]
};
function showAlert(state) {
  clearTimeout(recoveryTimer);
  screen.dataset.state = state;
  status.replaceChildren(Object.assign(document.createElement("i"), { ariaHidden: "true" }), document.createTextNode(descriptions[state][0]));
  detail.textContent = descriptions[state][1];
  speed.textContent = state === "loss" ? "" : "5 Gb/s";
  caption.textContent = descriptions[state][2];
  screen.setAttribute("aria-label", `Illustrated PortPanic ${state} preview for Canon EOS R5`);
  document.querySelectorAll("[data-alert]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.alert === state)));
  if (state === "recovery") recoveryTimer = setTimeout(() => { screen.dataset.state = "connected"; }, 3000);
}
document.querySelectorAll("[data-alert]").forEach(button => button.addEventListener("click", () => showAlert(button.dataset.alert)));
fetch("release.json", { cache: "no-cache" }).then(response => response.ok ? response.json() : null).then(release => {
  if (!release || !release.available || !/^https:\/\/github\.com\/austinpresley\/PortPanic-Releases\/releases\/download\//.test(release.url)) return;
  const link = document.querySelector("#download-link");
  link.href = release.url;
  link.firstChild.textContent = "Download for Mac ";
  document.querySelector("#download-status").textContent = `Free. Version ${release.version}. ${release.size || "Signed and notarized."}`;
}).catch(() => {});
