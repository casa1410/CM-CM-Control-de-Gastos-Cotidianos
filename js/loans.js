// Préstamos: los que pedí (yo debo) y los que hice (me deben), con su historial de pagos/abonos.
// Cada pago puede registrarse también como movimiento en el historial del mes (gasto o ingreso).
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { db } from './firebase.js';
import { isOfflineMode, appId } from './config.js';
import { formatCOP, parseAmount, showToast, attachAmountFormatter, formatAmountForInput, escapeHtml, todayStr, dateToIso } from './utils.js';
import { renderDashboard } from './dashboard.js';
import { renderComparisonChart } from './comparison.js';

export const LOANS_STORAGE_KEY = 'ycm_loans';

let statusFilter = 'active';
let directionFilter = 'all';
let openLoanId = null; // préstamo abierto en el modal de pagos

// ---------- Rutas de Firestore ----------
const userPath = () => ['artifacts', appId, 'users', state.currentUser.uid];
export const getLoansRef = () => {
    if (!state.currentUser) return null;
    return collection(db, ...userPath(), 'loans');
};
const loanDocRef = (id) => doc(db, ...userPath(), 'loans', id);

// ---------- Cálculos ----------
export const loanPaid = (loan) => (loan.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
export const loanBalance = (loan) => Math.max(0, (loan.amount || 0) - loanPaid(loan));
export const isSettled = (loan) => loanPaid(loan) >= (loan.amount || 0) - 0.005;

// ---------- Fechas ----------
const formatDate = (value) => {
    if (!value) return '';
    const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ---------- Persistencia ----------
const persistLocal = () => localStorage.setItem(LOANS_STORAGE_KEY, JSON.stringify(state.allLoans));

export const loadLoans = () => {
    if (!state.currentUser) return;
    if (state.unsubscribeLoans) { state.unsubscribeLoans(); state.unsubscribeLoans = null; }

    if (isOfflineMode) {
        const stored = localStorage.getItem(LOANS_STORAGE_KEY);
        state.allLoans = stored ? JSON.parse(stored) : [];
        renderLoans();
        return;
    }

    state.unsubscribeLoans = onSnapshot(query(getLoansRef()), (snapshot) => {
        state.allLoans = [];
        snapshot.forEach((d) => { state.allLoans.push({ id: d.id, ...d.data() }); });
        renderLoans();
        if (openLoanId) renderPaymentsModal();
    }, () => { showToast('Error al cargar préstamos', 'error'); });
};

const saveLoan = async (id, data) => {
    if (isOfflineMode) {
        if (id) {
            const idx = state.allLoans.findIndex(l => l.id === id);
            if (idx > -1) state.allLoans[idx] = { ...state.allLoans[idx], ...data };
        } else {
            state.allLoans.push({ id: Date.now().toString(), ...data });
        }
        persistLocal();
        renderLoans();
        if (openLoanId) renderPaymentsModal();
        return;
    }
    if (id) await updateDoc(loanDocRef(id), data);
    else await addDoc(getLoansRef(), data);
};

const removeLoan = async (id) => {
    if (isOfflineMode) {
        state.allLoans = state.allLoans.filter(l => l.id !== id);
        persistLocal();
        renderLoans();
        return;
    }
    await deleteDoc(loanDocRef(id));
};

// Movimiento asociado a un pago (se refleja en el historial y totales del mes).
const addLinkedTransaction = async (record) => {
    if (isOfflineMode) {
        const id = `${Date.now()}_prestamo`;
        state.allTransactions.push({ id, ...record });
        localStorage.setItem('ycm_txs', JSON.stringify(state.allTransactions));
        renderDashboard();
        renderComparisonChart();
        return id;
    }
    const ref = await addDoc(collection(db, ...userPath(), 'transactions'), record);
    return ref.id;
};

const updateLinkedTransaction = async (txId, changes) => {
    if (isOfflineMode) {
        const idx = state.allTransactions.findIndex(t => t.id === txId);
        if (idx === -1) return;
        state.allTransactions[idx] = { ...state.allTransactions[idx], ...changes };
        localStorage.setItem('ycm_txs', JSON.stringify(state.allTransactions));
        renderDashboard();
        renderComparisonChart();
        return;
    }
    await updateDoc(doc(db, ...userPath(), 'transactions', txId), changes);
};

// Gasto que representa la salida del dinero al prestar (solo préstamos "Yo presté").
const disbursementRecord = (loan, ruleClass) => ({
    type: 'expense',
    description: `Préstamo a ${loan.person}`,
    amount: loan.amount,
    chapter: 'Prestamos',
    reference: 'Préstamo',
    observation: loan.observation || '',
    date: dateToIso(loan.startDate),
    ruleClass
});

const deleteLinkedTransaction = async (txId) => {
    if (isOfflineMode) {
        state.allTransactions = state.allTransactions.filter(t => t.id !== txId);
        localStorage.setItem('ycm_txs', JSON.stringify(state.allTransactions));
        renderDashboard();
        renderComparisonChart();
        return;
    }
    await deleteDoc(doc(db, ...userPath(), 'transactions', txId));
};

// ---------- Renderizado de la lista ----------
const loanCard = (loan) => {
    const paid = loanPaid(loan);
    const balance = loanBalance(loan);
    const settled = isSettled(loan);
    const isBorrowed = loan.direction === 'borrowed';
    const pct = loan.amount > 0 ? Math.min(100, (paid / loan.amount) * 100) : 0;

    const badge = isBorrowed
        ? '<span class="bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded text-xs font-semibold">Yo debo</span>'
        : '<span class="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-xs font-semibold">Me deben</span>';
    const settledBadge = settled
        ? '<span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1"><i class="ph-fill ph-check-circle text-emerald-500"></i> Saldado</span>'
        : '';

    let installmentsInfo = `${(loan.payments || []).length} pago(s) registrado(s)`;
    if (loan.installments > 0) {
        const installmentValue = loan.amount / loan.installments;
        const installmentsPaid = Math.min(loan.installments, Math.floor((paid + 0.005) / installmentValue));
        installmentsInfo = `Cuotas ${installmentsPaid}/${loan.installments} · ${formatCOP(installmentValue)} c/u`;
    }

    let dueInfo = '';
    if (loan.dueDate && !settled) {
        const overdue = loan.dueDate < todayStr();
        dueInfo = `<span class="${overdue ? 'text-rose-500 font-semibold' : 'text-slate-500 dark:text-slate-400'} flex items-center gap-1">
            <i class="ph ${overdue ? 'ph-warning' : 'ph-calendar-check'}"></i>${overdue ? 'Vencido' : 'Vence'} ${formatDate(loan.dueDate)}</span>`;
    }

    return `
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-4 flex flex-col gap-3 ${settled ? 'opacity-75' : ''}">
            <div class="flex justify-between items-start gap-2">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">${badge}${settledBadge}</div>
                    <h3 class="font-bold text-slate-800 dark:text-slate-100 break-words">${escapeHtml(loan.person)}</h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Desde ${formatDate(loan.startDate)}</p>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Saldo</p>
                    <p class="text-lg font-bold ${settled ? 'text-emerald-600 dark:text-emerald-400' : isBorrowed ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}">${formatCOP(balance)}</p>
                </div>
            </div>
            <div>
                <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                    <div class="${settled ? 'bg-emerald-500' : 'bg-secondary'} h-2.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
                <div class="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span>${isBorrowed ? 'Pagado' : 'Recibido'} ${formatCOP(paid)} de ${formatCOP(loan.amount)}</span>
                    <span>${pct.toFixed(0)}%</span>
                </div>
            </div>
            <div class="flex justify-between items-center text-xs gap-2 flex-wrap">
                <span class="text-slate-500 dark:text-slate-400">${installmentsInfo}</span>
                ${dueInfo}
            </div>
            ${loan.observation ? `<p class="text-xs text-slate-500 dark:text-slate-400 italic break-words">${escapeHtml(loan.observation)}</p>` : ''}
            <div class="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700">
                <button onclick="window.openLoanPayments('${loan.id}')" class="bg-primary hover:bg-blue-900 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1.5">
                    <i class="ph ph-receipt"></i> ${settled ? 'Ver pagos' : isBorrowed ? 'Registrar pago' : 'Registrar abono'}
                </button>
                <div>
                    <button onclick="window.editLoan('${loan.id}')" class="text-slate-400 dark:text-slate-500 hover:text-amber-500 transition-colors mr-2" title="Editar préstamo">
                        <i class="ph-fill ph-pencil-simple text-lg"></i>
                    </button>
                    <button onclick="window.deleteLoan('${loan.id}')" class="text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors" title="Eliminar préstamo">
                        <i class="ph-fill ph-trash text-lg"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
};

export const renderLoans = () => {
    let owe = 0, oweCount = 0, owed = 0, owedCount = 0;
    state.allLoans.forEach(loan => {
        if (isSettled(loan)) return;
        if (loan.direction === 'borrowed') { owe += loanBalance(loan); oweCount++; }
        else { owed += loanBalance(loan); owedCount++; }
    });
    document.getElementById('loans-total-owe').innerText = formatCOP(owe);
    document.getElementById('loans-count-owe').innerText = `${oweCount} préstamo(s) activo(s)`;
    document.getElementById('loans-total-owed').innerText = formatCOP(owed);
    document.getElementById('loans-count-owed').innerText = `${owedCount} préstamo(s) activo(s)`;

    const list = state.allLoans
        .filter(l => directionFilter === 'all' || l.direction === directionFilter)
        .filter(l => statusFilter === 'all' || (statusFilter === 'settled') === isSettled(l))
        .sort((a, b) => {
            // Activos primero; entre ellos, los que vencen antes. Luego los más recientes.
            const sa = isSettled(a), sb = isSettled(b);
            if (sa !== sb) return sa ? 1 : -1;
            if (!sa && (a.dueDate || b.dueDate) && a.dueDate !== b.dueDate) {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate < b.dueDate ? -1 : 1;
            }
            return (b.createdAt || '').localeCompare(a.createdAt || '');
        });

    document.getElementById('loans-list').innerHTML = list.map(loanCard).join('');
    document.getElementById('loans-empty-state').classList.toggle('hidden', list.length > 0);
};

// ---------- Formulario de préstamo ----------
const loanForm = () => document.getElementById('loan-form');

const resetLoanForm = () => {
    loanForm().reset();
    document.getElementById('loan-id').value = '';
    document.getElementById('loan-start').value = todayStr();
    document.getElementById('loan-form-title').innerText = 'Nuevo préstamo';
    document.getElementById('text-submit-loan').innerText = 'Guardar Préstamo';
    updateDisbursementVisibility();
};

// La opción de registrar la salida del dinero aplica a préstamos "Yo presté" que aún no la tienen registrada.
const updateDisbursementVisibility = () => {
    const editing = state.allLoans.find(l => l.id === document.getElementById('loan-id').value);
    const isNewLent = document.getElementById('loan-direction').value === 'lent' && !(editing && editing.disbursementTxId);
    const checked = document.getElementById('loan-register-disbursement').checked;
    document.getElementById('loan-disbursement-container').classList.toggle('hidden', !isNewLent);
    document.getElementById('loan-disbursement-rule-container').classList.toggle('hidden', !checked);
};

const showLoanForm = () => {
    document.getElementById('loan-form-panel').classList.remove('hidden');
    document.getElementById('loan-person').focus();
};

const hideLoanForm = () => {
    document.getElementById('loan-form-panel').classList.add('hidden');
    resetLoanForm();
};

// ---------- Modal de pagos ----------
const paymentAmountInput = () => document.getElementById('payment-amount');

// Solo se sugiere un valor cuando hay cuotas; sin cuotas el campo queda vacío para no registrar el saldo completo por error.
const suggestedPayment = (loan) => {
    if (!(loan.installments > 0)) return 0;
    return Math.min(loanBalance(loan), loan.amount / loan.installments);
};

const renderPaymentsModal = () => {
    const loan = state.allLoans.find(l => l.id === openLoanId);
    if (!loan) { closePaymentsModal(); return; }

    const isBorrowed = loan.direction === 'borrowed';
    const settled = isSettled(loan);
    const paid = loanPaid(loan);

    document.getElementById('payments-modal-title').innerText = `${isBorrowed ? 'Pagos a' : 'Abonos de'} ${loan.person}`;
    document.getElementById('payments-summary-total').innerText = formatCOP(loan.amount);
    document.getElementById('payments-summary-paid').innerText = formatCOP(paid);
    document.getElementById('payments-summary-paid-label').innerText = isBorrowed ? 'Pagado' : 'Recibido';
    document.getElementById('payments-summary-balance').innerText = formatCOP(loanBalance(loan));

    document.getElementById('payment-form').classList.toggle('hidden', settled);
    document.getElementById('payments-settled-note').classList.toggle('hidden', !settled);
    document.getElementById('text-submit-payment').innerText = isBorrowed ? 'Registrar Pago' : 'Registrar Abono';
    document.getElementById('payment-link-help').innerText = isBorrowed
        ? 'Se registrará como Gasto (Obligaciones Bancarias · Necesidad).'
        : 'Se registrará como Ingreso del mes.';

    const payments = [...(loan.payments || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    const listEl = document.getElementById('payments-list');
    if (payments.length === 0) {
        listEl.innerHTML = '<p class="text-center text-sm text-slate-400 dark:text-slate-500 py-4">Aún no hay pagos registrados.</p>';
        return;
    }
    listEl.innerHTML = payments.map(p => `
        <div class="flex items-center justify-between gap-3 py-2">
            <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">${formatCOP(p.amount)}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 break-words">
                    ${formatDate(p.date)}${p.note ? ` · ${escapeHtml(p.note)}` : ''}
                    ${p.txId ? '<span class="ml-1 text-secondary" title="Registrado en el historial de movimientos"><i class="ph ph-link"></i></span>' : ''}
                </p>
            </div>
            <button onclick="window.deleteLoanPayment('${p.id}')" class="text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors shrink-0" title="Eliminar pago">
                <i class="ph-fill ph-trash text-lg"></i>
            </button>
        </div>
    `).join('');
};

const openPaymentsModal = (loanId) => {
    const loan = state.allLoans.find(l => l.id === loanId);
    if (!loan) return;
    openLoanId = loanId;

    document.getElementById('payment-form').reset();
    document.getElementById('payment-date').value = todayStr();
    const suggestion = suggestedPayment(loan);
    paymentAmountInput().value = suggestion > 0 ? formatAmountForInput(suggestion) : '';
    // Por defecto, los pagos de lo que debo cuentan como gasto y los abonos que recibo como ingreso.
    document.getElementById('payment-link-tx').checked = true;
    renderPaymentsModal();

    const modal = document.getElementById('payments-modal');
    const card = document.getElementById('payments-modal-card');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        card.classList.remove('scale-95');
        card.classList.add('scale-100');
        if (!isSettled(loan)) paymentAmountInput().select();
    }, 10);
};

const closePaymentsModal = () => {
    openLoanId = null;
    const modal = document.getElementById('payments-modal');
    const card = document.getElementById('payments-modal-card');
    modal.classList.add('opacity-0', 'pointer-events-none');
    card.classList.remove('scale-100');
    card.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

// ---------- Inicialización ----------
export const initLoans = () => {
    attachAmountFormatter(document.getElementById('loan-amount'));
    attachAmountFormatter(paymentAmountInput());
    resetLoanForm();

    document.getElementById('btn-new-loan').addEventListener('click', () => {
        const panel = document.getElementById('loan-form-panel');
        if (panel.classList.contains('hidden')) { resetLoanForm(); showLoanForm(); }
        else hideLoanForm();
    });
    document.getElementById('btn-cancel-loan').addEventListener('click', hideLoanForm);
    document.getElementById('loan-direction').addEventListener('change', updateDisbursementVisibility);
    document.getElementById('loan-register-disbursement').addEventListener('change', updateDisbursementVisibility);

    document.getElementById('btn-goto-loans').addEventListener('click', () => {
        document.getElementById('loans-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('loans-filter-status').addEventListener('change', (e) => { statusFilter = e.target.value; renderLoans(); });
    document.getElementById('loans-filter-direction').addEventListener('change', (e) => { directionFilter = e.target.value; renderLoans(); });

    loanForm().addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.currentUser) return;

        const amount = parseAmount(document.getElementById('loan-amount').value);
        if (isNaN(amount) || amount <= 0) return showToast('Ingrese un monto válido', 'error');
        const person = document.getElementById('loan-person').value.trim();
        if (!person) return showToast('Indique la persona o entidad', 'error');
        const installments = parseInt(document.getElementById('loan-installments').value, 10);

        const id = document.getElementById('loan-id').value;
        const data = {
            direction: document.getElementById('loan-direction').value,
            person,
            amount,
            installments: installments > 0 ? installments : null,
            startDate: document.getElementById('loan-start').value || todayStr(),
            dueDate: document.getElementById('loan-due').value || '',
            observation: document.getElementById('loan-obs').value.trim()
        };
        if (!id) {
            data.payments = [];
            data.createdAt = new Date().toISOString();
        }

        try {
            const existing = id ? state.allLoans.find(l => l.id === id) : null;
            const hasDisbursement = existing && existing.disbursementTxId;
            if (!hasDisbursement && data.direction === 'lent' && document.getElementById('loan-register-disbursement').checked) {
                data.disbursementRuleClass = document.getElementById('loan-disbursement-rule').value;
                data.disbursementTxId = await addLinkedTransaction(disbursementRecord(data, data.disbursementRuleClass));
            } else if (hasDisbursement) {
                // Mantiene sincronizado el gasto de la salida del dinero con los datos del préstamo.
                if (data.direction === 'lent') {
                    await updateLinkedTransaction(existing.disbursementTxId, disbursementRecord(data, existing.disbursementRuleClass || 'needs'))
                        .catch(() => { /* el movimiento pudo haberse borrado desde el historial */ });
                } else {
                    await deleteLinkedTransaction(existing.disbursementTxId).catch(() => {});
                    data.disbursementTxId = null;
                }
            }
            await saveLoan(id, data);
            showToast(id ? 'Préstamo actualizado' : 'Préstamo registrado', 'success');
            hideLoanForm();
        } catch (err) { showToast('Error al guardar el préstamo', 'error'); }
    });

    document.getElementById('payment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const loan = state.allLoans.find(l => l.id === openLoanId);
        if (!loan || !state.currentUser) return;

        const amount = parseAmount(paymentAmountInput().value);
        if (isNaN(amount) || amount <= 0) return showToast('Ingrese un valor válido', 'error');
        const balance = loanBalance(loan);
        if (amount > balance + 0.005) return showToast(`El valor supera el saldo pendiente (${formatCOP(balance)})`, 'error');
        if (amount >= balance - 0.005 && !confirm(`Este valor (${formatCOP(amount)}) salda el préstamo completo. ¿Deseas registrarlo?`)) return;

        const isBorrowed = loan.direction === 'borrowed';
        const dateIso = dateToIso(document.getElementById('payment-date').value || todayStr());
        const note = document.getElementById('payment-note').value.trim();
        const payment = {
            id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            date: dateIso,
            amount,
            note
        };

        const submitBtn = document.getElementById('btn-submit-payment');
        submitBtn.disabled = true;
        try {
            if (document.getElementById('payment-link-tx').checked) {
                payment.txId = await addLinkedTransaction({
                    type: isBorrowed ? 'expense' : 'income',
                    description: `${isBorrowed ? 'Pago préstamo' : 'Abono préstamo'} - ${loan.person}`,
                    amount,
                    chapter: isBorrowed ? 'Obligaciones' : 'Ingreso',
                    reference: 'Préstamo',
                    observation: note,
                    date: dateIso,
                    ruleClass: isBorrowed ? 'needs' : 'income'
                });
            }
            const updated = { ...loan, payments: [...(loan.payments || []), payment] };
            await saveLoan(loan.id, { payments: updated.payments });
            showToast(isBorrowed ? 'Pago registrado' : 'Abono registrado', 'success');

            document.getElementById('payment-note').value = '';
            const next = suggestedPayment(updated);
            paymentAmountInput().value = next > 0 ? formatAmountForInput(next) : '';
            if (isSettled(updated)) showToast('¡Préstamo saldado!', 'success');
        } catch (err) {
            showToast('Error al registrar el pago', 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });

    document.getElementById('btn-close-payments').addEventListener('click', closePaymentsModal);
    document.getElementById('payments-modal').addEventListener('click', (e) => {
        if (e.target.id === 'payments-modal') closePaymentsModal();
    });

    window.openLoanPayments = openPaymentsModal;

    window.editLoan = (id) => {
        const loan = state.allLoans.find(l => l.id === id);
        if (!loan) return;
        document.getElementById('loan-id').value = loan.id;
        document.getElementById('loan-direction').value = loan.direction;
        document.getElementById('loan-person').value = loan.person;
        document.getElementById('loan-amount').value = formatAmountForInput(loan.amount);
        document.getElementById('loan-installments').value = loan.installments || '';
        document.getElementById('loan-start').value = loan.startDate || '';
        document.getElementById('loan-due').value = loan.dueDate || '';
        document.getElementById('loan-obs').value = loan.observation || '';
        document.getElementById('loan-form-title').innerText = 'Editar préstamo';
        document.getElementById('text-submit-loan').innerText = 'Actualizar';
        updateDisbursementVisibility();
        showLoanForm();
        document.getElementById('loans-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.deleteLoan = async (id) => {
        const loan = state.allLoans.find(l => l.id === id);
        if (!loan) return;
        if (!confirm(`¿Eliminar el préstamo de "${loan.person}" y su historial de pagos?\n\nLos movimientos que ya se registraron en el historial del mes se conservan.`)) return;
        try {
            await removeLoan(id);
            showToast('Préstamo eliminado', 'success');
        } catch (err) { showToast('Error al eliminar el préstamo', 'error'); }
    };

    window.deleteLoanPayment = async (paymentId) => {
        const loan = state.allLoans.find(l => l.id === openLoanId);
        if (!loan) return;
        const payment = (loan.payments || []).find(p => p.id === paymentId);
        if (!payment) return;
        const msg = payment.txId
            ? '¿Eliminar este pago? También se eliminará el movimiento asociado en el historial.'
            : '¿Eliminar este pago?';
        if (!confirm(msg)) return;
        try {
            if (payment.txId) await deleteLinkedTransaction(payment.txId);
            await saveLoan(loan.id, { payments: loan.payments.filter(p => p.id !== paymentId) });
            showToast('Pago eliminado', 'success');
        } catch (err) { showToast('Error al eliminar el pago', 'error'); }
    };
};
