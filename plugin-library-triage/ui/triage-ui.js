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
    TRANSGENDER_FEMALE: true,
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
    var rated = females
      .map(function (p) {
        return p.rating100;
      })
      .filter(function (v) {
        return typeof v === "number";
      });

    var maxFemaleRating100 = rated.length ? Math.max.apply(null, rated) : null;
    var maxFemaleRating5 = maxFemaleRating100 == null ? null : Math.max(1, Math.min(5, Math.round(maxFemaleRating100 / 20)));

    var ages = females
      .map(function (p) {
        return ageAtDate(p.birthdate, scene.date);
      })
      .filter(function (v) {
        return typeof v === "number";
      });

    return {
      females: females,
      maxFemaleRating100: maxFemaleRating100,
      maxFemaleRating5: maxFemaleRating5,
      minFemaleAge: ages.length ? Math.min.apply(null, ages) : null,
      maxFemaleAge: ages.length ? Math.max.apply(null, ages) : null,
      sizeBytes: sceneSizeBytes(scene),
    };
  }

  function TriagePage() {
    var _a = React.useState(true), onlyFemale = _a[0], setOnlyFemale = _a[1];
    var _b = React.useState(""), minFemaleRating = _b[0], setMinFemaleRating = _b[1];

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

      var minRatingParsed = minFemaleRating === "" ? null : Number(minFemaleRating);

      return withMeta
        .filter(function (row) {
          if (onlyFemale && row.meta.females.length === 0) return false;
          if (minRatingParsed != null) {
            if (row.meta.maxFemaleRating5 == null) return false;
            return row.meta.maxFemaleRating5 >= minRatingParsed;
          }
          return true;
        })
        .sort(function (a, b) {
          return b.meta.sizeBytes - a.meta.sizeBytes;
        });
    }, [query.data, onlyFemale, minFemaleRating]);

    return React.createElement(
      "div",
      { className: "library-triage-page" },
      React.createElement("h3", null, "Library Triage"),
      React.createElement(
        "div",
        { className: "library-triage-muted" },
        "Top scenes sorted by total file size. Filters use female performer metadata when available."
      ),
      React.createElement(
        "div",
        { className: "library-triage-toolbar" },
        React.createElement(
          Form.Check,
          {
            type: "checkbox",
            id: "triage-only-female",
            label: "Only scenes with female performer",
            checked: onlyFemale,
            onChange: function (e) {
              setOnlyFemale(e.target.checked);
            },
          },
          null
        ),
        React.createElement(
          "label",
          { htmlFor: "triage-min-female-rating" },
          "Min female rating (1-5): "
        ),
        React.createElement(Form.Control, {
          id: "triage-min-female-rating",
          type: "number",
          min: 1,
          max: 5,
          style: { width: "7rem" },
          value: minFemaleRating,
          onChange: function (e) {
            setMinFemaleRating(e.target.value);
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
      query.loading
        ? React.createElement("div", null, "Loading...")
        : null,
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
            React.createElement("th", null, "Scene Rating"),
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
              ageRange = meta.minFemaleAge === meta.maxFemaleAge
                ? String(meta.minFemaleAge)
                : String(meta.minFemaleAge) + "-" + String(meta.maxFemaleAge);
            }

            var perfLabel = meta.females
              .map(function (p) {
                var r = "r?";
                if (typeof p.rating100 === "number") {
                  var r5 = Math.max(1, Math.min(5, Math.round(p.rating100 / 20)));
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
                React.createElement(
                  "div",
                  { className: "library-triage-muted" },
                  scene.date || "no date"
                )
              ),
              React.createElement("td", null, bytesHuman(meta.sizeBytes)),
              React.createElement("td", null, scene.rating100 != null ? String(scene.rating100) : "-"),
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
