// // src/offscreen.ts

// // --- Early listener registration prevents offscreen init races ---
// let _enginePromise: Promise<any> | null = null;

// // Public message router
// chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
//   (async () => {
//     try {
//       if (msg?.type === "PING_OFFSCREEN") {
//         // Used by background.ts to confirm offscreen is alive
//         sendResponse({ ok: true, pong: true });
//         return;
//       }

//       if (msg?.type === "SUMMARISE_TEXT") {
//         const { text, url, title } = msg as { text: string; url: string; title: string };
//         const summary = await summariseTermsAndConditions(text, url, title);
//         sendResponse({ ok: true, summary });
//         return;
//       }
//     } catch (e: any) {
//       console.error("[offscreen] handler error:", e);
//       sendResponse({ ok: false, error: e?.stack || e?.message || String(e) });
//     }
//   })();

//   // Keep the channel open for async responses
//   return true;
// });

// console.log("[offscreen] script loaded, listener registered");

// // ---------- Engine setup (lazy) ----------
// async function getEngine() {
//   if (!_enginePromise) {
//     _enginePromise = (async () => {
//       console.log("[offscreen] importing @mlc-ai/web-llm …");
//       const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

//       const initProgressCallback = (p: any /* InitProgressReport */) => {
//         // Optional: surface model download/compile progress to popup via background
//         chrome.runtime.sendMessage({ type: "MODEL_PROGRESS", progress: p });
//       };

//       // Start with a small, quick model for best UX. You can switch later.
//       const model = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
//       console.log("[offscreen] creating engine for", model);
//       const engine = await CreateMLCEngine(model, { initProgressCallback });
//       console.log("[offscreen] engine ready");
//       return engine;
//     })().catch((e) => {
//       console.error("[offscreen] engine init failed:", e);
//       throw e;
//     });
//   }
//   return _enginePromise;
// }

// // ---------- Text utilities ----------
// function splitIntoChunks(text: string, targetChars = 6000): string[] {
//   // Prefer splitting on paragraphs; then sentences; finally hard cut
//   const paras = text.split(/\n{2,}/g).map(s => s.trim()).filter(Boolean);
//   const chunks: string[] = [];
//   let buf = "";

//   for (const p of paras) {
//     const candidate = buf ? `${buf}\n\n${p}` : p;
//     if (candidate.length > targetChars) {
//       if (buf) chunks.push(buf);
//       if (p.length > targetChars) {
//         // split very long paragraph by sentences
//         const segs = p.split(/(?<=[.!?])\s+/).filter(Boolean);
//         let sb = "";
//         for (const s of segs) {
//           const cand = sb ? `${sb} ${s}` : s;
//           if (cand.length > targetChars) {
//             if (sb) chunks.push(sb);
//             sb = s;
//           } else {
//             sb = cand;
//           }
//         }
//         if (sb) chunks.push(sb);
//         buf = "";
//       } else {
//         buf = p;
//       }
//     } else {
//       buf = candidate;
//     }
//   }
//   if (buf) chunks.push(buf);

//   // Always return something
//   return chunks.length ? chunks : [text.slice(0, targetChars)];
// }

// function keepOnlyBullets(md: string): string {
//   return md
//     .split(/\r?\n/)
//     .map(s => s.trim())
//     .filter(s => /^[-*•]\s+/.test(s))
//     .map(s => s.replace(/^[-*•]\s+/, "- "))
//     .join("\n");
// }

// function clampChars(s: string, max = 48000) {
//   return s.length > max ? s.slice(0, max) : s;
// }

