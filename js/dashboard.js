// Renderizado del dashboard: resumen, barras de la regla, tabla y gráficos mensuales.
import { state } from './state.js';
import { formatCOP } from './utils.js';

const updateBar = (idPrefix, spent, limit) => {
    const pct = limit > 0 ? (spent / limit) * 100 : (spent > 0 ? 100 : 0);
    const pctClamped = Math.min(pct, 100);
    document.getElementById(`text-${idPrefix}`).innerText = `${formatCOP(spent)} / ${formatCOP(limit)}`;
    document.getElementById(`pct-${idPrefix}`).innerText = `${pct.toFixed(1)}%`;
    const bar = document.getElementById(`bar-${idPrefix}`);
    bar.style.width = `${pctClamped}%`;
    bar.classList.remove('bg-emerald-500', 'bg-amber-400', 'bg-rose-500', 'bg-secondary');
    if (idPrefix === 'savings') bar.classList.add('bg-secondary');
    else {
        if (pct < 75) bar.classList.add('bg-emerald-500');
        else if (pct < 90) bar.classList.add('bg-amber-400');
        else bar.classList.add('bg-rose-500');
    }
};

const updateCharts = (needs, wants, savings, inc, exp, chapterTotals) => {
    const { rule } = state;

    const ctx1 = document.getElementById('chart-503020').getContext('2d');
    if (state.charts.rule) state.charts.rule.destroy();
    state.charts.rule = new Chart(ctx1, {
        type: 'pie',
        data: {
            labels: [`Necesidades (${rule.needs}%)`, `Deseos (${rule.wants}%)`, `Ahorro/Inv. (${rule.savings}%)`],
            datasets: [{ data: [needs, wants, savings], backgroundColor: ['#10b981', '#f59e0b', '#3b82f6'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
    });

    const ctxChapters = document.getElementById('chart-chapters').getContext('2d');
    if (state.charts.chapters) state.charts.chapters.destroy();
    const chapterLabels = Object.keys(chapterTotals); const chapterData = Object.values(chapterTotals);
    const chapterColors = ['#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#64748b'];
    state.charts.chapters = new Chart(ctxChapters, {
        type: 'bar',
        data: { labels: chapterLabels.length > 0 ? chapterLabels : ['Sin datos'], datasets: [{ label: 'Gasto por Capítulo', data: chapterData.length > 0 ? chapterData : [0], backgroundColor: chapterColors, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { ticks: { font: { size: 10 } } } } }
    });

    const ctx2 = document.getElementById('chart-balance').getContext('2d');
    if (state.charts.balance) state.charts.balance.destroy();
    state.charts.balance = new Chart(ctx2, {
        type: 'doughnut',
        data: { labels: ['Ingresos', 'Gastos'], datasets: [{ data: [inc, exp], backgroundColor: ['#1e3a8a', '#f43f5e'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
    });
};

export const renderDashboard = () => {
    const filteredTx = state.allTransactions.filter(tx => tx.date && tx.date.startsWith(state.currentMonth));
    let totalIncome = 0, totalExpense = 0, spentNeeds = 0, spentWants = 0, spentSavings = 0;
    const chapterTotals = {};

    filteredTx.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tableBody = document.getElementById('tx-table-body');
    tableBody.innerHTML = '';

    if (filteredTx.length === 0) document.getElementById('empty-state').classList.remove('hidden');
    else document.getElementById('empty-state').classList.add('hidden');

    filteredTx.forEach(tx => {
        if (tx.type === 'income') totalIncome += tx.amount;
        else {
            totalExpense += tx.amount;
            if (tx.ruleClass === 'needs') spentNeeds += tx.amount;
            else if (tx.ruleClass === 'wants') spentWants += tx.amount;
            else if (tx.ruleClass === 'savings') spentSavings += tx.amount;
            chapterTotals[tx.chapter] = (chapterTotals[tx.chapter] || 0) + tx.amount;
        }

        const dateStr = new Date(tx.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
        const icon = tx.type === 'income' ? '<i class="ph-fill ph-arrow-circle-up text-emerald-500"></i>' : '<i class="ph-fill ph-arrow-circle-down text-rose-500"></i>';
        const ruleBadge = tx.type === 'income' ?
            `<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">Ingreso</span>` :
            `<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">${tx.ruleClass === 'needs' ? state.rule.needs + '% Nec.' : tx.ruleClass === 'wants' ? state.rule.wants + '% Des.' : state.rule.savings + '% Aho.'} - ${tx.chapter}</span>`;

        const attachmentBtn = tx.fileAttachment ?
            `<button onclick="window.viewAttachment('${tx.id}')" class="text-blue-500 hover:text-blue-700 transition-colors mr-2 bg-blue-50 p-1 rounded" title="Ver Soporte Adjunto">
                <i class="ph-bold ph-paperclip text-lg"></i>
            </button>` : '';

        tableBody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors group">
                <td class="p-3 text-slate-500 whitespace-nowrap">${dateStr}</td>
                <td class="p-3 font-medium text-slate-700 truncate max-w-[150px]" title="${tx.description}">${icon} ${tx.description}</td>
                <td class="p-3">${ruleBadge}</td>
                <td class="p-3 text-slate-500 text-xs truncate max-w-[120px]" title="${tx.reference || ''}">${tx.reference || '-'}</td>
                <td class="p-3 text-slate-500 text-xs truncate max-w-[150px]" title="${tx.observation || ''}">${tx.observation || '-'}</td>
                <td class="p-3 text-right font-semibold ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}">${formatCOP(tx.amount)}</td>
                <td class="p-3 text-center whitespace-nowrap">
                    ${attachmentBtn}
                    <button onclick="window.editTx('${tx.id}')" class="text-slate-400 hover:text-amber-500 transition-colors mr-2" title="Editar">
                        <i class="ph-fill ph-pencil-simple text-lg"></i>
                    </button>
                    <button onclick="window.deleteTx('${tx.id}')" class="text-slate-400 hover:text-rose-500 transition-colors" title="Eliminar">
                        <i class="ph-fill ph-trash text-lg"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    const balance = totalIncome - totalExpense;
    document.getElementById('total-income').innerText = formatCOP(totalIncome);
    document.getElementById('total-expenses').innerText = formatCOP(totalExpense);
    document.getElementById('total-balance').innerText = formatCOP(balance);
    document.getElementById('total-balance').className = `text-2xl font-bold mt-1 ${balance < 0 ? 'text-rose-500' : 'text-slate-800'}`;

    const limitNeeds = totalIncome * (state.rule.needs / 100);
    const limitWants = totalIncome * (state.rule.wants / 100);
    const limitSavings = totalIncome * (state.rule.savings / 100);

    updateBar('needs', spentNeeds, limitNeeds);
    updateBar('wants', spentWants, limitWants);
    updateBar('savings', spentSavings, limitSavings);
    updateCharts(spentNeeds, spentWants, spentSavings, totalIncome, totalExpense, chapterTotals);
};
