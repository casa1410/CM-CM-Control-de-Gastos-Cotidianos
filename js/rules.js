// Regla de distribución de ingresos (70/15/15 por defecto), editable por el usuario.
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { showToast } from './utils.js';
import { db } from './firebase.js';
import { isOfflineMode, appId, DEFAULT_RULE } from './config.js';

const RULE_STORAGE_KEY = 'ycm_rule';

const isValidRule = (r) => r && typeof r.needs === 'number' && typeof r.wants === 'number' && typeof r.savings === 'number'
    && Math.round(r.needs + r.wants + r.savings) === 100;

const saveRuleLocal = (rule) => localStorage.setItem(RULE_STORAGE_KEY, JSON.stringify(rule));

const loadRuleFromLocal = () => {
    const stored = localStorage.getItem(RULE_STORAGE_KEY);
    if (!stored) return;
    try {
        const parsed = JSON.parse(stored);
        if (isValidRule(parsed)) state.rule = parsed;
    } catch (e) { /* ignora datos corruptos */ }
};

const getRuleDocRef = () => {
    if (!state.currentUser || isOfflineMode) return null;
    return doc(db, 'artifacts', appId, 'users', state.currentUser.uid, 'settings', 'rule');
};

// Se llama al iniciar sesión en modo nube, para sincronizar la regla entre dispositivos.
export const loadRuleFromCloud = async () => {
    if (isOfflineMode || !state.currentUser) return;
    try {
        const ref = getRuleDocRef();
        if (!ref) return;
        const snap = await getDoc(ref);
        if (snap.exists() && isValidRule(snap.data())) {
            const data = snap.data();
            state.rule = { needs: data.needs, wants: data.wants, savings: data.savings };
            saveRuleLocal(state.rule);
        }
    } catch (e) {
        console.log('No se pudo cargar la regla desde la nube', e);
    }
    applyRuleToUI();
};

const saveRule = async (rule) => {
    state.rule = rule;
    saveRuleLocal(rule);
    if (!isOfflineMode && state.currentUser) {
        try {
            const ref = getRuleDocRef();
            if (ref) await setDoc(ref, rule);
        } catch (e) {
            console.log('No se pudo guardar la regla en la nube', e);
        }
    }
    applyRuleToUI();
};

export const applyRuleToUI = () => {
    document.getElementById('rule-label-needs').innerText = state.rule.needs;
    document.getElementById('rule-label-wants').innerText = state.rule.wants;
    document.getElementById('rule-label-savings').innerText = state.rule.savings;
    document.getElementById('rule-title').innerText = `${state.rule.needs}/${state.rule.wants}/${state.rule.savings}`;
    document.getElementById('rule-input-needs').value = state.rule.needs;
    document.getElementById('rule-input-wants').value = state.rule.wants;
    document.getElementById('rule-input-savings').value = state.rule.savings;
    updateRuleSumIndicator();
};

const updateRuleSumIndicator = () => {
    const needs = parseFloat(document.getElementById('rule-input-needs').value) || 0;
    const wants = parseFloat(document.getElementById('rule-input-wants').value) || 0;
    const savings = parseFloat(document.getElementById('rule-input-savings').value) || 0;
    const sum = needs + wants + savings;
    const indicator = document.getElementById('rule-sum-indicator');
    const saveBtn = document.getElementById('btn-save-rule');
    indicator.innerText = `Suma actual: ${sum}%`;
    if (sum === 100) {
        indicator.className = 'text-xs font-medium text-emerald-600';
        saveBtn.disabled = false;
        saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        indicator.className = 'text-xs font-medium text-rose-500';
        saveBtn.disabled = true;
        saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
};

// onRuleChanged: callback para re-renderizar el dashboard cuando cambian los porcentajes.
export const initRuleSettingsUI = (onRuleChanged) => {
    loadRuleFromLocal();
    applyRuleToUI();

    document.getElementById('btn-toggle-rule-settings').addEventListener('click', () => {
        document.getElementById('rule-settings-panel').classList.toggle('hidden');
    });

    ['rule-input-needs', 'rule-input-wants', 'rule-input-savings'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateRuleSumIndicator);
    });

    document.getElementById('btn-reset-rule').addEventListener('click', async () => {
        await saveRule({ ...DEFAULT_RULE });
        showToast('Regla restablecida a 70/15/15', 'success');
        if (onRuleChanged) onRuleChanged();
    });

    document.getElementById('btn-save-rule').addEventListener('click', async () => {
        const needs = parseFloat(document.getElementById('rule-input-needs').value) || 0;
        const wants = parseFloat(document.getElementById('rule-input-wants').value) || 0;
        const savings = parseFloat(document.getElementById('rule-input-savings').value) || 0;
        if (needs + wants + savings !== 100) return showToast('Los porcentajes deben sumar 100%', 'error');

        await saveRule({ needs, wants, savings });
        showToast('Regla guardada correctamente', 'success');
        document.getElementById('rule-settings-panel').classList.add('hidden');
        if (onRuleChanged) onRuleChanged();
    });
};
