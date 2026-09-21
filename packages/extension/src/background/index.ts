import { errorVerdict } from '@verity/core';
import type { MediaDescriptor, MediaKind, Verdict } from '@verity/core';
import type { AnalyzeResponse, RuntimeMessage } from '../messages';
import { OFFSCREEN_URL, VERDICT_PAGE_URL, verdictKey } from '../messages';

const MENU_ID = 'verity:verify';

// Firefox has no chrome.offscreen - analysis falls back to the verdict page
// running in "analyze mode" (?u= URL to check) in an opened tab.
const HAS_OFFSCREEN = typeof chrome.offscreen?.createDocument === 'function';

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
  if (msg.type === 'verity:analyze' || msg.type === 'verity:analyze-bytes') {
    handleAnalyze(
      msg.media,
      msg.type === 'verity:analyze-bytes' ? msg.dataB64 : undefined,
      msg.type === 'verity:analyze-bytes' ? msg.mime : undefined,
    ).then(sendResponse);
    return true; // async response
  }
  if (msg.type === 'verity:report-error') {
    storeError(msg.error).then(sendResponse);
    return true;
  }
  if (msg.type === 'verity:open') {
    void chrome.tabs.create({ url: `${VERDICT_PAGE_URL}?id=${msg.verdictId}` });
  }
});

async function handleAnalyze(
  media: MediaDescriptor,
  dataB64?: string,
  mime?: string,
): Promise<AnalyzeResponse> {
  if (!HAS_OFFSCREEN) {
    await chrome.tabs.create({
      url: `${VERDICT_PAGE_URL}?u=${encodeURIComponent(media.url)}&k=${media.kind}`,
    });
    return { ok: false, error: 'opened-in-tab' };
  }
  try {
    await ensureOffscreen();
    const res = (await chrome.runtime.sendMessage({
      type: 'verity:offscreen-analyze',
      media,
      ...(dataB64 ? { dataB64 } : {}),
      ...(mime ? { mime } : {}),
    } satisfies RuntimeMessage)) as AnalyzeResponse;
    if (!res.ok) return storeError(res.error);
    await chrome.storage.session.set({ [verdictKey(res.verdictId)]: res.verdict });
    await bumpStat();
    return res;
  } catch (e) {
    return storeError(e instanceof Error ? e.message : String(e));
  }
}

async function storeError(message: string): Promise<AnalyzeResponse> {
  const verdictId = crypto.randomUUID();
  const verdict: Verdict = errorVerdict(message);
  await chrome.storage.session.set({ [verdictKey(verdictId)]: verdict });
  return { ok: true, verdictId, verdict };
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
