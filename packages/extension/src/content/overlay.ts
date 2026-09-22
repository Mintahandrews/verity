import { DEFAULT_REGISTRY } from '../registry-client';

/**
 * In-page verdict viewer: a fixed right-side sheet embedding the extension's
 * verdict page in an iframe. Keeps the user on the site - no extra tabs.
 * The header links out to the public registry for anyone who wants the
 * full site (dashboard, shareable pages).
 */
let sheet: HTMLDivElement | null = null;
let frame: HTMLIFrameElement | null = null;

export function openVerdictOverlay(verdictId: string): void {
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.style.cssText =
      'position:fixed;top:0;right:0;height:100vh;width:min(420px,100vw);' +
      'z-index:2147483647;background:#f2f5eb;display:flex;flex-direction:column;' +
      'border-left:1px solid #273f2b;box-shadow:-8px 0 32px rgba(0,0,0,.35)';

    const head = document.createElement('div');
    head.style.cssText =
      'display:flex;align-items:center;gap:10px;padding:10px 14px;' +
      'background:#122314;color:#f2f5eb;font:13px/1.4 system-ui,sans-serif;flex-shrink:0';
    const title = document.createElement('span');
    title.textContent = 'Verity verdict';
    title.style.cssText = 'font-weight:600;flex:1';
    const site = document.createElement('a');
    site.textContent = 'Visit verity.codemintah.dev ↗';
    site.href = DEFAULT_REGISTRY;
    site.target = '_blank';
    site.rel = 'noopener';
    site.style.cssText = 'color:#68ef3f;text-decoration:none;font-size:12px';
    const close = document.createElement('button');
    close.textContent = '×';
    close.title = 'Close';
    close.style.cssText =
      'background:none;border:0;color:#b7bda5;font-size:18px;cursor:pointer;padding:0 0 0 6px';
    close.addEventListener('click', () => {
      sheet?.remove();
      sheet = null;
      frame = null;
    });
    head.append(title, site, close);

    frame = document.createElement('iframe');
    frame.style.cssText = 'flex:1;border:0;width:100%;background:#f2f5eb';
    sheet.append(head, frame);
    document.documentElement.appendChild(sheet);
  }
  frame!.src = chrome.runtime.getURL(`src/verdict/index.html?id=${verdictId}`);
}
