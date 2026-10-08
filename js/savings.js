// Resumen de ahorro mensual y acumulado.
// Solo cuenta lo registrado explícitamente como Ahorro / Inversión (ruleClass 'savings').
import { state } from './state.js';
import { formatCOP } from './utils.js';

const monthLabel = (month) => {
    const [y, m] = month.split('-').map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
};

export const renderSavingsSummary = () => {
    const byMonth = {};
    state.allTransactions.forEach(tx => {
        if (!tx.date || tx.type !== 'expense' || tx.ruleClass !== 'savings') return;
        const month = tx.date.substring(0, 7);
        byMonth[month] = (byMonth[month] || 0) + tx.amount;
    });

    let accumulated = 0;
    const rows = Object.keys(byMonth).sort().map(month => {
        accumulated += byMonth[month];
        return { month, saved: byMonth[month], accumulated };
    });

    document.getElementById('savings-accumulated').innerText = formatCOP(accumulated);
    document.getElementById('savings-current').innerText = formatCOP(byMonth[state.currentMonth] || 0);
    document.getElementById('savings-current-label').innerText = `Ahorro de ${monthLabel(state.currentMonth)}`;
    document.getElementById('savings-average').innerText = formatCOP(rows.length ? Math.round(accumulated / rows.length) : 0);
    document.getElementById('savings-months-count').innerText = `${rows.length} mes(es) con ahorro`;

    document.getElementById('savings-empty-state').classList.toggle('hidden', rows.length > 0);
    document.getElementById('savings-table-body').innerHTML = [...rows].reverse().map(r => `
        <tr class="${r.month === state.currentMonth ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'} transition-colors">
            <td class="p-3 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">${monthLabel(r.month)}</td>
            <td class="p-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">${formatCOP(r.saved)}</td>
            <td class="p-3 text-right font-bold text-slate-800 dark:text-slate-100">${formatCOP(r.accumulated)}</td>
        </tr>
    `).join('');
};
