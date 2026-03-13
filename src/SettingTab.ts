import { App, PluginSettingTab, Setting } from 'obsidian';
import type TimeBlocksPlugin from '../main';

export class SettingTab extends PluginSettingTab {
    plugin: TimeBlocksPlugin;

    constructor(app: App, plugin: TimeBlocksPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // ===== 显示设置 =====
        containerEl.createEl('h2', { text: '显示设置' });

        new Setting(containerEl)
            .setName('时间块高度')
            .setDesc(`当前: ${this.plugin.data.settings.blockHeight}px（范围 10-60）`)
            .addSlider((slider) =>
                slider
                    .setLimits(10, 60, 2)
                    .setValue(this.plugin.data.settings.blockHeight)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.data.settings.blockHeight = value;
                        await this.plugin.savePluginData();
                    })
            );

        new Setting(containerEl)
            .setName('自动刷新')
            .setDesc('数据文件被外部修改时（如同步、AI写入），自动重新加载并刷新视图')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.data.settings.autoRefresh)
                    .onChange(async (value) => {
                        this.plugin.data.settings.autoRefresh = value;
                        await this.plugin.savePluginData();
                    })
            );

        // ===== 类别管理 =====
        containerEl.createEl('h2', { text: '类别管理' });

        // Existing categories
        this.plugin.data.categories.forEach((cat, index) => {
            const s = new Setting(containerEl)
                .setName(cat.name)
                .addText((text) =>
                    text
                        .setPlaceholder('类别名称')
                        .setValue(cat.name)
                        .onChange(async (value) => {
                            this.plugin.data.categories[index].name = value;
                            await this.plugin.savePluginData();
                        })
                )
                .addColorPicker((cp) =>
                    cp.setValue(cat.color).onChange(async (value) => {
                        this.plugin.data.categories[index].color = value;
                        await this.plugin.savePluginData();
                    })
                )
                .addButton((btn) =>
                    btn
                        .setButtonText('删除')
                        .setWarning()
                        .onClick(async () => {
                            this.plugin.data.categories.splice(index, 1);
                            await this.plugin.savePluginData();
                            this.display();
                        })
                );
        });

        // Add new category
        containerEl.createEl('h3', { text: '添加新类别' });

        let newName = '';
        let newColor = '#E6A23C';

        const addSetting = new Setting(containerEl)
            .addText((text) =>
                text.setPlaceholder('类别名称').onChange((value) => {
                    newName = value;
                })
            )
            .addColorPicker((cp) =>
                cp.setValue(newColor).onChange((value) => {
                    newColor = value;
                })
            )
            .addButton((btn) =>
                btn.setButtonText('添加').setCta().onClick(async () => {
                    if (!newName.trim()) return;
                    const id = newName.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
                    this.plugin.data.categories.push({
                        id,
                        name: newName.trim(),
                        color: newColor,
                    });
                    await this.plugin.savePluginData();
                    this.display();
                })
            );
    }
}
