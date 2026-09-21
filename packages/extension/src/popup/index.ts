import type { RuntimeMessage } from '../messages';

document.getElementById('scan')!.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await chrome.tabs.sendMessage(tab.id, { type: 'verity:scan-page' } satisfies RuntimeMessage);
  }
  window.close();
});

const { stats } = (await chrome.storage.local.get('stats')) as {
  stats?: { scanned?: number };
};
document.getElementById('count')!.textContent = String(stats?.scanned ?? 0);
