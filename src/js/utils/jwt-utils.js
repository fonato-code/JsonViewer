(function () {
  function decodeJwtBase64UrlSegment(segment) {
    if (segment == null || typeof segment !== "string" || !segment.length) {
      throw new Error("empty");
    }
    if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
      throw new Error("invalid");
    }
    let b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
    b64 += "=".repeat(pad);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function isLikelyJwtTokenString(s) {
    if (!s || typeof s !== "string") {
      return false;
    }
    const t = s.trim();
    const parts = t.split(".");
    if (parts.length !== 3 || !parts[0] || !parts[1]) {
      return false;
    }
    if (!parts.every(function (p) {
      return p.length > 0 && /^[A-Za-z0-9_-]+$/.test(p);
    })) {
      return false;
    }
    try {
      const headerJson = decodeJwtBase64UrlSegment(parts[0]);
      const header = JSON.parse(headerJson);
      return header && typeof header === "object" && (header.alg !== undefined || header.typ !== undefined);
    } catch (e) {
      return false;
    }
  }

  window.JsonViewerJwtUtils = {
    decodeJwtBase64UrlSegment: decodeJwtBase64UrlSegment,
    isLikelyJwtTokenString: isLikelyJwtTokenString
  };
})();
