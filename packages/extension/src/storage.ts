/**
 * chrome.storage is unavailable in some contexts (offscreen documents in
 * certain Chromium builds, Firefox analyze-mode quirks). Feature flags must
 * fall back to defaults - a missing settings store should never kill the
 * analysis pipeline.
 */
export async function storageGet<T extends Record<string, unknown>>(
  keys: string | string[],
): Promise<T> {
  try {
    if (!chrome.storage?.local) return {} as T;
    return (await chrome.storage.local.get(keys)) as T;
  } catch {
    return {} as T;
  }
}
