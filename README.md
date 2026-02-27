# Stash Library Triage Plugin

This repository contains a Stash plugin focused on library cleanup workflows:

- largest scene files triage page
- scene auto-tagging from female performer rating and age signals

## Repository layout

- `plugins/library-triage/` is the plugin package root.
- `.github/workflows/deploy.yml` + `build_site.sh` publish a Stash plugin source index to GitHub Pages.

## Quick local install

1. Copy `plugins/library-triage` into your Stash plugins directory.
2. Ensure the plugin YAML exists as `plugins/library-triage.yml`.
3. Reload plugins in **Settings > Plugins > Reload Plugins**.

## Web app install flow (recommended)

1. Push this repo to GitHub.
2. In GitHub repo settings, enable **Pages** with source **GitHub Actions**.
3. Push a commit to `main` that touches `plugins/**` (or run the workflow manually).
4. After the workflow succeeds, use this source URL in Stash:
   - `https://<your-user>.github.io/<your-repo>/main/index.yml`
5. In Stash: **Settings > Plugins > Available Plugins > Sources**, add that URL.
6. Install `Library Triage` from that source.

## What it adds

- UI route: `/plugin/library-triage`
  - scenes sorted by filesize descending
  - quick filtering by female performer signals
- Hook auto-tagging on:
  - `Scene.Create.Post`
  - `Scene.Update.Post`
  - `Performer.Update.Post`

Managed tag prefixes used by the hook:

- `triage/female-performer`
- `girl-rated-*`
- age buckets like `18-22 years old`, `35-40 years old`, `40-45 years old`, `> 45 years old`
- exact ages like `<N> years old`

Female rating tags use a 1-5 scale:

- `girl-rated-1`
- `girl-rated-2`
- `girl-rated-3`
- `girl-rated-4`
- `girl-rated-5`
- `girl-rated-unknown`
