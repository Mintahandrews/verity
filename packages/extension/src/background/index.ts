import type { MediaDescriptor, MediaKind } from '@verity/core';
import type { AnalyzeResponse, RuntimeMessage } from '../messages';
import { OFFSCREEN_URL, VERDICT_PAGE_URL, verdictKey } from '../messages';

const MENU_ID = 'verity:verify';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Verify with Verity',
    contexts: ['image', 'video', 'audio'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id || !info.srcUrl) return;
  const kind: MediaKind =
    info.mediaType === 'video' ? 'video' : info.mediaType === 'audio' ? 'audio' : 'image';
  const media: MediaDescriptor = { url: info.srcUrl, kind };
  await chrome.tabs.sendMessage(tab.id, { type: 'verity:verify-one', media } satisfies RuntimeMessage);
});

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  if (msg.type === 'verity:analyze') {
    handleAnalyze(msg.media).then(sendResponse);
    return true; // async response
  }
  if (msg.type === 'verity:open') {
    void chrome.tabs.create({ url: `${VERDICT_PAGE_URL}?id=${msg.verdictId}` });
  }
});

async function handleAnalyze(media: MediaDescriptor): Promise<AnalyzeResponse> {
  try {
    await ensureOffscreen();
    const res = (await chrome.runtime.sendMessage({
      type: 'verity:offscreen-analyze',
      media,
    } satisfies RuntimeMessage)) as AnalyzeResponse;
    if (res.ok) {
      await chrome.storage.session.set({ [verdictKey(res.verdictId)]: res.verdict });
      await bumpStat();
    }
    return res;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function ensureOffscreen(): Promise<void> {
  const exists = await chrome.offscreen.hasDocument().catch(() => false);
  if (exists) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: 'Runs C2PA WASM verification and metadata forensics.',
  });
}

async function bumpStat(): Promise<void> {
  const { stats } = (await chrome.storage.local.get('stats')) as {
    stats?: { scanned?: number };
  };
  await chrome.storage.local.set({ stats: { scanned: (stats?.scanned ?? 0) + 1 } });
}