// // ---------- LLM calls ----------
// // async function llmSummariseTnCChunk(engine: any, chunk: string, title: string, url: string) {
// //   // Focus the model on T&C / policy essentials
// //   const messages = [
// //     {
// //       role: "system",
// //       content:
// //         "You are a compliance assistant. Summarise Terms & Conditions or a Privacy Policy. " +
// //         "Return ONLY 3–5 concise markdown bullets focusing on: user obligations; company rights; fees/payment; " +
// //         "data collection/usage/retention; cancellation/termination; dispute resolution/governing law. " +
// //         "Plain language. No headings, no titles, no URLs, no preamble—bullets only."
// //     },
// //     {
// //       role: "user",
// //       content: clampChars(chunk, 7000)
// //     }
// //   ];

// //   const res = await (await engine).chat.completions.create({
// //     messages,
// //     temperature: 0.2,
// //     max_tokens: 220
// //   });
// //   return keepOnlyBullets(res.choices?.[0]?.message?.content ?? "");
// // }

// // async function llmCombineBullets(engine: any, bulletsBlocks: string[]) {
// //   const joined = bulletsBlocks.join("\n");
// //   const messages = [
// //     {
// //       role: "system",
// //       content:
// //         "Combine bullets from multiple sections into a single list of the 5–7 most important points. " +
// //         "Avoid repetition. Output ONLY markdown bullets—no headings or preambles."
// //     },
// //     { role: "user", content: clampChars(joined, 12000) }
// //   ];

// //   const res = await (await engine).chat.completions.create({
// //     messages,
// //     temperature: 0.2,
// //     max_tokens: 260
// //   });
// //   return keepOnlyBullets(res.choices?.[0]?.message?.content ?? "");
// // }

// // async function llmRiskPass(engine: any, finalBullets: string) {
// //   const messages = [
// //     {
// //       role: "system",
// //       content:
// //         "You are a cautious risk reviewer. From the bullets below, flag 2–4 potential risks or gotchas for the user. " +
// //         "Examples: unilateral changes, broad data sharing/retention, arbitration/no class action, auto-renewal, fees, " +
// //         "Indemnity, limitation of liability, IP assignment, jurisdiction. Output ONLY markdown bullets in plain English."
// //     },
// //     { role: "user", content: clampChars(finalBullets, 6000) }
// //   ];

// //   const res = await (await engine).chat.completions.create({
// //     messages,
// //     temperature: 0.2,
// //     max_tokens: 180
// //   });
// //   return keepOnlyBullets(res.choices?.[0]?.message?.content ?? "");
// // }
// async function llmSummariseTnCChunk(engine: any, chunk: string, title: string, url: string) {
//   const messages = [
//     {
//       role: "system",
//       content:
//         "You are a compliance assistant. Summarise Terms & Conditions or a Privacy Policy. " +
//         "Categorise key points into JSON with arrays: {\"Good\":[], \"Neutral\":[], \"Bad\":[]}." +
//         "Good = user benefits, rights, protections. " +
//         "Neutral = general info, standard clauses. " +
//         "Bad = risks, obligations, restrictions, unilateral changes. " +
//         "Return ONLY valid JSON, no markdown, no preamble."
//     },
//     { role: "user", content: clampChars(chunk, 7000) }
//   ];

//   const res = await (await engine).chat.completions.create({
//     messages,
//     temperature: 0.2,
//     max_tokens: 400
//   });

//   let txt = res.choices?.[0]?.message?.content ?? "{}";
//   try {
//     console.log("Raw LLM output:", txt);
//     return JSON.parse(txt);
//   } catch {
//     console.warn("LLM did not return valid JSON, wrapping.");
//     return { Good: [], Neutral: [], Bad: [txt] };
//   }
// }

// async function llmRiskPass(engine: any, finalBullets: string) {
//   const messages = [
//     {
//       role: "system",
//       content:
//         "You are a cautious risk reviewer. From the text below, extract 2–4 potential risks or gotchas for the user. " +
//         "Examples: unilateral changes, broad data sharing, arbitration/no class action, auto-renewal, fees, indemnity, limitation of liability, jurisdiction. " +
//         "Return ONLY a JSON array of plain-English strings. Example: [\"Company may change terms anytime\", \"Broad data collection\"]"
//     },
//     { role: "user", content: clampChars(finalBullets, 6000) }
//   ];

