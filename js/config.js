// Configuración de Firebase y constantes de la aplicación.
// Reemplaza los valores de abajo con las claves de TU proyecto de Firebase
// (Consola de Firebase > Configuración del proyecto > Tus apps > SDK config).
// Mientras estos valores sigan con el texto por defecto, la app funcionará
// automáticamente en "Modo Local" (los datos se guardan en este navegador).
export const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "TU_DOMINIO.firebaseapp.com",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_BUCKET.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID"
};

// Identificador de la app, usado como namespace de las colecciones en Firestore.
export const appId = 'cm-control-gastos';

// Modo local (sin nube) si no se han configurado las claves reales de Firebase.
export const isOfflineMode = firebaseConfig.apiKey === "TU_API_KEY_AQUI";

// Regla de distribución de ingresos por defecto (editable por el usuario).
export const DEFAULT_RULE = { needs: 70, wants: 15, savings: 15 };
