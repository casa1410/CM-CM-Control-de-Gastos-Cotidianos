// Configuración de Firebase y constantes de la aplicación.
// Reemplaza los valores de abajo con las claves de TU proyecto de Firebase
// (Consola de Firebase > Configuración del proyecto > Tus apps > SDK config).
// Mientras estos valores sigan con el texto por defecto, la app funcionará
// automáticamente en "Modo Local" (los datos se guardan en este navegador).
export const firebaseConfig = {
    apiKey: "AIzaSyCWndUgvO8F6nWSTWiRWxSxf8fgwX6vMmc",
    authDomain: "cm-control-gastos.firebaseapp.com",
    projectId: "cm-control-gastos",
    storageBucket: "cm-control-gastos.firebasestorage.app",
    messagingSenderId: "814701952736",
    appId: "1:814701952736:web:3cbf89189a699585b51a85"
};

// Identificador de la app, usado como namespace de las colecciones en Firestore.
export const appId = 'cm-control-gastos';

// Modo local (sin nube) si no se han configurado las claves reales de Firebase.
export const isOfflineMode = firebaseConfig.apiKey === "TU_API_KEY_AQUI";

// Regla de distribución de ingresos por defecto (editable por el usuario).
export const DEFAULT_RULE = { needs: 70, wants: 15, savings: 15 };
