import { describe, expect, it } from 'vitest';
import { claimReviewMatches, classifyRating } from './fact-check.ts';

const page = (jsonLd: string) =>
  `<html><head><script type="application/ld+json">${jsonLd}</script></head></html>`;

describe('classifyRating', () => {
  it('maps false-family ratings to negative', () => {
    for (const r of ['False', 'Pants on Fire', 'Misleading', 'Mostly false', 'Out of context'])
      expect(classifyRating(r)).toBe('negative');
  });
  it('maps true-family ratings to positive', () => {
    for (const r of ['True', 'Mostly true', 'Correct', 'Accurate'])
      expect(classifyRating(r)).toBe('positive');
  });
  it('everything else is neutral', () => {
    expect(classifyRating('Unproven')).toBe('neutral');
    expect(classifyRating('')).toBe('neutral');
  });
});

describe('claimReviewMatches', () => {
  it('extracts ClaimReview JSON-LD from a page', () => {
    const html = page(
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ClaimReview',
        claimReviewed: 'Video shows aliens landing in Ohio',
        reviewRating: { ratingValue: 1, alternateName: 'False' },
        author: { name: 'ExampleCheck' },
        url: 'https://example.org/factcheck/123',
      }),
    );
    const m = claimReviewMatches(html);
    expect(m).toHaveLength(1);
    expect(m[0]!.claim).toContain('aliens');
    expect(m[0]!.rating).toBe('False');
    expect(m[0]!.publisher).toBe('ExampleCheck');
  });

  it('finds ClaimReviews nested in @graph', () => {
    const html = page(
      JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebPage' },
          { '@type': 'ClaimReview', claimReviewed: 'x', author: { name: 'P' } },
        ],
      }),
    );
    const m = claimReviewMatches(html);
    expect(m).toHaveLength(1);
    expect(m[0]!.publisher).toBe('P');
  });

  it('ignores pages without JSON-LD and malformed blocks', () => {
    expect(claimReviewMatches('<html><body>no markup</body></html>')).toHaveLength(0);
    expect(claimReviewMatches(page('{not json'))).toHaveLength(0);
  });
});
