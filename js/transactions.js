// Registro, edición y eliminación de movimientos (gastos/ingresos).
import { addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { db } from './firebase.js';
import { isOfflineMode, appId } from './config.js';
import { parseAmount, showToast, attachAmountFormatter, isoToDateInput, dateToIso } from './utils.js';
import { resetFileInput, setExistingAttachmentLabel } from './attachments.js';
import { getCollectionRef, loadData } from './data.js';

const amountInput = document.getElementById('tx-amount');

const resetFormState = () => {
    document.getElementById('tx-form').reset();
    document.getElementById('tx-id').value = '';
    document.getElementById('text-submit-tx').innerText = 'Guardar Registro';
    document.getElementById('tx-form-title').innerText = 'Registrar Movimiento';
    document.getElementById('tx-form-card').classList.remove('ring-2', 'ring-amber-400');
    document.getElementById('btn-cancel-edit').classList.add('hidden');
    document.getElementById('container-ref').style.display = 'none';
    document.getElementById('tx-medio').value = 'Efectivo';
    resetFileInput();
    document.getElementById('tx-type').dispatchEvent(new Event('change'));
};

export const initTransactions = () => {
    attachAmountFormatter(amountInput);

    document.getElementById('tx-type').addEventListener('change', (e) => {
        const ruleContainer = document.getElementById('container-rule');
        const chapterSelect = document.getElementById('tx-chapter');
        if (e.target.value === 'income') {
            ruleContainer.style.display = 'none';
            chapterSelect.value = 'Ingreso';
        } else if (e.target.value === 'saving') {
            ruleContainer.style.display = 'none';
            chapterSelect.value = 'Ahorro';
        } else {
            ruleContainer.style.display = 'block';
            if (chapterSelect.value === 'Ingreso' || chapterSelect.value === 'Ahorro') chapterSelect.value = 'Hogar';
        }
    });

    document.getElementById('tx-medio').addEventListener('change', (e) => {
        const refContainer = document.getElementById('container-ref');
        if (e.target.value === 'Efectivo') {
            refContainer.style.display = 'none';
            document.getElementById('tx-ref').value = '';
        } else { refContainer.style.display = 'block'; }
    });

    document.getElementById('btn-cancel-edit').addEventListener('click', resetFormState);

    document.getElementById('tx-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.currentUser) return;

        // "Ahorro" se guarda como salida (sale del saldo disponible) con clasificación de regla 'savings'.
        const formType = document.getElementById('tx-type').value;
        const type = formType === 'income' ? 'income' : 'expense';
        const amountVal = parseAmount(document.getElementById('tx-amount').value);

        if (isNaN(amountVal) || amountVal <= 0) return showToast('Ingrese un valor válido', 'error');

        const txId = document.getElementById('tx-id').value;
        const medio = document.getElementById('tx-medio').value;
        const refNumber = document.getElementById('tx-ref').value;
        const referenceComplete = medio === 'Efectivo' ? 'Efectivo' : `${medio} ${refNumber}`.trim();

        // Fecha opcional: vacía = hoy (o la original al editar). Si no cambió al editar, se conserva la hora original.
        const originalDate = txId ? state.allTransactions.find(t => t.id === txId).date : null;
        const dateInput = document.getElementById('tx-date').value;
        let date = originalDate || new Date().toISOString();
        if (dateInput && !(originalDate && dateInput === isoToDateInput(originalDate))) date = dateToIso(dateInput);

        const record = {
            type: type,
            description: document.getElementById('tx-desc').value,
            amount: amountVal,
            chapter: document.getElementById('tx-chapter').value,
            reference: referenceComplete,
            observation: document.getElementById('tx-obs').value || '',
            date,
            ruleClass: formType === 'income' ? 'income' : formType === 'saving' ? 'savings' : document.getElementById('tx-rule').value
        };

        if (state.currentFileBase64) {
            record.fileAttachment = state.currentFileBase64;
            record.fileType = state.currentFileType;
        } else if (txId) {
            const existingTx = state.allTransactions.find(t => t.id === txId);
            if (existingTx && existingTx.fileAttachment) {
                record.fileAttachment = existingTx.fileAttachment;
                record.fileType = existingTx.fileType;
            }
        }

        // Aviso si el registro queda en un mes distinto al que se está viendo.
        if (isoToDateInput(date).slice(0, 7) !== state.currentMonth) {
            const monthName = new Date(date).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
            showToast(`El registro quedó en ${monthName}`, 'info');
        }

        // MODO LOCAL
        if (isOfflineMode) {
            if (txId) {
                const idx = state.allTransactions.findIndex(t => t.id === txId);
                if (idx > -1) state.allTransactions[idx] = { ...state.allTransactions[idx], ...record };
                showToast('Registro actualizado (Local)', 'success');
            } else {
                record.id = Date.now().toString();
                state.allTransactions.push(record);
                showToast('Registro guardado (Local)', 'success');
            }
            localStorage.setItem('ycm_txs', JSON.stringify(state.allTransactions));
            resetFormState();
            loadData();
            return;
        }

        // MODO NUBE (Firebase)
        try {
            if (txId) {
                await updateDoc(doc(db, 'artifacts', appId, 'users', state.currentUser.uid, 'transactions', txId), record);
                showToast('Registro actualizado', 'success');
                resetFormState();
            } else {
                await addDoc(getCollectionRef(), record);
                showToast('Registro guardado', 'success');
                e.target.reset();
                document.getElementById('container-ref').style.display = 'none';
                resetFileInput();
                document.getElementById('tx-type').dispatchEvent(new Event('change'));
            }
        } catch (error) { showToast('Error al procesar registro', 'error'); }
    });

    window.editTx = (id) => {
        const tx = state.allTransactions.find(t => t.id === id);
        if (!tx) return;

        document.getElementById('tx-id').value = tx.id;
        document.getElementById('tx-type').value = tx.ruleClass === 'savings' ? 'saving' : tx.type;
        document.getElementById('tx-type').dispatchEvent(new Event('change'));

        if (tx.type === 'expense' && tx.ruleClass !== 'savings') document.getElementById('tx-rule').value = tx.ruleClass;
        document.getElementById('tx-desc').value = tx.description;

        const parts = tx.amount.toString().split('.');
        let formattedAmount = new Intl.NumberFormat('es-CO').format(parts[0]);
        if (parts.length > 1) formattedAmount += ',' + parts[1];
        document.getElementById('tx-amount').value = formattedAmount;

        document.getElementById('tx-chapter').value = tx.chapter;
        document.getElementById('tx-obs').value = tx.observation || '';
        document.getElementById('tx-date').value = tx.date ? isoToDateInput(tx.date) : '';

        const knownMedios = ['Efectivo', 'Nequi', 'DaviPlata', 'Banco', 'Llave', 'Otro'];
        let foundMedio = 'Otro';
        let foundRef = tx.reference || '';

        for (let m of knownMedios) {
            if (tx.reference && tx.reference.startsWith(m)) {
                foundMedio = m;
                foundRef = tx.reference.replace(m, '').trim();
                break;
            }
        }
        if (tx.reference === 'Efectivo' || !tx.reference) { foundMedio = 'Efectivo'; foundRef = ''; }

        document.getElementById('tx-medio').value = foundMedio;
        document.getElementById('tx-ref').value = foundRef;
        document.getElementById('tx-medio').dispatchEvent(new Event('change'));

        if (tx.fileAttachment) {
            setExistingAttachmentLabel();
        } else {
            resetFileInput();
        }

        document.getElementById('text-submit-tx').innerText = 'Actualizar';
        document.getElementById('btn-cancel-edit').classList.remove('hidden');
        // Lleva al formulario (el contenedor con scroll es <main>, no la ventana) y lo resalta mientras se edita.
        document.getElementById('tx-form-title').innerText = 'Editar Movimiento';
        const formCard = document.getElementById('tx-form-card');
        formCard.classList.add('ring-2', 'ring-amber-400');
        formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('tx-desc').focus({ preventScroll: true });
    };

    window.deleteTx = async (id) => {
        if (!state.currentUser) return;
        if (confirm("¿Estás seguro de eliminar este registro?")) {
            if (isOfflineMode) {
                state.allTransactions = state.allTransactions.filter(t => t.id !== id);
                localStorage.setItem('ycm_txs', JSON.stringify(state.allTransactions));
                showToast('Registro eliminado (Local)', 'success');
                loadData();
                return;
            }
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'users', state.currentUser.uid, 'transactions', id));
                showToast('Registro eliminado', 'success');
            } catch (error) { showToast('Error al eliminar', 'error'); }
        }
    };
};
