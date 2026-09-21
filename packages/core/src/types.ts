export type MediaKind = 'image' | 'video' | 'audio';

export type VerdictState = 'verified' | 'unverified' | 'suspicious';

export type SignalOutcome = 'positive' | 'neutral' | 'negative' | 'unsupported' | 'error';

export interface Evidence {
  /** Plain-language label, e.g. "Signed by Nikon Corporation". */
  label: string;
  /** Optional supporting detail, e.g. raw assertion summary. */
  detail?: string;
}

export interface SignalResult {
  signalId: string;
  signalName: string;
  outcome: SignalOutcome;
  /** 0..1 — how sure the signal is of its own outcome. */
  confidence: number;
  /** True when the outcome is cryptographically conclusive (e.g. valid C2PA signature). */
  conclusive?: boolean;
  /** One-sentence plain-language summary shown on the verdict card. */
  summary: string;
  evidence: Evidence[];
}

export interface MediaDescriptor {
  url: string;
  kind: MediaKind;
  /** Caption/alt/nearby text — feeds the fact-check signal. */
  contextText?: string;
  /** URL of the page/message hosting the media — the fact-check signal fetches
   *  it for ClaimReview markup (the page itself may be a fact-check). */
  pageUrl?: string;
}

export interface MediaInput extends MediaDescriptor {
  blob: Blob;
}

export interface Signal {
  readonly id: string;
  readonly name: string;
  supports(media: MediaDescriptor): boolean;
  analyze(media: MediaInput): Promise<SignalResult>;
}

export interface Verdict {
  state: VerdictState;
  /** Confidence in the verdict state itself (0 for unverified). */
  confidence: number;
  headline: string;
  signals: SignalResult[];
  checkedAt: string;
  /** Set when the check itself failed (fetch error, unreadable bytes, too large). Not a verdict state. */
  error?: string;
  /** Canonical shareable link, set when the verdict was submitted to a registry. */
  shareUrl?: string;
}
