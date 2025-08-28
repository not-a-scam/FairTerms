// src/offscreen.ts

// --- Early listener registration prevents offscreen init races ---
let _enginePromise: Promise<any> | null = null;

// Public message router
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "PING_OFFSCREEN") {
        // Used by background.ts to confirm offscreen is alive
        sendResponse({ ok: true, pong: true });
        return;
      }

      if (msg?.type === "SUMMARISE_TEXT") {
        const { text, url, title } = msg as { text: string; url: string; title: string };
        const markdown = await summariseTermsAndConditions(text, url, title);
        sendResponse({ ok: true, markdown });
        return;
      }
    } catch (e: any) {
      console.error("[offscreen] handler error:", e);
      sendResponse({ ok: false, error: e?.stack || e?.message || String(e) });
    }
  })();

  // Keep the channel open for async responses
  return true;
});

console.log("[offscreen] script loaded, listener registered");

// ---------- Engine setup (lazy) ----------
async function getEngine() {
  if (!_enginePromise) {
    _enginePromise = (async () => {
      console.log("[offscreen] importing @mlc-ai/web-llm …");
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

      const initProgressCallback = (p: any /* InitProgressReport */) => {
        // Optional: surface model download/compile progress to popup via background
        chrome.runtime.sendMessage({ type: "MODEL_PROGRESS", progress: p });
      };

      // Start with a small, quick model for best UX. You can switch later.
      const model = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
      console.log("[offscreen] creating engine for", model);
      const engine = await CreateMLCEngine(model, { initProgressCallback });
      console.log("[offscreen] engine ready");
      return engine;
    })().catch((e) => {
      console.error("[offscreen] engine init failed:", e);
      throw e;
    });
  }
  return _enginePromise;
}

// ---------- Text utilities ----------
function splitIntoChunks(text: string, targetChars = 6000): string[] {
  // Prefer splitting on paragraphs; then sentences; finally hard cut
  const paras = text.split(/\n{2,}/g).map(s => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";

  for (const p of paras) {
    const candidate = buf ? `${buf}\n\n${p}` : p;
    if (candidate.length > targetChars) {
      if (buf) chunks.push(buf);
      if (p.length > targetChars) {
        // split very long paragraph by sentences
        const segs = p.split(/(?<=[.!?])\s+/).filter(Boolean);
        let sb = "";
        for (const s of segs) {
          const cand = sb ? `${sb} ${s}` : s;
          if (cand.length > targetChars) {
            if (sb) chunks.push(sb);
            sb = s;
          } else {
            sb = cand;
          }
        }
        if (sb) chunks.push(sb);
        buf = "";
      } else {
        buf = p;
      }
    } else {
      buf = candidate;
    }
  }
  if (buf) chunks.push(buf);

  // Always return something
  return chunks.length ? chunks : [text.slice(0, targetChars)];
}

function keepOnlyBullets(md: string): string {
  return md
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => /^[-*•]\s+/.test(s))
    .map(s => s.replace(/^[-*•]\s+/, "- "))
    .join("\n");
}

function clampChars(s: string, max = 48000) {
  return s.length > max ? s.slice(0, max) : s;
}

// ---------- LLM calls ----------
async function llmSummariseTnCChunk(engine: any, chunk: string, title: string, url: string) {
  // Focus the model on T&C / policy essentials
  const messages = [
    {
      role: "system",
      content:
        "You are a compliance assistant. Summarise Terms & Conditions or a Privacy Policy. " +
        "Return ONLY 3–5 concise markdown bullets focusing on: user obligations; company rights; fees/payment; " +
        "data collection/usage/retention; cancellation/termination; dispute resolution/governing law. " +
        "Plain language. No headings, no titles, no URLs, no preamble—bullets only."
    },
    {
      role: "user",
      content: clampChars(chunk, 7000)
    }
  ];

  const res = await (await engine).chat.completions.create({
    messages,
    temperature: 0.2,
    max_tokens: 220
  });
  return keepOnlyBullets(res.choices?.[0]?.message?.content ?? "");
}

async function llmCombineBullets(engine: any, bulletsBlocks: string[]) {
  const joined = bulletsBlocks.join("\n");
  const messages = [
    {
      role: "system",
      content:
        "Combine bullets from multiple sections into a single list of the 5–7 most important points. " +
        "Avoid repetition. Output ONLY markdown bullets—no headings or preambles."
    },
    { role: "user", content: clampChars(joined, 12000) }
  ];

  const res = await (await engine).chat.completions.create({
    messages,
    temperature: 0.2,
    max_tokens: 260
  });
  return keepOnlyBullets(res.choices?.[0]?.message?.content ?? "");
}

async function llmRiskPass(engine: any, finalBullets: string) {
  const messages = [
    {
      role: "system",
      content:
        "You are a cautious risk reviewer. From the bullets below, flag 2–4 potential risks or gotchas for the user. " +
        "Examples: unilateral changes, broad data sharing/retention, arbitration/no class action, auto-renewal, fees, " +
        "Indemnity, limitation of liability, IP assignment, jurisdiction. Output ONLY markdown bullets in plain English."
    },
    { role: "user", content: clampChars(finalBullets, 6000) }
  ];

  const res = await (await engine).chat.completions.create({
    messages,
    temperature: 0.2,
    max_tokens: 180
  });
  return keepOnlyBullets(res.choices?.[0]?.message?.content ?? "");
}

// ---------- Orchestration ----------
async function summariseTermsAndConditions(fullText: string, url: string, title: string) {
  const engine = await getEngine();

  // If short, one-shot
  if (fullText.length <= 6000) {
    const bullets = await llmSummariseTnCChunk(engine, fullText, title, url);
    const risks = await llmRiskPass(engine, bullets);
    return `### Key Terms & Conditions\n${bullets || "- (No key points found)"}\n\n### Potential Risks\n${risks || "- (No obvious risks detected)"}`;
  }

  // Long: chunk → summarise each → combine → risk pass
  const chunks = splitIntoChunks(fullText, 6000);
  const partials: string[] = [];
  for (const c of chunks) {
    if (partials.length >= 8) break; // cap work for huge docs
    const out = await llmSummariseTnCChunk(engine, c, title, url);
    if (out) partials.push(out);
  }

  const combined = partials.length
    ? await llmCombineBullets(engine, partials)
    : "- (No key points found)";

  const risks = await llmRiskPass(engine, combined);
  return `### Key Terms & Conditions\n${combined}\n\n### Potential Risks\n${risks || "- (No obvious risks detected)"}`;
}
