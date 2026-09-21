import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ASSETS_DIR = join(ROOT, 'docs/assets');
const DB_FILE = join(ROOT, 'test-screenshot-registry.json');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8799;

mkdirSync(ASSETS_DIR, { recursive: true });

const VERIFIED_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const SUSPICIOUS_SHA = '01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b';
const UNVERIFIED_SHA = '7d1a54127b222502f5b79b5fb0803061152a44f92b37e23c65dd00417e403224';

const SAMPLE_DATA = [
  {
    sha256: VERIFIED_SHA,
    phash: '8f0a3c2b1e4d5f6a',
    url: 'https://example.com/press-photo.jpg',
    createdAt: new Date().toISOString(),
    hits: 42,
    verdict: {
      state: 'verified',
      confidence: 0.99,
      headline: 'Cryptographically signed provenance confirmed via C2PA Content Credentials',
      checkedAt: new Date().toISOString(),
      signals: [
        {
          signalId: 'c2pa',
          signalName: 'C2PA Content Credentials',
          outcome: 'positive',
          confidence: 1.0,
          conclusive: true,
          summary: 'Valid cryptographic signature by Reuters News Agency (DigiCert Trusted G2).',
          evidence: [
            { label: 'Issuer', detail: 'DigiCert Trusted Root G2' },
            { label: 'Claim Generator', detail: 'Nikon Z9 Firmware 4.01' },
            { label: 'Capture Date', detail: '2025-01-14 10:24:18 UTC' },
            { label: 'Tamper Check', detail: 'Manifest integrity intact (SHA-256 match)' }
          ]
        },
        {
          signalId: 'metadata',
          signalName: 'Camera & Hardware Forensics',
          outcome: 'positive',
          confidence: 0.95,
          summary: 'Hardware EXIF tags match C2PA capture manifest assertions.',
          evidence: [
            { label: 'Camera Model', detail: 'Nikon Z9' },
            { label: 'Lens', detail: 'NIKKOR Z 24-70mm f/2.8 S' },
            { label: 'Software', detail: 'In-camera firmware pipeline only' }
          ]
        },
        {
          signalId: 'prior-sightings',
          signalName: 'Prior Sightings & Reverse Lookup',
          outcome: 'neutral',
          confidence: 0.8,
          summary: 'First indexed in public registry 3 days ago with matching news caption.',
          evidence: [
            { label: 'Earliest Sighting', detail: '3 days ago on verified wire feed' }
          ]
        }
      ]
    }
  },
  {
    sha256: SUSPICIOUS_SHA,
    phash: '3b2c1d4e5f6a7b8c',
    url: 'https://social-media.com/viral-claim.jpg',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    hits: 156,
    verdict: {
      state: 'suspicious',
      confidence: 0.92,
      headline: 'Contradictory evidence: 2021 blast footage repurposed as breaking 2025 event',
      checkedAt: new Date(Date.now() - 3600000).toISOString(),
      signals: [
        {
          signalId: 'prior-sightings',
          signalName: 'Prior Sightings & History',
          outcome: 'negative',
          confidence: 0.95,
          summary: 'Perceptual hash matches 2021 industrial accident in Beirut (Hamming distance 2).',
          evidence: [
            { label: 'Archived Sighting', detail: 'Wayback Machine snapshot dated August 2021' },
            { label: 'Claim Mismatch', detail: 'Currently shared claiming to be today\'s storm' }
          ]
        },
        {
          signalId: 'fact-check',
          signalName: 'Fact-Check Database (ClaimReview)',
          outcome: 'negative',
          confidence: 0.98,
          summary: 'Known false claim debunked by Agence France-Presse (AFP Fact Check).',
          evidence: [
            { label: 'Claim Reviewed', detail: 'Viral video showing recent missile strike' },
            { label: 'Debunk Rating', detail: 'False Context (Old footage repurposed)' }
          ]
        },
        {
          signalId: 'c2pa',
          signalName: 'C2PA Content Credentials',
          outcome: 'neutral',
          confidence: 0.5,
          summary: 'No C2PA manifest found on media.',
          evidence: [
            { label: 'Provenance', detail: 'Unsigned asset' }
          ]
        }
      ]
    }
  },
  {
    sha256: UNVERIFIED_SHA,
    phash: '9f8e7d6c5b4a3210',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    hits: 8,
    verdict: {
      state: 'unverified',
      confidence: 0.0,
      headline: 'No cryptographic provenance found. Baseline state for web media.',
      checkedAt: new Date(Date.now() - 7200000).toISOString(),
      signals: [
        {
          signalId: 'c2pa',
          signalName: 'C2PA Content Credentials',
          outcome: 'neutral',
          confidence: 0.5,
          summary: 'No C2PA manifest found.',
          evidence: [{ label: 'Status', detail: 'Unsigned' }]
        },
        {
          signalId: 'metadata',
          signalName: 'Camera & Metadata',
          outcome: 'neutral',
          confidence: 0.6,
          summary: 'EXIF metadata stripped by social platform upload.',
          evidence: [{ label: 'EXIF', detail: 'Standard compression artifacts' }]
        }
      ]
    }
  }
];

writeFileSync(DB_FILE, JSON.stringify(SAMPLE_DATA, null, 2));

console.log('Starting registry server for screenshot capture...');
const server = spawn('node', ['packages/registry/src/server.ts'], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: String(PORT),
    PUBLIC_URL: `http://localhost:${PORT}`,
    VERITY_DB: DB_FILE
  },
  stdio: 'inherit'
});

await new Promise((r) => setTimeout(r, 1200));

async function capture(url, outFile) {
  console.log(`Capturing ${url} -> ${outFile}...`);
  return new Promise((resolve, reject) => {
    const proc = spawn(
      CHROME_PATH,
      [
        '--headless=new',
        '--hide-scrollbars',
        '--window-size=1280,800',
        `--screenshot=${outFile}`,
        url
      ],
      { stdio: 'inherit' }
    );
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Chrome exited with code ${code}`));
    });
  });
}

try {
  await capture(`http://localhost:${PORT}/`, join(ASSETS_DIR, 'screenshot-landing.png'));
  await capture(`http://localhost:${PORT}/dashboard`, join(ASSETS_DIR, 'screenshot-dashboard.png'));
  await capture(`http://localhost:${PORT}/v/${VERIFIED_SHA}`, join(ASSETS_DIR, 'screenshot-verdict-verified.png'));
  await capture(`http://localhost:${PORT}/v/${SUSPICIOUS_SHA}`, join(ASSETS_DIR, 'screenshot-verdict-suspicious.png'));
  console.log('✅ All 4 high-resolution screenshots captured successfully!');
} finally {
  server.kill();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
}
