import { errorVerdict } from '@checkverity/core';
import type { MediaDescriptor, MediaKind, Verdict } from '@checkverity/core';
import type { AnalyzeResponse, RuntimeMessage } from '../messages';
import {
  OFFSCREEN_URL,
  VERDICT_PAGE_URL,
  hasMediaAccess,
  injectContentScript,
  mediaOriginPattern,
  verdictKey,
} from '../messages';

const MENU_ID = 'verity:verify';

// Firefox has no chrome.offscreen - analysis falls back to the verdict page
// running in "analyze mode" (?u= URL to check) in an opened tab.
const HAS_OFFSCREEN = typeof chrome.offscreen?.createDocument === 'function';

chrome.runtime.onInstalled.addListener(() => {
  // removeAll first: create() throws on duplicate id after an update.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Verify with Verity',
      contexts: ['image', 'video', 'audio'],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  const kind: MediaKind =
    info.mediaType === 'video' ? 'video' : info.mediaType === 'audio' ? 'audio' : 'image';
  // srcUrl is empty for <video>/<audio> using <source> children - the
  // content script resolves the right-clicked element itself in that case.
  const msg: RuntimeMessage = info.srcUrl
    ? { type: 'verity:verify-one', media: { url: info.srcUrl, kind } }
    : { type: 'verity:verify-target', kind };
  try {
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    // Content script not present - inject it (activeTab covers the gesture).
    try {
      await injectContentScript(tab.id);
      for (let i = 0; i < 8; i++) {
        try {
          await chrome.tabs.sendMessage(tab.id, msg);
          return;
        } catch {
          if (i === 7) throw new Error('no receiver');
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    } catch {
      flashFailure(tab.id);
    }
  }
});

/** Restricted page (chrome://, Web Store, PDF viewer) - flag it, don't fail silently. */
function flashFailure(tabId: number): void {
  void chrome.action.setBadgeBackgroundColor({ tabId, color: '#d6d6d6' });
  void chrome.action.setBadgeText({ tabId, text: '×' });
  void chrome.action.setTitle({ tabId, title: "Verity can't run checks on this page" });
  setTimeout(() => {
    void chrome.action.setBadgeText({ tabId, text: '' });
    void chrome.action.setTitle({ tabId, title: 'Verity' });
  }, 4000);
}

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  if (msg.type === 'verity:analyze' || msg.type === 'verity:analyze-bytes') {
    handleAnalyze(
      msg.media,
      msg.type === 'verity:analyze-bytes' ? msg.dataB64 : undefined,
      msg.type === 'verity:analyze-bytes' ? msg.mime : undefined,
      msg.type === 'verity:analyze' ? msg.bulk : undefined,
    ).then(sendResponse);
    return true; // async response
  }
  if (msg.type === 'verity:report-error') {
    storeError(msg.error).then(sendResponse);
    return true;
  }
});

async function handleAnalyze(
  media: MediaDescriptor,
  dataB64?: string,
  mime?: string,
  bulk?: boolean,
): Promise<AnalyzeResponse> {
  // Fetching arbitrary media bytes needs an optional host grant for the
  // media's origin. Missing grant: single checks open the verdict page
  // (which can request it on a click); scans get a marker and continue.
  if (mediaOriginPattern(media.url) && !(await hasMediaAccess(media.url))) {
    if (!bulk) {
      await chrome.tabs.create({
        url: `${VERDICT_PAGE_URL}?u=${encodeURIComponent(media.url)}&k=${media.kind}`,
      });
      return { ok: false, error: 'opened-in-tab' };
    }
    return { ok: false, error: 'needs-permission' };
  }
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
    // A quota failure only costs the "click for details" link - badge still shows.
    await chrome.storage.session.set({ [verdictKey(res.verdictId)]: res.verdict }).catch(() => {});
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

let offscreenReady: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  if (!offscreenReady) {
    offscreenReady = (async () => {
      const exists = await chrome.offscreen.hasDocument().catch(() => false);
      if (exists) return;
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: [chrome.offscreen.Reason.WORKERS],
        justification: 'Runs C2PA WASM verification and metadata forensics.',
      });
    })();
    // Concurrent callers share this promise; a failure clears it for retry.
    offscreenReady.catch(() => {
      offscreenReady = null;
    });
  }
  return offscreenReady;
}

async function bumpStat(): Promise<void> {
  const { stats } = (await chrome.storage.local.get('stats')) as {
    stats?: { scanned?: number };
  };
  await chrome.storage.local.set({ stats: { scanned: (stats?.scanned ?? 0) + 1 } });
}
