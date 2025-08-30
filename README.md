# FairTerms

> Summarise Terms & Conditions and Privacy Policies into clear bullets - locally in the browser

FairTerms is a Chrome extension that reads the Terms & Conditions or Privacy Policies of the current tab and transforms it into a short, straight to the point summary with a “Potential Risks” section, so that users can see what they are really agreeing to.

## Features
- One-Click Summarisation
- On-Device AI Summarisation
- Live Progress Feedback
- Markdown-Formatted Summaries
- Focused Summarisation Pipeline
- Resilient Background State
- Smart Content Extraction

## Tech Stack
- **React** + **TypeScript**
- **Vite** (+ `@vitejs/plugin-react`)
- **@mlc-ai/web-llm**
- **react-markdown** + **remark-gfm**
- Chrome **MV3** APIs (service worker, content scripts, offscreen documents)

## Privacy
- Summarisation runs on your device via **WebGPU**.  
- No page text is sent to a server for inference.

## 🚀 Getting Started
### Prerequisites
- **Node.js 18+**
- Google Chrome with **WebGPU** support

### Install & Build
```bash
npm install
npm run build
```

This creates a `dist/` folder with:
- `popup.js` (popup bundle)
- `background.js` (service worker)
- `content.js` (content script)
- `offscreen.js` + `offscreen.html` (offscreen host)
- plus any code‑split chunks and assets

### Load in Chrome
1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the project’s `dist/` directory

### Use
1. Open a page with Terms & Conditions or a Privacy Policy.  
2. Click the **FairTerms** extension icon (opens the popup).  
3. Press **“Summarise this page”**.  
4. Read the **Key Terms & Conditions** and **Potential Risks**.

## Troubleshooting 
- **WebGPU unavailable**: Your device/Chrome may not support it. (You can try a different machine or Chrome version.)  
- **Blank summary**: The page may have little/no extractable text. Try opening the full policy page first.

## License
ISC (see `package.json`).

## Acknowledgements
- [`@mlc-ai/web-llm`](https://github.com/mlc-ai/web-llm) for running LLMs in the browser with WebGPU.
