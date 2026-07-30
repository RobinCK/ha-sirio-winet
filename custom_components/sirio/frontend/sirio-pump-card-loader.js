/*
 * Resilient bootstrap for sirio-pump-card.
 *
 * Lovelace imports each resource exactly once per page session with no
 * retry, so a single failed request (HA restarting, phone switching
 * networks, app cold-started away from home) leaves the dashboard stuck
 * with "Custom element not found: sirio-pump-card" until a full reload.
 *
 * This loader is served from a STABLE URL (no version query), so once a
 * client fetched it successfully it stays in the HTTP cache and runs even
 * when the session starts without connectivity. It imports the card lazily
 * (giving the directly registered, version-busted card resource a head
 * start), retries failures with backoff using a fresh query string (which
 * bypasses the document's failed module-map entry), and restarts the retry
 * round whenever the page returns to the foreground or the network comes
 * back. Once the element defines, Lovelace rebuilds the cards on its own.
 */
(() => {
  const TAG = "sirio-pump-card";
  const MAX_ATTEMPTS_PER_ROUND = 8;
  const FIRST_DELAY = 1200;

  if (window.__sirioPumpLoader) {
    return; // delivered twice (resource + extra module) — one instance is enough
  }

  let base;
  let version = "";
  try {
    const self = new URL(import.meta.url);
    base = new URL("./sirio-pump-card.js", self);
    version = self.searchParams.get("v") || "";
  } catch (_err) {
    base = new URL("/sirio/sirio-pump-card.js", location.origin);
  }

  const state = { attempt: 0, bust: 0, timer: 0 };
  window.__sirioPumpLoader = state;

  const done = () => Boolean(customElements.get(TAG));

  const schedule = (delay) => {
    clearTimeout(state.timer);
    state.timer = setTimeout(tryLoad, delay);
  };

  const tryLoad = () => {
    if (done() || state.attempt >= MAX_ATTEMPTS_PER_ROUND) {
      return;
    }
    state.attempt += 1;
    state.bust += 1;
    const url = new URL(base);
    if (version) {
      url.searchParams.set("v", version);
    }
    if (state.bust > 1) {
      // Fresh specifier: bypasses this document's failed module-map entry
      // and any intermediary that cached an error response.
      url.searchParams.set("r", String(state.bust));
    }
    import(url.href).catch(() => {
      schedule(Math.min(1000 * state.attempt, 8000));
    });
  };

  // A wake-up signal starts a fresh retry round: the app came back to the
  // foreground, the page was restored from the back/forward cache, or the
  // network returned. Each round gets the full attempt budget again.
  const rearm = () => {
    if (done()) {
      return;
    }
    state.attempt = 0;
    schedule(250);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      rearm();
    }
  });
  window.addEventListener("pageshow", rearm);
  window.addEventListener("online", rearm);

  // Defer the first attempt so the version-busted card resource that
  // Lovelace imports directly wins in healthy sessions (no double fetch).
  schedule(FIRST_DELAY);
})();
