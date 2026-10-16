const releasesURL = "https://github.com/austinpresley/PortPanic-Releases/releases";

export function releaseView(release) {
  const beta = release?.channel === "beta";
  const validChannel = !release?.channel || release.channel === "release"
    || (beta && Number.isSafeInteger(release.betaNumber) && release.betaNumber > 0);
  let url;
  try { url = new URL(release?.url); } catch { /* Unavailable metadata uses the coming-soon view. */ }
  const available = release?.available === true && validChannel && url?.origin === "https://github.com"
    && url.pathname.startsWith("/austinpresley/PortPanic-Releases/releases/download/")
    && !url.username && !url.password && !url.hash && !url.search
    && typeof release.version === "string" && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(release.version);
  if (!available) return {
    available: false, href: releasesURL, action: "View releases on GitHub",
    status: "Free for Mac. Public download coming soon.", detail: "Release checks are still in progress."
  };
  return {
    available: true, href: url.href, action: beta ? `Download Beta ${release.betaNumber} for Mac` : "Download for Mac",
    status: `Free. Version ${release.version}${beta ? ` Beta ${release.betaNumber}` : ""}.${typeof release.size === "string" && release.size ? ` ${release.size}.` : ""}`,
    detail: beta ? "Public beta for testing. Real-camera, extended-shooting and fresh-install checks are still in progress. Test with your setup before relying on it during a shoot."
      : "Open the DMG and drag PortPanic to Applications."
  };
}
