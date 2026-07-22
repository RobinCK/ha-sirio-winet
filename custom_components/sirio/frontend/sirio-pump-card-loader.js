/*
 * Resilient bootstrap for sirio-pump-card.
 *
 * Lovelace imports each resource exactly once per page session with no retry.
 * Right after a Home Assistant restart the card file may briefly 404 (the
 * integration registers its static path during startup), and on the mobile
 * app a flaky network can fail the one-shot import — either way the dashboard
 * is stuck with "Custom element not found: sirio-pump-card" until a full
 * reload. This tiny loader retries the import with backoff (using a fresh
 * query string, so a failed module-map entry or cached error is bypassed) and
 * re-checks whenever the app returns to the foreground. Once the element is
 * defined, Lovelace rebuilds the cards automatically.
 */
(() => {
  const TAG = "sirio-pump-card";
  const MAX_ATTEMPTS = 8;

  let base;
  let version = "";
  try {
    const self = new URL(import.meta.url);
    base = new URL("./sirio-pump-card.js", self);
    version = self.searchParams.get("v") || "";
  } catch (_err) {
    base = new URL("/sirio/sirio-pump-card.js", location.origin);
  }

  let attempt = 0;
  let scheduled = false;

  const schedule = (delay) => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      tryLoad();
    }, delay);
  };

  const tryLoad = () => {
    if (customElements.get(TAG) || attempt >= MAX_ATTEMPTS) {
      return;
    }
    attempt += 1;
    const url = new URL(base);
    if (version) {
      url.searchParams.set("v", version);
    }
    if (attempt > 1) {
      // Fresh specifier: bypasses this document's failed module-map entry
      // and any intermediary that cached an error response.
      url.searchParams.set("r", String(attempt));
    }
    import(url.href).catch(() => {
      schedule(Math.min(1500 * attempt, 10000));
    });
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !customElements.get(TAG)) {
      attempt = Math.min(attempt, MAX_ATTEMPTS - 1);
      schedule(0);
    }
  });

  tryLoad();
})();
