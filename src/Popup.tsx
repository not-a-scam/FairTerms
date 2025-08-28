import { useState } from "react";

export default function Popup() {
  const [loading, setLoading] = useState(false);
  const [md, setMd] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setErr(null);
    setMd(null);
    try {
      const resp = await chrome.runtime.sendMessage({ type: "RUN_SUMMARY" });
      if (resp?.ok) setMd(resp.markdown);
      else setErr(resp?.error || "Unknown error (no details)");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 12, width: 320 }}>
      <h3 style={{ marginTop: 0 }}>WebLLM Summariser</h3>
      <button onClick={handleClick} disabled={loading} style={{ padding: "6px 10px" }}>
        {loading ? "Summarising…" : "Summarise this page"}
      </button>

      {err && (
        <pre style={{ color: "crimson", whiteSpace: "pre-wrap", marginTop: 10, maxHeight: 180, overflow: "auto" }}>
          {err}
        </pre>
      )}

      {md && (
        <div style={{ marginTop: 12, maxHeight: 300, overflow: "auto", fontSize: 14, lineHeight: 1.4 }}>
          {md.split("\n").map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}

      {!md && !err && !loading && <p style={{ color: "#666" }}>Click to summarise the current tab.</p>}
    </div>
  );
}
