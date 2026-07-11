// Modo oscuro: alterna la clase 'dark' en <html>, persiste la preferencia y ajusta los colores de Chart.js.
const THEME_KEY = 'ycm_theme';

const applyChartDefaults = () => {
    if (typeof Chart === 'undefined') return;
    const isDark = document.documentElement.classList.contains('dark');
    Chart.defaults.color = isDark ? '#cbd5e1' : '#475569';
    Chart.defaults.borderColor = isDark ? '#334155' : '#e2e8f0';
};

// onThemeChanged: callback para re-renderizar los gráficos con los nuevos colores.
export const initTheme = (onThemeChanged) => {
    applyChartDefaults();

    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
        applyChartDefaults();
        if (onThemeChanged) onThemeChanged();
    });
};