//   const res = await (await engine).chat.completions.create({
//     messages,
//     temperature: 0.2,
//     max_tokens: 150
//   });

//   let txt = res.choices?.[0]?.message?.content ?? "[]";
//   try {
//     console.log("Raw LLM output:", txt);
//     return JSON.parse(txt);
//   } catch {
//     console.warn("Risk pass not valid JSON, wrapping.");
//     return [txt];
//   }
// }

// // ---------- Orchestration ----------
// // async function summariseTermsAndConditions(fullText: string, url: string, title: string) {
// //   const engine = await getEngine();

// //   // Helper to send progress (0–100)
// //   const sendProgress = (percent: number) => {
// //     try {
// //       chrome.runtime.sendMessage({ type: "MODEL_PROGRESS", progress: percent });
// //     } catch {
// //       // ignore if popup not listening
// //     }
// //   };

// //   // If short, one-shot
// //   if (fullText.length <= 6000) {
// //     sendProgress(0);
// //     const bullets = await llmSummariseTnCChunk(engine, fullText, title, url);
// //     sendProgress(50); // midway: summarisation done
// //     const risks = await llmRiskPass(engine, bullets);
// //     sendProgress(100); // done
// //     return `### Key Terms & Conditions\n${bullets || "- (No key points found)"}\n\n### Potential Risks\n${risks || "- (No obvious risks detected)"}`;
// //   }

// //   // Long: chunk → summarise each → combine → risk pass
// //   const chunks = splitIntoChunks(fullText, 6000);
// //   const partials: string[] = [];

// //   for (let i = 0; i < chunks.length && partials.length < 8; i++) {
// //     const chunk = chunks[i];
// //     const out = await llmSummariseTnCChunk(engine, chunk, title, url);
// //     if (out) partials.push(out);

// //     // Send progress after each chunk
// //     const percent = Math.round(((i + 1) / chunks.length) * 70); 
// //     // 0–70%: summarising chunks, 30% reserved for combining + risk pass
// //     sendProgress(percent);
// //   }

// //   const combined = partials.length
// //     ? await llmCombineBullets(engine, partials)
// //     : "- (No key points found)";

// //   sendProgress(85); // after combining bullets

// //   const risks = await llmRiskPass(engine, combined);
// //   sendProgress(100); // done

// //   return `### Key Terms & Conditions\n${combined}\n\n### Potential Risks\n${risks || "- (No obvious risks detected)"}`;
// // }
// function mergeSummaries(parts: any[]): { Good: string[]; Neutral: string[]; Bad: string[] } {
//    const out: { Good: string[]; Neutral: string[]; Bad: string[] } = { Good: [], Neutral: [], Bad: [] };
//   for (const p of parts) {
//     out.Good.push(...(p.Good || []));
//     out.Neutral.push(...(p.Neutral || []));
//     out.Bad.push(...(p.Bad || []));
//   }
//   return out;
// }

// async function summariseTermsAndConditions(fullText: string, url: string, title: string) {
//   const engine = await getEngine();

//   const sendProgress = (percent: number) => {
//     try { chrome.runtime.sendMessage({ type: "MODEL_PROGRESS", progress: percent }); } catch {}
//   };

//   const summariseOne = async (txt: string) => {
//     const summary = await llmSummariseTnCChunk(engine, txt, title, url);
//     return summary;
//   };

//   if (fullText.length <= 6000) {
//     sendProgress(0);
//     const summary = await summariseOne(fullText);
//     sendProgress(70);

//     // risk pass → append to Bad
//     const risks = await llmRiskPass(engine, [...summary.Good, ...summary.Neutral, ...summary.Bad].join("\n"));
//     summary.Bad.push(...risks);
//     sendProgress(100);
//     return summary;
//   }

