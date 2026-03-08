import { Plugin } from 'obsidian';
import type { TimeBlocksData } from './src/types';
import { DEFAULT_DATA, DEFAULT_SETTINGS } from './src/constants';
import { DataManager } from './src/DataManager';
import { TimeBlocksRenderer } from './src/TimeBlocksRenderer';
import { ChartRenderer } from './src/ChartRenderer';
import { SettingTab } from './src/SettingTab';

export default class TimeBlocksPlugin extends Plugin {
    data: TimeBlocksData = { ...DEFAULT_DATA };
    dataManager: DataManager = new DataManager(this);
    private renderer: TimeBlocksRenderer = new TimeBlocksRenderer(this);
    private chartRenderer: ChartRenderer = new ChartRenderer(this);

    async onload(): Promise<void> {
        await this.loadPluginData();

        this.dataManager = new DataManager(this);
        this.renderer = new TimeBlocksRenderer(this);
        this.chartRenderer = new ChartRenderer(this);

        this.registerMarkdownCodeBlockProcessor(
            'time-blocks',
            (source, el, ctx) => this.renderer.process(source, el, ctx)
        );

        this.registerMarkdownCodeBlockProcessor(
            'time-blocks-chart',
            (source, el, ctx) => this.chartRenderer.process(source, el, ctx)
        );

        this.addSettingTab(new SettingTab(this.app, this));

        this.addRibbonIcon('clock', '插入时间块', () => {
            const leaf = this.app.workspace.getMostRecentLeaf();
            if (leaf && leaf.view && 'editor' in leaf.view) {
                const editor = (leaf.view as any).editor;
                if (editor) {
                    editor.replaceSelection('```time-blocks\n```\n');
                }
            }
        });
    }

    async loadPluginData(): Promise<void> {
        const saved = await this.loadData();
        if (saved) {
            this.data = {
                records: saved.records ?? {},
                categories: saved.categories ?? [...DEFAULT_DATA.categories],
                settings: { ...DEFAULT_SETTINGS, ...saved.settings },
            };
        } else {
            this.data = {
                records: {},
                categories: [...DEFAULT_DATA.categories],
                settings: { ...DEFAULT_SETTINGS },
            };
        }
    }

    async savePluginData(): Promise<void> {
        await this.saveData(this.data);
    }
}
