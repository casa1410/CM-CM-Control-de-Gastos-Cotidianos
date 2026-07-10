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

export const showToast = (message, type = 'info') => {
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