//   // Long doc → chunked
//   const chunks = splitIntoChunks(fullText, 6000);
//   const partials: any[] = [];

//   for (let i = 0; i < chunks.length && partials.length < 8; i++) {
//     const out = await summariseOne(chunks[i]);
//     partials.push(out);
//     sendProgress(Math.round(((i + 1) / chunks.length) * 70));
//   }

//   // Merge all chunk summaries
//   const combined = mergeSummaries(partials);

//   sendProgress(85);

//   // risk pass on combined → append into Bad
//   const risks = await llmRiskPass(engine, [...combined.Good, ...combined.Neutral, ...combined.Bad].join("\n"));
//   combined.Bad.push(...risks);

//   sendProgress(100);
//   return combined;
// }

// src/offscreen.ts

let _enginePromise: Promise<any> | null = null;

// ----------------- Engine Setup -----------------
async function getEngine() {
  if (!_enginePromise) {
    _enginePromise = (async () => {
      console.log("[offscreen] importing @mlc-ai/web-llm …");
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

      const initProgressCallback = (p: any) =>
        chrome.runtime.sendMessage({ type: "MODEL_PROGRESS", progress: p });

      const model = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
      console.log("[offscreen] creating engine for", model);
      const engine = await CreateMLCEngine(model, { initProgressCallback });
      console.log("[offscreen] engine ready");
      return engine;
    })().catch(e => {
      console.error("[offscreen] engine init failed:", e);
      throw e;
    });
  }
  return _enginePromise;
}

// ----------------- Text Utilities -----------------
function splitIntoChunks(text: string, targetChars = 6000): string[] {
  const paras = text.split(/\n{2,}/g).map(s => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";

  for (const p of paras) {
    const candidate = buf ? `${buf}\n\n${p}` : p;
    if (candidate.length > targetChars) {
      if (buf) chunks.push(buf);
      if (p.length > targetChars) {
        const segs = p.split(/(?<=[.!?])\s+/).filter(Boolean);
        let sb = "";
        for (const s of segs) {
          const cand = sb ? `${sb} ${s}` : s;
          if (cand.length > targetChars) {
            if (sb) chunks.push(sb);
            sb = s;
          } else sb = cand;
        }
        if (sb) chunks.push(sb);
        buf = "";
      } else buf = p;
    } else buf = candidate;
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [text.slice(0, targetChars)];
}

function clampChars(s: string, max = 48000) {
  return s.length > max ? s.slice(0, max) : s;
}

function cleanList(arr: string[], maxItems = 7) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const item = s.trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
    if (out.length >= maxItems) break;
  }
  return out;
}

function mergeSummaries(parts: Summary[]): Summary {
  const out: Summary = { Good: [], Neutral: [], Bad: [] };
  for (const p of parts) {
    out.Good.push(...p.Good);
    out.Neutral.push(...p.Neutral);
    out.Bad.push(...p.Bad);
  }
   // Ensure Good is never empty
  if (out.Good.length === 0) {
    out.Good.push("No user benefits");
  }
  return out;
}

// ----------------- Types -----------------
type Summary = { Good: string[]; Neutral: string[]; Bad: string[] };

