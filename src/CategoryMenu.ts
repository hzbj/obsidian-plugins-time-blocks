import type TimeBlocksPlugin from '../main';

export class CategoryMenu {
    private container: HTMLElement;
    private plugin: TimeBlocksPlugin;
    private onUpdate: () => void;
    private menuEl: HTMLElement | null = null;
    private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

    constructor(container: HTMLElement, plugin: TimeBlocksPlugin, onUpdate: () => void) {
        this.container = container;
        this.plugin = plugin;
        this.onUpdate = onUpdate;
    }

    show(container: HTMLElement, indices: Set<number>): void {
        this.hide();

        const date = container.dataset.date;
        if (!date || indices.size === 0) return;

        // Find the first selected block to anchor the menu
        const minIndex = Math.min(...indices);
        const anchor = container.querySelector(`.tb-block[data-index="${minIndex}"]`);
        if (!anchor) return;

        const rect = anchor.getBoundingClientRect();

        // Create menu
        this.menuEl = document.body.createDiv({ cls: 'tb-category-menu' });

        // Category items
        for (const cat of this.plugin.data.categories) {
            const item = this.menuEl.createDiv({ cls: 'tb-menu-item' });
            const dot = item.createSpan({ cls: 'tb-menu-dot' });
            dot.style.backgroundColor = cat.color;
            item.createSpan({ text: cat.name });
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.plugin.dataManager.assignCategory(date, Array.from(indices), cat.id);
                this.hide();
                this.onUpdate();
            });
        }

        // Erase item
        const eraseItem = this.menuEl.createDiv({ cls: 'tb-menu-item tb-menu-erase' });
        eraseItem.createSpan({ text: '\u2715 \u6E05\u9664' });
        eraseItem.addEventListener('click', (e) => {
            e.stopPropagation();
            this.plugin.dataManager.clearBlocks(date, Array.from(indices));
            this.hide();
            this.onUpdate();
        });

        // Position the menu
        this.menuEl.style.left = `${rect.left}px`;
        this.menuEl.style.top = `${rect.bottom + 6}px`;

        // Ensure menu doesn't go off screen
        requestAnimationFrame(() => {
            if (!this.menuEl) return;
            const menuRect = this.menuEl.getBoundingClientRect();
            if (menuRect.right > window.innerWidth) {
                this.menuEl.style.left = `${window.innerWidth - menuRect.width - 8}px`;
            }
            if (menuRect.bottom > window.innerHeight) {
                this.menuEl.style.top = `${rect.top - menuRect.height - 6}px`;
            }
        });

        // Close on outside click (delay to avoid immediate trigger)
        setTimeout(() => {
            this.outsideClickHandler = (e: MouseEvent) => {
                if (this.menuEl && !this.menuEl.contains(e.target as Node)) {
                    this.hide();
                }
            };
            document.addEventListener('click', this.outsideClickHandler);
        }, 50);
    }

    hide(): void {
        if (this.menuEl) {
            this.menuEl.remove();
            this.menuEl = null;
        }
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
            this.outsideClickHandler = null;
        }
        // Clear selection visual
        this.container.querySelectorAll('.tb-block.tb-selected').forEach((b) => {
            b.classList.remove('tb-selected');
        });
    }
}
