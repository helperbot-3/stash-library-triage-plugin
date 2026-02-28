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

  var UNRATED_CF_KEY = "triage_unrated_scene_count";
  var STORAGE_BYTES_CF_KEY = "triage_total_size_bytes";

  var FIND_PERFORMERS = Apollo.gql`
    query LibraryTriageFindPerformers($filter: FindFilterType) {
      findPerformers(filter: $filter) {
        performers {
          id
          name
          rating100
          scene_count
          custom_fields
        }
      }
    }
  `;

  var FIND_STUDIOS = Apollo.gql`
    query LibraryTriageFindStudios($filter: FindFilterType) {
      findStudios(filter: $filter) {
        studios {
          id
          name
          rating100
          scene_count
        }
      }
    }
  `;

  var COUNT_UNRATED_BY_STUDIO = Apollo.gql`
    query LibraryTriageCountUnratedByStudio($filter: FindFilterType, $scene_filter: SceneFilterType) {
      findScenes(filter: $filter, scene_filter: $scene_filter) {
        count
      }
    }
  `;

  var LIST_STUDIO_SCENES_FILES = Apollo.gql`
    query LibraryTriageListStudioScenesFiles($filter: FindFilterType, $scene_filter: SceneFilterType) {
      findScenes(filter: $filter, scene_filter: $scene_filter) {
        scenes {
          id
          files {
            size
          }
        }
      }
    }
  `;

  function rating100To5(r100) {
    if (typeof r100 !== "number") return null;
    return Math.max(1, Math.min(5, Math.round(r100 / 20)));
  }

  function getUnratedCount(customFields) {
    if (!customFields || typeof customFields !== "object") return 0;
    var raw = customFields[UNRATED_CF_KEY];
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.round(raw));
    if (typeof raw === "string" && raw.trim() !== "") {
      var n = Number(raw);
      if (Number.isFinite(n)) return Math.max(0, Math.round(n));
    }
    return 0;
  }

  function getStorageBytes(customFields) {
    if (!customFields || typeof customFields !== "object") return 0;
    var raw = customFields[STORAGE_BYTES_CF_KEY];
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.round(raw));
    if (typeof raw === "string" && raw.trim() !== "") {
      var n = Number(raw);
      if (Number.isFinite(n)) return Math.max(0, Math.round(n));
    }
    return 0;
  }

  function bytesFromScenes(scenes) {
    var total = 0;
    for (var i = 0; i < scenes.length; i += 1) {
      var files = scenes[i] && scenes[i].files ? scenes[i].files : [];
      for (var j = 0; j < files.length; j += 1) {
        var size = files[j] && typeof files[j].size === "number" ? files[j].size : 0;
        if (Number.isFinite(size) && size > 0) total += size;
      }
    }
    return Math.round(total);
  }

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

  function byUnratedThenName(a, b) {
    if (b.unratedCount !== a.unratedCount) return b.unratedCount - a.unratedCount;
    return String(a.name || "").localeCompare(String(b.name || ""));
  }

  function EntityCountsPage() {
    var apolloClient = Apollo.useApolloClient();
    var _a = React.useState("1"), minUnrated = _a[0], setMinUnrated = _a[1];
    var _b = React.useState(true), hideZero = _b[0], setHideZero = _b[1];
    var _c = React.useState({}), studioUnratedByID = _c[0], setStudioUnratedByID = _c[1];
    var _d = React.useState({}), studioStorageByID = _d[0], setStudioStorageByID = _d[1];
    var _e = React.useState(false), studioCountLoading = _e[0], setStudioCountLoading = _e[1];
    var _f = React.useState("performers"), activeTab = _f[0], setActiveTab = _f[1];

    var performersQuery = Apollo.useQuery(FIND_PERFORMERS, {
      variables: { filter: { per_page: -1 } },
      fetchPolicy: "cache-and-network",
    });

    var studiosQuery = Apollo.useQuery(FIND_STUDIOS, {
      variables: { filter: { per_page: -1 } },
      fetchPolicy: "cache-and-network",
    });

    React.useEffect(function () {
      var studios = (((studiosQuery.data || {}).findStudios || {}).studios) || [];
      if (!studios.length) {
        setStudioUnratedByID({});
        setStudioStorageByID({});
        return;
      }

      var cancelled = false;
      setStudioCountLoading(true);

      Promise.all(
        studios.map(function (studio) {
          return Promise.all([
            apolloClient.query({
              query: COUNT_UNRATED_BY_STUDIO,
              variables: {
                filter: { per_page: 1 },
                scene_filter: {
                  studios: { value: [String(studio.id)], modifier: "INCLUDES" },
                  rating100: { value: 0, modifier: "IS_NULL" },
                },
              },
              fetchPolicy: "network-only",
            }),
            apolloClient.query({
              query: LIST_STUDIO_SCENES_FILES,
              variables: {
                filter: { per_page: -1 },
                scene_filter: {
                  studios: { value: [String(studio.id)], modifier: "INCLUDES" },
                },
              },
              fetchPolicy: "network-only",
            }),
          ])
            .then(function (allRes) {
              var unratedRes = allRes[0];
              var filesRes = allRes[1];
              var count = (((unratedRes.data || {}).findScenes || {}).count) || 0;
              var scenes = (((filesRes.data || {}).findScenes || {}).scenes) || [];
              return {
                id: String(studio.id),
                count: Number(count) || 0,
                storageBytes: bytesFromScenes(scenes),
              };
            })
            .catch(function () {
              return { id: String(studio.id), count: 0, storageBytes: 0 };
            });
        })
      ).then(function (pairs) {
        if (cancelled) return;
        var nextUnrated = {};
        var nextStorage = {};
        for (var i = 0; i < pairs.length; i += 1) {
          nextUnrated[pairs[i].id] = pairs[i].count;
          nextStorage[pairs[i].id] = pairs[i].storageBytes;
        }
        setStudioUnratedByID(nextUnrated);
        setStudioStorageByID(nextStorage);
        setStudioCountLoading(false);
      });

      return function () {
        cancelled = true;
      };
    }, [apolloClient, studiosQuery.data]);

    var minUnratedNum = React.useMemo(function () {
      var n = Number(minUnrated);
      return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
    }, [minUnrated]);

    var performerRows = React.useMemo(function () {
      var performers = (((performersQuery.data || {}).findPerformers || {}).performers) || [];
      return performers
        .map(function (p) {
          return {
            id: p.id,
            name: p.name || "[Unnamed Performer]",
            rating5: rating100To5(p.rating100),
            sceneCount: typeof p.scene_count === "number" ? p.scene_count : 0,
            unratedCount: getUnratedCount(p.custom_fields),
            storageBytes: getStorageBytes(p.custom_fields),
          };
        })
        .filter(function (p) {
          if (hideZero && p.unratedCount <= 0) return false;
          return p.unratedCount >= minUnratedNum;
        })
        .sort(byUnratedThenName);
    }, [performersQuery.data, hideZero, minUnratedNum]);

    var studioRows = React.useMemo(function () {
      var studios = (((studiosQuery.data || {}).findStudios || {}).studios) || [];
      return studios
        .map(function (s) {
          return {
            id: s.id,
            name: s.name || "[Unnamed Studio]",
            rating5: rating100To5(s.rating100),
            sceneCount: typeof s.scene_count === "number" ? s.scene_count : 0,
            unratedCount: Number(studioUnratedByID[String(s.id)] || 0),
            storageBytes: Number(studioStorageByID[String(s.id)] || 0),
          };
        })
        .filter(function (s) {
          if (hideZero && s.unratedCount <= 0) return false;
          return s.unratedCount >= minUnratedNum;
        })
        .sort(byUnratedThenName);
    }, [studiosQuery.data, studioUnratedByID, studioStorageByID, hideZero, minUnratedNum]);

    return React.createElement(
      "div",
      { className: "library-triage-page" },
      React.createElement("h3", null, "Entity Metrics"),
      React.createElement(
        "div",
        { className: "library-triage-muted" },
        "Performer and studio rankings by unrated scenes and storage."
      ),
      React.createElement(
        "div",
        { className: "library-triage-toolbar" },
        React.createElement(
          "div",
          { className: "btn-group", role: "group", "aria-label": "Entity view" },
          React.createElement(
            Button,
            {
              size: "sm",
              variant: activeTab === "performers" ? "primary" : "secondary",
              onClick: function () {
                setActiveTab("performers");
              },
            },
            "Performers"
          ),
          React.createElement(
            Button,
            {
              size: "sm",
              variant: activeTab === "studios" ? "primary" : "secondary",
              onClick: function () {
                setActiveTab("studios");
              },
            },
            "Studios"
          )
        ),
        React.createElement("label", { htmlFor: "triage-min-unrated" }, "Min unrated scenes:"),
        React.createElement(Form.Control, {
          id: "triage-min-unrated",
          type: "number",
          min: 0,
          style: { width: "7rem" },
          value: minUnrated,
          onChange: function (e) {
            setMinUnrated(e.target.value);
          },
        }),
        React.createElement(Form.Check, {
          type: "checkbox",
          id: "triage-hide-zero",
          label: "Hide zero",
          checked: hideZero,
          onChange: function (e) {
            setHideZero(e.target.checked);
          },
        }),
        React.createElement(
          Button,
          {
            size: "sm",
            onClick: function () {
              performersQuery.refetch();
              studiosQuery.refetch();
            },
          },
          "Refresh"
        )
      ),

      performersQuery.loading || studiosQuery.loading || studioCountLoading
        ? React.createElement("div", null, "Loading...")
        : null,
      performersQuery.error
        ? React.createElement("div", { className: "text-danger" }, "Performer query error: " + performersQuery.error.message)
        : null,
      studiosQuery.error
        ? React.createElement("div", { className: "text-danger" }, "Studio query error: " + studiosQuery.error.message)
        : null,

      activeTab === "performers"
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement("h4", { style: { marginTop: "1rem" } }, "Performers"),
            React.createElement(
              Table,
              { striped: true, bordered: false, hover: true, size: "sm", className: "library-triage-table" },
              React.createElement(
                "thead",
                null,
                React.createElement(
                  "tr",
                  null,
                  React.createElement("th", null, "Performer"),
                  React.createElement("th", null, "Rating (1-5)"),
                  React.createElement("th", null, "Scene Count"),
                  React.createElement("th", null, "Unrated Scenes"),
                  React.createElement("th", null, "Storage")
                )
              ),
              React.createElement(
                "tbody",
                null,
                performerRows.map(function (row) {
                  return React.createElement(
                    "tr",
                    { key: row.id },
                    React.createElement(
                      "td",
                      null,
                      React.createElement(Link, { to: "/performers/" + row.id }, row.name)
                    ),
                    React.createElement("td", null, row.rating5 != null ? String(row.rating5) : "-"),
                    React.createElement("td", null, String(row.sceneCount)),
                    React.createElement("td", null, String(row.unratedCount)),
                    React.createElement("td", null, bytesHuman(row.storageBytes))
                  );
                })
              )
            )
          )
        : React.createElement(
            React.Fragment,
            null,
            React.createElement("h4", { style: { marginTop: "1rem" } }, "Studios"),
            React.createElement(
              Table,
              { striped: true, bordered: false, hover: true, size: "sm", className: "library-triage-table" },
              React.createElement(
                "thead",
                null,
                React.createElement(
                  "tr",
                  null,
                  React.createElement("th", null, "Studio"),
                  React.createElement("th", null, "Rating (1-5)"),
                  React.createElement("th", null, "Scene Count"),
                  React.createElement("th", null, "Unrated Scenes"),
                  React.createElement("th", null, "Storage")
                )
              ),
              React.createElement(
                "tbody",
                null,
                studioRows.map(function (row) {
                  return React.createElement(
                    "tr",
                    { key: row.id },
                    React.createElement(
                      "td",
                      null,
                      React.createElement(Link, { to: "/studios/" + row.id }, row.name)
                    ),
                    React.createElement("td", null, row.rating5 != null ? String(row.rating5) : "-"),
                    React.createElement("td", null, String(row.sceneCount)),
                    React.createElement("td", null, String(row.unratedCount)),
                    React.createElement("td", null, bytesHuman(row.storageBytes))
                  );
                })
              )
            )
          )
    );
  }

  PluginApi.register.route("/plugin/library-triage-entities", EntityCountsPage);
})();
