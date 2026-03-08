export class SelectionManager {
    private container: HTMLElement;
    private onSelectionDone: (indices: Set<number>) => void;
    private isSelecting = false;
    private startIndex = -1;
    private selectedIndices = new Set<number>();

    // Bound handlers for cleanup
    private handleMouseDown: (e: MouseEvent) => void;
    private handleMouseMove: (e: MouseEvent) => void;
    private handleMouseUp: (e: MouseEvent) => void;
    private handleTouchStart: (e: TouchEvent) => void;
    private handleTouchMove: (e: TouchEvent) => void;
    private handleTouchEnd: (e: TouchEvent) => void;

    constructor(container: HTMLElement, onSelectionDone: (indices: Set<number>) => void) {
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

    private bindEvents(): void {
        const grid = this.container.querySelector('.tb-grid');
        if (!grid) return;

        grid.addEventListener('mousedown', this.handleMouseDown as EventListener);
        grid.addEventListener('mousemove', this.handleMouseMove as EventListener);
        grid.addEventListener('mouseup', this.handleMouseUp as EventListener);
        grid.addEventListener('mouseleave', this.handleMouseUp as EventListener);

        grid.addEventListener('touchstart', this.handleTouchStart as EventListener, { passive: false });
        grid.addEventListener('touchmove', this.handleTouchMove as EventListener, { passive: false });
        grid.addEventListener('touchend', this.handleTouchEnd as EventListener);
        grid.addEventListener('touchcancel', this.handleTouchEnd as EventListener);
    }

    // ===== Mouse events =====

    private onMouseDown(e: MouseEvent): void {
        const block = this.getBlockFromEvent(e);
        if (!block) return;
        e.preventDefault();
        this.startSelection(block);
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.isSelecting) return;
        const block = this.getBlockFromEvent(e);
        if (block) {
            this.extendSelection(block);
        }
    }

    private onMouseUp(e: MouseEvent): void {
        if (!this.isSelecting) return;
        this.finishSelection();
    }

    // ===== Touch events =====

    private onTouchStart(e: TouchEvent): void {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const block = this.getBlockFromPoint(touch.clientX, touch.clientY);
        if (!block) return;
        e.preventDefault();
        this.startSelection(block);
    }

    private onTouchMove(e: TouchEvent): void {
        if (!this.isSelecting || e.touches.length !== 1) return;
        e.preventDefault();
        const touch = e.touches[0];
        const block = this.getBlockFromPoint(touch.clientX, touch.clientY);
        if (block) {
            this.extendSelection(block);
        }
    }

    private onTouchEnd(e: TouchEvent): void {
        if (!this.isSelecting) return;
        this.finishSelection();
    }

    // ===== Core selection logic =====

    private startSelection(block: HTMLElement): void {
        this.clearVisual();
        const index = parseInt(block.dataset.index || '-1', 10);
        if (index < 0) return;

        this.isSelecting = true;
        this.startIndex = index;
        this.selectedIndices = new Set([index]);
        this.updateVisual();
    }

    private extendSelection(block: HTMLElement): void {
        const index = parseInt(block.dataset.index || '-1', 10);
        if (index < 0) return;

        const min = Math.min(this.startIndex, index);
        const max = Math.max(this.startIndex, index);
        this.selectedIndices = new Set<number>();
        for (let i = min; i <= max; i++) {
            this.selectedIndices.add(i);
        }
        this.updateVisual();
    }

    private finishSelection(): void {
        this.isSelecting = false;
        if (this.selectedIndices.size > 0) {
            this.onSelectionDone(new Set(this.selectedIndices));
        }
    }

    // ===== Visual helpers =====

    private updateVisual(): void {
        const blocks = this.container.querySelectorAll('.tb-block');
        blocks.forEach((b) => {
            const el = b as HTMLElement;
            const idx = parseInt(el.dataset.index || '-1', 10);
            if (this.selectedIndices.has(idx)) {
                el.classList.add('tb-selected');
            } else {
                el.classList.remove('tb-selected');
            }
        });
    }

    clearVisual(): void {
        this.selectedIndices.clear();
        this.container.querySelectorAll('.tb-block.tb-selected').forEach((b) => {
            b.classList.remove('tb-selected');
        });
    }

    // ===== Utilities =====

    private getBlockFromEvent(e: MouseEvent): HTMLElement | null {
        const target = e.target as HTMLElement;
        return target.closest('.tb-block');
    }

    private getBlockFromPoint(x: number, y: number): HTMLElement | null {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        return el.closest('.tb-block');
    }
}
