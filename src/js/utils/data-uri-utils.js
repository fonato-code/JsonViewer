(function () {
  const DATA_URI_MAX_CHARS = 40 * 1024 * 1024;
  const DATA_URI_MIME_EXT = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "text/plain": "txt",
    "text/html": "html",
    "text/css": "css",
    "application/json": "json",
    "application/xml": "xml",
    "application/zip": "zip",
    "application/octet-stream": "bin"
  };

  function isLikelyDataUri(s) {
    if (!s || typeof s !== "string") {
      return false;
    }
    const t = s.trim();
    if (!/^data:/i.test(t)) {
      return false;
    }
    const comma = t.indexOf(",");
    if (comma <= 5) {
      return false;
    }
    return true;
  }

  function parseDataUriMime(dataUri) {
    if (!dataUri || typeof dataUri !== "string") {
      return "";
    }
    const m = dataUri.trim().match(/^data:([^;,]+)/i);
    return m ? m[1].trim().split(";")[0].trim() : "";
  }

  function guessDownloadFilenameFromMime(mime) {
    const baseMime = (mime || "").split(";")[0].trim().toLowerCase();
    if (DATA_URI_MIME_EXT[baseMime]) {
      return "download." + DATA_URI_MIME_EXT[baseMime];
    }
    if (baseMime.indexOf("image/") === 0) {
      const sub = baseMime.slice("image/".length).replace(/\+xml$/i, "");
      const safe = sub.replace(/[^a-z0-9]/gi, "") || "img";
      return "download." + safe;
    }
    return "download.bin";
  }

  async function blobFromDataUri(dataUri) {
    const res = await fetch(dataUri);
    if (!res.ok) {
      throw new Error("fetch failed");
    }
    return res.blob();
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download.bin";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2500);
  }

  window.JsonViewerDataUriUtils = {
    DATA_URI_MAX_CHARS: DATA_URI_MAX_CHARS,
    DATA_URI_MIME_EXT: DATA_URI_MIME_EXT,
    isLikelyDataUri: isLikelyDataUri,
    parseDataUriMime: parseDataUriMime,
    guessDownloadFilenameFromMime: guessDownloadFilenameFromMime,
    blobFromDataUri: blobFromDataUri,
    triggerBlobDownload: triggerBlobDownload
  };
})();
