// Carga de datos: modo local (localStorage) o modo nube (Firestore en tiempo real).
import { collection, onSnapshot, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { db } from './firebase.js';
import { isOfflineMode, appId } from './config.js';
import { showToast } from './utils.js';
import { renderDashboard } from './dashboard.js';
import { renderComparisonChart } from './comparison.js';
import { loadLoans } from './loans.js';

export const getCollectionRef = () => {
    if (!state.currentUser) return null;
    return collection(db, 'artifacts', appId, 'users', state.currentUser.uid, 'transactions');
};

export const loadData = () => {
    if (!state.currentUser) return;
    loadLoans();

    if (isOfflineMode) {
        const stored = localStorage.getItem('ycm_txs');
        state.allTransactions = stored ? JSON.parse(stored) : [];
        renderDashboard();
        renderComparisonChart();
        return;
    }

    state.unsubscribeSnapshot = onSnapshot(query(getCollectionRef()), (snapshot) => {
        state.allTransactions = [];
        snapshot.forEach((doc) => { state.allTransactions.push({ id: doc.id, ...doc.data() }); });
        renderDashboard();
        renderComparisonChart();
    }, (error) => { showToast("Error al cargar datos", "error"); });
};
