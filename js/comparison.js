// Análisis histórico comparativo entre meses (ingresos/gastos, regla, capítulos).
import { state } from './state.js';
import { formatCOP } from './utils.js';

export const renderComparisonChart = () => {
    if (!state.allTransactions || state.allTransactions.length === 0) return;

    const metric = document.getElementById('comparison-metric').value;
    const dataByMonth = {};

    state.allTransactions.forEach(tx => {
        if (!tx.date) return;
        const month = tx.date.substring(0, 7);
        if (!dataByMonth[month]) dataByMonth[month] = { income: 0, expense: 0, needs: 0, wants: 0, savings: 0, chapters: {} };

        if (tx.type === 'income') dataByMonth[month].income += tx.amount;
        else {
            dataByMonth[month].expense += tx.amount;
            if (tx.ruleClass === 'needs') dataByMonth[month].needs += tx.amount;
            else if (tx.ruleClass === 'wants') dataByMonth[month].wants += tx.amount;
            else if (tx.ruleClass === 'savings') dataByMonth[month].savings += tx.amount;
            dataByMonth[month].chapters[tx.chapter] = (dataByMonth[month].chapters[tx.chapter] || 0) + tx.amount;
        }
    });

    const sortedMonths = Object.keys(dataByMonth).sort();
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        const date = new Date(year, month - 1);
        const str = date.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
        return str.charAt(0).toUpperCase() + str.slice(1);
    });

    let datasets = []; let isStacked = false;

    if (metric === 'balance') {
        datasets = [
            { label: 'Ingresos', data: sortedMonths.map(m => dataByMonth[m].income), backgroundColor: '#1e3a8a', borderRadius: 4 },
            { label: 'Gastos', data: sortedMonths.map(m => dataByMonth[m].expense), backgroundColor: '#f43f5e', borderRadius: 4 }
        ];
    } else if (metric === 'rule') {
        datasets = [
            { label: `Necesidades (${state.rule.needs}%)`, data: sortedMonths.map(m => dataByMonth[m].needs), backgroundColor: '#10b981' },
            { label: `Deseos (${state.rule.wants}%)`, data: sortedMonths.map(m => dataByMonth[m].wants), backgroundColor: '#f59e0b' },
            { label: `Ahorro/Inv. (${state.rule.savings}%)`, data: sortedMonths.map(m => dataByMonth[m].savings), backgroundColor: '#3b82f6' }
        ];
        isStacked = true;
    } else if (metric === 'chapters') {
        const allChapters = new Set();
        sortedMonths.forEach(m => Object.keys(dataByMonth[m].chapters).forEach(c => allChapters.add(c)));
        const chapterColors = ['#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#64748b'];
        let colorIdx = 0;
        Array.from(allChapters).forEach(chap => {
            if (chap === 'Ingreso') return;
            datasets.push({ label: chap, data: sortedMonths.map(m => dataByMonth[m].chapters[chap] || 0), backgroundColor: chapterColors[colorIdx % chapterColors.length] });
            colorIdx++;
        });
        isStacked = true;
    }

    const ctx = document.getElementById('chart-comparison').getContext('2d');
    if (state.charts.comparison) state.charts.comparison.destroy();

    state.charts.comparison = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12, font: { size: 12 } } },
                tooltip: {
                    mode: 'index', intersect: false, callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += formatCOP(context.parsed.y);
                            return label;
                        }
                    }
                }
            },
            scales: { x: { stacked: isStacked }, y: { stacked: isStacked, beginAtZero: true } }
        }
    });
};
