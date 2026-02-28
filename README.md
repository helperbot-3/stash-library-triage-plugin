# Stash Library Triage Plugin

This plugin helps you clean a large Stash library by:

- finding large scene files faster
- filtering scenes by rating and female-performer signals
- auto-tagging scenes from female age/rating and male-female age-gap signals
- auto-tagging performers by star rating (`rated 1` ... `rated 5`)
- ranking performers/studios by number of unrated scenes

## Repository layout

- `plugins/library-triage/` is the plugin package root.
- `.github/workflows/deploy.yml` + `build_site.sh` publish the Stash plugin source index to GitHub Pages.

## Quick local install

1. Copy `plugins/library-triage` into your Stash plugins directory.
2. Ensure the plugin YAML exists as `plugins/library-triage.yml`.
3. Reload plugins in **Settings > Plugins > Reload Plugins**.

## Web app install flow (recommended)

1. Push this repo to GitHub at:
   - `https://github.com/helperbot-3/stash-library-triage-plugin`
2. In GitHub repo settings, enable **Pages** with source **GitHub Actions**.
3. Push a commit to `main` that touches `plugins/**` (or run the workflow manually).
4. After the workflow succeeds, add this source URL in Stash:
   - `https://helperbot-3.github.io/stash-library-triage-plugin/main/index.yml`
5. In Stash: **Settings > Plugins > Available Plugins > Sources**, add that URL.
6. Install or update `Library Triage` from that source.

## Features

### 1) Large-files triage page
- Route: `/plugin/library-triage`
- Shows scenes sorted by file size (largest first)
- Filters:
  - unrated-only toggle
  - scene rating min/max (1-5)
  - female performer rating min/max (1-5)
  - female performer age min/max

### 2) Unrated-count rankings page
- Route: `/plugin/library-triage-entities`
- Tabbed view:
  - `Performers`
  - `Studios`
- Shared controls:
  - minimum unrated count
  - hide zero
- Count source:
  - performer count: `custom_fields.triage_unrated_scene_count`
  - studio count: computed live from unrated scenes

## Data this plugin adds/updates

### Scene tags (managed by plugin)
When a scene has at least one performer with `gender == FEMALE`, the plugin manages these tags on that scene:

- Female rating tag:
  - `girl-rated-1` ... `girl-rated-5`
  - `girl-rated-unknown` (if no female rating exists)
- Female age bucket tags:
  - `18-22 years old`
  - `23-27 years old`
  - `28-34 years old`
  - `35-40 years old`
  - `40-45 years old`
  - `> 45 years old`
- Exact female age tags:
  - `<N> years old` (example: `22 years old`)
- Age-gap tags:
  - `Age Gap: Male 10++ years older than Female`
  - `Age Gap: Male 25++ years older`
  - `YFEM` (young female `<23`, male at least 10 years older)

Notes:
- Female means exactly `gender == FEMALE` (transgender female is intentionally ignored).
- Ages are calculated at scene date.
- If scene date or birthdate is missing, age-derived tags are skipped safely.

### Performer tags (managed by plugin)
- One of: `rated 1`, `rated 2`, `rated 3`, `rated 4`, `rated 5`
- Computed from performer `rating100` mapped to 1-5 stars
- Existing `rated [1-5]` tags are replaced by the current one

### Performer custom field (managed by plugin)
- `custom_fields.triage_unrated_scene_count`
- Number of unrated scenes linked to the performer

## When updates happen (hooks)

### Scene triage tags
- Triggered by:
  - `Scene.Create.Post`
  - `Scene.Update.Post`
  - `Performer.Update.Post` (when relevant performer fields changed)

### Performer unrated count field
- Triggered by:
  - `Scene.Create.Post`
  - `Scene.Update.Post`
  - `Scene.Destroy.Post`
  - `Performer.Update.Post`

### Performer `rated X` tags
- Triggered by:
  - `Performer.Create.Post`
  - `Performer.Update.Post` (rating changes)

## Manual tasks

- `Recompute unrated scene counts`
  - full recount of `triage_unrated_scene_count` for all performers
- `Backfill scene triage tags`
  - reprocesses all scenes and reapplies managed scene tags (age, rating, age-gap, YFEM)
