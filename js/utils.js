// Utilidades de formato y notificaciones.

export const formatCOP = (value) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2
    }).format(value);
};

export const parseAmount = (valStr) => {
    if (!valStr) return 0;
    return parseFloat(valStr.replace(/\./g, '').replace(/,/g, '.'));
};

// Formato dinámico de miles mientras se escribe en un input de valor (ej. 1.500.000,50).
export const attachAmountFormatter = (input) => {
    input.addEventListener('input', function (e) {
        let rawValue = e.target.value;
        let value = rawValue.replace(/\./g, '').replace(/,/g, '.');
        value = value.replace(/[^0-9.]/g, '');

        const parts = value.split('.');
        if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');

        if (value !== '') {
            let formatted = new Intl.NumberFormat('es-CO').format(parts[0]);
            if (parts.length > 1) {
                formatted += ',' + parts[1].substring(0, 2);
            } else if (rawValue.endsWith(',')) {
                formatted += ',';
            }
            e.target.value = formatted;
        } else {
            e.target.value = '';
        }
    });
};

// Convierte un número al formato que usan los inputs de valor (ej. 1500000.5 -> "1.500.000,5").
export const formatAmountForInput = (amount) => {
    const rounded = Math.round(amount * 100) / 100;
    const parts = rounded.toString().split('.');
    let formatted = new Intl.NumberFormat('es-CO').format(parts[0]);
    if (parts.length > 1) formatted += ',' + parts[1];
    return formatted;
};

export const escapeHtml = (text) => String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const showToast =(message, type = 'info') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-rose-500' : type === 'success' ? 'bg-emerald-500' : 'bg-secondary';
    toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2 transform transition-all duration-300 translate-x-full opacity-0 pointer-events-auto`;
    toast.innerHTML = `<i class="ph-fill ${type === 'error' ? 'ph-warning-circle' : 'ph-check-circle'} text-lg"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => { toast.classList.remove('translate-x-full', 'opacity-0'); }, 10);
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};
