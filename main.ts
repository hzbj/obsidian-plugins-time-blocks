import { Plugin } from 'obsidian';
import type { TimeBlocksData, TimeBlocksSyncData, LocalSettings } from './src/types';
import { DEFAULT_DATA, DEFAULT_SETTINGS, DEFAULT_SYNC_DATA, DEFAULT_LOCAL_SETTINGS, DEFAULT_CATEGORIES, VAULT_DATA_FILE } from './src/constants';
import { DataManager } from './src/DataManager';
import { TimeBlocksRenderer } from './src/TimeBlocksRenderer';
import { ChartRenderer } from './src/ChartRenderer';
import { SettingTab } from './src/SettingTab';

export default class TimeBlocksPlugin extends Plugin {
    data: TimeBlocksData = { ...DEFAULT_DATA };
    dataManager: DataManager = new DataManager(this);
    private renderer: TimeBlocksRenderer = new TimeBlocksRenderer(this);
    private chartRenderer: ChartRenderer = new ChartRenderer(this);

    private syncData: TimeBlocksSyncData = { ...DEFAULT_SYNC_DATA, records: {}, categories: [...DEFAULT_CATEGORIES] };
    private localSettings: LocalSettings = { ...DEFAULT_LOCAL_SETTINGS, settings: { ...DEFAULT_SETTINGS } };
    private isSaving = false;

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

        // 监听 vault 文件变化，外部同步修改后自动重新加载数据并刷新视图
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file.path === VAULT_DATA_FILE && !this.isSaving) {
                    this.reloadSyncData();
                }
            })
        );
    }

    async loadPluginData(): Promise<void> {
        // 1. 加载本地设置（.obsidian/plugins/time-blocks/data.json）
        const saved = await this.loadData();
        let oldRecords: Record<string, any> | null = null;
        let oldCategories: any[] | null = null;

        if (saved) {
            this.localSettings = {
                settings: { ...DEFAULT_SETTINGS, ...saved.settings },
                migrated: saved.migrated ?? false,
            };
            // 保留旧数据以备迁移
            if (saved.records && Object.keys(saved.records).length > 0) {
                oldRecords = saved.records;
            }
            if (saved.categories && saved.categories.length > 0) {
                oldCategories = saved.categories;
            }
        } else {
            this.localSettings = {
                settings: { ...DEFAULT_SETTINGS },
                migrated: false,
            };
        }

        // 2. 加载 vault 文件（time-blocks-data.json）
        await this.loadSyncData();

        // 3. 迁移旧数据（如果需要）
        if (!this.localSettings.migrated && (oldRecords || oldCategories)) {
            await this.migrateData(oldRecords, oldCategories);
        }

        // 如果是全新安装（无旧数据，无 vault 文件），直接标记为已迁移
        if (!this.localSettings.migrated && !oldRecords && !oldCategories) {
            this.localSettings.migrated = true;
            await this.saveLocalSettings();
        }

        // 4. 拼装 this.data，使用引用保持同步
        this.assembleData();
    }

    private async loadSyncData(): Promise<void> {
        try {
            const exists = await this.app.vault.adapter.exists(VAULT_DATA_FILE);
            if (exists) {
                const raw = await this.app.vault.adapter.read(VAULT_DATA_FILE);
                const parsed = JSON.parse(raw);
                this.syncData = {
                    version: parsed.version ?? 1,
                    records: parsed.records ?? {},
                    categories: parsed.categories ?? [...DEFAULT_CATEGORIES],
                };
                return;
            }
        } catch (e) {
            console.error('[time-blocks] Failed to load vault data file:', e);
        }
        // 文件不存在或解析失败，使用默认值
        this.syncData = {
            version: 1,
            records: {},
            categories: [...DEFAULT_CATEGORIES],
        };
    }

    private async migrateData(
        oldRecords: Record<string, any> | null,
        oldCategories: any[] | null,
    ): Promise<void> {
        console.log('[time-blocks] Migrating data from .obsidian/ to vault file...');

        // 合并 records：vault 优先
        if (oldRecords) {
            for (const [date, record] of Object.entries(oldRecords)) {
                if (!this.syncData.records[date]) {
                    this.syncData.records[date] = record;
                }
            }
        }

        // 合并 categories：vault 优先，旧数据中 vault 没有的追加
        if (oldCategories) {
            const existingIds = new Set(this.syncData.categories.map(c => c.id));
            for (const cat of oldCategories) {
                if (!existingIds.has(cat.id)) {
                    this.syncData.categories.push(cat);
                }
            }
        }

        // 保存合并后的数据到 vault 文件
        await this.saveSyncData();

        // 标记已迁移并保存本地设置
        this.localSettings.migrated = true;
        await this.saveLocalSettings();

        console.log('[time-blocks] Migration completed.');
    }

    private assembleData(): void {
        // 使用引用，使得对 this.data.records 等的修改直接反映到 syncData/localSettings
        this.data = {
            records: this.syncData.records,
            categories: this.syncData.categories,
            settings: this.localSettings.settings,
        };
    }

    private async saveLocalSettings(): Promise<void> {
        await this.saveData({
            settings: this.localSettings.settings,
            migrated: this.localSettings.migrated,
        });
    }

    private async saveSyncData(): Promise<void> {
        this.isSaving = true;
        try {
            const json = JSON.stringify(this.syncData, null, 2);
            await this.app.vault.adapter.write(VAULT_DATA_FILE, json);
        } finally {
            setTimeout(() => { this.isSaving = false; }, 500);
        }
    }

    private async reloadSyncData(): Promise<void> {
        await this.loadSyncData();
        this.assembleData();
        // 触发所有已打开的 markdown 视图重新渲染
        this.app.workspace.iterateAllLeaves((leaf) => {
            const view = leaf.view;
            if (view.getViewType() === 'markdown') {
                (view as any).previewMode?.rerender?.(true);
            }
        });
    }

    async savePluginData(): Promise<void> {
        await Promise.all([
            this.saveLocalSettings(),
            this.saveSyncData(),
        ]);
    }
}
