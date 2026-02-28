# Stash Library Triage Plugin

This plugin helps you clean a large Stash library by:

- finding large scene files faster
- filtering scenes by rating and female-performer signals
- auto-tagging scenes from female age/rating and male-female age-gap signals
- auto-tagging performers by star rating (`rated 1` ... `rated 5`)
- ranking performers/studios by unrated scene count and storage usage

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

### 2) Entity rankings page
- Route: `/plugin/library-triage-entities`
- Tabbed view:
  - `Performers`
  - `Studios`
- Shared controls:
  - minimum unrated count
  - hide zero
- Data source:
  - performer count: `custom_fields.triage_unrated_scene_count`
  - performer storage: `custom_fields.triage_total_size_bytes`
  - studio count: computed live from unrated scenes
  - studio storage: computed live from scene file sizes

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
  - `Age Gap: Young Female (<23y), Experienced Male (10y older)` (you can keep `YFEM` as alias in Stash)

Notes:
- Female means exactly `gender == FEMALE` (transgender female is intentionally ignored).
- Ages are calculated at scene date.
- If scene date or birthdate is missing, age-derived tags are skipped safely.

### Performer tags (managed by plugin)
- One of: `rated 1`, `rated 2`, `rated 3`, `rated 4`, `rated 5`
- Computed from performer `rating100` mapped to 1-5 stars
- Existing `rated [1-5]` tags are replaced by the current one

### Performer custom fields (managed by plugin)
- `custom_fields.triage_unrated_scene_count`
- Number of unrated scenes linked to the performer
- `custom_fields.triage_total_size_bytes`
- Total size in bytes across all scene files linked to the performer

### Studio tag (managed by plugin)
- `has unrated scenes`
- Added when a studio has at least one unrated scene
- Removed when all studio scenes are rated

## When updates happen (hooks)

### Scene triage tags
- Triggered by:
  - `Scene.Create.Post`
  - `Scene.Update.Post`
  - `Performer.Update.Post` (when relevant performer fields changed)

### Performer metrics + studio unrated tag
- Triggered by:
  - `Scene.Create.Post`
  - `Scene.Update.Post` (fast path for rating/file changes, full recount when studio/performer links change)
  - `Scene.Destroy.Post` (fast targeted refresh from hook payload, no global recount)
  - `Performer.Update.Post`

### Performer `rated X` tags
- Triggered by:
  - `Performer.Create.Post`
  - `Performer.Update.Post` (rating changes)

## Manual tasks

- `Recompute performer metrics`
  - full recount of performer metrics and studio `has unrated scenes` tag:
  - `triage_unrated_scene_count`
  - `triage_total_size_bytes`
- `Backfill scene triage tags`
  - reprocesses all scenes and reapplies managed scene tags (age, rating, age-gap)
