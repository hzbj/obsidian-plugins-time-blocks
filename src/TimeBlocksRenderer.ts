import type { MarkdownPostProcessorContext } from 'obsidian';
import type TimeBlocksPlugin from '../main';
import { BLOCKS_PER_ROW, ROWS_COUNT } from './constants';
import { SelectionManager } from './SelectionManager';
import { CategoryMenu } from './CategoryMenu';

export class TimeBlocksRenderer {
    private plugin: TimeBlocksPlugin;
    private timeIndicatorTimers = new Map<HTMLElement, number>();

    constructor(plugin: TimeBlocksPlugin) {
        this.plugin = plugin;
    }

    process(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
        const initialDate = this.parseDate(source) || this.getTodayString();
        const container = el.createDiv({ cls: 'tb-container' });
        container.style.setProperty('--tb-block-height', `${this.plugin.data.settings.blockHeight}px`);
        this.renderFull(container, initialDate, ctx);
    }

    private renderFull(container: HTMLElement, date: string, ctx?: MarkdownPostProcessorContext): void {
        this.clearTimeIndicatorTimer(container);
        container.empty();
        container.dataset.date = date;

        this.renderHeader(container, date, ctx);
        this.renderGrid(container, date);
        this.renderLegend(container);
        this.renderActions(container, ctx);

        const grid = container.querySelector('.tb-grid') as HTMLElement;
        if (grid) {
            this.setupTimeIndicator(container, grid, date);
        }

        const categoryMenu = new CategoryMenu(container, this.plugin, () => {
            this.refreshGrid(container);
        });
        new SelectionManager(container, (indices: Set<number>) => {
            categoryMenu.show(container, indices);
        });
    }

    private renderHeader(container: HTMLElement, date: string, ctx?: MarkdownPostProcessorContext): void {
        const header = container.createDiv({ cls: 'tb-header' });

        const prevBtn = header.createEl('button', { cls: 'tb-nav-btn', text: '\u25C0' });
        prevBtn.addEventListener('click', () => {
            const cur = container.dataset.date || this.getTodayString();
            const newDate = this.addDays(cur, -1);
            this.renderFull(container, newDate);
        });

        const dateDisplay = header.createEl('input', { cls: 'tb-date-input' });
        dateDisplay.type = 'date';
        dateDisplay.value = date;
        dateDisplay.addEventListener('change', () => {
            if (dateDisplay.value) {
                this.renderFull(container, dateDisplay.value);
            }
        });

        const nextBtn = header.createEl('button', { cls: 'tb-nav-btn', text: '\u25B6' });
        nextBtn.addEventListener('click', () => {
            const cur = container.dataset.date || this.getTodayString();
            const newDate = this.addDays(cur, 1);
            this.renderFull(container, newDate);
        });

        const todayBtn = header.createEl('button', { cls: 'tb-today-btn', text: '今天' });
        todayBtn.addEventListener('click', () => {
            this.renderFull(container, this.getTodayString());
        });
    }

    private renderGrid(container: HTMLElement, date: string): void {
        const record = this.plugin.dataManager.getOrCreateRecord(date);
        const grid = this.createGridElement(container, record);
        container.appendChild(grid);
    }

    private createGridElement(container: HTMLElement, record: { blocks: (string | null)[] }): HTMLElement {
        const grid = createDiv({ cls: 'tb-grid' });

        for (let row = 0; row < ROWS_COUNT; row++) {
            const rowEl = grid.createDiv({ cls: 'tb-row' });
            const hour = row * 2;
            const label = `${String(hour).padStart(2, '0')}:00`;
            rowEl.createSpan({ cls: 'tb-time-label', text: label });

            for (let col = 0; col < BLOCKS_PER_ROW; col++) {
                const index = row * BLOCKS_PER_ROW + col;
                const block = rowEl.createDiv({ cls: 'tb-block' });
                block.dataset.index = String(index);

                const catId = record.blocks[index];
                if (catId) {
                    const color = this.plugin.dataManager.getCategoryColor(catId);
                    if (color) {
                        block.style.backgroundColor = color;
                        block.dataset.category = catId;
                        block.classList.add('tb-filled');
                    }
                }

                // Tooltip: 显示时间范围
                const startHour = Math.floor(index / 2);
                const startMin = (index % 2) * 30;
                const endIndex = index + 1;
                const endHour = Math.floor(endIndex / 2);
                const endMin = (endIndex % 2) * 30;
                block.title = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')} - ${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
            }
        }
        return grid;
    }

    private renderLegend(container: HTMLElement): void {
        const legend = this.createLegendElement(container);
        container.appendChild(legend);
    }

