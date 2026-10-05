// Resumen de ahorro mensual y acumulado.
// Total ahorrado del mes = lo registrado como Ahorro/Inversión + el saldo sobrante (ingresos - todos los gastos),
// es decir, ingresos menos el gasto real (necesidades y deseos).
import { state } from './state.js';
import { formatCOP } from './utils.js';

const monthLabel = (month) => {
    const [y, m] = month.split('-').map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const amountClass = (value) => value < 0 ? 'text-rose-500' : 'text-slate-800 dark:text-slate-100';

export const renderSavingsSummary = () => {
    const byMonth = {};
    state.allTransactions.forEach(tx => {
        if (!tx.date) return;
        const month = tx.date.substring(0, 7);
        if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0, savings: 0 };
        if (tx.type === 'income') byMonth[month].income += tx.amount;
        else {
            byMonth[month].expense += tx.amount;
            if (tx.ruleClass === 'savings') byMonth[month].savings += tx.amount;
        }
    });

    let accumulated = 0;
    const rows = Object.keys(byMonth).sort().map(month => {
        const { income, expense, savings } = byMonth[month];
        const leftover = income - expense;
        const total = savings + leftover;
        accumulated += total;
        return { month, savings, leftover, total, accumulated };
    });

    const current = rows.find(r => r.month === state.currentMonth);
    document.getElementById('savings-accumulated').innerText = formatCOP(accumulated);
    document.getElementById('savings-accumulated').className = `text-2xl font-bold mt-1 ${amountClass(accumulated)}`;
    document.getElementById('savings-current').innerText = formatCOP(current ? current.total : 0);
    document.getElementById('savings-current').className = `text-2xl font-bold mt-1 ${amountClass(current ? current.total : 0)}`;
    document.getElementById('savings-current-label').innerText = `Ahorro de ${monthLabel(state.currentMonth)}`;
    const average = rows.length ? Math.round(accumulated / rows.length) : 0;
    document.getElementById('savings-average').innerText = formatCOP(average);
    document.getElementById('savings-average').className = `text-2xl font-bold mt-1 ${amountClass(average)}`;
    document.getElementById('savings-months-count').innerText = `${rows.length} mes(es) con movimientos`;

    const body = document.getElementById('savings-table-body');
    document.getElementById('savings-empty-state').classList.toggle('hidden', rows.length > 0);
    body.innerHTML = [...rows].reverse().map(r => `
        <tr class="${r.month === state.currentMonth ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'} transition-colors">
            <td class="p-3 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">${monthLabel(r.month)}</td>
            <td class="p-3 text-right text-slate-600 dark:text-slate-300">${formatCOP(r.savings)}</td>
            <td class="p-3 text-right ${r.leftover < 0 ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}">${formatCOP(r.leftover)}</td>
            <td class="p-3 text-right font-semibold ${r.total < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}">${formatCOP(r.total)}</td>
            <td class="p-3 text-right font-bold ${amountClass(r.accumulated)}">${formatCOP(r.accumulated)}</td>
        </tr>
    `).join('');
};
