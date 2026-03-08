export interface TimeBlockCategory {
    id: string;
    name: string;
    color: string;
}

export interface DayRecord {
    date: string;
    blocks: (string | null)[];
}

export interface TimeBlocksData {
    records: Record<string, DayRecord>;
    categories: TimeBlockCategory[];
    settings: PluginSettings;
}

export interface PluginSettings {
    blockHeight: number;
}

export interface SelectionState {
    isSelecting: boolean;
    startIndex: number;
    endIndex: number;
    selectedIndices: Set<number>;
}
