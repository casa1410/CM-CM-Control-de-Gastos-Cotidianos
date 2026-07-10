// Importación de historial desde CSV (separado por punto y coma).
import { doc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { db } from './firebase.js';
import { isOfflineMode } from './config.js';
import { showToast } from './utils.js';
import { getCollectionRef, loadData } from './data.js';

const classifyRow = (desc) => {
    let ruleClass = 'needs'; let chapter = 'Hogar'; let dDesc = desc.toUpperCase();
    if (dDesc.includes('SUELDO') || dDesc.includes('SALARIO') || dDesc.includes('INGRESO')) { ruleClass = 'income'; chapter = 'Ingreso'; }
    else if (dDesc.includes('AREPA') || dDesc.includes('CARNE') || dDesc.includes('SUPERMERCADO')) chapter = 'Alimentacion';
    else if (dDesc.includes('TELEFONO') || dDesc.includes('MOVIL') || dDesc.includes('AGUA') || dDesc.includes('GAS') || dDesc.includes('LUZ') || dDesc.includes('ARRIENDO')) { chapter = 'Hogar'; ruleClass = 'needs'; }
    else if (dDesc.includes('COLEGIO') || dDesc.includes('MATRICULA') || dDesc.includes('UNIVERSIDAD')) { chapter = 'Educacion'; ruleClass = 'needs'; }
    return { ruleClass, chapter };
};

const parseRows = (rows) => {
    const records = [];
    for (let i = 0; i < rows.length; i++) {
        const cols = rows[i].split(';');
        if (cols.length < 4) continue;
        const desc = cols[1]?.trim();
        const valStr = cols[2]?.trim();
        const ref = cols[3]?.trim();
        const obs = cols.length >= 8 ? cols[7]?.trim() : '';

        if (!desc || !valStr || !(valStr.includes('$') || /[0-9]/.test(valStr))) continue;

        const cleanNumStr = valStr.replace(/[^0-9.-]+/g, "");
        const val = parseFloat(cleanNumStr);
        if (isNaN(val) || val <= 0) continue;

        const { ruleClass, chapter } = classifyRow(desc);
        records.push({
            type: ruleClass === 'income' ? 'income' : 'expense',
            description: desc, amount: val, chapter: chapter, reference: ref || '', observation: obs || '',
            date: new Date().toISOString(), ruleClass: ruleClass === 'income' ? 'income' : ruleClass
        });
    }
    return records;
};

export const initCsvImport = () => {
    document.getElementById('btn-import-csv').addEventListener('click', () => {
        const fileInput = document.getElementById('csv-file');
        if (fileInput.files.length === 0) return showToast('Selecciona un archivo CSV primero', 'error');

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            if (!state.currentUser) return;
            const text = e.target.result;
            const rows = text.split('\n');
            const records = parseRows(rows);

            if (records.length === 0) return showToast('No se encontraron datos válidos.', 'error');

            if (isOfflineMode) {
                records.forEach((rec, idx) => {
                    state.allTransactions.push({ id: Date.now().toString() + idx, ...rec });
                });
                localStorage.setItem('ycm_txs', JSON.stringify(state.allTransactions));
                showToast(`¡Importación Local Exitosa! ${records.length} registros.`, 'success');
                fileInput.value = '';
                loadData();
                return;
            }

            try {
                const batch = writeBatch(db);
                const colRef = getCollectionRef();
                records.forEach(rec => {
                    const docRef = doc(colRef);
                    batch.set(docRef, rec);
                });
                await batch.commit();
                showToast(`¡Importación Nube exitosa! ${records.length} añadidos.`, 'success');
                fileInput.value = '';
            } catch (err) { showToast('Error durante la importación', 'error'); }
        };
        reader.readAsText(file);
    });
};
