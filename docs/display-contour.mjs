// The web illustration uses the app's notch bend proportions: height / 8
// at each shoulder and height / 4 at the lower corners. ADR 0032.
export function displayContour({ width, height, notchWidth = 65, notchHeight = 11, topRadius = 7 }) {
  if (![width, height, notchWidth, notchHeight, topRadius].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  const radius = Math.max(0, Math.min(topRadius, width / 2, height / 2));
  const depth = Math.max(0, Math.min(notchHeight, height - radius));
  const housingWidth = Math.max(0, Math.min(notchWidth, width - 2 * radius - depth / 4));
  const n = value => Number(value.toFixed(3));
  const exterior = path => `M -64 -64 H ${n(width + 64)} V ${n(height + 64)} H -64 Z ${path}`;
  const end = `H ${n(width - radius)} A ${n(radius)} ${n(radius)} 0 0 1 ${n(width)} ${n(radius)} V ${n(height)} H 0 V ${n(radius)} A ${n(radius)} ${n(radius)} 0 0 1 ${n(radius)} 0 Z`;
  if (!depth || !housingWidth) {
    const path = `M ${n(radius)} 0 ${end}`;
    return { width, height, path, exterior: exterior(path), housing: "", notch: null };
  }
  const left = (width - housingWidth) / 2;
  const right = left + housingWidth;
  const shoulder = Math.min(depth / 8, housingWidth / 2);
  const lower = Math.min(depth / 4, housingWidth / 2);
  const bend = `H ${n(left - shoulder)} A ${n(shoulder)} ${n(shoulder)} 0 0 1 ${n(left)} ${n(shoulder)} V ${n(depth - lower)} A ${n(lower)} ${n(lower)} 0 0 0 ${n(left + lower)} ${n(depth)} H ${n(right - lower)} A ${n(lower)} ${n(lower)} 0 0 0 ${n(right)} ${n(depth - lower)} V ${n(shoulder)} A ${n(shoulder)} ${n(shoulder)} 0 0 1 ${n(right + shoulder)} 0`;
  const housing = `M ${n(left - shoulder)} 0 H ${n(right + shoulder)} A ${n(shoulder)} ${n(shoulder)} 0 0 0 ${n(right)} ${n(shoulder)} V ${n(depth - lower)} A ${n(lower)} ${n(lower)} 0 0 1 ${n(right - lower)} ${n(depth)} H ${n(left + lower)} A ${n(lower)} ${n(lower)} 0 0 1 ${n(left)} ${n(depth - lower)} V ${n(shoulder)} A ${n(shoulder)} ${n(shoulder)} 0 0 0 ${n(left - shoulder)} 0 Z`;
  const path = `M ${n(radius)} 0 ${bend} ${end}`;
  return { width, height, path, exterior: exterior(path), housing,
    notch: { left, right, depth, shoulder, lower } };
}
