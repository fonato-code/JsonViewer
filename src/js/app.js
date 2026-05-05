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
        inputPanelCollapsed: false
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
      inputColumnClass() {
        if (this.rootData !== null && this.inputPanelCollapsed) {
          return "col-auto input-rail-wrap";
        }
        return "col-lg-5";
      },
      viewerColumnClass() {
        if (this.rootData !== null && this.inputPanelCollapsed) {
          return "col min-w-0";
        }
        return "col-lg-7";
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
        if (this.rootData !== null) {
          this.inputPanelCollapsed = true;
        }
      },
      expandInputPanel() {
        this.inputPanelCollapsed = false;
      }
    },
    mounted() {
      document.body.classList.add("theme-dark");
    }
  });

  app.mount("#app");
})();
