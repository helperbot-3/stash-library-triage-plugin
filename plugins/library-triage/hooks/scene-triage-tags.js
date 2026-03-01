(function () {
  var FEMALE_GENDERS = {
    FEMALE: true,
  };
  var MALE_GENDERS = {
    MALE: true,
    TRANSGENDER_MALE: true,
  };

  var MANAGED_PREFIXES = [
    "girl-rated-",
    "triage/female-rating/",
    "triage/female-age/",
    "Age Gap:",
  ];
  var PERFORMER_RATING_TAG_REGEX = /^rated [1-5]$/;
  var YFEM_CANONICAL_TAG = "Age Gap: Young Female (<23y), Experienced Male (10y older)";

  var UNRATED_CF_KEY = "triage_unrated_scene_count";
  var STORAGE_BYTES_CF_KEY = "triage_total_size_bytes";
  var STUDIO_UNRATED_TAG_NAME = "has unrated scenes";
  var DEFAULT_MARKER_COPY_TAG_SELECTORS = [
    "girl-rated-*",
    "* years old",
    "Age Gap:*",
    "First Porn Scene",
    "Fake Boobs",
    "Fake Tits",
    "Fake Tits Bimbo",
    "Braces",
    "Audition",
    "Casting",
    "Teen (18-22)",
    "Teen (18–22)",
    "Teen Girl (18–22)",
    "Skinny",
    "Slim",
    "Small Tits",
    "White on Black",
    "First Anal Scene",
    "First Interracial Experience",
    "First Interracial Scene",
    "First Time",
    "Big vs. Small",
    "Bimbo",
    "Escort",
    "Experienced Man (30–40)",
    "Middle-aged Man (40–60)",
    "Older / Younger",
    "Older Man / Younger Woman",
    "Hairless Pussy",
    "Brown Hair",
    "Short Woman",
    "Blonde Hair",
    "Blonde",
    "Big Dick",
    "Twosome (Straight)",
    "Long Hair",
    "White Woman",
    "Brown Hair (Female)",
    "Trimmed Pussy",
    "Blonde Hair (Female)",
    "American",
    "Hairy Pussy",
    "Small Ass",
    "Amateur",
    "Objectified Amateur",
    "Medium Tits",
    "Behind the Scenes",
    "Pornstar",
    "Interracial",
    "White",
    "Asian",
    "Black",
    "Big Ass",
    "Latina Woman",
    "Latina",
    "Innie Pussy",
    "Tan Lines",
    "Piercing",
    "Professional Production",
    "White Man",
    "Straight Hair",
    "Navel Piercing",
    "Babes",
    "Family Roleplay",
    "Athletic Woman",
    "Tattoos & Piercings",
    "Adorable",
    "European",
    "Pale Skin",
    "Brown Eyes",
    "Blue Eyes",
    "Green Eyes",
    "Medium Skin",
    "Hairless Genitals",
    "Candid",
    "Tanned Skin",
    "Athletic",
    "All Natural",
    "Outie Pussy",
    "Average Height Woman",
    "Shaved",
    "Latin",
    "Reality Porn",
    "Tiny Woman",
    "Tiny",
    "Perky Tits",
    "Curly Hair",
    "Wavy Hair",
    "Big Black Cock (BBC)",
    "No Tattoos",
    "Missing or Removed",
    "Black Man",
    "Pigtails",
    "Necklace",
    "Manicured",
    "Freckles",
    "Perky Nipples",
    "Uniform",
    "Nose Piercing",
    "Puffy Nipples",
    "Innocent",
    "Average Body",
    "Big White Cock (BWC)",
    "Black Hair (Female)",
    "Curvy",
    "Muscular Man",
    "Coed",
    "Ponytail",
    "Schoolgirl",
    "American Porn",
    "Earrings",
    "Medium Hair",
    "Tiny Tits",
    "Asian Woman",
    "Average Male Body",
    "Tongue Piercing",
    "Short Hair",
    "Caucasian",
    "Black on White",
    "Cheerleader",
    "Hazel Eyes",
    "PAWG",
    "Tall Woman"
  ];

  function getArgs() {
    if (!input) return {};
    return input.Args || input.args || {};
  }

  function getAction() {
    var args = getArgs();
    return String(args.action || "scene_tags");
  }

  function getHookContext() {
    var args = getArgs();
    return args.hookContext || args.HookContext || null;
  }

  function getMarkerCopyTagNames() {
    var args = getArgs();
    var raw = args.marker_copy_tags != null ? args.marker_copy_tags : args.markerCopyTags;
    var values = null;

    if (Array.isArray(raw) && raw.length) {
      values = raw;
    } else if (typeof raw === "string" && raw.trim()) {
      // Canonical config format: JSON array string in plugin args.
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          values = parsed;
        }
      } catch (e) {
        // Ignore invalid JSON and fall back to defaults.
      }
    }

    if (!values) values = DEFAULT_MARKER_COPY_TAG_SELECTORS;

    var dedup = {};
    var out = [];
    for (var i = 0; i < values.length; i += 1) {
      var v = String(values[i] == null ? "" : values[i]).trim();
      if (!v || dedup[v]) continue;
      dedup[v] = true;
      out.push(v);
    }
    return out;
  }

  function matchesSelector(name, selector) {
    var n = String(name || "");
    var s = String(selector || "");
    if (s.indexOf("*") < 0) return n === s;

    var escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
    var re = new RegExp("^" + escaped + "$");
    return re.test(n);
  }

  function matchesAnySelector(name, selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      if (matchesSelector(name, selectors[i])) return true;
    }
    return false;
  }

  function parseDate(s) {
    if (!s) return null;
    var d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function ageAtDate(birthdate, sceneDate) {
    var b = parseDate(birthdate);
    var s = parseDate(sceneDate);
    if (!b || !s) return null;
    var age = s.getUTCFullYear() - b.getUTCFullYear();
    var m = s.getUTCMonth() - b.getUTCMonth();
    if (m < 0 || (m === 0 && s.getUTCDate() < b.getUTCDate())) age -= 1;
    return age >= 0 ? age : null;
  }

  function ageBucket(age) {
    if (age == null) return null;
    if (age < 18) return null;
    if (age <= 22) return "18-22 years old";
    if (age <= 27) return "23-27 years old";
    if (age <= 34) return "28-34 years old";
    if (age <= 40) return "35-40 years old";
    if (age <= 45) return "40-45 years old";
    return "> 45 years old";
  }

  function ratingBucket(maxRating) {
    if (typeof maxRating !== "number") return "unknown";
    var stars = Math.round(maxRating / 20);
    if (stars < 1) stars = 1;
    if (stars > 5) stars = 5;
    return String(stars);
  }

  function ratingStarsOrNull(rating100) {
    if (typeof rating100 !== "number" || !Number.isFinite(rating100)) return null;
    var stars = Math.round(rating100 / 20);
    if (stars < 1) stars = 1;
    if (stars > 5) stars = 5;
    return stars;
  }

  function hasManagedPrefix(name) {
    for (var i = 0; i < MANAGED_PREFIXES.length; i += 1) {
      if (name.indexOf(MANAGED_PREFIXES[i]) === 0) return true;
    }
    if (/^\d+\s+years old$/.test(name)) return true;
    if (/^\d+\-\d+\s+years old$/.test(name)) return true;
    if (/^>\s*\d+\s+years old$/.test(name)) return true;
    if (name === "YFEM") return true;
    return false;
  }

  function sortedUnique(arr) {
    var m = {};
    for (var i = 0; i < arr.length; i += 1) {
      m[arr[i]] = true;
    }
    var out = Object.keys(m);
    out.sort();
    return out;
  }

  function sameSortedStringSet(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function doGQL(query, variables) {
    return gql.Do(query, variables || {});
  }

  function logRun(message) {
    try {
      if (log && typeof log.Info === "function") {
        log.Info("[Library Triage] " + message);
        return;
      }
      if (log && typeof log.Warn === "function") {
        log.Warn("[Library Triage] " + message);
      }
    } catch (e) {
      // no-op: logging must never break hook execution
    }
  }

  function toIntOrNull(v) {
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
    if (typeof v === "string" && v.trim() !== "") {
      var n = Number(v);
      if (Number.isFinite(n)) return Math.round(n);
    }
    return null;
  }

  function getCustomFieldInt(mapObj, key) {
    if (!mapObj || typeof mapObj !== "object") return null;
    return toIntOrNull(mapObj[key]);
  }

  function fetchSceneForTags(sceneID) {
    var q = "query ($id: ID!) { findScene(id: $id) { id date tags { id name } performers { id name gender rating100 birthdate } } }";
    var res = doGQL(q, { id: String(sceneID) });
    return res && res.findScene ? res.findScene : null;
  }

  function fetchSceneWithMarkers(sceneID) {
    var q = "query ($id: ID!) { findScene(id: $id) { id tags { id name } scene_markers { id tags { id name } } } }";
    var res = doGQL(q, { id: String(sceneID) });
    return res && res.findScene ? res.findScene : null;
  }

  function fetchSceneMarker(markerID) {
    var q =
      "query ($ids: [ID!]) { findSceneMarkers(ids: $ids, filter: { per_page: 1 }) { scene_markers { id scene { id } tags { id name } } } }";
    try {
      var res = doGQL(q, { ids: [String(markerID)] });
      var markers = res && res.findSceneMarkers ? res.findSceneMarkers.scene_markers : [];
      return markers && markers.length ? markers[0] : null;
    } catch (e) {
      return null;
    }
  }

  function fetchTagByID(tagID) {
    var q = "query ($id: ID!) { findTag(id: $id) { id name } }";
    var res = doGQL(q, { id: String(tagID) });
    return res && res.findTag ? res.findTag : null;
  }

  function fetchSceneEntities(sceneID) {
    var q = "query ($id: ID!) { findScene(id: $id) { id studio { id } performers { id } } }";
    var res = doGQL(q, { id: String(sceneID) });
    return res && res.findScene ? res.findScene : null;
  }

  function fetchPerformerSceneIDs(performerID) {
    var q = "query ($id: ID!) { findPerformer(id: $id) { id scenes { id } } }";
    var res = doGQL(q, { id: String(performerID) });
    var performer = res && res.findPerformer ? res.findPerformer : null;
    if (!performer || !performer.scenes) return [];
    return performer.scenes
      .map(function (s) {
        return s && s.id ? String(s.id) : null;
      })
      .filter(function (id) {
        return !!id;
      });
  }

  function fetchAllPerformerIDs() {
    var q = "query ($filter: FindFilterType) { findPerformers(filter: $filter) { performers { id } } }";
    var res = doGQL(q, { filter: { per_page: -1 } });
    var performers = res && res.findPerformers ? res.findPerformers.performers : [];
    return (performers || [])
      .map(function (p) {
        return p && p.id ? String(p.id) : null;
      })
      .filter(function (id) {
        return !!id;
      });
  }

  function fetchAllStudioIDs() {
    var q = "query ($filter: FindFilterType) { findStudios(filter: $filter) { studios { id } } }";
    var res = doGQL(q, { filter: { per_page: -1 } });
    var studios = res && res.findStudios ? res.findStudios.studios : [];
    return (studios || [])
      .map(function (s) {
        return s && s.id ? String(s.id) : null;
      })
      .filter(function (id) {
        return !!id;
      });
  }

  function fetchAllSceneIDs() {
    var q = "query ($filter: FindFilterType) { findScenes(filter: $filter) { scenes { id } } }";
    var res = doGQL(q, { filter: { per_page: -1 } });
    var scenes = res && res.findScenes ? res.findScenes.scenes : [];
    return (scenes || [])
      .map(function (s) {
        return s && s.id ? String(s.id) : null;
      })
      .filter(function (id) {
        return !!id;
      });
  }

  function fetchPerformer(performerID) {
    var q = "query ($id: ID!) { findPerformer(id: $id) { id custom_fields } }";
    var res = doGQL(q, { id: String(performerID) });
    return res && res.findPerformer ? res.findPerformer : null;
  }

  function fetchPerformerForRatingTag(performerID) {
    var q = "query ($id: ID!) { findPerformer(id: $id) { id rating100 tags { id name } } }";
    var res = doGQL(q, { id: String(performerID) });
    return res && res.findPerformer ? res.findPerformer : null;
  }

  function fetchStudioForUnratedTag(studioID) {
    var q = "query ($id: ID!) { findStudio(id: $id) { id tags { id name } } }";
    var res = doGQL(q, { id: String(studioID) });
    return res && res.findStudio ? res.findStudio : null;
  }

  function listScenesByPerformer(performerID) {
    var q =
      "query ($filter: FindFilterType, $scene_filter: SceneFilterType) { " +
      "findScenes(filter: $filter, scene_filter: $scene_filter) { " +
      "count scenes { id files { size } } } }";
    var res = doGQL(q, {
      filter: { per_page: -1 },
      scene_filter: {
        performers: { value: [String(performerID)], modifier: "INCLUDES" },
      },
    });
    var node = res && res.findScenes ? res.findScenes : null;
    return {
      count: node ? Number(node.count || 0) : 0,
      scenes: node && Array.isArray(node.scenes) ? node.scenes : [],
    };
  }

  function countUnratedScenesByPerformer(performerID) {
    var q = "query ($filter: FindFilterType, $scene_filter: SceneFilterType) { findScenes(filter: $filter, scene_filter: $scene_filter) { count } }";
    var res = doGQL(q, {
      filter: { per_page: 1 },
      scene_filter: {
        performers: { value: [String(performerID)], modifier: "INCLUDES" },
        rating100: { value: 0, modifier: "IS_NULL" },
      },
    });
    return res && res.findScenes ? Number(res.findScenes.count || 0) : 0;
  }

  function countUnratedScenesByStudio(studioID) {
    var q = "query ($filter: FindFilterType, $scene_filter: SceneFilterType) { findScenes(filter: $filter, scene_filter: $scene_filter) { count } }";
    var res = doGQL(q, {
      filter: { per_page: 1 },
      scene_filter: {
        studios: { value: [String(studioID)], modifier: "INCLUDES" },
        rating100: { value: 0, modifier: "IS_NULL" },
      },
    });
    return res && res.findScenes ? Number(res.findScenes.count || 0) : 0;
  }

  function bytesFromScenes(scenes) {
    var total = 0;
    for (var i = 0; i < scenes.length; i += 1) {
      var files = scenes[i] && Array.isArray(scenes[i].files) ? scenes[i].files : [];
      for (var j = 0; j < files.length; j += 1) {
        var size = files[j] && typeof files[j].size === "number" ? files[j].size : 0;
        if (Number.isFinite(size) && size > 0) total += size;
      }
    }
    return Math.round(total);
  }

  function updatePerformerCustomFieldsMetrics(performerID, unratedCount, storageBytes) {
    var performer = fetchPerformer(performerID);
    if (!performer) return false;

    var currentUnrated = getCustomFieldInt(performer.custom_fields, UNRATED_CF_KEY);
    var currentStorage = getCustomFieldInt(performer.custom_fields, STORAGE_BYTES_CF_KEY);
    if (currentUnrated === unratedCount && currentStorage === storageBytes) return false;

    var q = "mutation ($input: PerformerUpdateInput!) { performerUpdate(input: $input) { id } }";
    doGQL(q, {
      input: {
        id: String(performerID),
        custom_fields: {
          partial: (function () {
            var obj = {};
            obj[UNRATED_CF_KEY] = unratedCount;
            obj[STORAGE_BYTES_CF_KEY] = storageBytes;
            return obj;
          })(),
        },
      },
    });
    return true;
  }

  function refreshPerformerMetrics(performerID) {
    var unratedCount = countUnratedScenesByPerformer(performerID);
    var listed = listScenesByPerformer(performerID);
    var storageBytes = bytesFromScenes(listed.scenes);
    return updatePerformerCustomFieldsMetrics(performerID, unratedCount, storageBytes);
  }

  function refreshCountsForScene(sceneID) {
    var scene = fetchSceneEntities(sceneID);
    if (!scene) return { updated: 0, checked: 0 };

    var updated = 0;
    var checked = 0;

    var performerIDs = (scene.performers || [])
      .map(function (p) {
        return p && p.id ? String(p.id) : null;
      })
      .filter(function (id) {
        return !!id;
      });

    for (var i = 0; i < performerIDs.length; i += 1) {
      checked += 1;
      if (refreshPerformerMetrics(performerIDs[i])) updated += 1;
    }

    return { updated: updated, checked: checked };
  }

  function recountAllUnratedCounts() {
    var performerIDs = fetchAllPerformerIDs();
    var updated = 0;

    for (var i = 0; i < performerIDs.length; i += 1) {
      if (refreshPerformerMetrics(performerIDs[i])) updated += 1;
    }

    var studioResult = recountAllStudioUnratedTags();

    return {
      Output:
        "Recounted performer metrics + studio unrated tags. performers=" +
        performerIDs.length +
        ", performer_updated=" +
        updated +
        ", studios_checked=" +
        studioResult.checked +
        ", studio_tag_updated=" +
        studioResult.updated,
    };
  }

  function findTagByName(name) {
    var q = "query ($filter: FindFilterType, $tag_filter: TagFilterType) { findTags(filter: $filter, tag_filter: $tag_filter) { tags { id name } } }";
    var res = doGQL(q, {
      filter: { per_page: 1 },
      tag_filter: { name: { value: name, modifier: "EQUALS" } },
    });
    var tags = res && res.findTags ? res.findTags.tags : [];
    return tags && tags.length ? tags[0] : null;
  }

  function createTag(name) {
    var q = "mutation ($input: TagCreateInput!) { tagCreate(input: $input) { id name } }";
    var res = doGQL(q, { input: { name: name } });
    return res ? res.tagCreate : null;
  }

  function getOrCreateTagID(name) {
    if (name === "YFEM") {
      var yfemCanonical = findTagByName(YFEM_CANONICAL_TAG);
      if (yfemCanonical && yfemCanonical.id) return yfemCanonical.id;
    }

    var existing = findTagByName(name);
    if (existing && existing.id) return existing.id;

    try {
      var created = createTag(name);
      if (created && created.id) return created.id;
    } catch (e) {
      var err = String(e || "");
      log.Warn("tagCreate failed for " + name + ", retrying find: " + err);

      // Stash can reject creating a tag when that name already exists as an alias
      // for another tag. In that case, resolve the canonical tag and reuse it.
      var aliasMatch = err.match(/used as alias for '([^']+)'/);
      if (aliasMatch && aliasMatch[1]) {
        var canonical = findTagByName(aliasMatch[1]);
        if (canonical && canonical.id) {
          return canonical.id;
        }
      }

      if (name === "YFEM") {
        var yfemCanonicalRetry = findTagByName(YFEM_CANONICAL_TAG);
        if (yfemCanonicalRetry && yfemCanonicalRetry.id) return yfemCanonicalRetry.id;
      }
    }

    var retry = findTagByName(name);
    if (retry && retry.id) return retry.id;
    throw new Error("Unable to resolve tag id for " + name);
  }

  function updateSceneTags(sceneID, tagIDs) {
    var q = "mutation ($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id } }";
    doGQL(q, {
      input: {
        id: String(sceneID),
        tag_ids: tagIDs,
      },
    });
  }

  function updatePerformerTags(performerID, tagIDs) {
    var q = "mutation ($input: PerformerUpdateInput!) { performerUpdate(input: $input) { id } }";
    doGQL(q, {
      input: {
        id: String(performerID),
        tag_ids: tagIDs,
      },
    });
  }

  function updateSceneMarkerTags(markerID, tagIDs) {
    var q = "mutation ($input: SceneMarkerUpdateInput!) { sceneMarkerUpdate(input: $input) { id } }";
    doGQL(q, {
      input: {
        id: String(markerID),
        tag_ids: tagIDs,
      },
    });
  }

  function updateStudioTags(studioID, tagIDs) {
    var q = "mutation ($input: StudioUpdateInput!) { studioUpdate(input: $input) { id } }";
    doGQL(q, {
      input: {
        id: String(studioID),
        tag_ids: tagIDs,
      },
    });
  }

  function syncStudioUnratedTag(studioID, studioUnratedTagID) {
    if (!studioID) return false;
    var studio = fetchStudioForUnratedTag(studioID);
    if (!studio) return false;

    var currentTags = studio.tags || [];
    var keepTagIDs = [];
    var hasTag = false;

    for (var i = 0; i < currentTags.length; i += 1) {
      var t = currentTags[i];
      if (t && String(t.id) === String(studioUnratedTagID)) {
        hasTag = true;
      } else if (t && t.id) {
        keepTagIDs.push(String(t.id));
      }
    }

    var shouldHaveTag = countUnratedScenesByStudio(studioID) > 0;
    if (shouldHaveTag === hasTag) return false;

    var nextTagIDs = shouldHaveTag ? keepTagIDs.concat([String(studioUnratedTagID)]) : keepTagIDs;
    updateStudioTags(studioID, nextTagIDs);
    return true;
  }

  function recountAllStudioUnratedTags() {
    var studioIDs = fetchAllStudioIDs();
    var studioTagID = getOrCreateTagID(STUDIO_UNRATED_TAG_NAME);
    var updated = 0;

    for (var i = 0; i < studioIDs.length; i += 1) {
      if (syncStudioUnratedTag(studioIDs[i], studioTagID)) updated += 1;
    }

    return {
      checked: studioIDs.length,
      updated: updated,
    };
  }

  function processPerformerRatingTag(performerID) {
    var performer = fetchPerformerForRatingTag(performerID);
    if (!performer) {
      return { Error: "Performer not found for hook context id " + performerID };
    }

    var currentTags = performer.tags || [];
    var keepTagIDs = [];
    var currentAllIDs = [];

    for (var i = 0; i < currentTags.length; i += 1) {
      var t = currentTags[i];
      currentAllIDs.push(t.id);
      if (!PERFORMER_RATING_TAG_REGEX.test(String(t.name || ""))) {
        keepTagIDs.push(t.id);
      }
    }

    var desiredTagIDs = [];
    var stars = ratingStarsOrNull(performer.rating100);
    if (stars != null) {
      desiredTagIDs.push(getOrCreateTagID("rated " + String(stars)));
    }

    var nextAllIDs = keepTagIDs.concat(desiredTagIDs);
    var currentSorted = sortedUnique(currentAllIDs);
    var nextSorted = sortedUnique(nextAllIDs);
    if (sameSortedStringSet(currentSorted, nextSorted)) {
      return { Output: "No performer rating tag changes for performer " + performerID };
    }

    updatePerformerTags(performerID, nextAllIDs);
    return { Output: "Updated performer rating tag for performer " + performerID };
  }

  function processSceneTags(sceneID) {
    var scene = fetchSceneForTags(sceneID);
    if (!scene) {
      return { Error: "Scene not found for hook context id " + sceneID };
    }

    var currentTags = scene.tags || [];
    var keepTagIDs = [];
    var managedCurrentNames = [];
    var currentAllIDs = [];

    for (var i = 0; i < currentTags.length; i += 1) {
      var t = currentTags[i];
      currentAllIDs.push(t.id);
      if (hasManagedPrefix(t.name)) {
        managedCurrentNames.push(t.name);
      } else {
        keepTagIDs.push(t.id);
      }
    }

    var desiredManagedNames = buildManagedTags(scene);
    var desiredManagedIDs = [];
    for (var j = 0; j < desiredManagedNames.length; j += 1) {
      desiredManagedIDs.push(getOrCreateTagID(desiredManagedNames[j]));
    }

    var nextAllIDs = keepTagIDs.concat(desiredManagedIDs);
    var currentSorted = sortedUnique(currentAllIDs);
    var nextSorted = sortedUnique(nextAllIDs);

    if (sameSortedStringSet(currentSorted, nextSorted)) {
      return {
        Output:
          "No triage tag changes for scene " +
          sceneID +
          ". Managed tags: [" +
          managedCurrentNames.join(", ") +
          "]",
      };
    }

    updateSceneTags(sceneID, nextAllIDs);

    return {
      Output:
        "Updated triage tags for scene " +
        sceneID +
        ": [" +
        desiredManagedNames.join(", ") +
        "]",
    };
  }

  function buildManagedTags(scene) {
    var tags = [];

    var performers = scene.performers || [];
    var females = performers.filter(function (p) {
      return p && FEMALE_GENDERS[p.gender || ""];
    });
    var males = performers.filter(function (p) {
      return p && MALE_GENDERS[p.gender || ""];
    });

    if (!females.length) {
      return [];
    }

    var ratings = females
      .map(function (p) {
        return p.rating100;
      })
      .filter(function (v) {
        return typeof v === "number";
      });

    var maxRating = ratings.length ? Math.max.apply(null, ratings) : null;
    tags.push("girl-rated-" + ratingBucket(maxRating));

    var seenAgeTags = {};
    for (var i = 0; i < females.length; i += 1) {
      var age = ageAtDate(females[i].birthdate, scene.date);
      var bucket = ageBucket(age);
      if (!bucket) continue;
      seenAgeTags[bucket] = true;
      seenAgeTags[String(age) + " years old"] = true;
    }

    var ageTags = Object.keys(seenAgeTags);
    for (var j = 0; j < ageTags.length; j += 1) {
      tags.push(ageTags[j]);
    }

    var femaleAges = females
      .map(function (p) {
        return ageAtDate(p.birthdate, scene.date);
      })
      .filter(function (v) {
        return typeof v === "number";
      });
    var maleAges = males
      .map(function (p) {
        return ageAtDate(p.birthdate, scene.date);
      })
      .filter(function (v) {
        return typeof v === "number";
      });

    if (femaleAges.length && maleAges.length) {
      var maxMaleOlderGap = null;
      var hasYFEM = false;

      for (var fa = 0; fa < femaleAges.length; fa += 1) {
        var fAge = femaleAges[fa];
        for (var ma = 0; ma < maleAges.length; ma += 1) {
          var mAge = maleAges[ma];
          var gap = mAge - fAge;
          if (maxMaleOlderGap == null || gap > maxMaleOlderGap) {
            maxMaleOlderGap = gap;
          }
          if (fAge < 23 && gap >= 10) {
            hasYFEM = true;
          }
        }
      }

      if (maxMaleOlderGap != null && maxMaleOlderGap >= 10) {
        tags.push("Age Gap: Male 10++ years older than Female");
      }
      if (maxMaleOlderGap != null && maxMaleOlderGap >= 25) {
        tags.push("Age Gap: Male 25++ years older");
      }
      if (hasYFEM) {
        tags.push(YFEM_CANONICAL_TAG);
      }
    }

    return sortedUnique(tags);
  }

  function shouldSkipPerformerCountHook(hookContext) {
    var fields = Array.isArray(hookContext.inputFields) ? hookContext.inputFields : [];
    return fields.length > 0 && fields.length === 1 && fields[0] === "custom_fields";
  }

  function shouldSkipPerformerRatingTagHook(hookContext) {
    var hookType = String(hookContext.type || "");
    if (hookType === "Performer.Create.Post") return false;
    if (hookType !== "Performer.Update.Post") return true;
    var fields = Array.isArray(hookContext.inputFields) ? hookContext.inputFields : [];
    if (fields.length === 0) return false;
    for (var i = 0; i < fields.length; i += 1) {
      if (fields[i] === "rating100") return false;
    }
    return true;
  }

  function sceneUpdateNeedsGlobalRecount(hookContext) {
    var fields = Array.isArray(hookContext.inputFields) ? hookContext.inputFields : [];
    var input = hookContext && hookContext.input && typeof hookContext.input === "object" ? hookContext.input : {};

    function hasOwn(obj, key) {
      return Object.prototype.hasOwnProperty.call(obj, key);
    }

    function isNonNilValue(v) {
      if (v == null) return false;
      if (typeof v === "string") return v.trim() !== "";
      return true;
    }

    function relationshipBulkValueHasChange(v) {
      if (Array.isArray(v)) return false;
      if (!v || typeof v !== "object") return false;
      if (Array.isArray(v.ids) && v.ids.length > 0) return true;
      if (typeof v.mode === "string" && v.mode.trim() !== "") return true;
      // If object exists (even empty ids), treat as explicit relationship update intent.
      return Object.keys(v).length > 0;
    }

    // Bulk scene updates include "ids" and often carry relationship keys even for rating-only edits.
    // Treat bulk scene updates as fast-path and rely on targeted refresh + manual full recount if needed.
    if (hasOwn(input, "ids")) {
      return false;
    }

    // Full-scene edit forms often submit many fields (including relationship keys)
    // even when only tags/rating/title changed. Avoid expensive false-positive recounts.
    if (fields.length > 6) {
      return false;
    }

    for (var i = 0; i < fields.length; i += 1) {
      var f = String(fields[i] || "");
      if (f === "performer_ids") {
        if (hasOwn(input, "performer_ids")) {
          if (relationshipBulkValueHasChange(input.performer_ids)) return true;
          continue;
        }
        return true;
      }
      if (f === "performers") {
        if (hasOwn(input, "performers")) {
          if (isNonNilValue(input.performers)) return true;
          continue;
        }
        return true;
      }
      if (f === "studio_id") {
        if (hasOwn(input, "studio_id")) {
          if (isNonNilValue(input.studio_id)) return true;
          continue;
        }
        return true;
      }
      if (f === "studio") {
        if (hasOwn(input, "studio")) {
          if (isNonNilValue(input.studio)) return true;
          continue;
        }
        return true;
      }
    }
    return false;
  }

  function toStringIDArray(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map(function (v) {
        if (v == null) return null;
        if (typeof v === "string" || typeof v === "number") return String(v);
        if (typeof v === "object" && v.id != null) return String(v.id);
        return null;
      })
      .filter(function (id) {
        return !!id;
      });
  }

  function extractDestroyRefs(hookContext) {
    var candidates = [
      hookContext && hookContext.input,
      hookContext && hookContext.Input,
      hookContext && hookContext.object,
      hookContext && hookContext.Object,
      hookContext && hookContext.entity,
      hookContext && hookContext.Entity,
    ];
    var data = null;
    for (var i = 0; i < candidates.length; i += 1) {
      if (candidates[i] && typeof candidates[i] === "object") {
        data = candidates[i];
        break;
      }
    }
    if (!data) data = {};

    var performerIDs = [];
    performerIDs = performerIDs.concat(toStringIDArray(data.performer_ids));
    performerIDs = performerIDs.concat(toStringIDArray(data.performers));
    performerIDs = performerIDs.concat(toStringIDArray(data.performerIds));

    var studioID = null;
    if (data.studio_id != null) studioID = String(data.studio_id);
    if (!studioID && data.studioId != null) studioID = String(data.studioId);
    if (!studioID && data.studio && data.studio.id != null) studioID = String(data.studio.id);

    var dedup = {};
    var finalPerformerIDs = [];
    for (var p = 0; p < performerIDs.length; p += 1) {
      var id = performerIDs[p];
      if (dedup[id]) continue;
      dedup[id] = true;
      finalPerformerIDs.push(id);
    }

    return {
      performerIDs: finalPerformerIDs,
      studioID: studioID,
    };
  }

  function runSceneTagAction() {
    var hookContext = getHookContext();
    if (!hookContext || !hookContext.id) {
      return { Output: "No hook context for scene tag action, skipping" };
    }

    var hookType = String(hookContext.type || "");

    if (hookType === "Scene.Update.Post") {
      var sceneFields = Array.isArray(hookContext.inputFields) ? hookContext.inputFields : [];
      if (sceneFields.length > 0) {
        var relevantSceneChanges = {
          date: true,
          rating100: true,
          rating: true,
          performer_ids: true,
          performerIds: true,
          performers: true,
        };
        var hasRelevantSceneChange = false;
        for (var sf = 0; sf < sceneFields.length; sf += 1) {
          if (relevantSceneChanges[String(sceneFields[sf] || "")]) {
            hasRelevantSceneChange = true;
            break;
          }
        }
        if (!hasRelevantSceneChange) {
          return { Output: "Scene update had no date/rating/performer changes, skipping scene tag recompute" };
        }
      }
    }

    if (hookType === "Performer.Update.Post") {
      var inputFields = Array.isArray(hookContext.inputFields) ? hookContext.inputFields : [];
      var relevant = { birthdate: true, gender: true, rating100: true };
      var hasRelevantChange = inputFields.length === 0;
      for (var f = 0; f < inputFields.length; f += 1) {
        if (relevant[inputFields[f]]) {
          hasRelevantChange = true;
          break;
        }
      }
      if (!hasRelevantChange) {
        return { Output: "Performer update had no age/rating/gender changes, skipping scene tag update" };
      }

      var performerID = String(hookContext.id);
      var sceneIDs = fetchPerformerSceneIDs(performerID);
      if (!sceneIDs.length) {
        return { Output: "No scenes linked to performer " + performerID };
      }

      var processed = 0;
      var failed = 0;
      var errorMessages = [];

      for (var s = 0; s < sceneIDs.length; s += 1) {
        var result = processSceneTags(sceneIDs[s]);
        if (result && result.Error) {
          failed += 1;
          errorMessages.push(result.Error);
        } else {
          processed += 1;
        }
      }

      if (failed > 0) {
        return {
          Error:
            "Performer update processed " +
            processed +
            " scenes, failed " +
            failed +
            ". First error: " +
            errorMessages[0],
        };
      }

      return {
        Output:
          "Performer update processed " +
          processed +
          " linked scenes for performer " +
          performerID,
      };
    }

    return processSceneTags(String(hookContext.id));
  }

  function runUnratedCountAction() {
    var hookContext = getHookContext();
    if (!hookContext || !hookContext.id) {
      return recountAllUnratedCounts();
    }

    var hookType = String(hookContext.type || "");
    var studioTagID = getOrCreateTagID(STUDIO_UNRATED_TAG_NAME);

    if (hookType === "Scene.Create.Post") {
      var sceneResult = refreshCountsForScene(String(hookContext.id));
      var sceneCreate = fetchSceneEntities(String(hookContext.id));
      var studioChanged = 0;
      if (sceneCreate && sceneCreate.studio && sceneCreate.studio.id) {
        studioChanged = syncStudioUnratedTag(String(sceneCreate.studio.id), studioTagID) ? 1 : 0;
      }
      return {
        Output:
          "Refreshed performer metrics + studio tag from scene " +
          String(hookContext.id) +
          ": checked=" +
          sceneResult.checked +
          ", performer_updated=" +
          sceneResult.updated +
          ", studio_tag_updated=" +
          studioChanged,
      };
    }

    if (hookType === "Scene.Update.Post") {
      if (sceneUpdateNeedsGlobalRecount(hookContext)) {
        var fieldsForWarn = Array.isArray(hookContext.inputFields) ? hookContext.inputFields.join(",") : "";
        logRun(
          "warning global recount selected trigger=" +
            hookType +
            " id=" +
            String(hookContext.id || "") +
            " inputFields=" +
            fieldsForWarn
        );
        var full = recountAllUnratedCounts();
        if (full && full.Output) {
          var fields = Array.isArray(hookContext.inputFields) ? hookContext.inputFields.join(",") : "";
          full.Output = "Global recount on scene update (relationship change; fields=" + fields + "). " + full.Output;
        }
        return full;
      }

      var sceneUpdateResult = refreshCountsForScene(String(hookContext.id));
      var sceneUpdate = fetchSceneEntities(String(hookContext.id));
      var studioUpdateChanged = 0;
      if (sceneUpdate && sceneUpdate.studio && sceneUpdate.studio.id) {
        studioUpdateChanged = syncStudioUnratedTag(String(sceneUpdate.studio.id), studioTagID) ? 1 : 0;
      }
      return {
        Output:
          "Refreshed performer metrics + studio tag from scene update " +
          String(hookContext.id) +
          ": checked=" +
          sceneUpdateResult.checked +
          ", performer_updated=" +
          sceneUpdateResult.updated +
          ", studio_tag_updated=" +
          studioUpdateChanged,
      };
    }

    if (hookType === "Scene.Destroy.Post") {
      var refs = extractDestroyRefs(hookContext);
      var performerUpdated = 0;
      for (var r = 0; r < refs.performerIDs.length; r += 1) {
        if (refreshPerformerMetrics(refs.performerIDs[r])) performerUpdated += 1;
      }
      var studioUpdated = 0;
      if (refs.studioID) {
        studioUpdated = syncStudioUnratedTag(refs.studioID, studioTagID) ? 1 : 0;
      }
      return {
        Output:
          "Fast destroy refresh completed. performer_checked=" +
          refs.performerIDs.length +
          ", performer_updated=" +
          performerUpdated +
          ", studio_checked=" +
          (refs.studioID ? 1 : 0) +
          ", studio_tag_updated=" +
          studioUpdated,
      };
    }

    if (hookType === "Performer.Update.Post") {
      if (shouldSkipPerformerCountHook(hookContext)) {
        return { Output: "Skipping performer count hook for custom_fields-only update" };
      }

      var performerID = String(hookContext.id);
      var changed = refreshPerformerMetrics(performerID);
      return { Output: "Performer " + performerID + " triage metrics " + (changed ? "updated" : "unchanged") };
    }

    return { Output: "No count action for hook type " + hookType + ", skipping" };
  }

  function runPerformerRatingTagAction() {
    var hookContext = getHookContext();
    if (!hookContext || !hookContext.id) {
      return { Output: "No hook context for performer rating tag action, skipping" };
    }

    if (shouldSkipPerformerRatingTagHook(hookContext)) {
      return { Output: "Performer update had no rating change, skipping performer rating tag update" };
    }

    return processPerformerRatingTag(String(hookContext.id));
  }

  function runBackfillSceneTagsAction() {
    var sceneIDs = fetchAllSceneIDs();
    var processed = 0;
    var failed = 0;
    var firstError = null;

    for (var i = 0; i < sceneIDs.length; i += 1) {
      var result = processSceneTags(sceneIDs[i]);
      if (result && result.Error) {
        failed += 1;
        if (!firstError) firstError = result.Error;
      } else {
        processed += 1;
      }
    }

    if (failed > 0) {
      return {
        Error:
          "Backfill completed with failures. processed=" +
          processed +
          ", failed=" +
          failed +
          ", first_error=" +
          firstError,
      };
    }

    return {
      Output: "Backfilled scene triage tags for " + processed + " scenes.",
    };
  }

  function syncConfiguredSceneTagsToMarkersForScene(sceneID, selectors) {
    if (!selectors.length) {
      return { Output: "No marker_copy_tags configured; marker tag sync skipped" };
    }

    var scene = fetchSceneWithMarkers(sceneID);
    if (!scene) return { Error: "Scene not found for marker sync: " + sceneID };

    var desiredIDs = [];
    var desiredSet = {};
    var sceneTags = Array.isArray(scene.tags) ? scene.tags : [];
    for (var i = 0; i < sceneTags.length; i += 1) {
      var st = sceneTags[i];
      if (!st || !st.id || !st.name) continue;
      var stName = String(st.name);
      var stID = String(st.id);
      if (!matchesAnySelector(stName, selectors)) continue;
      if (desiredSet[stID]) continue;
      desiredSet[stID] = true;
      desiredIDs.push(stID);
    }

    var markers = Array.isArray(scene.scene_markers) ? scene.scene_markers : [];
    var updated = 0;

    for (var k = 0; k < markers.length; k += 1) {
      var marker = markers[k];
      if (!marker || !marker.id) continue;
      var current = Array.isArray(marker.tags) ? marker.tags : [];
      var nextIDs = [];
      var seen = {};

      for (var t = 0; t < current.length; t += 1) {
        var tag = current[t];
        if (!tag || !tag.id) continue;
        var tid = String(tag.id);
        var tname = String(tag.name || "");
        if (matchesAnySelector(tname, selectors)) continue;
        if (seen[tid]) continue;
        seen[tid] = true;
        nextIDs.push(tid);
      }

      for (var dt = 0; dt < desiredIDs.length; dt += 1) {
        var did = String(desiredIDs[dt]);
        if (seen[did]) continue;
        seen[did] = true;
        nextIDs.push(did);
      }

      var currentIDs = current
        .map(function (tagObj) {
          return tagObj && tagObj.id ? String(tagObj.id) : null;
        })
        .filter(function (id) {
          return !!id;
        });

      var currentSorted = sortedUnique(currentIDs);
      var nextSorted = sortedUnique(nextIDs);
      if (sameSortedStringSet(currentSorted, nextSorted)) continue;

      updateSceneMarkerTags(String(marker.id), nextIDs);
      updated += 1;
    }

    return {
      Output:
        "Synced configured scene tags to markers for scene " +
        sceneID +
        ". markers=" +
        markers.length +
        ", updated=" +
        updated,
    };
  }

  function runSceneMarkerTagCopyAction() {
    var selectors = getMarkerCopyTagNames();
    var hookContext = getHookContext();
    if (!hookContext || !hookContext.id) {
      if (!selectors.length) {
        return { Output: "No marker_copy_tags configured; marker tag sync skipped" };
      }

      var sceneIDs = fetchAllSceneIDs();
      var processed = 0;
      var failed = 0;
      var firstError = null;
      for (var i = 0; i < sceneIDs.length; i += 1) {
        var res = syncConfiguredSceneTagsToMarkersForScene(sceneIDs[i], selectors);
        if (res && res.Error) {
          failed += 1;
          if (!firstError) firstError = res.Error;
        } else {
          processed += 1;
        }
      }
      if (failed > 0) {
        return {
          Error:
            "Marker tag sync completed with failures. scenes_processed=" +
            processed +
            ", failed=" +
            failed +
            ", first_error=" +
            firstError,
        };
      }
      return { Output: "Marker tag sync completed for " + processed + " scenes." };
    }

    var hookType = String(hookContext.type || "");
    if (hookType === "Scene.Update.Post") {
      var fields = Array.isArray(hookContext.inputFields) ? hookContext.inputFields : [];
      var tagFieldChanged = false;
      for (var f = 0; f < fields.length; f += 1) {
        var fieldName = String(fields[f] || "");
        if (fieldName === "tag_ids" || fieldName === "tags" || fieldName === "tagIds") {
          tagFieldChanged = true;
          break;
        }
      }
      var inputObj = hookContext.input && typeof hookContext.input === "object" ? hookContext.input : {};
      var hasTagPayload =
        (Object.prototype.hasOwnProperty.call(inputObj, "tag_ids") && inputObj.tag_ids != null) ||
        (Object.prototype.hasOwnProperty.call(inputObj, "tags") && inputObj.tags != null) ||
        (Object.prototype.hasOwnProperty.call(inputObj, "tagIds") && inputObj.tagIds != null);
      if (!tagFieldChanged || !hasTagPayload) {
        return { Output: "Scene update had no concrete tag change payload; marker tag sync skipped" };
      }
    }

    return syncConfiguredSceneTagsToMarkersForScene(String(hookContext.id), selectors);
  }

  function extractTagIDsFromMarkerInput(inputObj) {
    if (!inputObj || typeof inputObj !== "object") return null;

    function toIDArray(v) {
      if (!Array.isArray(v)) return null;
      var out = [];
      var seen = {};
      for (var i = 0; i < v.length; i += 1) {
        var item = v[i];
        var id = "";
        if (item == null) continue;
        if (typeof item === "string" || typeof item === "number") {
          id = String(item).trim();
        } else if (typeof item === "object" && item.id != null) {
          id = String(item.id).trim();
        }
        if (!id || seen[id]) continue;
        seen[id] = true;
        out.push(id);
      }
      return out;
    }

    if (Object.prototype.hasOwnProperty.call(inputObj, "tag_ids")) {
      var idsA = toIDArray(inputObj.tag_ids);
      if (idsA) return idsA;
    }
    if (Object.prototype.hasOwnProperty.call(inputObj, "tagIds")) {
      var idsB = toIDArray(inputObj.tagIds);
      if (idsB) return idsB;
    }
    if (Object.prototype.hasOwnProperty.call(inputObj, "tags")) {
      var idsC = toIDArray(inputObj.tags);
      if (idsC) return idsC;
    }
    return null;
  }

  function extractSceneIDFromMarkerHook(hookContext) {
    var inputObj = hookContext && hookContext.input && typeof hookContext.input === "object" ? hookContext.input : {};
    var objectObj = hookContext && hookContext.object && typeof hookContext.object === "object" ? hookContext.object : {};

    function idFrom(v) {
      if (v == null) return "";
      var s = String(v).trim();
      return s ? s : "";
    }

    var direct = idFrom(inputObj.scene_id || inputObj.sceneId || objectObj.scene_id || objectObj.sceneId);
    if (direct) return direct;

    var nestedInput = inputObj.scene && typeof inputObj.scene === "object" ? idFrom(inputObj.scene.id) : "";
    if (nestedInput) return nestedInput;

    var nestedObject = objectObj.scene && typeof objectObj.scene === "object" ? idFrom(objectObj.scene.id) : "";
    if (nestedObject) return nestedObject;

    var markerID = hookContext && hookContext.id != null ? String(hookContext.id) : "";
    if (!markerID) return "";
    var marker = fetchSceneMarker(markerID);
    if (marker && marker.scene && marker.scene.id) return String(marker.scene.id);
    return "";
  }

  function syncConfiguredMarkerTagsToScene(sceneID, selectors, markerOverride) {
    if (!selectors.length) {
      return { Output: "No marker_copy_tags configured; marker->scene tag sync skipped" };
    }

    var scene = fetchSceneWithMarkers(sceneID);
    if (!scene) return { Error: "Scene not found for marker->scene sync: " + sceneID };

    var desiredManaged = [];
    var desiredManagedSet = {};
    var markers = Array.isArray(scene.scene_markers) ? scene.scene_markers : [];
    var overrideTagNameByID = {};
    var overrideMarkerID = markerOverride && markerOverride.markerID ? String(markerOverride.markerID) : "";
    var overrideTagIDs = markerOverride && Array.isArray(markerOverride.tagIDs) ? markerOverride.tagIDs : null;

    if (overrideMarkerID && overrideTagIDs) {
      for (var ot = 0; ot < overrideTagIDs.length; ot += 1) {
        var overrideID = String(overrideTagIDs[ot] || "").trim();
        if (!overrideID || overrideTagNameByID[overrideID]) continue;
        var tagObj = fetchTagByID(overrideID);
        if (tagObj && tagObj.id && tagObj.name) {
          overrideTagNameByID[String(tagObj.id)] = String(tagObj.name);
        }
      }
    }

    for (var m = 0; m < markers.length; m += 1) {
      var marker = markers[m];
      var markerTags = marker && Array.isArray(marker.tags) ? marker.tags : [];

      if (overrideMarkerID && marker && String(marker.id || "") === overrideMarkerID && overrideTagIDs) {
        markerTags = overrideTagIDs.map(function (id) {
          var sid = String(id);
          return { id: sid, name: overrideTagNameByID[sid] || "" };
        });
      }

      for (var mt = 0; mt < markerTags.length; mt += 1) {
        var tag = markerTags[mt];
        if (!tag || !tag.id || !tag.name) continue;
        var name = String(tag.name);
        var id = String(tag.id);
        if (!matchesAnySelector(name, selectors)) continue;
        if (desiredManagedSet[id]) continue;
        desiredManagedSet[id] = true;
        desiredManaged.push(id);
      }
    }

    var currentSceneTags = Array.isArray(scene.tags) ? scene.tags : [];
    var nextSceneTagIDs = [];
    var seen = {};

    for (var st = 0; st < currentSceneTags.length; st += 1) {
      var sceneTag = currentSceneTags[st];
      if (!sceneTag || !sceneTag.id) continue;
      var sceneTagID = String(sceneTag.id);
      var sceneTagName = String(sceneTag.name || "");
      if (matchesAnySelector(sceneTagName, selectors)) continue;
      if (seen[sceneTagID]) continue;
      seen[sceneTagID] = true;
      nextSceneTagIDs.push(sceneTagID);
    }

    for (var d = 0; d < desiredManaged.length; d += 1) {
      var did = String(desiredManaged[d]);
      if (seen[did]) continue;
      seen[did] = true;
      nextSceneTagIDs.push(did);
    }

    var currentIDs = currentSceneTags
      .map(function (tagObj) {
        return tagObj && tagObj.id ? String(tagObj.id) : null;
      })
      .filter(function (id) {
        return !!id;
      });

    var currentSorted = sortedUnique(currentIDs);
    var nextSorted = sortedUnique(nextSceneTagIDs);
    if (sameSortedStringSet(currentSorted, nextSorted)) {
      return { Output: "Marker->scene managed tags already in sync for scene " + sceneID };
    }

    updateSceneTags(sceneID, nextSceneTagIDs);
    return {
      Output:
        "Synced configured marker tags to scene " +
        sceneID +
        ". markers=" +
        markers.length +
        ", scene_tags_updated=1",
    };
  }

  function runMarkerToSceneTagCopyAction() {
    var selectors = getMarkerCopyTagNames();
    var hookContext = getHookContext();
    if (!hookContext || !hookContext.type) {
      return { Output: "Marker->scene sync requires hook context; skipped" };
    }

    var hookType = String(hookContext.type || "");
    if (hookType === "SceneMarker.Update.Post") {
      var fields = Array.isArray(hookContext.inputFields) ? hookContext.inputFields : [];
      var tagFieldChanged = false;
      for (var f = 0; f < fields.length; f += 1) {
        var fieldName = String(fields[f] || "");
        if (fieldName === "tag_ids" || fieldName === "tags" || fieldName === "tagIds") {
          tagFieldChanged = true;
          break;
        }
      }
      var inputObj = hookContext.input && typeof hookContext.input === "object" ? hookContext.input : {};
      var hasTagPayload =
        (Object.prototype.hasOwnProperty.call(inputObj, "tag_ids") && inputObj.tag_ids != null) ||
        (Object.prototype.hasOwnProperty.call(inputObj, "tags") && inputObj.tags != null) ||
        (Object.prototype.hasOwnProperty.call(inputObj, "tagIds") && inputObj.tagIds != null);
      if (!tagFieldChanged || !hasTagPayload) {
        return { Output: "SceneMarker update had no concrete tag change payload; marker->scene sync skipped" };
      }
    }

    var sceneID = extractSceneIDFromMarkerHook(hookContext);
    if (!sceneID) {
      return { Output: "SceneMarker hook had no resolvable scene id; marker->scene sync skipped" };
    }

    var markerOverride = null;
    if (hookType === "SceneMarker.Update.Post") {
      var inputObj2 = hookContext.input && typeof hookContext.input === "object" ? hookContext.input : {};
      var tagIDsFromInput = extractTagIDsFromMarkerInput(inputObj2);
      var markerID = hookContext && hookContext.id != null ? String(hookContext.id) : "";
      if (markerID && Array.isArray(tagIDsFromInput)) {
        markerOverride = { markerID: markerID, tagIDs: tagIDsFromInput };
      }
    }

    return syncConfiguredMarkerTagsToScene(sceneID, selectors, markerOverride);
  }

  function runFullRecountAction() {
    var metricsResult = recountAllUnratedCounts();
    if (metricsResult && metricsResult.Error) return metricsResult;

    var tagsResult = runBackfillSceneTagsAction();
    if (tagsResult && tagsResult.Error) return tagsResult;

    return {
      Output:
        "Full triage recompute completed. " +
        String((metricsResult && metricsResult.Output) || "") +
        " " +
        String((tagsResult && tagsResult.Output) || ""),
    };
  }

  function main() {
    var action = getAction();
    var hookContext = getHookContext();
    var trigger = hookContext && hookContext.type ? String(hookContext.type) : "manual-task";
    var ctxID = hookContext && hookContext.id != null ? String(hookContext.id) : "n/a";
    var result;

    logRun("start action=" + action + " trigger=" + trigger + " id=" + ctxID);

    if (action === "update_unrated_counts" || action === "recount_unrated_all") {
      result = runUnratedCountAction();
    } else if (action === "performer_rating_tags") {
      result = runPerformerRatingTagAction();
    } else if (action === "backfill_scene_tags") {
      result = runBackfillSceneTagsAction();
    } else if (action === "recount_all") {
      result = runFullRecountAction();
    } else if (action === "sync_marker_tags") {
      result = runSceneMarkerTagCopyAction();
    } else if (action === "sync_scene_tags_from_markers") {
      result = runMarkerToSceneTagCopyAction();
    } else {
      result = runSceneTagAction();
    }

    if (result && result.Error) {
      logRun(
        "end action=" +
          action +
          " trigger=" +
          trigger +
          " id=" +
          ctxID +
          " status=error message=" +
          String(result.Error)
      );
    } else {
      logRun(
        "end action=" +
          action +
          " trigger=" +
          trigger +
          " id=" +
          ctxID +
          " status=ok message=" +
          String((result && result.Output) || "done")
      );
    }

    return result;
  }

  main();
})();
