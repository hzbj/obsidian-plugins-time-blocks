var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TimeBlocksPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/constants.ts
var DEFAULT_SETTINGS = {
  blockHeight: 20
};
var DEFAULT_CATEGORIES = [
  { id: "work", name: "\u5DE5\u4F5C", color: "#4A90D9" },
  { id: "study", name: "\u5B66\u4E60", color: "#67C23A" },
  { id: "rest", name: "\u4F11\u606F", color: "#909399" }
];
var DEFAULT_DATA = {
  records: {},
  categories: [...DEFAULT_CATEGORIES],
  settings: { ...DEFAULT_SETTINGS }
};
var DEFAULT_SYNC_DATA = {
  version: 1,
  records: {},
  categories: [...DEFAULT_CATEGORIES]
};
var DEFAULT_LOCAL_SETTINGS = {
  settings: { ...DEFAULT_SETTINGS },
  migrated: false
};
var VAULT_DATA_FILE = "time-blocks-data.json";
var BLOCKS_PER_DAY = 48;
var BLOCKS_PER_ROW = 4;
var ROWS_COUNT = 12;

// src/DataManager.ts
var DataManager = class {
  constructor(plugin) {
    this.plugin = plugin;
  }
  get data() {
    return this.plugin.data;
  }
  getOrCreateRecord(date) {
    if (!this.data.records[date]) {
      this.data.records[date] = {
        date,
        blocks: new Array(BLOCKS_PER_DAY).fill(null)
      };
    }
    return this.data.records[date];
  }
  assignCategory(date, indices, categoryId) {
    const record = this.getOrCreateRecord(date);
    for (const i of indices) {
      if (i >= 0 && i < BLOCKS_PER_DAY) {
        record.blocks[i] = categoryId;
      }
    }
    this.save();
  }
  clearBlocks(date, indices) {
    const record = this.getOrCreateRecord(date);
    for (const i of indices) {
      if (i >= 0 && i < BLOCKS_PER_DAY) {
        record.blocks[i] = null;
      }
    }
    this.save();
  }
  getCategoryColor(categoryId) {
    const cat = this.data.categories.find((c) => c.id === categoryId);
    return cat ? cat.color : null;
  }
  getStats(dates) {
    const countMap = {};
    let totalFilled = 0;
    for (const date of dates) {
      const record = this.data.records[date];
      if (!record)
        continue;
      for (const catId of record.blocks) {
        if (catId) {
          countMap[catId] = (countMap[catId] || 0) + 1;
          totalFilled++;
        }
      }
    }
    const stats = [];
    for (const cat of this.data.categories) {
      const blocks = countMap[cat.id] || 0;
      if (blocks === 0)
        continue;
      stats.push({
        categoryId: cat.id,
        name: cat.name,
        color: cat.color,
        blocks,
        hours: blocks * 0.5,
        percentage: totalFilled > 0 ? blocks / totalFilled * 100 : 0
      });
    }
    for (const [catId, blocks] of Object.entries(countMap)) {
      if (!this.data.categories.find((c) => c.id === catId)) {
        stats.push({
          categoryId: catId,
          name: "\u672A\u5206\u7C7B",
          color: "#999999",
          blocks,
          hours: blocks * 0.5,
          percentage: totalFilled > 0 ? blocks / totalFilled * 100 : 0
        });
      }
    }
    return stats.sort((a, b) => b.blocks - a.blocks);
  }
  getWeekDates(date) {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const y = day.getFullYear();
      const m = String(day.getMonth() + 1).padStart(2, "0");
      const dd = String(day.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${dd}`);
    }
    return dates;
  }
  save() {
    this.plugin.savePluginData();
  }
};

// src/SelectionManager.ts
var SelectionManager = class {
  constructor(container, onSelectionDone) {
    this.isSelecting = false;
    this.startIndex = -1;
    this.selectedIndices = /* @__PURE__ */ new Set();
    this.container = container;
    this.onSelectionDone = onSelectionDone;
    this.handleMouseDown = this.onMouseDown.bind(this);
    this.handleMouseMove = this.onMouseMove.bind(this);
    this.handleMouseUp = this.onMouseUp.bind(this);
    this.handleTouchStart = this.onTouchStart.bind(this);
    this.handleTouchMove = this.onTouchMove.bind(this);
    this.handleTouchEnd = this.onTouchEnd.bind(this);
    this.bindEvents();
  }
  bindEvents() {
    const grid = this.container.querySelector(".tb-grid");
    if (!grid)
      return;
    grid.addEventListener("mousedown", this.handleMouseDown);
    grid.addEventListener("mousemove", this.handleMouseMove);
    grid.addEventListener("mouseup", this.handleMouseUp);
    grid.addEventListener("mouseleave", this.handleMouseUp);
    grid.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    grid.addEventListener("touchmove", this.handleTouchMove, { passive: false });
    grid.addEventListener("touchend", this.handleTouchEnd);
    grid.addEventListener("touchcancel", this.handleTouchEnd);
  }
  // ===== Mouse events =====
  onMouseDown(e) {
    const block = this.getBlockFromEvent(e);
    if (!block)
      return;
    e.preventDefault();
    this.startSelection(block);
  }
  onMouseMove(e) {
    if (!this.isSelecting)
      return;
    const block = this.getBlockFromEvent(e);
    if (block) {
      this.extendSelection(block);
    }
  }
  onMouseUp(e) {
    if (!this.isSelecting)
      return;
    this.finishSelection();
  }
  // ===== Touch events =====
  onTouchStart(e) {
    if (e.touches.length !== 1)
      return;
    const touch = e.touches[0];
    const block = this.getBlockFromPoint(touch.clientX, touch.clientY);
    if (!block)
      return;
    e.preventDefault();
    this.startSelection(block);
  }
  onTouchMove(e) {
    if (!this.isSelecting || e.touches.length !== 1)
      return;
    e.preventDefault();
    const touch = e.touches[0];
    const block = this.getBlockFromPoint(touch.clientX, touch.clientY);
    if (block) {
      this.extendSelection(block);
    }
  }
  onTouchEnd(e) {
    if (!this.isSelecting)
      return;
    this.finishSelection();
  }
  // ===== Core selection logic =====
  startSelection(block) {
    this.clearVisual();
    const index = parseInt(block.dataset.index || "-1", 10);
    if (index < 0)
      return;
    this.isSelecting = true;
    this.startIndex = index;
    this.selectedIndices = /* @__PURE__ */ new Set([index]);
    this.updateVisual();
  }
  extendSelection(block) {
    const index = parseInt(block.dataset.index || "-1", 10);
    if (index < 0)
      return;
    const min = Math.min(this.startIndex, index);
    const max = Math.max(this.startIndex, index);
    this.selectedIndices = /* @__PURE__ */ new Set();
    for (let i = min; i <= max; i++) {
      this.selectedIndices.add(i);
    }
    this.updateVisual();
  }
  finishSelection() {
    this.isSelecting = false;
    if (this.selectedIndices.size > 0) {
      this.onSelectionDone(new Set(this.selectedIndices));
    }
  }
  // ===== Visual helpers =====
  updateVisual() {
    const blocks = this.container.querySelectorAll(".tb-block");
    blocks.forEach((b) => {
      const el = b;
      const idx = parseInt(el.dataset.index || "-1", 10);
      if (this.selectedIndices.has(idx)) {
        el.classList.add("tb-selected");
      } else {
        el.classList.remove("tb-selected");
      }
    });
  }
  clearVisual() {
    this.selectedIndices.clear();
    this.container.querySelectorAll(".tb-block.tb-selected").forEach((b) => {
      b.classList.remove("tb-selected");
    });
  }
  // ===== Utilities =====
  getBlockFromEvent(e) {
    const target = e.target;
    return target.closest(".tb-block");
  }
  getBlockFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el)
      return null;
    return el.closest(".tb-block");
  }
};

// src/CategoryMenu.ts
var CategoryMenu = class {
  constructor(container, plugin, onUpdate) {
    this.menuEl = null;
    this.outsideClickHandler = null;
    this.container = container;
    this.plugin = plugin;
    this.onUpdate = onUpdate;
  }
  show(container, indices) {
    this.hide();
    const date = container.dataset.date;
    if (!date || indices.size === 0)
      return;
    const minIndex = Math.min(...indices);
    const anchor = container.querySelector(`.tb-block[data-index="${minIndex}"]`);
    if (!anchor)
      return;
    const rect = anchor.getBoundingClientRect();
    this.menuEl = document.body.createDiv({ cls: "tb-category-menu" });
    for (const cat of this.plugin.data.categories) {
      const item = this.menuEl.createDiv({ cls: "tb-menu-item" });
      const dot = item.createSpan({ cls: "tb-menu-dot" });
      dot.style.backgroundColor = cat.color;
      item.createSpan({ text: cat.name });
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.plugin.dataManager.assignCategory(date, Array.from(indices), cat.id);
        this.hide();
        this.onUpdate();
      });
    }
    const eraseItem = this.menuEl.createDiv({ cls: "tb-menu-item tb-menu-erase" });
    eraseItem.createSpan({ text: "\u2715 \u6E05\u9664" });
    eraseItem.addEventListener("click", (e) => {
      e.stopPropagation();
      this.plugin.dataManager.clearBlocks(date, Array.from(indices));
      this.hide();
      this.onUpdate();
    });
    this.menuEl.style.left = `${rect.left}px`;
    this.menuEl.style.top = `${rect.bottom + 6}px`;
    requestAnimationFrame(() => {
      if (!this.menuEl)
        return;
      const menuRect = this.menuEl.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        this.menuEl.style.left = `${window.innerWidth - menuRect.width - 8}px`;
      }
      if (menuRect.bottom > window.innerHeight) {
        this.menuEl.style.top = `${rect.top - menuRect.height - 6}px`;
      }
    });
    setTimeout(() => {
      this.outsideClickHandler = (e) => {
        if (this.menuEl && !this.menuEl.contains(e.target)) {
          this.hide();
        }
      };
      document.addEventListener("click", this.outsideClickHandler);
    }, 50);
  }
  hide() {
    if (this.menuEl) {
      this.menuEl.remove();
      this.menuEl = null;
    }
    if (this.outsideClickHandler) {
      document.removeEventListener("click", this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    this.container.querySelectorAll(".tb-block.tb-selected").forEach((b) => {
      b.classList.remove("tb-selected");
    });
  }
};

// src/TimeBlocksRenderer.ts
var TimeBlocksRenderer = class {
  constructor(plugin) {
    this.plugin = plugin;
  }
  process(source, el, ctx) {
    const initialDate = this.parseDate(source) || this.getTodayString();
    const container = el.createDiv({ cls: "tb-container" });
    container.style.setProperty("--tb-block-height", `${this.plugin.data.settings.blockHeight}px`);
    this.renderFull(container, initialDate, ctx);
  }
  renderFull(container, date, ctx) {
    container.empty();
    container.dataset.date = date;
    this.renderHeader(container, date, ctx);
    this.renderGrid(container, date);
    this.renderLegend(container);
    this.renderActions(container, ctx);
    const categoryMenu = new CategoryMenu(container, this.plugin, () => {
      this.refreshGrid(container);
    });
    new SelectionManager(container, (indices) => {
      categoryMenu.show(container, indices);
    });
  }
  renderHeader(container, date, ctx) {
    const header = container.createDiv({ cls: "tb-header" });
    const prevBtn = header.createEl("button", { cls: "tb-nav-btn", text: "\u25C0" });
    prevBtn.addEventListener("click", () => {
      const cur = container.dataset.date || this.getTodayString();
      const newDate = this.addDays(cur, -1);
      this.renderFull(container, newDate);
    });
    const dateDisplay = header.createEl("input", { cls: "tb-date-input" });
    dateDisplay.type = "date";
    dateDisplay.value = date;
    dateDisplay.addEventListener("change", () => {
      if (dateDisplay.value) {
        this.renderFull(container, dateDisplay.value);
      }
    });
    const nextBtn = header.createEl("button", { cls: "tb-nav-btn", text: "\u25B6" });
    nextBtn.addEventListener("click", () => {
      const cur = container.dataset.date || this.getTodayString();
      const newDate = this.addDays(cur, 1);
      this.renderFull(container, newDate);
    });
    const todayBtn = header.createEl("button", { cls: "tb-today-btn", text: "\u4ECA\u5929" });
    todayBtn.addEventListener("click", () => {
      this.renderFull(container, this.getTodayString());
    });
  }
  renderGrid(container, date) {
    const record = this.plugin.dataManager.getOrCreateRecord(date);
    const grid = this.createGridElement(container, record);
    container.appendChild(grid);
  }
  createGridElement(container, record) {
    const grid = createDiv({ cls: "tb-grid" });
    for (let row = 0; row < ROWS_COUNT; row++) {
      const rowEl = grid.createDiv({ cls: "tb-row" });
      const hour = row * 2;
      const label = `${String(hour).padStart(2, "0")}:00`;
      rowEl.createSpan({ cls: "tb-time-label", text: label });
      for (let col = 0; col < BLOCKS_PER_ROW; col++) {
        const index = row * BLOCKS_PER_ROW + col;
        const block = rowEl.createDiv({ cls: "tb-block" });
        block.dataset.index = String(index);
        const catId = record.blocks[index];
        if (catId) {
          const color = this.plugin.dataManager.getCategoryColor(catId);
          if (color) {
            block.style.backgroundColor = color;
            block.dataset.category = catId;
            block.classList.add("tb-filled");
          }
        }
        const startHour = Math.floor(index / 2);
        const startMin = index % 2 * 30;
        const endIndex = index + 1;
        const endHour = Math.floor(endIndex / 2);
        const endMin = endIndex % 2 * 30;
        block.title = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")} - ${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
      }
    }
    return grid;
  }
  renderLegend(container) {
    const legend = this.createLegendElement(container);
    container.appendChild(legend);
  }
  createLegendElement(container) {
    const legend = createDiv({ cls: "tb-legend" });
    for (const cat of this.plugin.data.categories) {
      const item = legend.createSpan({ cls: "tb-legend-item" });
      const dot = item.createSpan({ cls: "tb-color-dot" });
      dot.style.backgroundColor = cat.color;
      item.createSpan({ text: cat.name });
    }
    return legend;
  }
  renderActions(container, ctx) {
    const actions = container.createDiv({ cls: "tb-actions" });
    const insertChartBtn = actions.createEl("button", {
      cls: "tb-action-btn",
      text: "\u2795 \u63D2\u5165\u56FE\u8868"
    });
    insertChartBtn.addEventListener("click", () => {
      const { workspace } = this.plugin.app;
      const leaf = workspace.getMostRecentLeaf();
      if (leaf && leaf.view && "editor" in leaf.view) {
        const editor = leaf.view.editor;
        if (editor) {
          const cursor = editor.getCursor();
          const lineCount = editor.lineCount();
          let insertLine = cursor.line;
          for (let i = cursor.line; i < lineCount; i++) {
            const lineText = editor.getLine(i);
            if (lineText.trim() === "```" && i > 0) {
              insertLine = i;
              break;
            }
          }
          const insertPos = { line: insertLine + 1, ch: 0 };
          editor.replaceRange("\n```time-blocks-chart\n```\n", insertPos);
        }
      }
    });
  }
  refreshGrid(container) {
    const date = container.dataset.date || this.getTodayString();
    const oldGrid = container.querySelector(".tb-grid");
    const oldLegend = container.querySelector(".tb-legend");
    const actions = container.querySelector(".tb-actions");
    if (oldGrid)
      oldGrid.remove();
    if (oldLegend)
      oldLegend.remove();
    const record = this.plugin.dataManager.getOrCreateRecord(date);
    const grid = this.createGridElement(container, record);
    const legend = this.createLegendElement(container);
    if (actions) {
      container.insertBefore(grid, actions);
      container.insertBefore(legend, actions);
    } else {
      container.appendChild(grid);
      container.appendChild(legend);
    }
    const categoryMenu = new CategoryMenu(container, this.plugin, () => {
      this.refreshGrid(container);
    });
    new SelectionManager(container, (indices) => {
      categoryMenu.show(container, indices);
    });
  }
  parseDate(source) {
    const trimmed = source.trim();
    if (!trimmed)
      return null;
    const match = trimmed.match(/(?:date\s*:\s*)?(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  getTodayString() {
    const d = /* @__PURE__ */ new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
};

// src/ChartRenderer.ts
var ChartRenderer = class {
  constructor(plugin) {
    this.plugin = plugin;
  }
  process(source, el, ctx) {
    const initialDate = this.parseDate(source) || this.getTodayString();
    const container = el.createDiv({ cls: "tb-chart-container" });
    this.renderFull(container, initialDate, "day", "bar");
  }
  renderFull(container, date, range, chart) {
    container.empty();
    container.dataset.date = date;
    container.dataset.range = range;
    container.dataset.chart = chart;
    this.renderHeader(container, date, range, chart);
    const dates = range === "week" ? this.plugin.dataManager.getWeekDates(date) : [date];
    const stats = this.plugin.dataManager.getStats(dates);
    const body = container.createDiv({ cls: "tb-chart-body" });
    if (stats.length === 0) {
      body.createDiv({ cls: "tb-chart-empty", text: range === "week" ? "\u672C\u5468\u6682\u65E0\u6570\u636E" : "\u5F53\u5929\u6682\u65E0\u6570\u636E" });
    } else if (chart === "bar") {
      this.renderBarChart(body, stats, range);
    } else {
      this.renderPieChart(body, stats, range);
    }
  }
  renderHeader(container, date, range, chart) {
    const header = container.createDiv({ cls: "tb-chart-header" });
    const navGroup = header.createDiv({ cls: "tb-chart-nav" });
    const prevBtn = navGroup.createEl("button", { cls: "tb-nav-btn", text: "\u25C0" });
    prevBtn.addEventListener("click", () => {
      const delta = range === "week" ? -7 : -1;
      const newDate = this.addDays(date, delta);
      this.renderFull(container, newDate, range, chart);
    });
    const dateInput = navGroup.createEl("input", { cls: "tb-date-input" });
    dateInput.type = "date";
    dateInput.value = date;
    dateInput.addEventListener("change", () => {
      if (dateInput.value) {
        this.renderFull(container, dateInput.value, range, chart);
      }
    });
    const nextBtn = navGroup.createEl("button", { cls: "tb-nav-btn", text: "\u25B6" });
    nextBtn.addEventListener("click", () => {
      const delta = range === "week" ? 7 : 1;
      const newDate = this.addDays(date, delta);
      this.renderFull(container, newDate, range, chart);
    });
    const todayBtn = navGroup.createEl("button", { cls: "tb-today-btn", text: "\u4ECA\u5929" });
    todayBtn.addEventListener("click", () => {
      this.renderFull(container, this.getTodayString(), range, chart);
    });
    const toggleRow = header.createDiv({ cls: "tb-chart-toggles" });
    const rangeGroup = toggleRow.createDiv({ cls: "tb-toggle-group" });
    const dayBtn = rangeGroup.createEl("button", {
      cls: `tb-chart-toggle ${range === "day" ? "tb-toggle-active" : ""}`,
      text: "\u5F53\u5929"
    });
    dayBtn.addEventListener("click", () => {
      this.renderFull(container, date, "day", chart);
    });
    const weekBtn = rangeGroup.createEl("button", {
      cls: `tb-chart-toggle ${range === "week" ? "tb-toggle-active" : ""}`,
      text: "\u672C\u5468"
    });
    weekBtn.addEventListener("click", () => {
      this.renderFull(container, date, "week", chart);
    });
    const chartGroup = toggleRow.createDiv({ cls: "tb-toggle-group" });
    const barBtn = chartGroup.createEl("button", {
      cls: `tb-chart-toggle ${chart === "bar" ? "tb-toggle-active" : ""}`,
      text: "\u6761\u5F62\u56FE"
    });
    barBtn.addEventListener("click", () => {
      this.renderFull(container, date, range, "bar");
    });
    const pieBtn = chartGroup.createEl("button", {
      cls: `tb-chart-toggle ${chart === "pie" ? "tb-toggle-active" : ""}`,
      text: "\u997C\u72B6\u56FE"
    });
    pieBtn.addEventListener("click", () => {
      this.renderFull(container, date, range, "pie");
    });
  }
  // ===== Bar Chart =====
  renderBarChart(container, stats, range) {
    const totalHours = stats.reduce((sum, s) => sum + s.hours, 0);
    const maxHours = Math.max(...stats.map((s) => s.hours));
    const summary = container.createDiv({ cls: "tb-chart-summary" });
    summary.textContent = `${range === "week" ? "\u672C\u5468" : "\u5F53\u5929"}\u5171\u6295\u5165 ${totalHours.toFixed(1)} \u5C0F\u65F6`;
    const chart = container.createDiv({ cls: "tb-bar-chart" });
    for (const stat of stats) {
      const row = chart.createDiv({ cls: "tb-bar-row" });
      const label = row.createDiv({ cls: "tb-bar-label" });
      const dot = label.createSpan({ cls: "tb-color-dot" });
      dot.style.backgroundColor = stat.color;
      label.createSpan({ text: stat.name });
      const barWrap = row.createDiv({ cls: "tb-bar-wrap" });
      const bar = barWrap.createDiv({ cls: "tb-bar" });
      const widthPct = maxHours > 0 ? stat.hours / maxHours * 100 : 0;
      bar.style.width = `${widthPct}%`;
      bar.style.backgroundColor = stat.color;
      const value = row.createDiv({ cls: "tb-bar-value" });
      value.textContent = `${stat.hours.toFixed(1)}h (${stat.percentage.toFixed(0)}%)`;
    }
  }
  // ===== Pie Chart =====
  renderPieChart(container, stats, range) {
    const totalHours = stats.reduce((sum, s) => sum + s.hours, 0);
    const summary = container.createDiv({ cls: "tb-chart-summary" });
    summary.textContent = `${range === "week" ? "\u672C\u5468" : "\u5F53\u5929"}\u5171\u6295\u5165 ${totalHours.toFixed(1)} \u5C0F\u65F6`;
    const pieWrap = container.createDiv({ cls: "tb-pie-wrap" });
    const size = 160;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 60;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.classList.add("tb-pie-svg");
    const totalBlocks = stats.reduce((sum, s) => sum + s.blocks, 0);
    if (totalBlocks > 0) {
      let startAngle = -90;
      for (const stat of stats) {
        const sliceAngle = stat.blocks / totalBlocks * 360;
        if (sliceAngle >= 359.99) {
          const circle = document.createElementNS(svgNS, "circle");
          circle.setAttribute("cx", String(cx));
          circle.setAttribute("cy", String(cy));
          circle.setAttribute("r", String(radius));
          circle.setAttribute("fill", stat.color);
          svg.appendChild(circle);
        } else {
          const path = document.createElementNS(svgNS, "path");
          const endAngle = startAngle + sliceAngle;
          const largeArc = sliceAngle > 180 ? 1 : 0;
          const x1 = cx + radius * Math.cos(Math.PI / 180 * startAngle);
          const y1 = cy + radius * Math.sin(Math.PI / 180 * startAngle);
          const x2 = cx + radius * Math.cos(Math.PI / 180 * endAngle);
          const y2 = cy + radius * Math.sin(Math.PI / 180 * endAngle);
          const d = [
            `M ${cx} ${cy}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            "Z"
          ].join(" ");
          path.setAttribute("d", d);
          path.setAttribute("fill", stat.color);
          svg.appendChild(path);
          startAngle = endAngle;
        }
      }
    }
    pieWrap.appendChild(svg);
    const legend = pieWrap.createDiv({ cls: "tb-pie-legend" });
    for (const stat of stats) {
      const item = legend.createDiv({ cls: "tb-pie-legend-item" });
      const dot = item.createSpan({ cls: "tb-color-dot" });
      dot.style.backgroundColor = stat.color;
      item.createSpan({ text: `${stat.name}  ${stat.hours.toFixed(1)}h (${stat.percentage.toFixed(0)}%)` });
    }
  }
  // ===== Utilities =====
  parseDate(source) {
    const trimmed = source.trim();
    if (!trimmed)
      return null;
    const match = trimmed.match(/(?:date\s*:\s*)?(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  getTodayString() {
    const d = /* @__PURE__ */ new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
};

// src/SettingTab.ts
var import_obsidian = require("obsidian");
var SettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "\u663E\u793A\u8BBE\u7F6E" });
    new import_obsidian.Setting(containerEl).setName("\u65F6\u95F4\u5757\u9AD8\u5EA6").setDesc(`\u5F53\u524D: ${this.plugin.data.settings.blockHeight}px\uFF08\u8303\u56F4 10-60\uFF09`).addSlider(
      (slider) => slider.setLimits(10, 60, 2).setValue(this.plugin.data.settings.blockHeight).setDynamicTooltip().onChange(async (value) => {
        this.plugin.data.settings.blockHeight = value;
        await this.plugin.savePluginData();
      })
    );
    containerEl.createEl("h2", { text: "\u7C7B\u522B\u7BA1\u7406" });
    this.plugin.data.categories.forEach((cat, index) => {
      const s = new import_obsidian.Setting(containerEl).setName(cat.name).addText(
        (text) => text.setPlaceholder("\u7C7B\u522B\u540D\u79F0").setValue(cat.name).onChange(async (value) => {
          this.plugin.data.categories[index].name = value;
          await this.plugin.savePluginData();
        })
      ).addColorPicker(
        (cp) => cp.setValue(cat.color).onChange(async (value) => {
          this.plugin.data.categories[index].color = value;
          await this.plugin.savePluginData();
        })
      ).addButton(
        (btn) => btn.setButtonText("\u5220\u9664").setWarning().onClick(async () => {
          this.plugin.data.categories.splice(index, 1);
          await this.plugin.savePluginData();
          this.display();
        })
      );
    });
    containerEl.createEl("h3", { text: "\u6DFB\u52A0\u65B0\u7C7B\u522B" });
    let newName = "";
    let newColor = "#E6A23C";
    const addSetting = new import_obsidian.Setting(containerEl).addText(
      (text) => text.setPlaceholder("\u7C7B\u522B\u540D\u79F0").onChange((value) => {
        newName = value;
      })
    ).addColorPicker(
      (cp) => cp.setValue(newColor).onChange((value) => {
        newColor = value;
      })
    ).addButton(
      (btn) => btn.setButtonText("\u6DFB\u52A0").setCta().onClick(async () => {
        if (!newName.trim())
          return;
        const id = newName.trim().toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
        this.plugin.data.categories.push({
          id,
          name: newName.trim(),
          color: newColor
        });
        await this.plugin.savePluginData();
        this.display();
      })
    );
  }
};

// main.ts
var TimeBlocksPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.data = { ...DEFAULT_DATA };
    this.dataManager = new DataManager(this);
    this.renderer = new TimeBlocksRenderer(this);
    this.chartRenderer = new ChartRenderer(this);
    this.syncData = { ...DEFAULT_SYNC_DATA, records: {}, categories: [...DEFAULT_CATEGORIES] };
    this.localSettings = { ...DEFAULT_LOCAL_SETTINGS, settings: { ...DEFAULT_SETTINGS } };
  }
  async onload() {
    await this.loadPluginData();
    this.dataManager = new DataManager(this);
    this.renderer = new TimeBlocksRenderer(this);
    this.chartRenderer = new ChartRenderer(this);
    this.registerMarkdownCodeBlockProcessor(
      "time-blocks",
      (source, el, ctx) => this.renderer.process(source, el, ctx)
    );
    this.registerMarkdownCodeBlockProcessor(
      "time-blocks-chart",
      (source, el, ctx) => this.chartRenderer.process(source, el, ctx)
    );
    this.addSettingTab(new SettingTab(this.app, this));
    this.addRibbonIcon("clock", "\u63D2\u5165\u65F6\u95F4\u5757", () => {
      const leaf = this.app.workspace.getMostRecentLeaf();
      if (leaf && leaf.view && "editor" in leaf.view) {
        const editor = leaf.view.editor;
        if (editor) {
          editor.replaceSelection("```time-blocks\n```\n");
        }
      }
    });
  }
  async loadPluginData() {
    var _a;
    const saved = await this.loadData();
    let oldRecords = null;
    let oldCategories = null;
    if (saved) {
      this.localSettings = {
        settings: { ...DEFAULT_SETTINGS, ...saved.settings },
        migrated: (_a = saved.migrated) != null ? _a : false
      };
      if (saved.records && Object.keys(saved.records).length > 0) {
        oldRecords = saved.records;
      }
      if (saved.categories && saved.categories.length > 0) {
        oldCategories = saved.categories;
      }
    } else {
      this.localSettings = {
        settings: { ...DEFAULT_SETTINGS },
        migrated: false
      };
    }
    await this.loadSyncData();
    if (!this.localSettings.migrated && (oldRecords || oldCategories)) {
      await this.migrateData(oldRecords, oldCategories);
    }
    if (!this.localSettings.migrated && !oldRecords && !oldCategories) {
      this.localSettings.migrated = true;
      await this.saveLocalSettings();
    }
    this.assembleData();
  }
  async loadSyncData() {
    var _a, _b, _c;
    try {
      const exists = await this.app.vault.adapter.exists(VAULT_DATA_FILE);
      if (exists) {
        const raw = await this.app.vault.adapter.read(VAULT_DATA_FILE);
        const parsed = JSON.parse(raw);
        this.syncData = {
          version: (_a = parsed.version) != null ? _a : 1,
          records: (_b = parsed.records) != null ? _b : {},
          categories: (_c = parsed.categories) != null ? _c : [...DEFAULT_CATEGORIES]
        };
        return;
      }
    } catch (e) {
      console.error("[time-blocks] Failed to load vault data file:", e);
    }
    this.syncData = {
      version: 1,
      records: {},
      categories: [...DEFAULT_CATEGORIES]
    };
  }
  async migrateData(oldRecords, oldCategories) {
    console.log("[time-blocks] Migrating data from .obsidian/ to vault file...");
    if (oldRecords) {
      for (const [date, record] of Object.entries(oldRecords)) {
        if (!this.syncData.records[date]) {
          this.syncData.records[date] = record;
        }
      }
    }
    if (oldCategories) {
      const existingIds = new Set(this.syncData.categories.map((c) => c.id));
      for (const cat of oldCategories) {
        if (!existingIds.has(cat.id)) {
          this.syncData.categories.push(cat);
        }
      }
    }
    await this.saveSyncData();
    this.localSettings.migrated = true;
    await this.saveLocalSettings();
    console.log("[time-blocks] Migration completed.");
  }
  assembleData() {
    this.data = {
      records: this.syncData.records,
      categories: this.syncData.categories,
      settings: this.localSettings.settings
    };
  }
  async saveLocalSettings() {
    await this.saveData({
      settings: this.localSettings.settings,
      migrated: this.localSettings.migrated
    });
  }
  async saveSyncData() {
    const json = JSON.stringify(this.syncData, null, 2);
    await this.app.vault.adapter.write(VAULT_DATA_FILE, json);
  }
  async savePluginData() {
    await Promise.all([
      this.saveLocalSettings(),
      this.saveSyncData()
    ]);
  }
};
