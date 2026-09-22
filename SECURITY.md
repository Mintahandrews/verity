# Security Policy

Verity is built with a **strict privacy and security-first model**. This document describes our security guarantees, scope, and how to report vulnerabilities.

---

## Core Security & Privacy Invariants

1. **Zero Media Storage / Transmission**:
   - The Verity Browser Extension and Registry API **never** ingest, upload, or retain raw user images or videos.
   - Only SHA-256 content hashes and 64-bit perceptual hashes (`pHash`) are transmitted to or stored by the registry.
2. **Local Client-Side Cryptographic Execution**:
   - C2PA Content Credentials validation, EXIF metadata parsing, and OCR occur inside an isolated offscreen document or sandboxed client thread.
3. **Signed Provenance Trust Anchor**:
   - Only verified x509 certificate chains conforming to the Coalition for Content Provenance and Authenticity (C2PA) trust list can produce a `verified` outcome.

---

## Supported Versions

Security updates are actively applied to the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

---

## Reporting a Vulnerability

If you discover a security issue or vulnerability (such as a bypass of cryptographic validation, unexpected telemetry leakage, or rate-limiter denial of service):

1. **Do not disclose publicly** via GitHub issues, PRs, or public channels.
2. Submit a confidential report via [GitHub Private Vulnerability Reporting](https://github.com/Mintahandrews/verity/security/advisories/new) on the repository.
3. Include:
   - Affected component (`@checkverity/core`, `@checkverity/extension`, `@checkverity/registry`, `@checkverity/bot`, `@checkverity/signer`)
   - Step-by-step reproduction instructions or proof-of-concept media file
   - Impact assessment
4. **Response Timeline**:
   - Initial acknowledgement: within **24 hours**.
   - Assessment and triage: within **72 hours**.
   - Coordinated public disclosure and patch release: within **14 days**.
