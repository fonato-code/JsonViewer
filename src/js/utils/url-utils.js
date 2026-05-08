(function () {
  function normalizeUrlHref(value) {
    if (value == null) {
      return "";
    }
    const s = String(value).trim();
    if (!s) {
      return "";
    }
    if (/^(https?|mailto):/i.test(s)) {
      return s;
    }
    if (/^\/\//.test(s)) {
      return "https:" + s;
    }
    if (/^www\./i.test(s)) {
      return "https://" + s;
    }
    try {
      return new URL(s).href;
    } catch (e1) {
      try {
        return new URL("https://" + s).href;
      } catch (e2) {
        return "";
      }
    }
  }

  window.JsonViewerUrlUtils = {
    normalizeUrlHref: normalizeUrlHref
  };
})();
