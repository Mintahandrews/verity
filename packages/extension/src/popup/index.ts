import '@fontsource/instrument-serif/400.css';
import '../design/tokens.css';
import type { RuntimeMessage } from '../messages';

const statusEl = document.getElementById('status')!;

document.getElementById('scan')!.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const msg = { type: 'verity:scan-page' } satisfies RuntimeMessage;
  try {
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    // Content script not injected (page predates install, or restricted scheme).
    const files =
      chrome.runtime
        .getManifest()
        .content_scripts?.flatMap((cs) => cs.js)
        .filter((f): f is string => typeof f === 'string') ?? [];
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
      // The injected file is a loader shim - the real listener registers a
      // tick later, so retry briefly instead of racing it once.
      let sent = false;
      for (let i = 0; i < 8 && !sent; i++) {
        try {
          await chrome.tabs.sendMessage(tab.id, msg);
          sent = true;
        } catch {
          await new Promise((r) => setTimeout(r, 150));
        }
      }
      if (!sent) throw new Error('no receiver');
    } catch {
      statusEl.textContent = "Can't scan this page - try reloading it first.";
      statusEl.style.display = 'block';
      return;
    }
  }
  window.close();
});

const { stats, reverseSearch, ocrEnabled, aiModelEnabled, geoLookup, clipEnabled } =
  (await chrome.storage.local.get([
    'stats',
    'reverseSearch',
    'ocrEnabled',
    'aiModelEnabled',
    'geoLookup',
    'clipEnabled',
  ])) as {
    stats?: { scanned?: number };
    reverseSearch?: boolean;
    ocrEnabled?: boolean;
    aiModelEnabled?: boolean;
    geoLookup?: boolean;
    clipEnabled?: boolean;
  };
document.getElementById('count')!.textContent = String(stats?.scanned ?? 0);

const rs = document.getElementById('rs') as HTMLInputElement;
rs.checked = reverseSearch ?? false;
rs.addEventListener('change', () => {
  void chrome.storage.local.set({ reverseSearch: rs.checked });
});

const ocr = document.getElementById('ocr') as HTMLInputElement;
ocr.checked = ocrEnabled ?? true; // default on - claims live in pixels
ocr.addEventListener('change', () => {
  void chrome.storage.local.set({ ocrEnabled: ocr.checked });
});

const ai = document.getElementById('ai') as HTMLInputElement;
ai.checked = aiModelEnabled ?? false; // default off - big download, weak signal
ai.addEventListener('change', () => {
  void chrome.storage.local.set({ aiModelEnabled: ai.checked });
});

const geo = document.getElementById('geo') as HTMLInputElement;
geo.checked = geoLookup ?? false; // default off - coordinates are sensitive
geo.addEventListener('change', () => {
  void chrome.storage.local.set({ geoLookup: geo.checked });
});

const clip = document.getElementById('clip') as HTMLInputElement;
clip.checked = clipEnabled ?? false; // default off - ~85MB model download
clip.addEventListener('change', () => {
  void chrome.storage.local.set({ clipEnabled: clip.checked });
});
