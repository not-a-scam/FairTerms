import { useState, useEffect } from "react";

export default function Popup() {
  const [loading, setLoading] = useState(false);
  const [md, setMd] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null); // 0 to 100
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    // Listen for background/offscreen progress messages
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
    setMd(null);
    setProgress(0);
    try {
      const resp = await chrome.runtime.sendMessage({ type: "RUN_SUMMARY" });
      if (resp?.ok) setMd(resp.markdown);
      else setErr(resp?.error || "Unknown error (no details)");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <div
      style={{
        padding: 16,
        width: 360,
        fontFamily: "Inter, sans-serif",
        background: "#f9f9f9",
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Header */}
      <h3
        style={{
          margin: 0,
          marginBottom: 16,
          fontSize: 22,
          fontWeight: 600,
          color: "#333",
          borderBottom: "2px solid #4caf50",
          paddingBottom: 4,
          textAlign: "center",
          width: "100%",
        }}
      >
        FairTerms
      </h3>

      {/* Summarise Button */}
      <button
        onClick={handleClick}
        disabled={loading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: "100%",
          padding: "10px 0",
          fontSize: 14,
          fontWeight: 500,
          background: loading
            ? "#a5d6a7"
            : hovered
            ? "#388e3c"
            : "#4caf50",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: loading ? "not-allowed" : "pointer",
          transition: "background 0.2s ease",
          marginBottom: 12,
        }}
      >
        {loading ? "Summarising…" : "Summarise this page"}
      </button>

      {/* Progress Bar */}
      {loading && progress !== null && (
        <div
          style={{
            width: "100%",
            background: "#e0e0e0",
            borderRadius: 4,
            overflow: "hidden",
            height: 8,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: `${Math.round(progress)}%`,
              height: "100%",
              background: "#4caf50",
              transition: "width 0.2s ease",
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
            marginBottom: 12,
            maxHeight: 180,
            overflowY: "auto",
            background: "#ffe5e5",
            padding: 8,
            borderRadius: 6,
            fontSize: 13,
            textAlign: "left",
            width: "100%",
          }}
        >
          {err}
        </pre>
      )}

      {/* Markdown Summary */}
      {md && (
        <div
          style={{
            marginTop: 8,
            maxHeight: 300,
            overflowY: "auto",
            fontSize: 14,
            lineHeight: 1.5,
            padding: 8,
            background: "#fff",
            borderRadius: 6,
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
            textAlign: "left",
            width: "100%",
          }}
        >
          {md.split("\n").map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {/* Instruction */}
      {!md && !err && !loading && (
        <p
          style={{
            color: "#777",
            fontSize: 13,
            marginTop: 8,
            textAlign: "left",
            width: "100%",
          }}
        >
          Click to summarise the current tab.
        </p>
      )}
    </div>
  );
}
