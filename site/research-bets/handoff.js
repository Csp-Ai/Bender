"use strict";

// Production Bender always opens canonical ResearchBets. Vercel previews
// automatically pair with the existing ResearchBets feature-branch alias.
// No ticket contents, credentials or screenshot data enter the handoff URL.
(function (root) {
  const PROD = "https://research-bets.vercel.app";
  const PREVIEW = "https://research-bets-git-feat-ben-b4e1c2-christopher-s-ponces-projects.vercel.app";
  const productionHosts = new Set([
    "bender-one-nu.vercel.app",
    "benderbtc.vercel.app",
    "bender-christopher-s-ponces-projects.vercel.app"
  ]);

  function originForHostname(hostname) {
    const host = String(hostname || "").toLowerCase();
    const isBenderPreview =
      /^(?:bender-|bender-git-)/.test(host) &&
      host.endsWith(".vercel.app") &&
      !productionHosts.has(host);
    return isBenderPreview ? PREVIEW : PROD;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { originForHostname };
  }

  if (!root || !root.document || !root.location) return;
  const destination = originForHostname(root.location.hostname);
  if (destination === PROD) return;

  for (const link of root.document.querySelectorAll("a[data-rb-destination]")) {
    const href = link.getAttribute("href");
    if (!href) continue;
    const original = new URL(href, root.location.origin);
    if (original.origin !== PROD) continue;
    link.href = destination + original.pathname + original.search + original.hash;
  }

  const label = root.document.getElementById("rb-destination-domain");
  if (label) label.textContent = new URL(destination).hostname;
})(typeof window !== "undefined" ? window : null);