// ----------------- LLM Calls -----------------
async function llmSummariseTnCChunk(engine: any, chunk: string, title: string, url: string): Promise<Summary> {
  const prompt = `
You are a Terms & Conditions summarizer.

Summarise the input text into three categories: Good, Neutral, and Bad.
- Good: Positive points for the user.
- Neutral: Informational points, neither good nor bad.
- Bad: Potential risks or obligations for the user.

Return ONLY valid JSON with this exact structure:

{
  "Good": [ "point1", "point2", ... ],
  "Neutral": [ "point1", "point2", ... ],
  "Bad": [ "point1", "point2", ... ]
}

Do NOT include:
- Markdown
- Code fences
- Nested objects
- Any text outside the JSON

Make sure to provide at least 1–3 items in each category, if present.
Each bullet point should be concise, plain English, 1–2 sentences max.
Text to summarise:
${clampChars(chunk, 7000)}
`;

  const res = await (await engine).chat.completions.create({
    messages: [{ role: "system", content: "You are a T&C summariser." }, { role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 220
  });

  const raw = res.choices?.[0]?.message?.content ?? "";
  console.log("Raw LLM output:", raw);

  try {
    return JSON.parse(raw.replace(/```json/i, "").replace(/```/g, "").trim());
  } catch (e) {
    console.warn("LLM did not return valid JSON, wrapping.", raw);
    return { Good: [], Neutral: [], Bad: [] };
  }
}

// async function llmRiskPass(engine: any, finalBullets: string): Promise<string[]> {
//   const prompt = `
// You are a cautious risk reviewer. From the text below, extract 2–4 potential risks or gotchas for the user.
// Return ONLY a JSON array of plain-English strings. No explanations.

// Text:
// ${clampChars(finalBullets, 6000)}
// `;

//   const res = await (await engine).chat.completions.create({
//     messages: [{ role: "system", content: "Risk reviewer" }, { role: "user", content: prompt }],
//     temperature: 0.2,
//     max_tokens: 180
//   });

//   const raw = res.choices?.[0]?.message?.content ?? "";
//   try {
//     return JSON.parse(raw.replace(/```json/i, "").replace(/```/g, "").trim());
//   } catch (e) {
//     console.warn("Risk pass not valid JSON, wrapping", raw);
//     return [raw];
//   }
// }

// ----------------- Orchestration -----------------
async function summariseTermsAndConditions(fullText: string, url: string, title: string): Promise<Summary> {
  const engine = await getEngine();

  const sendProgress = (percent: number) => {
    try { chrome.runtime.sendMessage({ type: "MODEL_PROGRESS", progress: percent }); } catch {}
  };

  // if (fullText.length <= 6000) {
  //   sendProgress(0);
  //   const summary = await llmSummariseTnCChunk(engine, fullText, title, url);
  //   sendProgress(70);

  //   const risks = await llmRiskPass(engine, [...summary.Good, ...summary.Neutral, ...summary.Bad].join("\n"));
  //   summary.Bad.push(...risks);

  //   sendProgress(100);
  //   return {
  //     Good: cleanList(summary.Good),
  //     Neutral: cleanList(summary.Neutral),
  //     Bad: cleanList(summary.Bad)
  //   };
  // }

  const chunks = splitIntoChunks(fullText, 6000);
  const partials: Summary[] = [];

  for (let i = 0; i < chunks.length && partials.length < 8; i++) {
    const out = await llmSummariseTnCChunk(engine, chunks[i], title, url);
    partials.push(out);
    sendProgress(Math.round(((i + 1) / chunks.length) * 70));
  }

  const combined = mergeSummaries(partials);
  sendProgress(85);

  // const risks = await llmRiskPass(engine, [...combined.Good, ...combined.Neutral, ...combined.Bad].join("\n"));
  // combined.Bad.push(...risks);

  sendProgress(100);

  return {
    Good: cleanList(combined.Good),
    Neutral: cleanList(combined.Neutral),
    Bad: cleanList(combined.Bad)
  };
}

// ----------------- Message Router -----------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "PING_OFFSCREEN") {
        sendResponse({ ok: true, pong: true });
        return;
      }

      if (msg?.type === "SUMMARISE_TEXT") {
        const { text, url, title } = msg as { text: string; url: string; title: string };
        const summary = await summariseTermsAndConditions(text, url, title);
        sendResponse({ ok: true, summary });
      }
    } catch (e: any) {
      console.error("[offscreen] handler error:", e);
      sendResponse({ ok: false, error: e?.stack || e?.message || String(e) });
    }
  })();

  return true;
});

console.log("[offscreen] script loaded, listener registered");
