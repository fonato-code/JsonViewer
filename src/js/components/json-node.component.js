(function () {
  window.JsonNodeComponent = {
    name: "JsonNode",
    props: {
      node: { type: null, required: true },
      nodeKey: { type: String, required: true },
      path: { type: Array, required: true },
      expandedState: { type: Object, required: true },
      activePath: { type: Array, required: true },
      valuePreviewResolver: { type: Function, default: null },
      valueClassResolver: { type: Function, default: null }
    },
    methods: {
      nodePath(childKey) {
        return this.path.concat(childKey);
      },
      pathText(path) {
        return JSON.stringify(path);
      },
      isExpanded(path) {
        return this.expandedState[this.pathText(path)] === true;
      },
      isActive(path) {
        return this.pathText(path) === this.pathText(this.activePath);
      },
      emitToggle(path) {
        this.$emit("toggle", path);
      },
      emitSelect(path) {
        this.$emit("select", path);
      },
      childrenEntries(value) {
        if (Array.isArray(value)) {
          return value.map(function (item, index) {
            return [String(index), item];
          });
        }
        return Object.entries(value);
      },
      valueClass(value) {
        if (typeof this.valueClassResolver === "function") {
          return this.valueClassResolver(this.path, value);
        }
        if (typeof value === "string") return "value-string";
        if (typeof value === "number") return "value-number";
        if (typeof value === "boolean") return "value-bool";
        if (value === null) return "value-null";
        return "";
      },
      valuePreview(value) {
        if (typeof this.valuePreviewResolver === "function") {
          return this.valuePreviewResolver(this.path, value);
        }
        if (Array.isArray(value)) return "[" + value.length + "]";
        if (value && typeof value === "object") return "{" + Object.keys(value).length + "}";
        if (typeof value === "string") return '"' + value + '"';
        return String(value);
      }
    },
    computed: {
      isContainer() {
        return this.node !== null && typeof this.node === "object";
      }
    },
    template: `
      <div class="tree-node">
        <div class="tree-line" :class="{active: isActive(path)}" @click="emitSelect(path)">
          <span v-if="isContainer" @click.stop="emitToggle(path)" class="tree-node-toggle text-secondary">
            <i :class="isExpanded(path) ? 'far fa-chevron-down' : 'far fa-chevron-right'"></i>
          </span>
          <span v-else class="tree-node-toggle text-secondary"><i class="far fa-circle fa-xs"></i></span>
          <span class="key">{{ nodeKey }}</span>
          <span class="text-secondary">:</span>
          <span :class="valueClass(node)">{{ valuePreview(node) }}</span>
        </div>
        <div v-if="isContainer && isExpanded(path)">
          <json-node
            v-for="([childKey, childValue]) in childrenEntries(node)"
            :key="pathText(nodePath(childKey))"
            :node="childValue"
            :node-key="childKey"
            :path="nodePath(childKey)"
            :expanded-state="expandedState"
            :active-path="activePath"
            :value-preview-resolver="valuePreviewResolver"
            :value-class-resolver="valueClassResolver"
            @toggle="$emit('toggle', $event)"
            @select="$emit('select', $event)"
          ></json-node>
        </div>
      </div>
    `
  };
})();
