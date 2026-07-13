// Copia de seguridad manual: exportar todo a un archivo JSON y restaurarlo cuando se quiera.
// Es 100% local al navegador (no pasa por ningún servidor intermedio: se genera y descarga
// directamente en el dispositivo del usuario mediante un Blob).
import { doc, writeBatch, getDocs, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { db } from './firebase.js';
import { isOfflineMode } from './config.js';
import { showToast } from './utils.js';
import { getCollectionRef, loadData } from './data.js';

const APP_LABEL = 'CM & CM Control de Gastos Cotidianos';
const CHUNK_SIZE = 400;

const chunk = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
};

const exportBackup = () => {
    const payload = {
        app: APP_LABEL,
        version: 1,
        exportedAt: new Date().toISOString(),
        rule: state.rule,
        transactions: state.allTransactions
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `copia-seguridad-cm-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Copia de seguridad descargada', 'success');
};

const RULE_LABELS = { needs: 'Necesidad', wants: 'Deseo', savings: 'Ahorro/Inversión', income: 'Ingreso' };

const exportExcel = () => {
    const rows = [...state.allTransactions]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(tx => ({
            Fecha: tx.date ? new Date(tx.date).toLocaleDateString('es-CO') : '',
            Tipo: tx.type === 'income' ? 'Ingreso' : 'Gasto',
            Descripción: tx.description || '',
            Capítulo: tx.chapter || '',
            Clasificación: RULE_LABELS[tx.ruleClass] || tx.ruleClass || '',
            Valor: tx.amount || 0,
            'Medio/Referencia': tx.reference || '',
            Observaciones: tx.observation || ''
        }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 30 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Movimientos');

    const dateStamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `movimientos-cm-${dateStamp}.xlsx`);
    showToast('Excel descargado', 'success');
};

const restoreLocal = (payload) => {
    state.allTransactions = payload.transactions.map(tx => ({ ...tx, id: tx.id || (Date.now().toString() + Math.random()) }));
    localStorage.setItem('ycm_txs', JSON.stringify(state.allTransactions));
    if (payload.rule && typeof payload.rule.needs === 'number') {
        state.rule = payload.rule;
        localStorage.setItem('ycm_rule', JSON.stringify(state.rule));
    }
    showToast('Copia de seguridad restaurada', 'success');
    loadData();
};

const restoreCloud = async (payload) => {
    const colRef = getCollectionRef();
    const existing = await getDocs(query(colRef));
    const existingRefs = [];
    existing.forEach(d => existingRefs.push(d.ref));

    for (const group of chunk(existingRefs, CHUNK_SIZE)) {
        const batch = writeBatch(db);
        group.forEach(ref => batch.delete(ref));
        await batch.commit();
    }

    for (const group of chunk(payload.transactions, CHUNK_SIZE)) {
        const batch = writeBatch(db);
        group.forEach(tx => {
            const { id, ...rest } = tx;
            batch.set(doc(colRef), rest);
        });
        await batch.commit();
    }

    showToast('Copia de seguridad restaurada en la nube', 'success');
};

export const initBackup = () => {
    document.getElementById('btn-export-backup').addEventListener('click', () => {
        if (!state.currentUser) return showToast('Inicia sesión primero', 'error');
        exportBackup();
    });

    document.getElementById('btn-export-excel').addEventListener('click', () => {
        if (!state.currentUser) return showToast('Inicia sesión primero', 'error');
        if (state.allTransactions.length === 0) return showToast('No hay movimientos para exportar', 'error');
        exportExcel();
    });

    document.getElementById('backup-restore-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !state.currentUser) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            let payload;
            try {
                payload = JSON.parse(evt.target.result);
            } catch (err) {
                showToast('El archivo no es una copia de seguridad válida', 'error');
                e.target.value = '';
                return;
            }
            if (!Array.isArray(payload.transactions)) {
                showToast('El archivo no contiene movimientos válidos', 'error');
                e.target.value = '';
                return;
            }
            const confirmed = confirm(`Esto reemplazará TODOS tus movimientos actuales por los ${payload.transactions.length} de la copia de seguridad. ¿Deseas continuar?`);
            if (!confirmed) { e.target.value = ''; return; }

            try {
                if (isOfflineMode) restoreLocal(payload);
                else await restoreCloud(payload);
            } catch (err) {
                showToast('Error al restaurar la copia de seguridad', 'error');
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    });
};
