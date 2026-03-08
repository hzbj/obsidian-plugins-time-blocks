import type { DayRecord, TimeBlocksData } from './types';
import { BLOCKS_PER_DAY } from './constants';
import type TimeBlocksPlugin from '../main';

export class DataManager {
    private plugin: TimeBlocksPlugin;

    constructor(plugin: TimeBlocksPlugin) {
        this.plugin = plugin;
    }

    get data(): TimeBlocksData {
        return this.plugin.data;
    }

    getOrCreateRecord(date: string): DayRecord {
        if (!this.data.records[date]) {
            this.data.records[date] = {
                date,
                blocks: new Array(BLOCKS_PER_DAY).fill(null),
            };
        }
        return this.data.records[date];
    }

    assignCategory(date: string, indices: number[], categoryId: string): void {
        const record = this.getOrCreateRecord(date);
        for (const i of indices) {
            if (i >= 0 && i < BLOCKS_PER_DAY) {
                record.blocks[i] = categoryId;
            }
        }
        this.save();
    }

    clearBlocks(date: string, indices: number[]): void {
        const record = this.getOrCreateRecord(date);
        for (const i of indices) {
            if (i >= 0 && i < BLOCKS_PER_DAY) {
                record.blocks[i] = null;
            }
        }
        this.save();
    }

    getCategoryColor(categoryId: string): string | null {
        const cat = this.data.categories.find(c => c.id === categoryId);
        return cat ? cat.color : null;
    }

    getStats(dates: string[]): CategoryStat[] {
        const countMap: Record<string, number> = {};
        let totalFilled = 0;

        for (const date of dates) {
            const record = this.data.records[date];
            if (!record) continue;
            for (const catId of record.blocks) {
                if (catId) {
                    countMap[catId] = (countMap[catId] || 0) + 1;
                    totalFilled++;
                }
            }
        }

        const stats: CategoryStat[] = [];
        for (const cat of this.data.categories) {
            const blocks = countMap[cat.id] || 0;
            if (blocks === 0) continue;
            stats.push({
                categoryId: cat.id,
                name: cat.name,
                color: cat.color,
                blocks,
                hours: blocks * 0.5,
                percentage: totalFilled > 0 ? (blocks / totalFilled) * 100 : 0,
            });
        }

        // Include uncategorized entries (deleted categories)
        for (const [catId, blocks] of Object.entries(countMap)) {
            if (!this.data.categories.find(c => c.id === catId)) {
                stats.push({
                    categoryId: catId,
                    name: '未分类',
                    color: '#999999',
                    blocks,
                    hours: blocks * 0.5,
                    percentage: totalFilled > 0 ? (blocks / totalFilled) * 100 : 0,
                });
            }
        }

        return stats.sort((a, b) => b.blocks - a.blocks);
    }

    getWeekDates(date: string): string[] {
        const d = new Date(date);
        const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ...
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(d);
        monday.setDate(d.getDate() + mondayOffset);

        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            const y = day.getFullYear();
            const m = String(day.getMonth() + 1).padStart(2, '0');
            const dd = String(day.getDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${dd}`);
        }
        return dates;
    }

    private save(): void {
        this.plugin.savePluginData();
    }
}

export interface CategoryStat {
    categoryId: string;
    name: string;
    color: string;
    blocks: number;
    hours: number;
    percentage: number;
}
