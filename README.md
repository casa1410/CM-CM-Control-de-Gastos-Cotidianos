# CM & CM Control de Gastos Cotidianos

Aplicación web para el control de gastos e ingresos personales, basada en una regla de distribución de ingresos (por defecto 70% Necesidades / 15% Deseos / 15% Ahorro-Inversión) **totalmente personalizable** por el usuario.

Funciona en el navegador (PC y móvil), con guardado en la nube (Firebase) o en modo local (sin cuenta, usando el propio navegador) y permite descargar una copia de seguridad de todos tus datos en cualquier momento.

## Características

- Registro de ingresos y gastos, con capítulo, medio de pago, referencia, observaciones y soporte adjunto (imagen o PDF).
- Regla de distribución **editable**: define tus propios porcentajes (ej. 60/20/20, 50/30/20) desde el panel de configuración (ícono de ajustes junto a "Estado Regla"). Deben sumar 100%.
- Importación de historial desde CSV.
- **Préstamos**: lleva los préstamos que pediste (yo debo) y los que hiciste (me deben), con monto total, cuotas, fecha límite y el historial de pagos/abonos. Cada pago puede registrarse también como movimiento del mes (gasto en *Obligaciones Bancarias* o ingreso), y al prestar dinero su salida puede registrarse como gasto en el capítulo *Préstamos*.
- Copia de seguridad manual: botón para **descargar** un `.json` con todos tus movimientos y tu regla personalizada, y botón para **restaurarla** cuando quieras. Se genera directamente en tu navegador, sin pasar por ningún servidor intermedio.
- **Resumen de ahorro**: cuánto ahorraste cada mes (lo registrado como Ahorro/Inversión + el saldo sobrante) y el total acumulado.
- Gráficos de distribución, gastos por capítulo, ingresos vs. gastos y análisis histórico comparativo.
- Modo nube (Firebase Auth + Firestore) o Modo Local (localStorage) si no configuras Firebase.
- Diseño responsivo: se adapta a pantallas de PC, tablet y móvil.

## Estructura del proyecto

```
cm-control-gastos/
├── index.html              # Estructura de la página
├── css/
│   └── styles.css          # Estilos personalizados
├── js/
│   ├── tailwind-config.js  # Configuración de colores/fuentes de Tailwind
│   ├── config.js           # Configuración de Firebase y constantes
│   ├── firebase.js         # Inicialización de Firebase (Auth + Firestore)
│   ├── state.js             # Estado global compartido de la app
│   ├── utils.js             # Formato de moneda, parseo, notificaciones (toast)
│   ├── rules.js             # Regla 70/15/15 editable (guardar/cargar/aplicar)
│   ├── attachments.js       # Adjuntos: compresión de imágenes, modal de vista
│   ├── data.js               # Carga de datos (modo local / tiempo real en Firestore)
│   ├── auth.js               # Login, registro, invitado, cierre de sesión
│   ├── transactions.js       # Crear, editar y eliminar movimientos
│   ├── dashboard.js          # Resumen, barras de la regla, tabla y gráficos del mes
│   ├── comparison.js         # Gráfico comparativo histórico
│   ├── savings.js            # Resumen de ahorro mensual y acumulado
│   ├── csvImport.js          # Importación de historial desde CSV
│   ├── backup.js             # Exportar / restaurar copia de seguridad
│   ├── loans.js              # Préstamos (yo debo / me deben) y sus pagos
│   └── main.js                # Punto de entrada, conecta todos los módulos
└── assets/                    # (opcional) íconos, imágenes propias
```

## Cómo probarlo en tu computador

La app usa módulos de JavaScript (`type="module"`), por lo que **no funciona abriendo `index.html` directamente con doble clic** (los navegadores bloquean módulos cargados con `file://`). Necesitas un servidor local sencillo:

**Opción A — Extensión "Live Server" de VS Code**
1. Instala la extensión "Live Server".
2. Clic derecho sobre `index.html` → "Open with Live Server".

**Opción B — Python (ya viene instalado en muchos equipos)**
```bash
cd cm-control-gastos
python -m http.server 8080
```
Y abre `http://localhost:8080` en el navegador.

Al abrir la app sin haber configurado Firebase, funcionará automáticamente en **Modo Local** (botón "Probar App (Modo Local)"): los datos se guardan en el navegador (localStorage) de ese equipo.

## Cómo activar el guardado en la nube (Firebase)

Firebase es gratuito para este tipo de uso personal (plan Spark) y evita tener que programar y mantener un servidor propio.

1. Ve a [https://console.firebase.google.com](https://console.firebase.google.com) e inicia sesión con tu cuenta de Google.
2. Crea un proyecto nuevo (ej. "cm-control-gastos").
3. En el panel del proyecto, ve a **Compilación → Authentication → Comenzar** y habilita los métodos "Correo electrónico/contraseña" y "Anónimo".
4. Ve a **Compilación → Firestore Database → Crear base de datos** (modo producción, elige la región más cercana).
5. Ve a **Configuración del proyecto** (ícono de engranaje) → en "Tus apps" pulsa el ícono `</>` para registrar una app web.
6. Copia el objeto `firebaseConfig` que te entrega Firebase.
7. Pégalo en [js/config.js](js/config.js), reemplazando los valores de ejemplo (`TU_API_KEY_AQUI`, etc.).
8. Guarda, recarga la app: ahora el botón de login pedirá correo/contraseña reales y tus datos (incluida tu regla personalizada) se guardarán en la nube, sincronizados entre dispositivos.

> Mientras `js/config.js` conserve los valores de ejemplo, la app seguirá funcionando en Modo Local automáticamente — no se rompe nada si aún no configuras Firebase.

### Reglas de seguridad recomendadas para Firestore

Para que cada usuario solo pueda leer/escribir sus propios datos, en Firestore → Reglas, usa algo como:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Copia de seguridad

En la tarjeta "Copia de Seguridad" puedes:
- **Descargar Copia de Seguridad**: genera un archivo `.json` con todos tus movimientos, préstamos y tu regla personalizada, descargado directamente a tu equipo o celular (sin intermediarios).
- **Restaurar Copia**: sube un `.json` generado previamente para recuperar tus datos (reemplaza los movimientos actuales, pide confirmación antes de continuar).

Se recomienda descargar una copia periódicamente, sobre todo si usas Modo Local (los datos viven solo en ese navegador).

## Publicarlo en GitHub Pages (gratis)

1. Sube este proyecto a un repositorio de GitHub.
2. En el repositorio, ve a **Settings → Pages**.
3. En "Source" elige la rama `main` y la carpeta `/root`.
4. Guarda: en un par de minutos tu app estará disponible en `https://tu-usuario.github.io/nombre-del-repo/`, accesible desde PC y celular.

## Tecnologías usadas

- HTML + [Tailwind CSS](https://tailwindcss.com/) (vía CDN) para el diseño responsivo.
- [Chart.js](https://www.chartjs.org/) para los gráficos.
- [Phosphor Icons](https://phosphoricons.com/) para los íconos.
- [Firebase](https://firebase.google.com/) (Authentication + Firestore) para el guardado en la nube.
- JavaScript modular (ES Modules), sin frameworks ni pasos de compilación (`build`).
