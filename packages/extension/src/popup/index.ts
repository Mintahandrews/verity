import '@fontsource/instrument-serif/400.css';
import '../design/tokens.css';
import type { RuntimeMessage } from '../messages';

document.getElementById('scan')!.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await chrome.tabs.sendMessage(tab.id, { type: 'verity:scan-page' } satisfies RuntimeMessage);
  }
  window.close();
});

const { stats, reverseSearch, ocrEnabled } = (await chrome.storage.local.get([
  'stats',
  'reverseSearch',
  'ocrEnabled',
])) as {
  stats?: { scanned?: number };
  reverseSearch?: boolean;
  ocrEnabled?: boolean;
};
document.getElementById('count')!.textContent = String(stats?.scanned ?? 0);

const rs = document.getElementById('rs') as HTMLInputElement;
rs.checked = reverseSearch ?? false;
rs.addEventListener('change', () => {
  void chrome.storage.local.set({ reverseSearch: rs.checked });
});

const ocr = document.getElementById('ocr') as HTMLInputElement;
ocr.checked = ocrEnabled ?? true; // default on — claims live in pixels
ocr.addEventListener('change', () => {
  void chrome.storage.local.set({ ocrEnabled: ocr.checked });
});
