## Description

Provide a clear explanation of what this pull request changes and why. Reference any related issues (e.g. `Fixes #123`).

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 📡 New Verification Signal
- [ ] ⚡ Performance / Optimization
- [ ] 📝 Documentation update
- [ ] 🎨 UI / Design alignment

## Architecture & Privacy Checklist

- [ ] **Privacy Preserved**: Media bytes never leave the local environment; only cryptographic hashes are sent to the registry.
- [ ] **Verdict Integrity**: Code respects the core invariant—*only cryptographic provenance (C2PA) can verify*. Never labels media "fake".
- [ ] **Graceful Degradation**: External API failures or missing keys downgrade signal status to `unsupported` or `neutral`, never throwing unhandled errors.

## Verification & Testing

- [ ] `npm run typecheck` passes cleanly across all packages.
- [ ] `npm test` passes all test suites.
- [ ] `npm run build` succeeds (if modifying extension or registry).
- [ ] Added or updated unit tests covering the changes.
