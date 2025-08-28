// src/background.ts

// ---------- helpers ----------
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Find a loadable offscreen HTML inside the packed extension.
// Adjust the candidate list if your build places it elsewhere.
async function resolveOffscreenURL(): Promise<string> {
  const candidates = [
    "offscreen.html",      // root (preferred)
    "html/offscreen.html", // sometimes ends up under /html
  ];

  for (const rel of candidates) {
    const url = chrome.runtime.getURL(rel);
    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (resp.ok) {
        console.log("[bg] Found offscreen at", rel);
        return url;
      } else {
        console.warn("[bg] Not found (status):", rel, resp.status);
      }
    } catch (e) {
      console.warn("[bg] Not found (exception):", rel, e);
    }
  }

  throw new Error(
    "offscreen.html not found in extension package. Ensure dist contains offscreen.html next to offscreen.js (or under html/)."
  );
}

async function tryPingOffscreen(timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await chrome.runtime.sendMessage({ type: "PING_OFFSCREEN" });
    clearTimeout(timer);
    return !!(resp && resp.ok && resp.pong);
  } catch {
    clearTimeout(timer);
    return false;
  }
}

async function waitForOffscreenReady(totalMs: number): Promise<boolean> {
  const step = 250;
  for (let t = 0; t < totalMs; t += step) {
    if (await tryPingOffscreen(step)) return true;
    await sleep(step);
  }
  return false;
}

// Create the offscreen document (idempotent) and ensure it responds to PING.
async function ensureOffscreen(): Promise<void> {
  try {
    // @ts-ignore - not present in older Chrome builds
    if (await chrome.offscreen.hasDocument?.()) {
      if (await tryPingOffscreen(1000)) {
        console.log("[bg] Offscreen already alive");
        return;
      }
      console.warn("[bg] Offscreen exists but not responsive; recreating");
    }
  } catch {
    // ignore
  }

  const url = await resolveOffscreenURL();
  console.log("[bg] Creating offscreen:", url);

  try {
    await chrome.offscreen.createDocument({
      url,
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING], // closest acceptable reason
      justification: "Run WebLLM (WebGPU) in a hidden page."
    });
  } catch (e: any) {
    // If it already exists, creation can throw; surface only real failures.
    console.error("[bg] offscreen.createDocument failed:", e);
    throw e;
  }

  const ok = await waitForOffscreenReady(5000);
  if (!ok) throw new Error("Offscreen page did not initialise.");
}

// Pull text from the active tab via the content script and guard restricted pages.
async function getActiveTabText(): Promise<{ text: string; url: string; title: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error("No active tab");

  const u = new URL(tab.url);
  const restrictedSchemes = new Set(["chrome", "edge", "about"]);
  const isRestrictedScheme = restrictedSchemes.has(u.protocol.replace(":", ""));
  const isChromeExt = u.protocol === "chrome-extension:";
  const isPDFViewer =
    isChromeExt && u.origin === "chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai";
  const isFile = u.protocol === "file:";

  if (isRestrictedScheme || isChromeExt || isPDFViewer) {
    throw new Error("This page type is restricted; try on a normal website.");
  }
  if (isFile) {
    throw new Error('Local file detected. Enable “Allow access to file URLs” for this extension and retry.');
  }

  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_TEXT" });
    if (!res?.text) throw new Error("No text found on this page.");
    return res as { text: string; url: string; title: string };
  } catch (e: any) {
    if ((e?.message || "").includes("Receiving end does not exist")) {
      throw new Error("Content script is not running on this page. Reload the tab or try another site.");
    }
    throw e;
  }
}

// ---------- message router ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "RUN_SUMMARY") {
      try {
        const { text, url, title } = await getActiveTabText();
        await ensureOffscreen();
        const resp = await chrome.runtime.sendMessage({
          type: "SUMMARISE_TEXT",
          text,
          url,
          title
        });
        if (!resp) throw new Error("Offscreen did not respond.");
        sendResponse(resp);
      } catch (e: any) {
        console.error("[bg] RUN_SUMMARY error:", e);
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    }
  })();
  return true; // keep the message channel open for async reply
});
