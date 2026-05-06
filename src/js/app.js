(function () {
  const PROFILE_STORAGE_KEY = "jsonViewer.classProfiles.v1";
  const GLOBAL_SETTINGS_KEY = "jsonViewer.globalSettings.v1";

  const app = Vue.createApp({
    components: {
      JsonNode: window.JsonNodeComponent
    },
    data() {
      return {
        theme: "dark",
        jsonText: "",
        jsonError: "",
        rootData: null,
        rootDataOriginal: null,
        rootDataView: null,
        transformedDraft: null,
        selectedPath: [],
        expandedState: {},
        userTreeExpandedPaths: {},
        inputPanelCollapsed: false,
        rightPanelCollapsed: true,
        tableViewEnabled: false,
        tablePageSize: 10,
        tablePage: 1,
        tableSearch: "",
        tableSortColumn: null,
        tableSortDir: "asc",
        tableColumnWidths: {},
        rowContextMenu: {
          visible: false,
          x: 0,
          y: 0,
          item: null
        },
        toast: {
          visible: false,
          message: "",
          type: "success"
        },
        schemaModel: {
          classes: [],
          objectClassByNormPath: {},
          arrayItemClassByNormPath: {},
          signature: "",
          schemaKeys: []
        },
        viewRules: {},
        selectedSchemaClass: "",
        selectedSchemaProperty: "",
        profileNameInput: "",
        savedProfiles: [],
        behaviorRulesByClass: {},
        behaviorCatalog: {
          marker: {
            type: "marker",
            label: "Marker",
            requiredConfig: ["latitudeProperty", "longitudeProperty"]
          }
        },
        activeBehaviorModal: {
          visible: false,
          title: "",
          summary: "",
          mapUrl: "",
          embedUrl: "",
          points: []
        },
        globalSettings: {
          googleMapsApiKey: ""
        },
        globalSettingsModalOpen: false,
        globalSettingsDraft: {
          googleMapsApiKey: ""
        }
      };
    },
    computed: {
      inputStatus() {
        return this.rootDataOriginal === null ? "Aguardando dados" : "JSON carregado";
      },
      themeIcon() {
        return this.theme === "dark" ? "far fa-sun" : "far fa-moon";
      },
      themeTitle() {
        return this.theme === "dark" ? "Trocar para tema claro" : "Trocar para tema escuro";
      },
      currentNode() {
        if (this.rootDataView === null) return null;
        let value = this.rootDataView;
        for (const key of this.selectedPath) {
          if (value === null || typeof value !== "object") break;
          value = value[key];
        }
        return value;
      },
      currentNodeLabel() {
        if (this.selectedPath.length === 0) return "root";
        return String(this.selectedPath[this.selectedPath.length - 1]);
      },
      currentNodeType() {
        return this.readableType(this.currentNode);
      },
      currentNodeChildren() {
        if (this.currentNode && typeof this.currentNode === "object") {
          return Array.isArray(this.currentNode) ? this.currentNode.length : Object.keys(this.currentNode).length;
        }
        return 0;
      },
      pathParts() {
        const items = [{ label: "root", path: [] }];
        this.selectedPath.forEach((part, index) => {
          items.push({
            label: String(part),
            path: this.selectedPath.slice(0, index + 1)
          });
        });
        return items;
      },
      nodeTypeSummary() {
        if (this.rootDataView === null) return "Sem estrutura";
        return this.readableType(this.rootDataView);
      },
      viewerLevelSummary() {
        if (this.rootDataView === null) return "Sem estrutura";
        const t = this.readableType(this.currentNode);
        if (Array.isArray(this.currentNode)) {
          return t + " (" + this.currentNode.length + ")";
        }
        return t;
      },
      canUseTableView() {
        return this.rootDataView !== null && Array.isArray(this.currentNode);
      },
      showTableView() {
        return this.tableViewEnabled && this.canUseTableView;
      },
      tableColumnKeys() {
        if (!this.canUseTableView || this.currentNode.length === 0) return [];
        const arr = this.currentNode;
        const keys = new Set();
        let anyObject = false;
        arr.forEach(function (item) {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            anyObject = true;
            Object.keys(item).forEach(function (k) {
              keys.add(k);
            });
          }
        });
        if (anyObject) {
          return Array.from(keys).sort(function (a, b) {
            return a.localeCompare(b, "pt-BR");
          });
        }
        return ["__primitive"];
      },
      tableRowSource() {
        if (!this.canUseTableView) return [];
        return this.currentNode.map(function (item, index) {
          return { item: item, index: index };
        });
      },
      tableFilteredRowsMeta() {
        const q = this.tableSearch.trim().toLowerCase();
        let rows = this.tableRowSource.slice();
        if (q) {
          const self = this;
          rows = rows.filter(function (row) {
            return self.rowSearchText(row.item).toLowerCase().indexOf(q) !== -1;
          });
        }
        if (this.tableSortColumn) {
          const col = this.tableSortColumn;
          const dir = this.tableSortDir === "asc" ? 1 : -1;
          const self = this;
          rows.sort(function (a, b) {
            return dir * self.compareTableValues(self.getCellRaw(a.item, col), self.getCellRaw(b.item, col));
          });
        }
        return rows;
      },
      tableTotalPages() {
        const n = this.tableFilteredRowsMeta.length;
        return Math.max(1, Math.ceil(n / this.tablePageSize));
      },
      tablePagedRows() {
        const rows = this.tableFilteredRowsMeta;
        const start = (this.tablePage - 1) * this.tablePageSize;
        return rows.slice(start, start + this.tablePageSize);
      },
      tableRangeLabel() {
        const total = this.tableFilteredRowsMeta.length;
        if (total === 0) {
          return "0 de 0 linhas";
        }
        const start = (this.tablePage - 1) * this.tablePageSize + 1;
        const end = Math.min(this.tablePage * this.tablePageSize, total);
        return start + "-" + end + " de " + total + " linhas";
      },
      stats() {
        const result = { objects: 0, arrays: 0, leaves: 0 };
        const visit = (value) => {
          if (Array.isArray(value)) {
            result.arrays += 1;
            value.forEach(visit);
            return;
          }
          if (value && typeof value === "object") {
            result.objects += 1;
            Object.values(value).forEach(visit);
            return;
          }
          result.leaves += 1;
        };
        if (this.rootDataView !== null) {
          visit(this.rootDataView);
        }
        return result;
      },
      schemaClasses() {
        return this.schemaModel.classes || [];
      },
      selectedSchemaClassInfo() {
        if (!this.selectedSchemaClass) return null;
        for (let i = 0; i < this.schemaClasses.length; i++) {
          if (this.schemaClasses[i].name === this.selectedSchemaClass) {
            return this.schemaClasses[i];
          }
        }
        return null;
      },
      selectedSchemaPropertyInfo() {
        const classInfo = this.selectedSchemaClassInfo;
        if (!classInfo || !this.selectedSchemaProperty) return null;
        return classInfo.properties.find((p) => p.name === this.selectedSchemaProperty) || null;
      },
      selectedRule() {
        if (!this.selectedSchemaClass || !this.selectedSchemaProperty) return null;
        return this.ensureRule(this.selectedSchemaClass, this.selectedSchemaProperty);
      },
      currentArrayItemClass() {
        if (!Array.isArray(this.currentNode)) return "";
        return this.schemaModel.arrayItemClassByNormPath[this.normalizePath(this.selectedPath)] || "";
      },
      suggestedProfiles() {
        if (!this.schemaModel.signature) return [];
        return this.savedProfiles
          .filter((profile) => this.isProfileCompatible(profile))
          .sort((a, b) => this.profileCompatibilityScore(b) - this.profileCompatibilityScore(a));
      },
      selectedClassBehaviors() {
        if (!this.selectedSchemaClass) return [];
        return this.behaviorRulesByClass[this.selectedSchemaClass] || [];
      },
      currentNodeClassName() {
        if (this.currentNode === null || typeof this.currentNode !== "object" || Array.isArray(this.currentNode)) {
          return "";
        }
        return this.getClassNameForObjectPath(this.selectedPath);
      },
      currentNodeBehaviors() {
        if (!this.currentNodeClassName) return [];
        const list = this.behaviorRulesByClass[this.currentNodeClassName] || [];
        return list.filter((item) => this.isBehaviorEnabledForNode(item, this.currentNode));
      },
      currentTableMarkerBehaviors() {
        if (!Array.isArray(this.currentNode) || !this.currentArrayItemClass) {
          return [];
        }
        const list = this.behaviorRulesByClass[this.currentArrayItemClass] || [];
        return list.filter((item) => item && item.type === "marker" && item.enabled && this.behaviorHasRequiredConfig(item));
      },
      needsTableColumnWidthInit() {
        if (!this.showTableView || !this.tableColumnKeys.length) {
          return false;
        }
        const keys = this.tableColumnKeys;
        const w = this.tableColumnWidths;
        for (let i = 0; i < keys.length; i++) {
          if (w[keys[i]] == null) {
            return true;
          }
        }
        return Object.keys(w).length !== keys.length;
      }
    },
    watch: {
      tableSearch: function () {
        this.tablePage = 1;
      },
      tablePageSize: function () {
        this.tablePage = 1;
      },
      selectedPath: function () {
        this.tablePage = 1;
        this.tableColumnWidths = {};
        const self = this;
        this.$nextTick(function () {
          if (self.showTableView && self.canUseTableView) {
            self.initTableColumnWidthsFromContent();
          }
        });
      },
      tableViewEnabled: function (v) {
        if (!v) {
          return;
        }
        const self = this;
        this.$nextTick(function () {
          if (self.needsTableColumnWidthInit) {
            self.initTableColumnWidthsFromContent();
          }
        });
      }
    },
    methods: {
      readableType(value) {
        if (Array.isArray(value)) return "array";
        if (value === null) return "null";
        return typeof value;
      },
      isNumericSegment(segment) {
        return typeof segment === "number" || /^[0-9]+$/.test(String(segment));
      },
      normalizePath(path) {
        return path
          .map((segment) => (this.isNumericSegment(segment) ? "*" : String(segment)))
          .join(".");
      },
      cloneJson(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
      },
      defaultRule() {
        return { enabled: false, displayType: "auto", dateFormat: "iso", manualDateMask: "" };
      },
      ensureRule(className, propertyName) {
        if (!className || !propertyName) {
          return null;
        }
        if (!this.viewRules[className]) {
          this.viewRules = Object.assign({}, this.viewRules, { [className]: {} });
        }
        if (!this.viewRules[className][propertyName]) {
          this.viewRules[className] = Object.assign({}, this.viewRules[className], {
            [propertyName]: this.defaultRule()
          });
        } else if (typeof this.viewRules[className][propertyName].manualDateMask !== "string") {
          this.viewRules[className][propertyName].manualDateMask = "";
        }
        return this.viewRules[className][propertyName];
      },
      getRule(className, propertyName) {
        if (!className || !propertyName) return null;
        const byClass = this.viewRules[className];
        return byClass ? byClass[propertyName] || null : null;
      },
      inferSchemaModel(rootValue) {
        const classesByName = {};
        const objectClassByNormPath = {};
        const arrayItemClassByNormPath = {};
        const maxArraySamples = 200;
        const self = this;

        const ensureClass = function (className) {
          if (!classesByName[className]) {
            classesByName[className] = {
              name: className,
              propertyMap: {}
            };
          }
          return classesByName[className];
        };
        const typeOfValue = function (value) {
          if (Array.isArray(value)) return "array";
          if (value === null) return "null";
          return typeof value;
        };
        const maybeDateLike = function (value) {
          if (typeof value !== "string") return false;
          const text = value.trim();
          if (!text) return false;
          if (
            !(
              /[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(text) ||
              /[0-9]{4}\/[0-9]{2}\/[0-9]{2}/.test(text) ||
              /[0-9]{2}\/[0-9]{2}\/[0-9]{4}/.test(text)
            )
          ) {
            return false;
          }
          return !isNaN(Date.parse(text));
        };
        const noteProperty = function (className, propName, value) {
          const cls = ensureClass(className);
          if (!cls.propertyMap[propName]) {
            cls.propertyMap[propName] = {
              name: propName,
              types: {},
              occurrences: 0,
              dateLikeSamples: 0
            };
          }
          const prop = cls.propertyMap[propName];
          prop.occurrences += 1;
          prop.types[typeOfValue(value)] = true;
          if (maybeDateLike(value)) {
            prop.dateLikeSamples += 1;
          }
        };
        const walkObject = function (obj, objectPath, className) {
          objectClassByNormPath[self.normalizePath(objectPath)] = className;
          ensureClass(className);
          Object.keys(obj).forEach((key) => {
            const val = obj[key];
            noteProperty(className, key, val);
            if (val && typeof val === "object" && !Array.isArray(val)) {
              walkObject(val, objectPath.concat(key), className + "." + key);
              return;
            }
            if (Array.isArray(val)) {
              const arrayPath = objectPath.concat(key);
              const itemClass = className + "." + key;
              arrayItemClassByNormPath[self.normalizePath(arrayPath)] = itemClass;
              const sampleCount = Math.min(val.length, maxArraySamples);
              for (let j = 0; j < sampleCount; j++) {
                const item = val[j];
                if (item && typeof item === "object" && !Array.isArray(item)) {
                  walkObject(item, arrayPath.concat(String(j)), itemClass);
                }
              }
            }
          });
        };

        if (rootValue && typeof rootValue === "object" && !Array.isArray(rootValue)) {
          walkObject(rootValue, [], "root");
        } else if (Array.isArray(rootValue)) {
          arrayItemClassByNormPath[""] = "root.item";
          const sampleCount = Math.min(rootValue.length, maxArraySamples);
          for (let i = 0; i < sampleCount; i++) {
            const item = rootValue[i];
            if (item && typeof item === "object" && !Array.isArray(item)) {
              walkObject(item, [String(i)], "root.item");
            }
          }
        }

        const classes = Object.values(classesByName)
          .map((cls) => {
            const properties = Object.values(cls.propertyMap)
              .map((prop) => ({
                name: prop.name,
                types: Object.keys(prop.types).sort(),
                occurrences: prop.occurrences,
                dateLike: prop.dateLikeSamples > 0
              }))
              .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
            return { name: cls.name, properties: properties };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

        const schemaKeys = [];
        classes.forEach((cls) => {
          cls.properties.forEach((prop) => {
            schemaKeys.push(cls.name + "." + prop.name);
          });
        });
        schemaKeys.sort();
        return {
          classes: classes,
          objectClassByNormPath: objectClassByNormPath,
          arrayItemClassByNormPath: arrayItemClassByNormPath,
          signature: schemaKeys.join("|"),
          schemaKeys: schemaKeys
        };
      },
      getClassNameForObjectPath(path) {
        return this.schemaModel.objectClassByNormPath[this.normalizePath(path)] || "";
      },
      ruleContextFromPath(path) {
        if (!path || path.length === 0) {
          return null;
        }
        const property = String(path[path.length - 1]);
        if (this.isNumericSegment(property)) {
          return null;
        }
        const className = this.getClassNameForObjectPath(path.slice(0, -1));
        if (!className) return null;
        return { className: className, propertyName: property };
      },
      parseDateInput(value) {
        if (typeof value !== "string" && typeof value !== "number") {
          return null;
        }
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      },
      formatDateByMode(date, mode) {
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
      },
      getPtWeekdayName(date, shortName) {
        const names = shortName
          ? ["dom", "seg", "ter", "qua", "qui", "sex", "sab"]
          : ["domingo", "segunda-feira", "terca-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sabado"];
        return names[date.getDay()];
      },
      getPtMonthName(date, shortName) {
        const names = shortName
          ? ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
          : ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
        return names[date.getMonth()];
      },
      formatOffsetToken(date, token) {
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
      },
      formatFractionToken(date, token) {
        const milli = String(date.getMilliseconds()).padStart(3, "0");
        const seven = (milli + "0000").slice(0, 7);
        if (token[0] === "f") {
          return seven.slice(0, token.length);
        }
        const raw = seven.slice(0, token.length);
        return raw.replace(/0+$/, "");
      },
      formatDateWithCSharpMask(date, mask) {
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
              out += this.getPtWeekdayName(date, true);
              break;
            case "dddd":
              out += this.getPtWeekdayName(date, false);
              break;
            case "M":
              out += String(date.getMonth() + 1);
              break;
            case "MM":
              out += pad(date.getMonth() + 1, 2);
              break;
            case "MMM":
              out += this.getPtMonthName(date, true);
              break;
            case "MMMM":
              out += this.getPtMonthName(date, false);
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
              out += this.formatOffsetToken(date, token);
              break;
            case "K":
              out += this.formatOffsetToken(date, "zzz");
              break;
            default:
              if (/^[fF]{1,7}$/.test(token)) {
                out += this.formatFractionToken(date, token);
              } else {
                out += token;
              }
              break;
          }
        }
        return out;
      },
      formatByRule(value, ruleContext) {
        if (!ruleContext) return null;
        const rule = this.getRule(ruleContext.className, ruleContext.propertyName);
        if (!rule || !rule.enabled || rule.displayType === "auto") return null;
        if (rule.displayType === "date") {
          const date = this.parseDateInput(value);
          if (!date) return null;
          if (rule.dateFormat === "manual") {
            const manual = this.formatDateWithCSharpMask(date, rule.manualDateMask);
            return manual != null ? manual : null;
          }
          return this.formatDateByMode(date, rule.dateFormat || "iso");
        }
        if (rule.displayType === "text") {
          return String(value);
        }
        if (rule.displayType === "number") {
          const num = Number(value);
          return isFinite(num) ? String(num) : null;
        }
        return null;
      },
      treeValuePreview(path, value) {
        if (Array.isArray(value)) return "[" + value.length + "]";
        if (value && typeof value === "object") return "{" + Object.keys(value).length + "}";
        const transformed = this.formatByRule(value, this.ruleContextFromPath(path));
        const finalValue = transformed != null ? transformed : value;
        if (typeof finalValue === "string") return '"' + finalValue + '"';
        if (finalValue === null) return "null";
        return String(finalValue);
      },
      treeValueClass(path, value) {
        const transformed = this.formatByRule(value, this.ruleContextFromPath(path));
        const finalValue = transformed != null ? transformed : value;
        if (typeof finalValue === "string") return "value-string";
        if (typeof finalValue === "number") return "value-number";
        if (typeof finalValue === "boolean") return "value-bool";
        if (finalValue === null) return "value-null";
        return "";
      },
      retainOnlyCompatibleRules() {
        const allowed = {};
        this.schemaClasses.forEach((cls) => {
          allowed[cls.name] = {};
          cls.properties.forEach((prop) => {
            allowed[cls.name][prop.name] = true;
          });
        });
        const next = {};
        Object.keys(this.viewRules).forEach((className) => {
          if (!allowed[className]) return;
          Object.keys(this.viewRules[className]).forEach((propName) => {
            if (!allowed[className][propName]) return;
            if (!next[className]) next[className] = {};
            next[className][propName] = this.viewRules[className][propName];
          });
        });
        this.viewRules = next;
      },
      retainOnlyCompatibleBehaviors() {
        const allowed = {};
        this.schemaClasses.forEach((cls) => {
          allowed[cls.name] = {};
          cls.properties.forEach((prop) => {
            allowed[cls.name][prop.name] = true;
          });
        });
        const next = {};
        Object.keys(this.behaviorRulesByClass || {}).forEach((className) => {
          if (!allowed[className]) return;
          const list = Array.isArray(this.behaviorRulesByClass[className]) ? this.behaviorRulesByClass[className] : [];
          next[className] = list
            .filter((item) => item && item.type)
            .map((item) => {
              const normalized = {
                id: item.id || ("bhv-" + Date.now().toString(36)),
                type: item.type,
                name: item.name || (this.behaviorCatalog[item.type] ? this.behaviorCatalog[item.type].label : "Comportamento"),
                enabled: item.enabled !== false,
                config: Object.assign({ latitudeProperty: "", longitudeProperty: "" }, item.config || {})
              };
              if (normalized.type === "marker") {
                if (!allowed[className][normalized.config.latitudeProperty]) {
                  normalized.config.latitudeProperty = "";
                }
                if (!allowed[className][normalized.config.longitudeProperty]) {
                  normalized.config.longitudeProperty = "";
                }
              }
              return normalized;
            });
        });
        this.behaviorRulesByClass = next;
      },
      toggleTheme() {
        this.theme = this.theme === "dark" ? "light" : "dark";
        document.body.classList.toggle("theme-dark", this.theme === "dark");
        document.body.classList.toggle("theme-light", this.theme === "light");
      },
      parseJson() {
        this.jsonError = "";
        try {
          const parsed = JSON.parse(this.jsonText);
          this.rootData = parsed;
          this.rootDataOriginal = parsed;
          this.rootDataView = parsed;
          this.transformedDraft = this.cloneJson(parsed);
          this.schemaModel = this.inferSchemaModel(parsed);
          this.retainOnlyCompatibleRules();
          this.retainOnlyCompatibleBehaviors();
          this.selectedSchemaClass = this.schemaClasses.length ? this.schemaClasses[0].name : "";
          this.ensureSelectedProperty();
          this.selectedPath = [];
          this.expandedState = { "[]": true };
          this.userTreeExpandedPaths = {};
          this.inputPanelCollapsed = true;
          this.tableColumnWidths = {};
          const self = this;
          this.$nextTick(function () {
            if (self.showTableView && self.canUseTableView) {
              self.initTableColumnWidthsFromContent();
            }
          });
        } catch (error) {
          this.rootData = null;
          this.rootDataOriginal = null;
          this.rootDataView = null;
          this.transformedDraft = null;
          this.schemaModel = {
            classes: [],
            objectClassByNormPath: {},
            arrayItemClassByNormPath: {},
            signature: "",
            schemaKeys: []
          };
          this.jsonError = "JSON invalido: " + error.message;
        }
      },
      clearAll() {
        this.jsonText = "";
        this.jsonError = "";
        this.rootData = null;
        this.rootDataOriginal = null;
        this.rootDataView = null;
        this.transformedDraft = null;
        this.selectedPath = [];
        this.expandedState = {};
        this.userTreeExpandedPaths = {};
        this.inputPanelCollapsed = false;
        this.rightPanelCollapsed = true;
        this.schemaModel = {
          classes: [],
          objectClassByNormPath: {},
          arrayItemClassByNormPath: {},
          signature: "",
          schemaKeys: []
        };
        this.viewRules = {};
        this.behaviorRulesByClass = {};
        this.activeBehaviorModal = {
          visible: false,
          title: "",
          summary: "",
          mapUrl: ""
        };
        this.selectedSchemaClass = "";
        this.selectedSchemaProperty = "";
        this.tableViewEnabled = false;
        this.tablePage = 1;
        this.tablePageSize = 10;
        this.tableSearch = "";
        this.tableSortColumn = null;
        this.tableSortDir = "asc";
        this.tableColumnWidths = {};
        this.dismissRowContextMenu();
      },
      loadSample() {
        this.jsonText = JSON.stringify(
          {
            alerts: [
              {
                country: "BR",
                level: 5,
                city: "Congonhas",
                line: [
                  { x: -43.84085, y: -20.48644 },
                  { x: -43.84859, y: -20.48595 }
                ]
              },
              {
                country: "BR",
                level: 2,
                city: "Ressaquinha",
                line: [{ x: -43.81, y: -20.47 }]
              }
            ],
            startTime: "2026-05-05 14:17:00.000",
            endTime: "2026-05-05 14:18:00.000"
          },
          null,
          2
        );
        this.parseJson();
      },
      selectPath(path) {
        this.dismissRowContextMenu();
        const oldPath = this.selectedPath.slice();
        const newPath = path.slice();
        this.selectedPath = newPath;
        this.ensurePathExpanded(path);
        this.collapseAutoExpandedArraysLeaving(oldPath, newPath);
      },
      navigateToParent() {
        if (this.selectedPath.length === 0) return;
        this.dismissRowContextMenu();
        const oldPath = this.selectedPath.slice();
        this.selectedPath = this.selectedPath.slice(0, -1);
        this.ensurePathExpanded(this.selectedPath);
        this.collapseAutoExpandedArraysLeaving(oldPath, this.selectedPath);
      },
      navigateToPath(path) {
        this.dismissRowContextMenu();
        const oldPath = this.selectedPath.slice();
        const newPath = path.slice();
        this.selectedPath = newPath;
        this.ensurePathExpanded(newPath);
        this.collapseAutoExpandedArraysLeaving(oldPath, newPath);
      },
      pathIsPrefix(prefix, full) {
        if (prefix.length > full.length) {
          return false;
        }
        for (let i = 0; i < prefix.length; i++) {
          if (prefix[i] !== full[i]) {
            return false;
          }
        }
        return true;
      },
      nodeAtPath(path) {
        if (this.rootDataView === null) {
          return undefined;
        }
        let v = this.rootDataView;
        for (let i = 0; i < path.length; i++) {
          if (v === null || typeof v !== "object") {
            return undefined;
          }
          v = v[path[i]];
        }
        return v;
      },
      collapseAutoExpandedArraysLeaving(oldPath, newPath) {
        if (!this.pathIsPrefix(newPath, oldPath) || newPath.length >= oldPath.length) {
          return;
        }
        for (let j = newPath.length + 1; j <= oldPath.length; j++) {
          const p = oldPath.slice(0, j);
          const key = JSON.stringify(p);
          if (this.userTreeExpandedPaths[key]) {
            continue;
          }
          const node = this.nodeAtPath(p);
          if (node !== undefined && Array.isArray(node)) {
            this.expandedState[key] = false;
          }
        }
      },
      toggleExpand(path) {
        const key = JSON.stringify(path);
        const next = !this.isPathExpanded(path);
        this.expandedState[key] = next;
        const nextUser = Object.assign({}, this.userTreeExpandedPaths);
        if (next) {
          nextUser[key] = true;
        } else {
          delete nextUser[key];
        }
        this.userTreeExpandedPaths = nextUser;
      },
      isPathExpanded(path) {
        const key = JSON.stringify(path);
        return this.expandedState[key] === true;
      },
      ensurePathExpanded(path) {
        let partial = [];
        this.expandedState["[]"] = true;
        path.forEach((step) => {
          partial = partial.concat(step);
          this.expandedState[JSON.stringify(partial)] = true;
        });
      },
      expandAllTree() {
        const root = this.currentNode;
        if (root === null || typeof root !== "object") {
          return;
        }
        const base = this.selectedPath.slice();
        const next = Object.assign({}, this.expandedState);
        next[JSON.stringify(base)] = true;
        const walk = function (value, pathArr, state) {
          if (value === null || typeof value !== "object") {
            return;
          }
          if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
              const p = pathArr.concat(String(i));
              state[JSON.stringify(p)] = true;
              walk(value[i], p, state);
            }
          } else {
            const keys = Object.keys(value);
            for (let j = 0; j < keys.length; j++) {
              const k = keys[j];
              const p = pathArr.concat(k);
              state[JSON.stringify(p)] = true;
              walk(value[k], p, state);
            }
          }
        };
        walk(root, base, next);
        this.expandedState = next;
      },
      collapseAllTree() {
        const base = this.selectedPath.slice();
        const next = {};
        next[JSON.stringify(base)] = true;
        this.expandedState = next;
      },
      collapseInputPanel() {
        this.inputPanelCollapsed = true;
      },
      expandInputPanel() {
        this.inputPanelCollapsed = false;
      },
      collapseRightPanel() {
        this.rightPanelCollapsed = true;
      },
      expandRightPanel() {
        this.rightPanelCollapsed = false;
      },
      selectSchemaClass(className) {
        this.selectedSchemaClass = className;
        this.ensureSelectedProperty();
      },
      ensureSelectedProperty() {
        const classInfo = this.selectedSchemaClassInfo;
        if (!classInfo || !classInfo.properties.length) {
          this.selectedSchemaProperty = "";
          return;
        }
        const found = classInfo.properties.find((p) => p.name === this.selectedSchemaProperty);
        if (!found) {
          this.selectedSchemaProperty = classInfo.properties[0].name;
        }
      },
      setSelectedRuleDisplayType(nextType) {
        const rule = this.selectedRule;
        if (!rule) return;
        rule.displayType = nextType;
        rule.enabled = nextType !== "auto";
      },
      createBehaviorInstance(type) {
        const catalog = this.behaviorCatalog[type];
        if (!catalog) return null;
        return {
          id: "bhv-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          type: type,
          name: catalog.label,
          enabled: true,
          config: {
            latitudeProperty: "",
            longitudeProperty: ""
          }
        };
      },
      addBehaviorToSelectedClass(type) {
        if (!this.selectedSchemaClass) return;
        const instance = this.createBehaviorInstance(type || "marker");
        if (!instance) return;
        const current = this.behaviorRulesByClass[this.selectedSchemaClass] || [];
        const nextByClass = Object.assign({}, this.behaviorRulesByClass, {
          [this.selectedSchemaClass]: current.concat([instance])
        });
        this.behaviorRulesByClass = nextByClass;
      },
      removeBehaviorFromSelectedClass(behaviorId) {
        if (!this.selectedSchemaClass) return;
        const current = this.behaviorRulesByClass[this.selectedSchemaClass] || [];
        const nextList = current.filter((item) => item.id !== behaviorId);
        this.behaviorRulesByClass = Object.assign({}, this.behaviorRulesByClass, {
          [this.selectedSchemaClass]: nextList
        });
      },
      normalizeBehaviorRules(rawRules) {
        const src = rawRules && typeof rawRules === "object" ? rawRules : {};
        const next = {};
        Object.keys(src).forEach((className) => {
          const arr = Array.isArray(src[className]) ? src[className] : [];
          next[className] = arr
            .filter((item) => item && typeof item === "object" && item.type)
            .map((item, idx) => {
              return {
                id: item.id || ("bhv-" + className + "-" + idx),
                type: item.type,
                name: item.name || (this.behaviorCatalog[item.type] ? this.behaviorCatalog[item.type].label : "Comportamento"),
                enabled: item.enabled !== false,
                config: Object.assign({ latitudeProperty: "", longitudeProperty: "" }, item.config || {})
              };
            });
        });
        return next;
      },
      behaviorHasRequiredConfig(behavior) {
        if (!behavior || !behavior.type) return false;
        if (behavior.type !== "marker") return false;
        return !!(behavior.config && behavior.config.latitudeProperty && behavior.config.longitudeProperty);
      },
      isBehaviorEnabledForNode(behavior, nodeValue) {
        if (!behavior || !behavior.enabled || !this.behaviorHasRequiredConfig(behavior)) {
          return false;
        }
        if (behavior.type === "marker") {
          return nodeValue && typeof nodeValue === "object" && !Array.isArray(nodeValue);
        }
        return false;
      },
      resolveMarkerLatLng(behavior, nodeValue) {
        if (!this.isBehaviorEnabledForNode(behavior, nodeValue)) {
          return null;
        }
        const latRaw = nodeValue[behavior.config.latitudeProperty];
        const lngRaw = nodeValue[behavior.config.longitudeProperty];
        const lat = Number(latRaw);
        const lng = Number(lngRaw);
        if (!isFinite(lat) || !isFinite(lng)) {
          return null;
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return null;
        }
        return { lat: lat, lng: lng };
      },
      executeBehaviorOnNode(behavior, nodeValue) {
        if (!behavior || !behavior.type) {
          return;
        }
        if (behavior.type === "marker") {
          const coords = this.resolveMarkerLatLng(behavior, nodeValue);
          if (!coords) {
            this.showToast("Marker invalido: configure latitude/longitude validas.", "error");
            return;
          }
          this.activeBehaviorModal = {
            visible: true,
            title: behavior.name || "Marker",
            summary: "Latitude: " + coords.lat + " | Longitude: " + coords.lng,
            mapUrl: "https://www.google.com/maps?q=" + encodeURIComponent(coords.lat + "," + coords.lng),
            embedUrl: this.buildGoogleMapsEmbedUrl(coords.lat, coords.lng),
            points: [coords]
          };
          this.$nextTick(() => this.renderBehaviorMap());
          return;
        }
      },
      buildGoogleMapsEmbedUrl(lat, lng) {
        const coords = lat + "," + lng;
        return "https://maps.google.com/maps?q=" + encodeURIComponent(coords) + "&z=16&output=embed";
      },
      buildGoogleMapsListUrls(coordsList) {
        if (!coordsList.length) {
          return { mapUrl: "", embedUrl: "" };
        }
        if (coordsList.length === 1) {
          const single = coordsList[0].lat + "," + coordsList[0].lng;
          return {
            mapUrl: "https://www.google.com/maps?q=" + encodeURIComponent(single),
            embedUrl: "https://maps.google.com/maps?q=" + encodeURIComponent(single) + "&z=16&output=embed"
          };
        }
        const first = coordsList[0].lat + "," + coordsList[0].lng;
        const chain = coordsList
          .slice(1)
          .map((pt) => pt.lat + "," + pt.lng)
          .join("+to:");
        const mapUrl =
          "https://www.google.com/maps/dir/?api=1&origin=" +
          encodeURIComponent(first) +
          "&destination=" +
          encodeURIComponent(coordsList[coordsList.length - 1].lat + "," + coordsList[coordsList.length - 1].lng) +
          (coordsList.length > 2
            ? "&waypoints=" +
              encodeURIComponent(
                coordsList
                  .slice(1, -1)
                  .map((pt) => pt.lat + "," + pt.lng)
                  .join("|")
              )
            : "");
        const embedUrl = "https://maps.google.com/maps?output=embed&saddr=" + encodeURIComponent(first) + "&daddr=" + encodeURIComponent(chain);
        return { mapUrl: mapUrl, embedUrl: embedUrl };
      },
      executeBehaviorOnCurrentTable(behavior) {
        if (!behavior || behavior.type !== "marker" || !Array.isArray(this.currentNode)) {
          return;
        }
        const points = [];
        for (let i = 0; i < this.currentNode.length; i++) {
          const item = this.currentNode[i];
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            continue;
          }
          const coords = this.resolveMarkerLatLng(behavior, item);
          if (coords) {
            points.push(coords);
          }
        }
        if (!points.length) {
          this.showToast("Nenhum marcador valido encontrado nesta lista.", "error");
          return;
        }
        const urls = this.buildGoogleMapsListUrls(points);
        this.activeBehaviorModal = {
          visible: true,
          title: (behavior.name || "Marker") + " (lista)",
          summary: points.length + " marcador(es) conectados em sequencia.",
          mapUrl: urls.mapUrl,
          embedUrl: urls.embedUrl,
          points: points
        };
        this.$nextTick(() => this.renderBehaviorMap());
      },
      renderBehaviorMap() {
        const L = window.L;
        const el = this.$refs.behaviorMapEl;
        const points = this.activeBehaviorModal.points || [];
        if (!el || !L || !points.length) {
          return;
        }
        if (this._behaviorLeafletMap) {
          this._behaviorLeafletMap.remove();
          this._behaviorLeafletMap = null;
        }
        const map = L.map(el, { zoomControl: true });
        this._behaviorLeafletMap = map;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap"
        }).addTo(map);
        const latLngs = points.map((pt) => [pt.lat, pt.lng]);
        for (let i = 0; i < latLngs.length; i++) {
          L.marker(latLngs[i]).addTo(map);
        }
        if (latLngs.length > 1) {
          L.polyline(latLngs, { color: "#2f8bff", weight: 3, opacity: 0.9 }).addTo(map);
        }
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [18, 18], maxZoom: 16 });
      },
      closeBehaviorModal() {
        if (this._behaviorLeafletMap) {
          this._behaviorLeafletMap.remove();
          this._behaviorLeafletMap = null;
        }
        this.activeBehaviorModal.visible = false;
      },
      openBehaviorMapLink() {
        if (!this.activeBehaviorModal.mapUrl) return;
        window.open(this.activeBehaviorModal.mapUrl, "_blank", "noopener,noreferrer");
      },
      openGlobalSettingsModal() {
        this.globalSettingsDraft = {
          googleMapsApiKey: this.globalSettings.googleMapsApiKey || ""
        };
        this.globalSettingsModalOpen = true;
      },
      closeGlobalSettingsModal() {
        this.globalSettingsModalOpen = false;
      },
      saveGlobalSettings() {
        this.globalSettings = {
          googleMapsApiKey: (this.globalSettingsDraft.googleMapsApiKey || "").trim()
        };
        this.persistGlobalSettings();
        this.globalSettingsModalOpen = false;
        this.showToast("Configuracoes globais salvas.");
      },
      loadGlobalSettings() {
        try {
          const raw = localStorage.getItem(GLOBAL_SETTINGS_KEY);
          if (!raw) return;
          const parsed = JSON.parse(raw);
          this.globalSettings = {
            googleMapsApiKey: (parsed && parsed.googleMapsApiKey) || ""
          };
        } catch (err) {
          this.globalSettings = { googleMapsApiKey: "" };
        }
      },
      persistGlobalSettings() {
        try {
          localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(this.globalSettings));
        } catch (err) {
          // no-op
        }
      },
      tableRowBehaviors(rowItem) {
        const className = this.currentArrayItemClass;
        if (!className) return [];
        const list = this.behaviorRulesByClass[className] || [];
        return list.filter((item) => this.isBehaviorEnabledForNode(item, rowItem));
      },
      getCellRaw(item, col) {
        if (col === "__primitive") {
          return item;
        }
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return Object.prototype.hasOwnProperty.call(item, col) ? item[col] : undefined;
        }
        return undefined;
      },
      rowSearchText(item) {
        const self = this;
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return Object.keys(item)
            .map(function (k) {
              const ctx = self.currentArrayItemClass ? { className: self.currentArrayItemClass, propertyName: k } : null;
              const transformed = self.formatByRule(item[k], ctx);
              return k + ":" + self.cellSearchSnippet(transformed != null ? transformed : item[k]);
            })
            .join(" ");
        }
        return this.cellSearchSnippet(item);
      },
      cellSearchSnippet(v) {
        if (v === null || v === undefined) {
          return "";
        }
        if (typeof v === "object") {
          return JSON.stringify(v);
        }
        return String(v);
      },
      compareTableValues(a, b) {
        if (a === b) {
          return 0;
        }
        if (a === null || a === undefined) {
          return 1;
        }
        if (b === null || b === undefined) {
          return -1;
        }
        if (typeof a === "number" && typeof b === "number" && !isNaN(a) && !isNaN(b)) {
          return a < b ? -1 : 1;
        }
        if (typeof a === "boolean" && typeof b === "boolean") {
          return a === b ? 0 : a ? 1 : -1;
        }
        if (typeof a === "object" || typeof b === "object") {
          return JSON.stringify(a).localeCompare(JSON.stringify(b), "pt-BR");
        }
        return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
      },
      toggleTableSort(col) {
        if (this.tableSortColumn === col) {
          this.tableSortDir = this.tableSortDir === "asc" ? "desc" : "asc";
        } else {
          this.tableSortColumn = col;
          this.tableSortDir = "asc";
        }
      },
      resetTableViewFilters() {
        this.tableSearch = "";
        this.tableSortColumn = null;
        this.tableSortDir = "asc";
        this.tablePage = 1;
      },
      formatTableCell(val) {
        if (val === null || val === undefined) {
          return "—";
        }
        if (typeof val === "string") {
          return val;
        }
        if (typeof val === "number" || typeof val === "boolean") {
          return String(val);
        }
        if (Array.isArray(val)) {
          return "[" + val.length + "]";
        }
        if (typeof val === "object") {
          return "{" + Object.keys(val).length + "}";
        }
        return String(val);
      },
      formatTableCellDisplay(item, col) {
        const raw = this.tableCellRaw(item, col);
        if (raw && typeof raw === "object") {
          return this.formatTableCell(raw);
        }
        let ctx = null;
        if (col !== "__primitive" && this.currentArrayItemClass) {
          ctx = { className: this.currentArrayItemClass, propertyName: col };
        }
        const transformed = this.formatByRule(raw, ctx);
        return this.formatTableCell(transformed != null ? transformed : raw);
      },
      tableCellClass(val) {
        if (typeof val === "string") {
          return "value-string";
        }
        if (typeof val === "number") {
          return "value-number";
        }
        if (typeof val === "boolean") {
          return "value-bool";
        }
        if (val === null) {
          return "value-null";
        }
        return "text-secondary";
      },
      tableCellClassDisplay(item, col) {
        const raw = this.tableCellRaw(item, col);
        if (raw && typeof raw === "object") {
          return this.tableCellClass(raw);
        }
        let ctx = null;
        if (col !== "__primitive" && this.currentArrayItemClass) {
          ctx = { className: this.currentArrayItemClass, propertyName: col };
        }
        const transformed = this.formatByRule(raw, ctx);
        return this.tableCellClass(transformed != null ? transformed : raw);
      },
      tableHeaderLabel(col) {
        if (col === "__primitive") {
          return "valor";
        }
        return col;
      },
      tableCellRaw(item, col) {
        if (col === "__primitive") {
          return item;
        }
        return this.getCellRaw(item, col);
      },
      isTableCellDrillable(item, col) {
        const raw = this.tableCellRaw(item, col);
        return raw !== null && typeof raw === "object";
      },
      tableCellDrillTitle(item, col) {
        if (!this.isTableCellDrillable(item, col)) {
          return "";
        }
        const raw = this.tableCellRaw(item, col);
        return Array.isArray(raw) ? "Abrir este array (modo tabela)" : "Abrir este objeto (modo arvore)";
      },
      drillTableCell(rowMeta, col) {
        const raw = this.tableCellRaw(rowMeta.item, col);
        if (raw === null || typeof raw !== "object") {
          return;
        }
        let newPath;
        if (col === "__primitive") {
          newPath = this.selectedPath.concat([String(rowMeta.index)]);
        } else {
          newPath = this.selectedPath.concat([String(rowMeta.index), col]);
        }
        this.dismissRowContextMenu();
        this.navigateToPath(newPath);
      },
      openRowContextMenu(ev, item) {
        ev.preventDefault();
        if (this._docCloseContext) {
          document.removeEventListener("mousedown", this._docCloseContext, true);
        }
        this.rowContextMenu.item = item;
        this.rowContextMenu.x = ev.clientX;
        this.rowContextMenu.y = ev.clientY;
        this.rowContextMenu.visible = true;
        const self = this;
        this.$nextTick(function () {
          self.clampRowContextMenuPosition();
          document.addEventListener("mousedown", self._docCloseContext, true);
        });
      },
      clampRowContextMenuPosition() {
        const el = this.$refs.rowContextMenuEl;
        if (!el) {
          return;
        }
        const pad = 8;
        let x = this.rowContextMenu.x;
        let y = this.rowContextMenu.y;
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth - pad) {
          x = Math.max(pad, window.innerWidth - rect.width - pad);
        }
        if (rect.bottom > window.innerHeight - pad) {
          y = Math.max(pad, window.innerHeight - rect.height - pad);
        }
        if (x < pad) {
          x = pad;
        }
        if (y < pad) {
          y = pad;
        }
        this.rowContextMenu.x = x;
        this.rowContextMenu.y = y;
      },
      dismissRowContextMenu() {
        if (this._docCloseContext) {
          document.removeEventListener("mousedown", this._docCloseContext, true);
        }
        this.rowContextMenu.visible = false;
        this.rowContextMenu.item = null;
      },
      onRowContextMenuCopy() {
        if (this.rowContextMenu.item != null) {
          this.copyTableRow(this.rowContextMenu.item);
        }
        this.dismissRowContextMenu();
      },
      copyTableRow(item) {
        const text = JSON.stringify(item, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          const self = this;
          navigator.clipboard.writeText(text).then(function () {
            self.showToast("Linha copiada para a area de transferencia.");
          }).catch(function () {
            window.prompt("Copiar linha", text);
          });
        } else {
          window.prompt("Copiar linha", text);
        }
      },
      showToast(message, type) {
        this.toast.message = message;
        this.toast.type = type || "success";
        this.toast.visible = true;
        if (this._toastTimer) {
          clearTimeout(this._toastTimer);
        }
        const self = this;
        this._toastTimer = setTimeout(function () {
          self.toast.visible = false;
        }, 2200);
      },
      escapeTsvCell(value) {
        const txt = value == null ? "" : String(value);
        if (/[\t\r\n"]/.test(txt)) {
          return '"' + txt.replace(/"/g, '""') + '"';
        }
        return txt;
      },
      copyWholeTableAsTsv() {
        if (!this.showTableView || !this.tableColumnKeys.length) {
          return;
        }
        const headers = this.tableColumnKeys.map((col) => this.escapeTsvCell(this.tableHeaderLabel(col)));
        const lines = [headers.join("\t")];
        const rows = this.tableFilteredRowsMeta;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i].item;
          const cells = this.tableColumnKeys.map((col) => this.escapeTsvCell(this.formatTableCellDisplay(row, col)));
          lines.push(cells.join("\t"));
        }
        const tsv = lines.join("\n");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          const self = this;
          navigator.clipboard.writeText(tsv).then(function () {
            self.showToast("Tabela copiada em TSV (" + rows.length + " linhas).");
          }).catch(function () {
            window.prompt("Copiar TSV", tsv);
          });
        } else {
          window.prompt("Copiar TSV", tsv);
        }
      },
      tablePagePrev() {
        if (this.tablePage > 1) {
          this.tablePage -= 1;
        }
      },
      tablePageNext() {
        if (this.tablePage < this.tableTotalPages) {
          this.tablePage += 1;
        }
      },
      tableColPixelWidth(col) {
        const w = this.tableColumnWidths[col];
        return w != null ? w : 140;
      },
      measurePlainTextWidth(text) {
        let el = this._tableMeasureEl;
        if (!el) {
          el = document.createElement("span");
          el.className = "json-data-table-measure";
          el.setAttribute("aria-hidden", "true");
          document.body.appendChild(el);
          this._tableMeasureEl = el;
        }
        el.textContent = text == null ? "" : String(text);
        return el.getBoundingClientRect().width;
      },
      measureColumnContentWidth(col) {
        let maxW = this.measurePlainTextWidth(this.tableHeaderLabel(col) + "  ↕");
        const rows = this.tableFilteredRowsMeta;
        for (let i = 0; i < rows.length; i++) {
          const txt = this.formatTableCellDisplay(rows[i].item, col);
          maxW = Math.max(maxW, this.measurePlainTextWidth(txt));
        }
        return Math.ceil(maxW);
      },
      initTableColumnWidthsFromContent() {
        if (!this.showTableView || !this.tableColumnKeys.length) {
          return;
        }
        const maxAutoCap = 320;
        const pad = 52;
        const next = {};
        const self = this;
        this.tableColumnKeys.forEach(function (col) {
          const measured = self.measureColumnContentWidth(col);
          next[col] = Math.min(Math.max(measured + pad, 72), maxAutoCap);
        });
        this.tableColumnWidths = next;
      },
      autoFitTableColumn(col) {
        if (this.tableColumnKeys.indexOf(col) === -1) {
          return;
        }
        const pad = 56;
        const natural = Math.ceil(this.measureColumnContentWidth(col) + pad);
        const fitMax = Math.min(Math.max(window.innerWidth - 48, 520), 2400);
        const w = Math.min(Math.max(natural, 72), fitMax);
        this.tableColumnWidths = Object.assign({}, this.tableColumnWidths, { [col]: w });
      },
      onColResizeMouseDown(e, col) {
        const startX = e.clientX;
        let startW = this.tableColumnWidths[col];
        if (startW == null) {
          startW = Math.ceil(this.measureColumnContentWidth(col) + 52);
        }
        const self = this;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        const onMove = function (ev) {
          const w = Math.max(48, startW + (ev.clientX - startX));
          self.tableColumnWidths = Object.assign({}, self.tableColumnWidths, { [col]: Math.round(w) });
        };
        const onUp = function () {
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      },
      onColResizeDblClick(e, col) {
        this.autoFitTableColumn(col);
      },
      profileCompatibilityScore(profile) {
        if (!profile || !profile.schemaSignature) return 0;
        if (profile.schemaSignature === this.schemaModel.signature) return 1;
        const current = {};
        (this.schemaModel.schemaKeys || []).forEach((k) => {
          current[k] = true;
        });
        const profileKeys = profile.schemaKeys || [];
        if (!profileKeys.length || !this.schemaModel.schemaKeys.length) return 0;
        let matches = 0;
        profileKeys.forEach((k) => {
          if (current[k]) matches += 1;
        });
        return matches / Math.max(profileKeys.length, this.schemaModel.schemaKeys.length);
      },
      isProfileCompatible(profile) {
        return this.profileCompatibilityScore(profile) >= 0.5;
      },
      loadProfilesFromStorage() {
        try {
          const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
          if (!raw) {
            this.savedProfiles = [];
            return;
          }
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed) ? parsed : [];
          this.savedProfiles = list.map((profile) => this.normalizeProfileRules(profile));
        } catch (err) {
          this.savedProfiles = [];
        }
      },
      normalizeProfileRules(profile) {
        const next = Object.assign({}, profile);
        const rules = this.cloneJson((profile && profile.rules) || {});
        const behaviors = this.normalizeBehaviorRules((profile && profile.behaviors) || {});
        Object.keys(rules).forEach((className) => {
          Object.keys(rules[className] || {}).forEach((propertyName) => {
            const rule = rules[className][propertyName] || {};
            if (typeof rule.manualDateMask !== "string") {
              rule.manualDateMask = "";
            }
            if (!rule.dateFormat) {
              rule.dateFormat = "iso";
            }
            if (typeof rule.enabled !== "boolean") {
              rule.enabled = rule.displayType && rule.displayType !== "auto";
            }
            rules[className][propertyName] = rule;
          });
        });
        next.rules = rules;
        next.behaviors = behaviors;
        return next;
      },
      persistProfilesToStorage() {
        try {
          localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.savedProfiles));
        } catch (err) {
          // no-op
        }
      },
      saveCurrentProfile() {
        const name = this.profileNameInput.trim();
        if (!name) return;
        const now = new Date().toISOString();
        const next = this.savedProfiles.slice();
        const idx = next.findIndex((p) => p.name === name);
        const profile = {
          name: name,
          createdAt: idx >= 0 ? next[idx].createdAt : now,
          updatedAt: now,
          schemaSignature: this.schemaModel.signature,
          schemaKeys: (this.schemaModel.schemaKeys || []).slice(),
          rules: this.cloneJson(this.viewRules),
          behaviors: this.cloneJson(this.behaviorRulesByClass)
        };
        if (idx >= 0) {
          next[idx] = profile;
        } else {
          next.push(profile);
        }
        next.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        this.savedProfiles = next;
        this.persistProfilesToStorage();
      },
      applyProfile(profileName) {
        const profile = this.savedProfiles.find((p) => p.name === profileName);
        if (!profile) return;
        const normalized = this.normalizeProfileRules(profile);
        this.viewRules = this.cloneJson(normalized.rules || {});
        this.behaviorRulesByClass = this.cloneJson(normalized.behaviors || {});
        this.retainOnlyCompatibleRules();
        this.retainOnlyCompatibleBehaviors();
      },
      deleteProfile(profileName) {
        this.savedProfiles = this.savedProfiles.filter((p) => p.name !== profileName);
        this.persistProfilesToStorage();
      },
      escapeNavigationIgnoredTarget(target) {
        if (!target || typeof target.closest !== "function") {
          return false;
        }
        if (target.closest("textarea, select, [contenteditable='true']")) {
          return true;
        }
        const input = target.closest("input");
        if (!input) {
          return false;
        }
        const type = (input.getAttribute("type") || "text").toLowerCase();
        const nonTextTypes = ["button", "checkbox", "radio", "submit", "reset", "file", "hidden", "range", "color"];
        return nonTextTypes.indexOf(type) === -1;
      },
      onGlobalEscapeKeydown(e) {
        if (e.key !== "Escape") {
          return;
        }
        if (this.escapeNavigationIgnoredTarget(e.target)) {
          return;
        }
        if (this.rootDataView === null) {
          return;
        }
        if (this.rowContextMenu.visible) {
          this.dismissRowContextMenu();
          e.preventDefault();
          return;
        }
        if (this.selectedPath.length === 0) {
          return;
        }
        this.navigateToParent();
        e.preventDefault();
      }
    },
    mounted() {
      document.body.classList.add("theme-dark");
      this.loadGlobalSettings();
      this.loadProfilesFromStorage();
      const self = this;
      this._docCloseContext = function (e) {
        const menu = self.$refs.rowContextMenuEl;
        if (menu && menu.contains(e.target)) {
          return;
        }
        self.dismissRowContextMenu();
      };
      this._boundEscapeNav = function (ev) {
        self.onGlobalEscapeKeydown(ev);
      };
      document.addEventListener("keydown", this._boundEscapeNav);
    },
    beforeUnmount() {
      if (this._boundEscapeNav) {
        document.removeEventListener("keydown", this._boundEscapeNav);
      }
      if (this._toastTimer) {
        clearTimeout(this._toastTimer);
      }
      this.dismissRowContextMenu();
      if (this._tableMeasureEl && this._tableMeasureEl.parentNode) {
        this._tableMeasureEl.parentNode.removeChild(this._tableMeasureEl);
      }
    }
  });

  app.mount("#app");
})();
