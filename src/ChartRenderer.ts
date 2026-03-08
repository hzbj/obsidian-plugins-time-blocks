import type { MarkdownPostProcessorContext } from 'obsidian';
import type TimeBlocksPlugin from '../main';
import type { CategoryStat } from './DataManager';

type ChartMode = 'bar' | 'pie';
type RangeMode = 'day' | 'week';

export class ChartRenderer {
    private plugin: TimeBlocksPlugin;

    constructor(plugin: TimeBlocksPlugin) {
        this.plugin = plugin;
    }

    process(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
        const initialDate = this.parseDate(source) || this.getTodayString();
        const container = el.createDiv({ cls: 'tb-chart-container' });
        this.renderFull(container, initialDate, 'day', 'bar');
    }

    private renderFull(container: HTMLElement, date: string, range: RangeMode, chart: ChartMode): void {
        container.empty();
        container.dataset.date = date;
        container.dataset.range = range;
        container.dataset.chart = chart;

        this.renderHeader(container, date, range, chart);

        const dates = range === 'week'
            ? this.plugin.dataManager.getWeekDates(date)
            : [date];
        const stats = this.plugin.dataManager.getStats(dates);

        const body = container.createDiv({ cls: 'tb-chart-body' });

        if (stats.length === 0) {
            body.createDiv({ cls: 'tb-chart-empty', text: range === 'week' ? '本周暂无数据' : '当天暂无数据' });
        } else if (chart === 'bar') {
            this.renderBarChart(body, stats, range);
        } else {
            this.renderPieChart(body, stats, range);
        }
    }

    private renderHeader(container: HTMLElement, date: string, range: RangeMode, chart: ChartMode): void {
        const header = container.createDiv({ cls: 'tb-chart-header' });

        // Date navigation
        const navGroup = header.createDiv({ cls: 'tb-chart-nav' });

        const prevBtn = navGroup.createEl('button', { cls: 'tb-nav-btn', text: '\u25C0' });
        prevBtn.addEventListener('click', () => {
            const delta = range === 'week' ? -7 : -1;
            const newDate = this.addDays(date, delta);
            this.renderFull(container, newDate, range, chart);
        });

        const dateInput = navGroup.createEl('input', { cls: 'tb-date-input' });
        dateInput.type = 'date';
        dateInput.value = date;
        dateInput.addEventListener('change', () => {
            if (dateInput.value) {
                this.renderFull(container, dateInput.value, range, chart);
            }
        });

        const nextBtn = navGroup.createEl('button', { cls: 'tb-nav-btn', text: '\u25B6' });
        nextBtn.addEventListener('click', () => {
            const delta = range === 'week' ? 7 : 1;
            const newDate = this.addDays(date, delta);
            this.renderFull(container, newDate, range, chart);
        });

        const todayBtn = navGroup.createEl('button', { cls: 'tb-today-btn', text: '今天' });
        todayBtn.addEventListener('click', () => {
            this.renderFull(container, this.getTodayString(), range, chart);
        });

        // Toggle buttons row
        const toggleRow = header.createDiv({ cls: 'tb-chart-toggles' });

        // Range toggle
        const rangeGroup = toggleRow.createDiv({ cls: 'tb-toggle-group' });
        const dayBtn = rangeGroup.createEl('button', {
            cls: `tb-chart-toggle ${range === 'day' ? 'tb-toggle-active' : ''}`,
            text: '当天',
        });
        dayBtn.addEventListener('click', () => {
            this.renderFull(container, date, 'day', chart);
        });
        const weekBtn = rangeGroup.createEl('button', {
            cls: `tb-chart-toggle ${range === 'week' ? 'tb-toggle-active' : ''}`,
            text: '本周',
        });
        weekBtn.addEventListener('click', () => {
            this.renderFull(container, date, 'week', chart);
        });

        // Chart type toggle
        const chartGroup = toggleRow.createDiv({ cls: 'tb-toggle-group' });
        const barBtn = chartGroup.createEl('button', {
            cls: `tb-chart-toggle ${chart === 'bar' ? 'tb-toggle-active' : ''}`,
            text: '条形图',
        });
        barBtn.addEventListener('click', () => {
            this.renderFull(container, date, range, 'bar');
        });
        const pieBtn = chartGroup.createEl('button', {
            cls: `tb-chart-toggle ${chart === 'pie' ? 'tb-toggle-active' : ''}`,
            text: '饼状图',
        });
        pieBtn.addEventListener('click', () => {
            this.renderFull(container, date, range, 'pie');
        });
    }

