# Asset and Repo Policy

This repo separates **code licensing** from **asset usage rights**.

## Code

- All original code in this repository is released under the [MIT License](LICENSE).
- That includes gameplay systems, UI code, tests, tooling, and project documentation unless otherwise noted.

## Safe to Keep Public

These are good candidates to remain in a public source repository:

- source code under `src/`
- tests under `test/` and `tests/`
- docs, design notes, and CI/workflow files
- build and tooling config such as `package.json`, `vite.config.js`, `vitest.config.js`, and `playwright.config.js`
- original project writing and metadata

## Review Before Reuse or Re-licensing

These files may be present in the repo, but they should **not** be assumed to be MIT-licensed just because the code is:

- bundled art, textures, models, and promo images in `public/assets/` and `public/itch/`
- environment/HDR files
- bundled audio in `public/assets/sfx/`
- modified derivatives of third-party asset packs

Current third-party dependencies called out by the project:

- KayKit Medieval Hexagon Pack: credited in the README and project docs
- other bundled media such as sound effects, HDR files, and cover art should be treated as **asset-specific** until their source/license is documented

## Keep Private

These should stay out of the public repo unless you have a specific reason to publish them:

- API keys, tokens, platform credentials, and signing material
- raw source art files such as `.blend`, `.psd`, `.aseprite`, stems, or layered exports
- marketplace downloads or licensed source files that do not allow redistribution
- unpublished marketing plans, store dashboards, finance docs, or contract material
- generated local outputs like zips, staging builds, screenshots, and test reports

## Public Release Rule

When publishing the repo, use this rule:

1. Code can follow the repo license.
2. Assets keep their own license terms.
3. If an asset source or redistribution right is unclear, do not assume it is open.

## Recommended Next Step

Before a wider public launch or commercial release, add a short `THIRD_PARTY.md` or expand this file with:

- source URL
- author
- license
- whether redistribution in-source is allowed
- whether commercial use is allowed
