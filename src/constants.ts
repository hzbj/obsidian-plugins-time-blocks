import type { TimeBlockCategory, TimeBlocksData, TimeBlocksSyncData, LocalSettings, PluginSettings } from './types';

export const DEFAULT_SETTINGS: PluginSettings = {
    blockHeight: 20,
};

export const DEFAULT_CATEGORIES: TimeBlockCategory[] = [
    { id: 'work', name: '工作', color: '#4A90D9' },
    { id: 'study', name: '学习', color: '#67C23A' },
    { id: 'rest', name: '休息', color: '#909399' },
];

export const DEFAULT_DATA: TimeBlocksData = {
    records: {},
    categories: [...DEFAULT_CATEGORIES],
    settings: { ...DEFAULT_SETTINGS },
};

export const DEFAULT_SYNC_DATA: TimeBlocksSyncData = {
    version: 1,
    records: {},
    categories: [...DEFAULT_CATEGORIES],
};

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
    settings: { ...DEFAULT_SETTINGS },
    migrated: false,
};

export const VAULT_DATA_FILE = 'time-blocks-data.json';

export const BLOCKS_PER_DAY = 48;
export const BLOCKS_PER_ROW = 4;
export const ROWS_COUNT = 12;
