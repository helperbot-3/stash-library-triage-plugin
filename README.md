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

### Optional marker tag sync (configurable)
- You can configure tags that should be copied from scene to all scene markers.
- Config key in hook/task args: `marker_copy_tags` (JSON array string of selector strings).
- Wildcard `*` is supported in selectors.
- Example: `["girl-rated-*", "* years old", "Tag, With Comma"]`
- Behavior:
  - if a scene tag name matches any selector, it is added to all markers of that scene
  - if a managed scene tag is removed from scene, it is removed from markers
  - only matched/managed tags are touched; marker-only tags are preserved
  - marker->scene sync is also enabled for the same selectors:
    - if marker tag set changes for matched tags, scene managed tags are recomputed from marker union
    - no scene update is sent when effective scene tags are unchanged (loop-safe no-op)
    - hook skips if scene id cannot be resolved
  - defaults are preconfigured for your triage workflow:
    - all `girl-rated-*` tags
    - all `* years old` tags (exact age + buckets)
    - all `Age Gap:*` tags
    - plus the explicit tag set you listed (e.g. `First Porn Scene`, `Fake Tits`, `Audition`, `Casting`, `Teen (18-22)`, etc.)

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
  - `Scene.Update.Post` (only when update payload includes concrete scene date, scene rating, or scene performer changes)
  - `Performer.Update.Post` (when relevant performer fields changed)
- Exception:
  - if the scene update includes `tag_ids`, scene triage recompute is skipped so manual scene tag edits are preserved

### Marker tag sync (optional)
- Triggered by:
  - `Scene.Create.Post`
  - `Scene.Update.Post` (when update payload includes a concrete tag change, e.g. `tag_ids`/`tags`)
- Uses `marker_copy_tags` from plugin hook args.

### Marker -> scene tag sync (optional)
- Triggered by:
  - `SceneMarker.Create.Post`
  - `SceneMarker.Update.Post` (only when payload includes concrete marker tag changes)
  - `SceneMarker.Destroy.Post`
- Uses `marker_copy_tags` from plugin hook args.
- Guards:
  - requires resolvable scene id
  - updates scene only when effective managed scene tags actually changed

### Performer metrics + studio unrated tag
- Triggered by:
  - `Scene.Create.Post`
  - `Scene.Update.Post` (fast path for rating/file changes, full recount when studio/performer links change)
  - `Scene.Destroy.Post` (fast targeted refresh from hook payload, no global recount)
  - `Performer.Update.Post`
  - bulk scene updates (`ids` payload) always use fast targeted refresh

### Performer `rated X` tags
- Triggered by:
  - `Performer.Create.Post`
  - `Performer.Update.Post` (rating changes)

## Manual tasks

- `Recompute all triage data (recommended)`
  - runs both of the tasks below in one step
- `Sync configured scene tags to markers`
  - runs marker tag sync across all scenes using `marker_copy_tags`
- `Recompute performer metrics`
  - full recount of performer metrics and studio `has unrated scenes` tag:
  - `triage_unrated_scene_count`
  - `triage_total_size_bytes`
- `Backfill scene triage tags`
  - reprocesses all scenes and reapplies managed scene tags (age, rating, age-gap)
