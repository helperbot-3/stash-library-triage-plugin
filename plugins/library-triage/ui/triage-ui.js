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

  function TriagePage() {
    var _a = React.useState(true), onlyFemale = _a[0], setOnlyFemale = _a[1];
    var _b = React.useState(false), unratedOnly = _b[0], setUnratedOnly = _b[1];

    var _c = React.useState(""), minSceneRating = _c[0], setMinSceneRating = _c[1];
    var _d = React.useState(""), maxSceneRating = _d[0], setMaxSceneRating = _d[1];

    var _e = React.useState(""), minFemaleRating = _e[0], setMinFemaleRating = _e[1];
    var _f = React.useState(""), maxFemaleRating = _f[0], setMaxFemaleRating = _f[1];

    var _g = React.useState(""), minFemaleAge = _g[0], setMinFemaleAge = _g[1];
    var _h = React.useState(""), maxFemaleAge = _h[0], setMaxFemaleAge = _h[1];

    var query = Apollo.useQuery(FIND_SCENES_TRIAGE, {
      variables: {
        filter: {
          per_page: 250,
          sort: "filesize",
          direction: "DESC",
        },
      },
      fetchPolicy: "cache-and-network",
    });

    var rows = React.useMemo(function () {
      var scenes = (((query.data || {}).findScenes || {}).scenes) || [];
      var withMeta = scenes.map(function (scene) {
        return { scene: scene, meta: triageMeta(scene) };
      });

      var minScene = parseOptionalNumber(minSceneRating);
      var maxScene = parseOptionalNumber(maxSceneRating);
      var minFR = parseOptionalNumber(minFemaleRating);
      var maxFR = parseOptionalNumber(maxFemaleRating);
      var minFA = parseOptionalNumber(minFemaleAge);
      var maxFA = parseOptionalNumber(maxFemaleAge);

      return withMeta
        .filter(function (row) {
          if (onlyFemale && row.meta.females.length === 0) return false;

          if (unratedOnly) {
            if (row.meta.sceneRating5 != null) return false;
          } else if (minScene != null || maxScene != null) {
            if (!inRange(row.meta.sceneRating5, minScene, maxScene)) return false;
          }

          if (!anyInRange(row.meta.femaleRatingValues5, minFR, maxFR)) return false;
          if (!anyInRange(row.meta.femaleAgeValues, minFA, maxFA)) return false;

          return true;
        })
        .sort(function (a, b) {
          return b.meta.sizeBytes - a.meta.sizeBytes;
        });
    }, [
      query.data,
      onlyFemale,
      unratedOnly,
      minSceneRating,
      maxSceneRating,
      minFemaleRating,
      maxFemaleRating,
      minFemaleAge,
      maxFemaleAge,
    ]);

    return React.createElement(
      "div",
      { className: "library-triage-page" },
      React.createElement("h3", null, "Library Triage"),
      React.createElement(
        "div",
        { className: "library-triage-muted" },
        "Top scenes sorted by total file size. Ratings shown on a 1-5 scale."
      ),
      React.createElement(
        "div",
        { className: "library-triage-toolbar" },
        React.createElement(Form.Check, {
          type: "checkbox",
          id: "triage-only-female",
          label: "Only scenes with female performer",
          checked: onlyFemale,
          onChange: function (e) {
            setOnlyFemale(e.target.checked);
          },
        }),
        React.createElement(Form.Check, {
          type: "checkbox",
          id: "triage-unrated-only",
          label: "Only unrated scenes",
          checked: unratedOnly,
          onChange: function (e) {
            setUnratedOnly(e.target.checked);
          },
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
          },
          placeholder: "any",
        }),

        React.createElement(
          Button,
          {
            size: "sm",
            onClick: function () {
              query.refetch();
            },
          },
          "Refresh"
        )
      ),
      query.loading ? React.createElement("div", null, "Loading...") : null,
      query.error
        ? React.createElement("div", { className: "text-danger" }, "Error: " + query.error.message)
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
          )
        ),
      },
    ];
  });
})();
