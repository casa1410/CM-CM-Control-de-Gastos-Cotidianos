// Estado global compartido entre módulos.
import { DEFAULT_RULE } from './config.js';

export const state = {
    currentUser: null,
    unsubscribeSnapshot: null,
    allTransactions: [],
    currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    currentChapterFilter: 'all',
    currentFileBase64: null,
    currentFileType: null,
    rule: { ...DEFAULT_RULE },
    charts: {
        rule: null,
        chapters: null,
        balance: null,
        comparison: null
    }
};
