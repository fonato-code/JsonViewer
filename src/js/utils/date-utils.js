(function () {
  function parseDateInput(value) {
    if (typeof value !== "string" && typeof value !== "number") {
      return null;
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  function getPtWeekdayName(date, shortName) {
    const names = shortName
      ? ["dom", "seg", "ter", "qua", "qui", "sex", "sab"]
      : ["domingo", "segunda-feira", "terca-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sabado"];
    return names[date.getDay()];
  }

  function getPtMonthName(date, shortName) {
    const names = shortName
      ? ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
      : ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    return names[date.getMonth()];
  }

  function formatOffsetToken(date, token) {
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    const hh = String(Math.floor(abs / 60)).padStart(2, "0");
    const mm = String(abs % 60).padStart(2, "0");
    if (token === "z") {
      return sign + String(Math.floor(abs / 60));
    }
    if (token === "zz") {
      return sign + hh;
    }
    return sign + hh + ":" + mm;
  }

  function formatFractionToken(date, token) {
    const milli = String(date.getMilliseconds()).padStart(3, "0");
    const seven = (milli + "0000").slice(0, 7);
    if (token[0] === "f") {
      return seven.slice(0, token.length);
    }
    const raw = seven.slice(0, token.length);
    return raw.replace(/0+$/, "");
  }

  function formatDateByMode(date, mode) {
    const pad = function (v) {
      return String(v).padStart(2, "0");
    };
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mi = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    const fff = pad(date.getMilliseconds()).padStart(3, "0");
    if (mode === "br-date") return dd + "/" + mm + "/" + yyyy;
    if (mode === "br-datetime") return dd + "/" + mm + "/" + yyyy + " " + hh + ":" + mi + ":" + ss;
    if (mode === "us-date") return mm + "/" + dd + "/" + yyyy;
    if (mode === "br-datetime-ms") return dd + "/" + mm + "/" + yyyy + " " + hh + ":" + mi + ":" + ss + "." + fff;
    if (mode === "us-datetime-ms") return mm + "/" + dd + "/" + yyyy + " " + hh + ":" + mi + ":" + ss + "." + fff;
    if (mode === "iso-local-ms") return yyyy + "-" + mm + "-" + dd + " " + hh + ":" + mi + ":" + ss + "." + fff;
    if (mode === "iso-datetime-local") return yyyy + "-" + mm + "-" + dd + "T" + hh + ":" + mi + ":" + ss;
    if (mode === "iso-datetime-utc") return date.toISOString().replace(/\.\d{3}Z$/, "Z");
    if (mode === "serial-1900") {
      const base = new Date(1900, 0, 1);
      const dayMs = 24 * 60 * 60 * 1000;
      return String(Math.floor((date.getTime() - base.getTime()) / dayMs));
    }
    if (mode === "compact-datetime") return yyyy + mm + dd + hh + mi + ss + fff;
    if (mode === "epoch-seconds") return String(Math.floor(date.getTime() / 1000));
    return date.toISOString();
  }

  function formatDateWithCSharpMask(date, mask) {
    if (!mask || !mask.trim()) {
      return null;
    }
    const fmt = mask.trim();
    const tokenRegex = /('(?:[^']|'')*'|"(?:[^"]|"")*"|\\.|dddd|ddd|dd|d|MMMM|MMM|MM|M|yyyyy|yyyy|yyy|yy|y|HH|H|hh|h|mm|m|ss|s|fffffff|ffffff|fffff|ffff|fff|ff|f|FFFFFFF|FFFFFF|FFFFF|FFFF|FFF|FF|F|tt|t|zzz|zz|z|K)/g;
    const parts = fmt.split(tokenRegex).filter(function (p) {
      return p != null && p !== "";
    });
    const pad = function (v, n) {
      return String(v).padStart(n, "0");
    };
    let out = "";
    for (let i = 0; i < parts.length; i++) {
      const token = parts[i];
      if (token[0] === "'" || token[0] === '"') {
        out += token.slice(1, -1).replace(/''/g, "'").replace(/""/g, '"');
        continue;
      }
      if (token[0] === "\\") {
        out += token.slice(1);
        continue;
      }
      switch (token) {
        case "d":
          out += String(date.getDate());
          break;
        case "dd":
          out += pad(date.getDate(), 2);
          break;
        case "ddd":
          out += getPtWeekdayName(date, true);
          break;
        case "dddd":
          out += getPtWeekdayName(date, false);
          break;
        case "M":
          out += String(date.getMonth() + 1);
          break;
        case "MM":
          out += pad(date.getMonth() + 1, 2);
          break;
        case "MMM":
          out += getPtMonthName(date, true);
          break;
        case "MMMM":
          out += getPtMonthName(date, false);
          break;
        case "y":
          out += String(date.getFullYear() % 100);
          break;
        case "yy":
          out += pad(date.getFullYear() % 100, 2);
          break;
        case "yyy":
          out += pad(date.getFullYear(), 3);
          break;
        case "yyyy":
          out += pad(date.getFullYear(), 4);
          break;
        case "yyyyy":
          out += pad(date.getFullYear(), 5);
          break;
        case "H":
          out += String(date.getHours());
          break;
        case "HH":
          out += pad(date.getHours(), 2);
          break;
        case "h": {
          const h = date.getHours() % 12 || 12;
          out += String(h);
          break;
        }
        case "hh": {
          const h = date.getHours() % 12 || 12;
          out += pad(h, 2);
          break;
        }
        case "m":
          out += String(date.getMinutes());
          break;
        case "mm":
          out += pad(date.getMinutes(), 2);
          break;
        case "s":
          out += String(date.getSeconds());
          break;
        case "ss":
          out += pad(date.getSeconds(), 2);
          break;
        case "t":
          out += date.getHours() < 12 ? "A" : "P";
          break;
        case "tt":
          out += date.getHours() < 12 ? "AM" : "PM";
          break;
        case "z":
        case "zz":
        case "zzz":
          out += formatOffsetToken(date, token);
          break;
        case "K":
          out += formatOffsetToken(date, "zzz");
          break;
        default:
          if (/^[fF]{1,7}$/.test(token)) {
            out += formatFractionToken(date, token);
          } else {
            out += token;
          }
          break;
      }
    }
    return out;
  }

  window.JsonViewerDateUtils = {
    parseDateInput: parseDateInput,
    formatDateByMode: formatDateByMode,
    formatDateWithCSharpMask: formatDateWithCSharpMask,
    getPtWeekdayName: getPtWeekdayName,
    getPtMonthName: getPtMonthName,
    formatOffsetToken: formatOffsetToken,
    formatFractionToken: formatFractionToken
  };
})();
