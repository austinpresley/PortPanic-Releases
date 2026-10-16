// Geometry and drag rules for the landing page's cable control.
// Every value is in user units of the 600 by 120 drawing.
export const cable = Object.freeze({
  width: 600,
  exitX: 112, exitY: 62,   // where the wire leaves the camera
  minX: 160,               // the plug cannot be pulled closer to the camera
  restX: 236,              // where an unplugged plug comes to rest
  seatedX: 426,            // where the plug sits inside the port
  snapInX: 404,            // dragging this far seats the plug
  pullOutX: 386,           // pulling a seated plug back this far unplugs it
  tailOffset: 12,          // the wire attaches this far left of the plug origin
  leanX: 264               // an untouched plug leans this far toward the port, then settles back
});

export function clampPlug(x) {
  return Math.min(cable.seatedX, Math.max(cable.minX, x));
}

export function restingX(plugged) {
  return plugged ? cable.seatedX : cable.restX;
}

// A drag that crosses a threshold changes the cable at once, before release.
// The two thresholds overlap so a small tug on a seated plug does nothing.
export function dragCrossing(plugged, x) {
  if (!plugged && x >= cable.snapInX) return "plug";
  if (plugged && x <= cable.pullOutX) return "unplug";
  return null;
}

// The wire hangs between the camera and the plug. It droops when the plug is
// close to the camera and straightens as the plug reaches the port.
export function wirePath(x) {
  const start = cable.exitX;
  const end = clampPlug(x) - cable.tailOffset;
  const span = Math.max(0, end - start);
  const longest = cable.seatedX - cable.tailOffset - start;
  const slack = 1 - Math.min(1, span / longest);
  const sag = 5 + 32 * Math.pow(slack, 0.8);
  const pull = span * 0.38;
  const low = (cable.exitY + sag).toFixed(1);
  return `M${start} ${cable.exitY}C${(start + pull).toFixed(1)} ${low} ${(end - pull).toFixed(1)} ${low} ${end} ${cable.exitY}`;
}

// One frame of a lightly underdamped spring toward the target. The port is a
// hard stop, so the plug thuds into it instead of passing through.
export function stepSpring(position, velocity, target, dt, { stiffness = 170, damping = 17 } = {}) {
  const step = Math.min(Math.max(dt, 0), 1 / 30);
  let v = velocity + (stiffness * (target - position) - damping * velocity) * step;
  let x = position + v * step;
  if (x >= cable.seatedX) { x = cable.seatedX; v = Math.min(0, v); }
  if (x <= cable.minX) { x = cable.minX; v = Math.max(0, v); }
  const settled = Math.abs(v) < 0.5 && Math.abs(target - x) < 0.25;
  return { position: settled ? target : x, velocity: settled ? 0 : v, settled };
}
