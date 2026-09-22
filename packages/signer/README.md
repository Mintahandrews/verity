# @checkverity/signer

> Local C2PA signing CLI for journalists, photographers, and creators to cryptographically stamp original media before publishing.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](../../LICENSE)
[![Standard: C2PA](https://img.shields.io/badge/Standard-C2PA%20Content%20Credentials-00c853.svg)](https://c2pa.org/)

`@checkverity/signer` solves the "prove it's real" challenge. Before publishing original photographs, investigative video, or creative media, creators use this CLI tool to inject a tamper-evident, cryptographically signed C2PA manifest containing author attribution and cryptographic hashes.

---

## Capabilities

- 🖋️ **Tamper-Evident Manifest Injection**: Embeds standard C2PA JUMBF boxes into JPEG, PNG, WebP, and MP4 containers.
- 🔐 **x509 Certificate Integration**: Signs assertions using standard ES256, RS256, or Ed25519 cryptographic keys.
- 📂 **Batch Asset Processing**: Process full directories of media during newsroom ingest.
- 🛡️ **Zero Cloud Exposure**: Keys and uncompressed media never leave the local workstation.

---

## Usage

```bash
# Sign a single image
node src/sign.ts --input photo.jpg --output photo_signed.jpg \
  --cert cert.pem --key private_key.pem \
  --author "Andrews Mintah"

# Or run via npm script
npm run sign -w @checkverity/signer -- --input sample.jpg
```

---

## License

Apache-2.0 &copy; [Andrews Mintah](https://github.com/Mintahandrews)
