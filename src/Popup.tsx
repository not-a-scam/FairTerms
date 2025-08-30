// import { useState, useEffect } from "react";

// export default function Popup() {
//   const [loading, setLoading] = useState(false);
//   const [md, setMd] = useState<string | null>(null);
//   const [err, setErr] = useState<string | null>(null);
//   const [progress, setProgress] = useState<number | null>(null); // 0 to 100

//   useEffect(() => {
//     // Listen for background/offscreen progress messages
//     const listener = (msg: any) => {
//       if (msg?.type === "MODEL_PROGRESS" && typeof msg.progress === "number") {
//         setProgress(msg.progress);
//       }
//     };
//     chrome.runtime.onMessage.addListener(listener);
//     return () => chrome.runtime.onMessage.removeListener(listener);
//   }, []);

//   async function handleClick() {
//     setLoading(true);
//     setErr(null);
//     setMd(null);
//     setProgress(0);
//     try {
//       const resp = await chrome.runtime.sendMessage({ type: "RUN_SUMMARY" });
//       if (resp?.ok) setMd(resp.markdown);
//       else setErr(resp?.error || "Unknown error (no details)");
//     } catch (e: any) {
//       setErr(String(e?.message || e));
//     } finally {
//       setLoading(false);
//       setProgress(null);
//     }
//   }

//   return (
//     <div style={{ padding: 12, width: 320 }}>
//       <h3 style={{ marginTop: 0 }}>WebLLM Summariser</h3>
//       <button onClick={handleClick} disabled={loading} style={{ padding: "6px 10px" }}>
//         {loading ? "Summarising…" : "Summarise this page"}
//       </button>

//       {/* Progress bar */}
//       {loading && progress !== null && (
//         <div style={{ marginTop: 10, width: "100%", background: "#eee", borderRadius: 4 }}>
//           <div
//             style={{
//               width: `${Math.round(progress)}%`,
//               height: 8,
//               background: "#4caf50",
//               borderRadius: 4,
//               transition: "width 0.2s ease"
//             }}
//           />
//         </div>
//       )}

//       {err && (
//         <pre style={{ color: "crimson", whiteSpace: "pre-wrap", marginTop: 10, maxHeight: 180, overflow: "auto" }}>
//           {err}
//         </pre>
//       )}

//       {md && (
//         <div style={{ marginTop: 12, maxHeight: 300, overflow: "auto", fontSize: 14, lineHeight: 1.4 }}>
//           {md.split("\n").map((line, i) => <div key={i}>{line}</div>)}
//         </div>
//       )}

//       {!md && !err && !loading && <p style={{ color: "#666" }}>Click to summarise the current tab.</p>}
//     </div>
//   );
// }
import { useState, useEffect } from "react";

type Summary = {
  Good: string[];
  Neutral: string[];
  Bad: string[];
};

export default function Popup() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null); // 0 to 100

  useEffect(() => {
    const listener = (msg: any) => {
      if (msg?.type === "MODEL_PROGRESS" && typeof msg.progress === "number") {
        setProgress(msg.progress);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function handleClick() {
    setLoading(true);
    setErr(null);
    setSummary(null);
    setProgress(0);

    try {
      const resp = await chrome.runtime.sendMessage({ type: "RUN_SUMMARY" });
      if (resp?.ok) setSummary(resp.summary);
      else setErr(resp?.error || "Unknown error (no details)");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  const renderCategory = (title: string, items: string[]) => {
    if (!items.length) return null;
    return (
      <div style={{ marginBottom: 12 }}>
        <strong>{title}</strong>
        <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
          {items.map((item, i) => (
            <li key={i} style={{ marginBottom: 2 }}>{item}</li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div style={{ padding: 12, width: 340 }}>
      <h3 style={{ marginTop: 0 }}>WebLLM Summariser</h3>
      <button onClick={handleClick} disabled={loading} style={{ padding: "6px 10px" }}>
        {loading ? "Summarising…" : "Summarise this page"}
      </button>

      {/* Progress bar */}
      {loading && progress !== null && (
        <div style={{ marginTop: 10, width: "100%", background: "#eee", borderRadius: 4 }}>
          <div
            style={{
              width: `${Math.round(progress)}%`,
              height: 8,
              background: "#4caf50",
              borderRadius: 4,
              transition: "width 0.2s ease"
            }}
          />
        </div>
      )}

      {/* Error */}
      {err && (
        <pre
          style={{
            color: "crimson",
            whiteSpace: "pre-wrap",
            marginTop: 10,
            maxHeight: 180,
            overflow: "auto"
          }}
        >
          {err}
        </pre>
      )}

      {/* Summary */}
      {summary && (
        <div style={{ marginTop: 12, maxHeight: 300, overflowY: "auto", fontSize: 14, lineHeight: 1.4 }}>
          {renderCategory("✅ Good", summary.Good)}
          {renderCategory("⚪ Neutral", summary.Neutral)}
          {renderCategory("⚠️ Bad / Risks", summary.Bad)}
        </div>
      )}

      {!summary && !err && !loading && (
        <p style={{ color: "#666", marginTop: 12 }}>Click to summarise the current tab.</p>
      )}
    </div>
  );
}