    // ===== Bar Chart =====

    private renderBarChart(container: HTMLElement, stats: CategoryStat[], range: RangeMode): void {
        const totalHours = stats.reduce((sum, s) => sum + s.hours, 0);
        const maxHours = Math.max(...stats.map(s => s.hours));

        const summary = container.createDiv({ cls: 'tb-chart-summary' });
        summary.textContent = `${range === 'week' ? '本周' : '当天'}共投入 ${totalHours.toFixed(1)} 小时`;

        const chart = container.createDiv({ cls: 'tb-bar-chart' });

        for (const stat of stats) {
            const row = chart.createDiv({ cls: 'tb-bar-row' });

            const label = row.createDiv({ cls: 'tb-bar-label' });
            const dot = label.createSpan({ cls: 'tb-color-dot' });
            dot.style.backgroundColor = stat.color;
            label.createSpan({ text: stat.name });

            const barWrap = row.createDiv({ cls: 'tb-bar-wrap' });
            const bar = barWrap.createDiv({ cls: 'tb-bar' });
            const widthPct = maxHours > 0 ? (stat.hours / maxHours) * 100 : 0;
            bar.style.width = `${widthPct}%`;
            bar.style.backgroundColor = stat.color;

            const value = row.createDiv({ cls: 'tb-bar-value' });
            value.textContent = `${stat.hours.toFixed(1)}h (${stat.percentage.toFixed(0)}%)`;
        }
    }

    // ===== Pie Chart =====

    private renderPieChart(container: HTMLElement, stats: CategoryStat[], range: RangeMode): void {
        const totalHours = stats.reduce((sum, s) => sum + s.hours, 0);

        const summary = container.createDiv({ cls: 'tb-chart-summary' });
        summary.textContent = `${range === 'week' ? '本周' : '当天'}共投入 ${totalHours.toFixed(1)} 小时`;

        const pieWrap = container.createDiv({ cls: 'tb-pie-wrap' });

        // SVG pie chart
        const size = 160;
        const cx = size / 2;
        const cy = size / 2;
        const radius = 60;

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.classList.add('tb-pie-svg');

        const totalBlocks = stats.reduce((sum, s) => sum + s.blocks, 0);

        if (totalBlocks > 0) {
            let startAngle = -90; // Start from top

            for (const stat of stats) {
                const sliceAngle = (stat.blocks / totalBlocks) * 360;

                if (sliceAngle >= 359.99) {
                    // Full circle
                    const circle = document.createElementNS(svgNS, 'circle');
                    circle.setAttribute('cx', String(cx));
                    circle.setAttribute('cy', String(cy));
                    circle.setAttribute('r', String(radius));
                    circle.setAttribute('fill', stat.color);
                    svg.appendChild(circle);
                } else {
                    const path = document.createElementNS(svgNS, 'path');
                    const endAngle = startAngle + sliceAngle;
                    const largeArc = sliceAngle > 180 ? 1 : 0;

                    const x1 = cx + radius * Math.cos((Math.PI / 180) * startAngle);
                    const y1 = cy + radius * Math.sin((Math.PI / 180) * startAngle);
                    const x2 = cx + radius * Math.cos((Math.PI / 180) * endAngle);
                    const y2 = cy + radius * Math.sin((Math.PI / 180) * endAngle);

                    const d = [
                        `M ${cx} ${cy}`,
                        `L ${x1} ${y1}`,
                        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                        'Z',
                    ].join(' ');

                    path.setAttribute('d', d);
                    path.setAttribute('fill', stat.color);
                    svg.appendChild(path);

                    startAngle = endAngle;
                }
            }
        }

        pieWrap.appendChild(svg);

        // Legend next to pie
        const legend = pieWrap.createDiv({ cls: 'tb-pie-legend' });
        for (const stat of stats) {
            const item = legend.createDiv({ cls: 'tb-pie-legend-item' });
            const dot = item.createSpan({ cls: 'tb-color-dot' });
            dot.style.backgroundColor = stat.color;
            item.createSpan({ text: `${stat.name}  ${stat.hours.toFixed(1)}h (${stat.percentage.toFixed(0)}%)` });
        }
    }

    // ===== Utilities =====

    private parseDate(source: string): string | null {
        const trimmed = source.trim();
        if (!trimmed) return null;
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