    private createLegendElement(container: HTMLElement): HTMLElement {
        const legend = createDiv({ cls: 'tb-legend' });
        for (const cat of this.plugin.data.categories) {
            const item = legend.createSpan({ cls: 'tb-legend-item' });
            const dot = item.createSpan({ cls: 'tb-color-dot' });
            dot.style.backgroundColor = cat.color;
            item.createSpan({ text: cat.name });
        }
        return legend;
    }

    private renderActions(container: HTMLElement, ctx?: MarkdownPostProcessorContext): void {
        const actions = container.createDiv({ cls: 'tb-actions' });
        const insertChartBtn = actions.createEl('button', {
            cls: 'tb-action-btn',
            text: '\u2795 \u63D2\u5165\u56FE\u8868',
        });
        insertChartBtn.addEventListener('click', () => {
            const { workspace } = this.plugin.app;
            const leaf = workspace.getMostRecentLeaf();
            if (leaf && leaf.view && 'editor' in leaf.view) {
                const editor = (leaf.view as any).editor;
                if (editor) {
                    // Find the end of the current code block and insert chart after it
                    const cursor = editor.getCursor();
                    const lineCount = editor.lineCount();
                    let insertLine = cursor.line;
                    // Search forward for the closing ``` of the current time-blocks block
                    for (let i = cursor.line; i < lineCount; i++) {
                        const lineText = editor.getLine(i);
                        if (lineText.trim() === '```' && i > 0) {
                            insertLine = i;
                            break;
                        }
                    }
                    const insertPos = { line: insertLine + 1, ch: 0 };
                    editor.replaceRange('\n```time-blocks-chart\n```\n', insertPos);
                }
            }
        });
    }

    private refreshGrid(container: HTMLElement): void {
        this.clearTimeIndicatorTimer(container);
        const date = container.dataset.date || this.getTodayString();
        const oldGrid = container.querySelector('.tb-grid');
        const oldLegend = container.querySelector('.tb-legend');
        // 记住插入位置：在 .tb-actions 之前
        const actions = container.querySelector('.tb-actions');
        if (oldGrid) oldGrid.remove();
        if (oldLegend) oldLegend.remove();

        // 重新创建 grid 和 legend，插入到 actions 之前以保持顺序
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

        this.setupTimeIndicator(container, grid, date);

        // Re-bind interactions
        const categoryMenu = new CategoryMenu(container, this.plugin, () => {
            this.refreshGrid(container);
        });
        new SelectionManager(container, (indices: Set<number>) => {
            categoryMenu.show(container, indices);
        });
    }

    private clearTimeIndicatorTimer(container: HTMLElement): void {
        const timer = this.timeIndicatorTimers.get(container);
        if (timer !== undefined) {
            window.clearInterval(timer);
            this.timeIndicatorTimers.delete(container);
        }
    }

    private setupTimeIndicator(container: HTMLElement, grid: HTMLElement, date: string): void {
        if (date !== this.getTodayString()) return;

        this.updateTimeIndicator(grid);

        const timer = window.setInterval(() => {
            if (!grid.isConnected) {
                this.clearTimeIndicatorTimer(container);
                return;
            }
            if (container.dataset.date !== this.getTodayString()) {
                this.clearTimeIndicatorTimer(container);
                return;
            }
            this.updateTimeIndicator(grid);
        }, 60000);

        this.timeIndicatorTimers.set(container, timer);
        this.plugin.registerInterval(timer);
    }

    private updateTimeIndicator(grid: HTMLElement): void {
        let indicator = grid.querySelector('.tb-time-indicator') as HTMLElement;
        if (!indicator) {
            indicator = createDiv({ cls: 'tb-time-indicator' });
            grid.appendChild(indicator);
        }

        const now = new Date();
        const totalMinutes = now.getHours() * 60 + now.getMinutes();
        const blockHeight = this.plugin.data.settings.blockHeight;
        const gap = 4; // matches --tb-gap
        const rowIndex = Math.floor(totalMinutes / 120);
        const minutesIntoRow = totalMinutes % 120;
        const fractionInRow = minutesIntoRow / 120;
        const y = rowIndex * (blockHeight + gap) + fractionInRow * blockHeight;

        indicator.style.top = `${y}px`;
    }

    private parseDate(source: string): string | null {
        const trimmed = source.trim();
        if (!trimmed) return null;
        // Support "date: YYYY-MM-DD" or plain "YYYY-MM-DD"
        const match = trimmed.match(/(?:date\s*:\s*)?(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : null;
    }

    private getTodayString(): string {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private addDays(dateStr: string, days: number): string {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + days);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}
