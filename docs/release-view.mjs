const releasesURL = "https://github.com/austinpresley/PortPanic-Releases/releases";

export function releaseView(release) {
  let url;
  try { url = new URL(release?.url); } catch { /* Unavailable metadata uses the coming-soon view. */ }
  const available = release?.available === true && url?.origin === "https://github.com"
    && url.pathname.startsWith("/austinpresley/PortPanic-Releases/releases/download/")
    && !url.username && !url.password && !url.hash && !url.search
    && typeof release.version === "string" && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(release.version);
  if (!available) return {
    available: false, href: releasesURL, action: "View releases on GitHub",
    status: "Free for Mac. Public download coming soon.", detail: "Release checks are still in progress."
  };
  return {
    available: true, href: url.href, action: "Download for Mac",
    status: `Free. Version ${release.version}.${typeof release.size === "string" && release.size ? ` ${release.size}.` : ""}`,
    detail: "Open the DMG and drag PortPanic to Applications."
  };
}
