(function () {
  var FEMALE_GENDERS = {
    FEMALE: true,
    TRANSGENDER_FEMALE: true,
  };
  var MALE_GENDERS = {
    MALE: true,
    TRANSGENDER_MALE: true,
  };

  var MANAGED_PREFIXES = [
    "triage/female-performer",
    "girl-rated-",
    "triage/female-rating/",
    "triage/female-age/",
    "Age Gap:",
  ];

  function getArgs() {
    if (!input) return {};
    return input.Args || input.args || {};
  }

  function getHookContext() {
    var args = getArgs();
    return args.hookContext || args.HookContext || null;
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

  function setFromArray(arr) {
    var m = {};
    for (var i = 0; i < arr.length; i += 1) {
      m[arr[i]] = true;
    }
    return m;
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

  function fetchScene(sceneID) {
    var q = "query ($id: ID!) { findScene(id: $id) { id date tags { id name } performers { id name gender rating100 birthdate } } }";
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
    var existing = findTagByName(name);
    if (existing && existing.id) return existing.id;

    try {
      var created = createTag(name);
      if (created && created.id) return created.id;
    } catch (e) {
      log.Warn("tagCreate failed for " + name + ", retrying find: " + String(e));
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

  function processScene(sceneID) {
    var scene = fetchScene(sceneID);
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
    var tags = ["triage/female-performer"]; // presence marker, removed if no female performers

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
        tags.push("YFEM");
      }
    }

    return sortedUnique(tags);
  }

  function main() {
    var hookContext = getHookContext();
    if (!hookContext || !hookContext.id) {
      return { Output: "No hook context, skipping" };
    }
    var hookType = String(hookContext.type || "");

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
        return { Output: "Performer update had no age/rating/gender changes, skipping" };
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
        var result = processScene(sceneIDs[s]);
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

    return processScene(String(hookContext.id));
  }

  main();
})();
