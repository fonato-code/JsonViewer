(function () {
  const TREE_PREVIEW_STRING_MAX = 160;
  const TREE_LINK_LABEL_MAX = 88;
  const TREE_TITLE_ATTR_MAX = 12000;

  function isNumericSegment(segment) {
    return typeof segment === "number" || /^[0-9]+$/.test(String(segment));
  }

  function normalizePath(path) {
    return path
      .map(function (segment) {
        return isNumericSegment(segment) ? "*" : String(segment);
      })
      .join(".");
  }

  function cloneJson(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function readableType(value) {
    if (Array.isArray(value)) return "array";
    if (value === null) return "null";
    return typeof value;
  }

  function truncateString(s, maxLen) {
    if (s == null) {
      return "";
    }
    const t = String(s);
    const n = typeof maxLen === "number" && maxLen > 4 ? maxLen : TREE_PREVIEW_STRING_MAX;
    if (t.length <= n) {
      return t;
    }
    return t.slice(0, n - 1) + "\u2026";
  }

  window.JsonViewerPathUtils = {
    TREE_PREVIEW_STRING_MAX: TREE_PREVIEW_STRING_MAX,
    TREE_LINK_LABEL_MAX: TREE_LINK_LABEL_MAX,
    TREE_TITLE_ATTR_MAX: TREE_TITLE_ATTR_MAX,
    isNumericSegment: isNumericSegment,
    normalizePath: normalizePath,
    cloneJson: cloneJson,
    readableType: readableType,
    truncateString: truncateString
  };
})();
