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

const { stats, reverseSearch } = (await chrome.storage.local.get(['stats', 'reverseSearch'])) as {
  stats?: { scanned?: number };
  reverseSearch?: boolean;
};
document.getElementById('count')!.textContent = String(stats?.scanned ?? 0);

const rs = document.getElementById('rs') as HTMLInputElement;
rs.checked = reverseSearch ?? false;
rs.addEventListener('change', () => {
  void chrome.storage.local.set({ reverseSearch: rs.checked });
});
