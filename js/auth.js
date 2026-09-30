// Autenticación: correo/contraseña y modo local sin Firebase.
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { state } from './state.js';
import { auth } from './firebase.js';
import { isOfflineMode } from './config.js';
import { showToast } from './utils.js';
import { loadData } from './data.js';
import { loadRuleFromCloud } from './rules.js';

const loginLocal = () => {
    state.currentUser = { uid: 'local_user', email: 'invitado@local' };
    document.getElementById('auth-screen').classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
    }, 300);
    loadData();
    showToast('Simulador Local Iniciado', 'success');
};

export const initAuth = () => {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isOfflineMode) return loginLocal();

        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-password').value;
        if (!email || !pass) return showToast('Por favor llena los campos', 'error');

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            showToast('Sesión iniciada correctamente', 'success');
        } catch (error) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                try {
                    await createUserWithEmailAndPassword(auth, email, pass);
                    showToast('Cuenta creada y sesión iniciada', 'success');
                } catch (regError) { showToast('Error de autenticación.', 'error'); }
            } else { showToast('Error de conexión.', 'error'); }
        }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        if (isOfflineMode) { location.reload(); return; }
        signOut(auth);
        if (state.unsubscribeSnapshot) state.unsubscribeSnapshot();
        if (state.unsubscribeLoans) { state.unsubscribeLoans(); state.unsubscribeLoans = null; }
    });

    if (!isOfflineMode) {
        onAuthStateChanged(auth, async (user) => {
            const authScreen = document.getElementById('auth-screen');
            const appScreen = document.getElementById('app-screen');
            if (user) {
                state.currentUser = user;
                authScreen.classList.add('opacity-0', 'pointer-events-none');
                setTimeout(() => { authScreen.classList.add('hidden'); appScreen.classList.remove('hidden'); }, 300);
                await loadRuleFromCloud();
                loadData();
            } else {
                state.currentUser = null;
                appScreen.classList.add('hidden');
                authScreen.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
            }
        });
    }
};
