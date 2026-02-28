(function () {
  var PluginApi = window.PluginApi;
  if (!PluginApi) return;

  var React = PluginApi.React;
  var Apollo = PluginApi.libraries.Apollo;
  var ReactRouterDOM = PluginApi.libraries.ReactRouterDOM;
  var Bootstrap = PluginApi.libraries.Bootstrap;

  var Link = ReactRouterDOM.Link;
  var Button = Bootstrap.Button;
  var Form = Bootstrap.Form;
  var Table = Bootstrap.Table;

  var FIND_SCENES_TRIAGE = Apollo.gql`
    query LibraryTriageFindScenes($filter: FindFilterType) {
      findScenes(filter: $filter) {
        count
        scenes {
          id
          title
          date
          rating100
          files {
            id
            size
            path
          }
          studio {
            id
            name
            rating100
          }
          performers {
            id
            name
            gender
            birthdate
            rating100
          }
        }
      }
    }
  `;

  var FEMALE_GENDERS = {
    FEMALE: true,
  };

  function bytesHuman(size) {
    if (!size || size <= 0) return "0 B";
    var units = ["B", "KB", "MB", "GB", "TB"];
    var idx = 0;
    var value = size;
    while (value >= 1024 && idx < units.length - 1) {
      value = value / 1024;
      idx += 1;
    }
    var digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return value.toFixed(digits) + " " + units[idx];
  }

  function parseISODate(dateString) {
    if (!dateString) return null;
    var d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function parseOptionalNumber(value) {
    if (value === "") return null;
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function rating100To5(r100) {
    if (typeof r100 !== "number") return null;
    return Math.max(1, Math.min(5, Math.round(r100 / 20)));
  }

  function inRange(value, min, max) {
    if (value == null) return false;
    if (min != null && value < min) return false;
    if (max != null && value > max) return false;
    return true;
  }

  function anyInRange(values, min, max) {
    if (min == null && max == null) return true;
    if (!values || !values.length) return false;
    for (var i = 0; i < values.length; i += 1) {
      if (inRange(values[i], min, max)) return true;
    }
    return false;
  }

  function ageAtDate(birthdate, sceneDate) {
    var b = parseISODate(birthdate);
    var s = parseISODate(sceneDate);
    if (!b || !s) return null;
    var age = s.getUTCFullYear() - b.getUTCFullYear();
    var m = s.getUTCMonth() - b.getUTCMonth();
    if (m < 0 || (m === 0 && s.getUTCDate() < b.getUTCDate())) age -= 1;
    return age >= 0 ? age : null;
  }

  function femalePerformers(scene) {
    var perf = (scene && scene.performers) || [];
    return perf.filter(function (p) {
      return !!p && !!FEMALE_GENDERS[p.gender || ""];
    });
  }

  function sceneSizeBytes(scene) {
    var files = (scene && scene.files) || [];
    return files.reduce(function (acc, f) {
      return acc + (f && typeof f.size === "number" ? f.size : 0);
    }, 0);
  }

  function triageMeta(scene) {
    var females = femalePerformers(scene);

    var femaleRatingValues5 = females
      .map(function (p) {
        return rating100To5(p.rating100);
      })
      .filter(function (v) {
        return typeof v === "number";
      });

    var femaleAgeValues = females
      .map(function (p) {
        return ageAtDate(p.birthdate, scene.date);
      })
      .filter(function (v) {
        return typeof v === "number";
      });

    return {
      females: females,
      sceneRating5: rating100To5(scene.rating100),
      studioRating5: rating100To5(scene.studio && scene.studio.rating100),
      femaleRatingValues5: femaleRatingValues5,
      maxFemaleRating5: femaleRatingValues5.length ? Math.max.apply(null, femaleRatingValues5) : null,
      femaleAgeValues: femaleAgeValues,
      minFemaleAge: femaleAgeValues.length ? Math.min.apply(null, femaleAgeValues) : null,
      maxFemaleAge: femaleAgeValues.length ? Math.max.apply(null, femaleAgeValues) : null,
      sizeBytes: sceneSizeBytes(scene),
    };
  }

  function rowMatchesFilters(row, filters) {
    if (filters.unratedOnly) {
      if (row.meta.sceneRating5 != null) return false;
    } else if (filters.minScene != null || filters.maxScene != null) {
      if (!inRange(row.meta.sceneRating5, filters.minScene, filters.maxScene)) return false;
    }

    if (!anyInRange(row.meta.femaleRatingValues5, filters.minFR, filters.maxFR)) return false;
    if (!anyInRange(row.meta.femaleAgeValues, filters.minFA, filters.maxFA)) return false;
    return true;
  }

  function TriagePage() {
    var apolloClient = Apollo.useApolloClient();
    var _a = React.useState(false), unratedOnly = _a[0], setUnratedOnly = _a[1];
    var _b = React.useState(""), minSceneRating = _b[0], setMinSceneRating = _b[1];
    var _c = React.useState(""), maxSceneRating = _c[0], setMaxSceneRating = _c[1];
    var _d = React.useState(""), minFemaleRating = _d[0], setMinFemaleRating = _d[1];
    var _e = React.useState(""), maxFemaleRating = _e[0], setMaxFemaleRating = _e[1];
    var _f = React.useState(""), minFemaleAge = _f[0], setMinFemaleAge = _f[1];
    var _g = React.useState(""), maxFemaleAge = _g[0], setMaxFemaleAge = _g[1];
    var _h = React.useState("200"), perPage = _h[0], setPerPage = _h[1];
    var _i = React.useState(1), filteredPage = _i[0], setFilteredPage = _i[1];
    var _j = React.useState(0), refreshToken = _j[0], setRefreshToken = _j[1];

    var _k = React.useState([]), rows = _k[0], setRows = _k[1];
    var _l = React.useState(false), loading = _l[0], setLoading = _l[1];
    var _m = React.useState(null), error = _m[0], setError = _m[1];
    var _n = React.useState(false), hasNextPage = _n[0], setHasNextPage = _n[1];
    var _o = React.useState(0), serverTotal = _o[0], setServerTotal = _o[1];
    var _p = React.useState(0), scannedScenes = _p[0], setScannedScenes = _p[1];
    var _q = React.useState(null), knownFilteredTotal = _q[0], setKnownFilteredTotal = _q[1];

    React.useEffect(
      function () {
        var cancelled = false;
        var pageSize = Math.max(1, parseOptionalNumber(perPage) || 200);
        var serverChunkSize = 200;
        var wantedStart = (filteredPage - 1) * pageSize;
        var wantedEndExclusive = filteredPage * pageSize;
        var neededMatchCount = wantedEndExclusive + 1;

        var filters = {
          unratedOnly: unratedOnly,
          minScene: parseOptionalNumber(minSceneRating),
          maxScene: parseOptionalNumber(maxSceneRating),
          minFR: parseOptionalNumber(minFemaleRating),
          maxFR: parseOptionalNumber(maxFemaleRating),
          minFA: parseOptionalNumber(minFemaleAge),
          maxFA: parseOptionalNumber(maxFemaleAge),
        };

        setLoading(true);
        setError(null);
        setKnownFilteredTotal(null);

        (async function () {
          var collected = [];
          var page = 1;
          var maxPages = 1;
          var localServerTotal = 0;
          var localScanned = 0;
          var reachedEnd = false;

          try {
            while (true) {
              var res = await apolloClient.query({
                query: FIND_SCENES_TRIAGE,
                variables: {
                  filter: {
                    per_page: serverChunkSize,
                    page: page,
                    sort: "filesize",
                    direction: "DESC",
                  },
                },
                fetchPolicy: "network-only",
              });

              var node = (res.data && res.data.findScenes) || {};
              localServerTotal = Number(node.count || 0);
              maxPages = Math.max(1, Math.ceil(localServerTotal / serverChunkSize));
              var scenes = Array.isArray(node.scenes) ? node.scenes : [];
              localScanned += scenes.length;

              for (var s = 0; s < scenes.length; s += 1) {
                var row = { scene: scenes[s], meta: triageMeta(scenes[s]) };
                if (rowMatchesFilters(row, filters)) {
                  collected.push(row);
                }
              }

              if (collected.length >= neededMatchCount) {
                reachedEnd = false;
                break;
              }
              if (page >= maxPages || scenes.length === 0) {
                reachedEnd = true;
                break;
              }
              page += 1;
            }
          } catch (e) {
            if (cancelled) return;
            setError(e);
            setRows([]);
            setServerTotal(0);
            setScannedScenes(0);
            setHasNextPage(false);
            setKnownFilteredTotal(null);
            setLoading(false);
            return;
          }

          if (cancelled) return;

          setRows(collected.slice(wantedStart, wantedEndExclusive));
          setServerTotal(localServerTotal);
          setScannedScenes(localScanned);
          setHasNextPage(collected.length > wantedEndExclusive);
          setKnownFilteredTotal(reachedEnd ? collected.length : null);
          setLoading(false);
        })();

        return function () {
          cancelled = true;
        };
      },
      [
        apolloClient,
        unratedOnly,
        minSceneRating,
        maxSceneRating,
        minFemaleRating,
        maxFemaleRating,
        minFemaleAge,
        maxFemaleAge,
        perPage,
        filteredPage,
        refreshToken,
      ]
    );

    var perPageNum = Math.max(1, parseOptionalNumber(perPage) || 200);
    var visibleFrom = rows.length === 0 ? 0 : (filteredPage - 1) * perPageNum + 1;
    var visibleTo = visibleFrom + rows.length - 1;

    return React.createElement(
      "div",
      { className: "library-triage-page" },
      React.createElement("h3", null, "Library Triage"),
      React.createElement(
        "div",
        { className: "library-triage-muted" },
        "Top scenes sorted by total file size. Filters apply globally across all scenes before pagination."
      ),
      React.createElement(
        "div",
        { className: "library-triage-muted", style: { marginBottom: "0.75rem" } },
        "Managed scene tags: girl-rated-*, age tags, age-gap tags. Managed performer tags: rated 1..5. Use task 'Recompute all triage data (recommended)' after major bulk edits."
      ),
      React.createElement(
        "div",
        { className: "library-triage-toolbar" },
        React.createElement(Form.Check, {
          type: "checkbox",
          id: "triage-unrated-only",
          label: "Only unrated scenes",
          checked: unratedOnly,
          onChange: function (e) {
            setUnratedOnly(e.target.checked);
            setFilteredPage(1);
          },
        }),
        React.createElement("label", { htmlFor: "triage-per-page" }, "Rows per page:"),
        React.createElement(Form.Control, {
          id: "triage-per-page",
          type: "number",
          min: 1,
          style: { width: "7rem" },
          value: perPage,
          onChange: function (e) {
            setPerPage(e.target.value);
            setFilteredPage(1);
          },
          placeholder: "200",
        }),

        React.createElement("label", { htmlFor: "triage-min-scene-rating" }, "Scene rating min:"),
        React.createElement(Form.Control, {
          id: "triage-min-scene-rating",
          type: "number",
          min: 1,
          max: 5,
          style: { width: "5rem" },
          value: minSceneRating,
          onChange: function (e) {
            setMinSceneRating(e.target.value);
            setFilteredPage(1);
          },
          placeholder: "any",
        }),
        React.createElement("label", { htmlFor: "triage-max-scene-rating" }, "max:"),
        React.createElement(Form.Control, {
          id: "triage-max-scene-rating",
          type: "number",
          min: 1,
          max: 5,
          style: { width: "5rem" },
          value: maxSceneRating,
          onChange: function (e) {
            setMaxSceneRating(e.target.value);
            setFilteredPage(1);
          },
          placeholder: "any",
        }),

        React.createElement("label", { htmlFor: "triage-min-female-rating" }, "Female rating min:"),
        React.createElement(Form.Control, {
          id: "triage-min-female-rating",
          type: "number",
          min: 1,
          max: 5,
          style: { width: "5rem" },
          value: minFemaleRating,
          onChange: function (e) {
            setMinFemaleRating(e.target.value);
            setFilteredPage(1);
          },
          placeholder: "any",
        }),
        React.createElement("label", { htmlFor: "triage-max-female-rating" }, "max:"),
        React.createElement(Form.Control, {
          id: "triage-max-female-rating",
          type: "number",
          min: 1,
          max: 5,
          style: { width: "5rem" },
          value: maxFemaleRating,
          onChange: function (e) {
            setMaxFemaleRating(e.target.value);
            setFilteredPage(1);
          },
          placeholder: "any",
        }),

        React.createElement("label", { htmlFor: "triage-min-female-age" }, "Female age min:"),
        React.createElement(Form.Control, {
          id: "triage-min-female-age",
          type: "number",
          min: 18,
          style: { width: "6rem" },
          value: minFemaleAge,
          onChange: function (e) {
            setMinFemaleAge(e.target.value);
            setFilteredPage(1);
          },
          placeholder: "any",
        }),
        React.createElement("label", { htmlFor: "triage-max-female-age" }, "max:"),
        React.createElement(Form.Control, {
          id: "triage-max-female-age",
          type: "number",
          min: 18,
          style: { width: "6rem" },
          value: maxFemaleAge,
          onChange: function (e) {
            setMaxFemaleAge(e.target.value);
            setFilteredPage(1);
          },
          placeholder: "any",
        }),

        React.createElement(
          Button,
          {
            size: "sm",
            onClick: function () {
              setRefreshToken(function (v) {
                return v + 1;
              });
            },
          },
          "Refresh"
        )
      ),
      React.createElement(
        "div",
        { className: "library-triage-muted", style: { marginBottom: "0.5rem" } },
        "Showing " +
          String(visibleFrom) +
          "-" +
          String(visibleTo) +
          " filtered scenes on page " +
          String(filteredPage) +
          (knownFilteredTotal != null
            ? " (" + String(knownFilteredTotal) + " total filtered, " + String(serverTotal) + " total scenes)."
            : " (scanned " + String(scannedScenes) + " / " + String(serverTotal) + " scenes so far).")
      ),
      React.createElement(
        "div",
        { className: "library-triage-toolbar", style: { marginBottom: "0.75rem" } },
        React.createElement(
          Button,
          {
            size: "sm",
            disabled: filteredPage <= 1,
            onClick: function () {
              setFilteredPage(Math.max(1, filteredPage - 1));
            },
          },
          "Prev"
        ),
        React.createElement(
          "span",
          { className: "library-triage-muted" },
          knownFilteredTotal != null
            ? "Page " + String(filteredPage) + " / " + String(Math.max(1, Math.ceil(knownFilteredTotal / perPageNum)))
            : "Page " + String(filteredPage)
        ),
        React.createElement(
          Button,
          {
            size: "sm",
            disabled: !hasNextPage,
            onClick: function () {
              if (hasNextPage) setFilteredPage(filteredPage + 1);
            },
          },
          "Next"
        )
      ),
      loading ? React.createElement("div", null, "Loading...") : null,
      error
        ? React.createElement("div", { className: "text-danger" }, "Error: " + (error.message || String(error)))
        : null,
      React.createElement(
        Table,
        { striped: true, bordered: false, hover: true, size: "sm", className: "library-triage-table" },
        React.createElement(
          "thead",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement("th", null, "Scene"),
            React.createElement("th", null, "Size"),
            React.createElement("th", null, "Scene Rating (1-5)"),
            React.createElement("th", null, "Studio"),
            React.createElement("th", null, "Studio Rating (1-5)"),
            React.createElement("th", null, "Max Female Rating"),
            React.createElement("th", null, "Female Age Range"),
            React.createElement("th", null, "Female Performers")
          )
        ),
        React.createElement(
          "tbody",
          null,
          rows.map(function (row) {
            var scene = row.scene;
            var meta = row.meta;

            var ageRange = "-";
            if (meta.minFemaleAge != null && meta.maxFemaleAge != null) {
              ageRange =
                meta.minFemaleAge === meta.maxFemaleAge
                  ? String(meta.minFemaleAge)
                  : String(meta.minFemaleAge) + "-" + String(meta.maxFemaleAge);
            }

            var perfLabel = meta.females
              .map(function (p) {
                var r = "r?";
                var r5 = rating100To5(p.rating100);
                if (r5 != null) {
                  r = "r" + r5;
                }
                return p.name + " (" + r + ")";
              })
              .join(", ");

            return React.createElement(
              "tr",
              { key: scene.id },
              React.createElement(
                "td",
                null,
                React.createElement(
                  Link,
                  { to: "/scenes/" + scene.id },
                  scene.title && scene.title.trim() ? scene.title : "[Untitled]"
                ),
                React.createElement("div", { className: "library-triage-muted" }, scene.date || "no date")
              ),
              React.createElement("td", null, bytesHuman(meta.sizeBytes)),
              React.createElement("td", null, meta.sceneRating5 != null ? String(meta.sceneRating5) : "-"),
              React.createElement(
                "td",
                null,
                scene.studio && scene.studio.id
                  ? React.createElement(
                      Link,
                      { to: "/studios/" + scene.studio.id },
                      scene.studio.name || "[Studio]"
                    )
                  : "-"
              ),
              React.createElement("td", null, meta.studioRating5 != null ? String(meta.studioRating5) : "-"),
              React.createElement("td", null, meta.maxFemaleRating5 != null ? String(meta.maxFemaleRating5) : "-"),
              React.createElement("td", null, ageRange),
              React.createElement("td", { className: "library-triage-performers" }, perfLabel || "-")
            );
          })
        )
      )
    );
  }

  PluginApi.register.route("/plugin/library-triage", TriagePage);

  PluginApi.patch.before("SettingsToolsSection", function (props) {
    var Setting = PluginApi.components.Setting;
    if (!Setting) return [props];

    return [
      {
        children: React.createElement(
          React.Fragment,
          null,
          props.children,
          React.createElement(
            Setting,
            {
              heading: React.createElement(
                Link,
                { to: "/plugin/library-triage" },
                React.createElement(Button, null, "Open Library Triage")
              ),
            },
            null
          ),
          React.createElement(
            Setting,
            {
              heading: React.createElement(
                Link,
                { to: "/plugin/library-triage-entities" },
                React.createElement(Button, null, "Open Unrated Counts")
              ),
            },
            null
          )
        ),
      },
    ];
  });
})();
