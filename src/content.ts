function extractTnCText(): string {
  // Remove obvious boilerplate
  document.querySelectorAll("script, style, noscript, svg, nav, header, footer, aside, form").forEach(n => n.remove());

  // Look for elements with legal keywords
  const selectors = [
    "article",
    "main",
    "[class*='terms']",
    "[class*='policy']",
    "[id*='terms']",
    "[id*='policy']"
  ];
  const el = document.querySelector(selectors.join(","));
  if (el) return (el as HTMLElement).innerText;

  // Fallback: whole page
  return document.body.innerText;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GET_PAGE_TEXT") {
    const raw = extractTnCText();
    const cleaned = raw
      .replace(/\s+/g, " ")
      .replace(/©\s*\d{4}.*/g, "")  // drop footers
      .slice(0, 20000); // cap
    sendResponse({ text: cleaned, url: location.href, title: document.title });
  }
});
