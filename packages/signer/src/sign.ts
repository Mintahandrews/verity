import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
  createC2pa,
  createTestSigner,
  ManifestBuilder,
  SigningAlgorithm,
  type LocalSigner,
} from 'c2pa-node';
import { sniffMime } from '@verity/core';

const USAGE = `verity sign - embed cryptographically signed provenance (C2PA)

  node src/sign.ts <input> <output> [options]

  --test                    Sign with an ephemeral test certificate (dev only -
                            test certs are NOT on the C2PA trust list)
  --cert <cert.pem>         Your certificate chain (PEM)
  --key <key.pem>           Your private key (PEM)
  --alg <es256|ps256|...>   Signing algorithm (default es256)
  --title <name>            Human-readable asset title (default: filename)
  --generator <name>        claim_generator string (default "Verity Signer/0.1")
  --source-type <uri>       C2PA digitalSourceType (default digitalCapture)

  Real signing needs a cert on the C2PA trust list (or accepted by verifiers
  you care about). A self-signed cert still proves "who signed" - trust is a
  separate layer, same as HTTPS.
`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const [input, output] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));

  if (!input || !output || flags.has('--help')) {
    console.log(USAGE);
    process.exit(input ? 0 : 1);
  }

  const buffer = readFileSync(input);
  const mimeType = sniffMime(new Uint8Array(buffer));
  if (!mimeType) {
    console.error(`Cannot determine media type of ${input} - supported: png/jpeg/gif/webp/mp4/webm/pdf`);
    process.exit(1);
  }

  let signer: LocalSigner;
  if (flags.has('--test')) {
    signer = await createTestSigner();
    console.warn('Using an ephemeral TEST certificate - not on the C2PA trust list.');
  } else {
    const certPath = arg('cert');
    const keyPath = arg('key');
    if (!certPath || !keyPath) {
      console.error('Provide --cert and --key (PEM files), or --test for development.');
      process.exit(1);
    }
    const alg = arg('alg') ?? 'es256';
    signer = {
      type: 'local',
      certificate: readFileSync(certPath),
      privateKey: readFileSync(keyPath),
      algorithm: Object.values(SigningAlgorithm).includes(alg as SigningAlgorithm)
        ? (alg as SigningAlgorithm)
        : SigningAlgorithm.ES256,
    };
  }

  const manifest = new ManifestBuilder({
    claim_generator: arg('generator') ?? 'Verity Signer/0.1',
    format: mimeType,
    title: arg('title') ?? basename(input),
    assertions: [
      {
        label: 'c2pa.actions',
        data: {
          actions: [
            {
              action: 'c2pa.created',
              digitalSourceType: `http://cv.iptc.org/newscodes/digitalsourcetype/${arg('source-type') ?? 'digitalCapture'}`,
            },
          ],
        },
      },
    ],
  });

  const c2pa = createC2pa();
  const { signedAsset } = await c2pa.sign({
    manifest,
    asset: { buffer, mimeType },
    signer,
  });

  writeFileSync(output, signedAsset.buffer);
  console.log(`Signed ${input} → ${output} (${signedAsset.buffer.length} bytes, manifest embedded)`);
}

main().catch((e) => {
  console.error(`signing failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
