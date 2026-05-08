(function () {
  function normalizeRadixBase(b, fallback) {
    const n = Number(b);
    const fb = Number(fallback);
    const def = Number.isFinite(fb) && fb >= 2 && fb <= 36 ? fb : 10;
    if (!Number.isFinite(n) || n < 2 || n > 36) {
      return def;
    }
    return Math.floor(n);
  }

  function parseValueAsIntegerInBase(value, fromBase) {
    const fb = normalizeRadixBase(fromBase, 10);
    if (typeof value === "number" && Number.isFinite(value)) {
      if (fb !== 10) {
        return null;
      }
      const n = Math.trunc(value);
      if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER) {
        return null;
      }
      return n;
    }
    const s = String(value).trim();
    if (!s || /\s/.test(s)) {
      return null;
    }
    if (fb === 10) {
      const num = Number(s);
      if (!Number.isFinite(num)) {
        return null;
      }
      const n = Math.trunc(num);
      if (Math.abs(n) > Number.MAX_SAFE_INTEGER) {
        return null;
      }
      return n;
    }
    const t = s;
    if (t === "-" || t === "+") {
      return null;
    }
    const core = t[0] === "-" || t[0] === "+" ? t.slice(1) : t;
    if (!core) {
      return null;
    }
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz".slice(0, fb);
    for (let i = 0; i < core.length; i++) {
      const c = core[i].toLowerCase();
      if (alphabet.indexOf(c) === -1) {
        return null;
      }
    }
    const parsed = parseInt(t, fb);
    if (!Number.isFinite(parsed) || Math.abs(parsed) > Number.MAX_SAFE_INTEGER) {
      return null;
    }
    return parsed;
  }

  function formatValueRadixConvert(value, rule) {
    const fromB = normalizeRadixBase(rule.radixFrom, 10);
    const toB = normalizeRadixBase(rule.radixTo, 16);
    const n = parseValueAsIntegerInBase(value, fromB);
    if (n === null) {
      return null;
    }
    try {
      return n.toString(toB);
    } catch (e) {
      return null;
    }
  }

  window.JsonViewerRadixUtils = {
    normalizeRadixBase: normalizeRadixBase,
    parseValueAsIntegerInBase: parseValueAsIntegerInBase,
    formatValueRadixConvert: formatValueRadixConvert
  };
})();
