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
      valueClassResolver: { type: Function, default: null },
      valueTitleResolver: { type: Function, default: null },
      valueLinkResolver: { type: Function, default: null },
      behaviorResolver: { type: Function, default: null },
      behaviorIconResolver: { type: Function, default: null }
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
      },
      behaviorIconClass(behavior) {
        if (typeof this.behaviorIconResolver === "function") {
          return this.behaviorIconResolver(behavior, this.node);
        }
        return "far fa-bolt";
      },
      emitRunBehavior(behavior) {
        this.$emit("run-behavior", { behavior: behavior, node: this.node, path: this.path });
      },
      emitContextMenu(ev) {
        this.$emit("context-menu", { event: ev, path: this.path, nodeKey: this.nodeKey, node: this.node });
      },
      emitOpenJwt(token) {
        this.$emit("open-jwt", { token: token, path: this.path.slice() });
      },
      emitOpenDataUri(uri) {
        this.$emit("open-data-uri", { dataUri: uri, path: this.path.slice() });
      }
    },
    computed: {
      isContainer() {
        return this.node !== null && typeof this.node === "object";
      },
      nodeBehaviors() {
        if (typeof this.behaviorResolver !== "function") {
          return [];
        }
        const list = this.behaviorResolver(this.path, this.node);
        return Array.isArray(list) ? list : [];
      },
      valueLineTitle() {
        if (this.isContainer) {
          return undefined;
        }
        if (typeof this.valueTitleResolver !== "function") {
          return undefined;
        }
        const t = this.valueTitleResolver(this.path, this.node);
        if (t == null || t === "") {
          return undefined;
        }
        return String(t);
      },
      valueLinkInfo() {
        if (this.isContainer) {
          return null;
        }
        if (typeof this.valueLinkResolver !== "function") {
          return null;
        }
        const info = this.valueLinkResolver(this.path, this.node);
        if (!info) {
          return null;
        }
        if (info.kind === "jwt" && info.rawToken) {
          return info;
        }
        if (info.kind === "data-uri" && info.rawDataUri) {
          return info;
        }
        if (info.href) {
          return Object.assign({ kind: "external" }, info);
        }
        return null;
      }
    },
    template: `
      <div class="tree-node">
        <div class="tree-line" :class="{active: isActive(path)}" @click="emitSelect(path)" @contextmenu.prevent="emitContextMenu($event)">
          <span v-if="isContainer" @click.stop="emitToggle(path)" class="tree-node-toggle text-secondary">
            <i :class="isExpanded(path) ? 'far fa-chevron-down' : 'far fa-chevron-right'"></i>
          </span>
          <span v-else class="tree-node-toggle text-secondary"><i class="far fa-circle fa-xs"></i></span>
          <span class="key">{{ nodeKey }}</span>
          <span class="text-secondary">:</span>
          <span class="tree-value-cell" :title="valueLineTitle">
            <a v-if="valueLinkInfo && valueLinkInfo.kind === 'external'" :href="valueLinkInfo.href" target="_blank"
              rel="noopener noreferrer" class="value-link" :class="valueClass(node)" @click.stop>{{ valueLinkInfo.label }}</a>
            <button v-else-if="valueLinkInfo && valueLinkInfo.kind === 'jwt'" type="button" class="jwt-inline-link"
              :class="valueClass(node)" @click.stop="emitOpenJwt(valueLinkInfo.rawToken)">{{ valueLinkInfo.label }}</button>
            <button v-else-if="valueLinkInfo && valueLinkInfo.kind === 'data-uri'" type="button" class="data-uri-inline-link"
              :class="valueClass(node)" @click.stop="emitOpenDataUri(valueLinkInfo.rawDataUri)">{{ valueLinkInfo.label }}</button>
            <span v-else :class="valueClass(node)">{{ valuePreview(node) }}</span>
          </span>
          <span v-if="nodeBehaviors.length" class="tree-line-actions ms-auto" @click.stop>
            <button
              v-for="behavior in nodeBehaviors"
              :key="'node-bhv-' + pathText(path) + '-' + behavior.id"
              type="button"
              :class="['btn', 'btn-xs', 'table-row-behavior-btn', 'tree-row-behavior-btn', behavior.type === 'pieChart' ? 'btn-outline-warning' : behavior.type === 'timeline' ? 'btn-outline-primary' : 'btn-outline-info']"
              @click.stop="emitRunBehavior(behavior)"
              :title="behavior.name"
            >
              <i :class="behaviorIconClass(behavior)"></i>
            </button>
          </span>
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
            :value-title-resolver="valueTitleResolver"
            :value-link-resolver="valueLinkResolver"
            :behavior-resolver="behaviorResolver"
            :behavior-icon-resolver="behaviorIconResolver"
            @toggle="$emit('toggle', $event)"
            @select="$emit('select', $event)"
            @run-behavior="$emit('run-behavior', $event)"
            @open-jwt="$emit('open-jwt', $event)"
            @open-data-uri="$emit('open-data-uri', $event)"
            @context-menu="$emit('context-menu', $event)"
          ></json-node>
        </div>
      </div>
    `
  };
})();
