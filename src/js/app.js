(function () {
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
        selectedPath: [],
        expandedState: {},
        inputPanelCollapsed: false,
        tableViewEnabled: false,
        tablePageSize: 50,
        tablePage: 1,
        tableSearch: "",
        tableSortColumn: null,
        tableSortDir: "asc",
        tableColumnWidths: {}
      };
    },
    computed: {
      inputStatus() {
        return this.rootData === null ? "Aguardando dados" : "JSON carregado";
      },
      themeIcon() {
        return this.theme === "dark" ? "far fa-sun" : "far fa-moon";
      },
      themeTitle() {
        return this.theme === "dark" ? "Trocar para tema claro" : "Trocar para tema escuro";
      },
      currentNode() {
        if (this.rootData === null) return null;
        let value = this.rootData;
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
          return Array.isArray(this.currentNode)
            ? this.currentNode.length
            : Object.keys(this.currentNode).length;
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
        if (this.rootData === null) return "Sem estrutura";
        return this.readableType(this.rootData);
      },
      viewerLevelSummary() {
        if (this.rootData === null) return "Sem estrutura";
        const t = this.readableType(this.currentNode);
        if (Array.isArray(this.currentNode)) {
          return t + " (" + this.currentNode.length + ")";
        }
        return t;
      },
      canUseTableView() {
        return this.rootData !== null && Array.isArray(this.currentNode);
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
        if (this.rootData !== null) {
          visit(this.rootData);
        }
        return result;
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
          if (!Array.isArray(self.currentNode)) {
            self.tableViewEnabled = false;
          } else if (self.showTableView) {
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
          this.selectedPath = [];
          this.expandedState = { "[]": true };
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
          this.jsonError = "JSON invalido: " + error.message;
        }
      },
      clearAll() {
        this.jsonText = "";
        this.jsonError = "";
        this.rootData = null;
        this.selectedPath = [];
        this.expandedState = {};
        this.inputPanelCollapsed = false;
        this.tableViewEnabled = false;
        this.tablePage = 1;
        this.tableSearch = "";
        this.tableSortColumn = null;
        this.tableSortDir = "asc";
        this.tableColumnWidths = {};
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
        this.selectedPath = path.slice();
        this.ensurePathExpanded(path);
      },
      navigateToParent() {
        if (this.selectedPath.length === 0) return;
        this.selectedPath = this.selectedPath.slice(0, -1);
        this.ensurePathExpanded(this.selectedPath);
      },
      navigateToPath(path) {
        this.selectedPath = path.slice();
        this.ensurePathExpanded(path);
      },
      toggleExpand(path) {
        const key = JSON.stringify(path);
        this.expandedState[key] = !this.isPathExpanded(path);
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
      collapseInputPanel() {
        this.inputPanelCollapsed = true;
      },
      expandInputPanel() {
        this.inputPanelCollapsed = false;
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
              return k + ":" + self.cellSearchSnippet(item[k]);
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
      tableHeaderLabel(col) {
        if (col === "__primitive") {
          return "valor";
        }
        return col;
      },
      copyTableRow(item) {
        const text = JSON.stringify(item, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(function () {
            window.prompt("Copiar linha", text);
          });
        } else {
          window.prompt("Copiar linha", text);
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
        if (w != null) {
          return w;
        }
        return 140;
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
        let maxW = this.measurePlainTextWidth(this.tableHeaderLabel(col) + "  \u2195");
        const rows = this.tableFilteredRowsMeta;
        for (let i = 0; i < rows.length; i++) {
          const raw = this.getCellRaw(rows[i].item, col);
          const txt = this.formatTableCell(raw);
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
      }
    },
    mounted() {
      document.body.classList.add("theme-dark");
    },
    beforeUnmount() {
      if (this._tableMeasureEl && this._tableMeasureEl.parentNode) {
        this._tableMeasureEl.parentNode.removeChild(this._tableMeasureEl);
      }
    }
  });

  app.mount("#app");
})();
