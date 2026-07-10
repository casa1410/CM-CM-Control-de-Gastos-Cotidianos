// Punto de entrada: conecta todos los módulos de la aplicación.
import { state } from './state.js';
import './firebase.js';
import { renderDashboard } from './dashboard.js';
import { renderComparisonChart } from './comparison.js';
import { initRuleSettingsUI } from './rules.js';
import { initAttachments } from './attachments.js';
import { initTransactions } from './transactions.js';
import { initCsvImport } from './csvImport.js';
import { initBackup } from './backup.js';
import { initAuth } from './auth.js';

document.getElementById('month-selector').value = state.currentMonth;
document.getElementById('month-selector').addEventListener('change', (e) => {
    state.currentMonth = e.target.value;
    renderDashboard();
});

document.getElementById('comparison-metric').addEventListener('change', () => { renderComparisonChart(); });

initAttachments();
initTransactions();
initCsvImport();
initBackup();
initRuleSettingsUI(() => { renderDashboard(); renderComparisonChart(); });
initAuth();
