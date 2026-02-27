# Stash Library Triage Plugin

This repository contains a Stash plugin focused on library cleanup workflows:

- largest scene files triage page
- scene auto-tagging from female performer rating and age signals

## Install

1. Copy the `plugin-library-triage` directory into your Stash `plugins` directory.
2. Ensure the plugin YAML file is present as:
   - `plugins/library-triage.yml`
3. Reload plugins from **Settings > Plugins > Reload Plugins**.

## What it adds

- UI route: `/plugin/library-triage`
  - scenes sorted by filesize descending
  - quick filtering by female performer signals
- Hook auto-tagging on:
  - `Scene.Create.Post`
  - `Scene.Update.Post`

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
