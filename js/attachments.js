// Gestión de archivos adjuntos (recibos/soportes): compresión, selección y modal de vista.
import { state } from './state.js';
import { showToast } from './utils.js';

const fileInput = document.getElementById('tx-file');
const fileNameDisplay = document.getElementById('file-name-display');
const btnClearFile = document.getElementById('btn-clear-file');

// Comprimir imagen usando Canvas
const compressImage = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1000;
                const MAX_HEIGHT = 1000;
                let width = img.width;
                let height = img.height;

                if (width > height && width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width; width = MAX_WIDTH;
                } else if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height; height = MAX_HEIGHT;
                }

                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve({ data: canvas.toDataURL('image/jpeg', 0.7), type: 'image/jpeg' });
            };
        };
    });
};

export const resetFileInput = () => {
    fileInput.value = '';
    state.currentFileBase64 = null;
    state.currentFileType = null;
    fileNameDisplay.innerText = 'Adjuntar PDF / Imagen';
    btnClearFile.classList.add('hidden');
};

export const setExistingAttachmentLabel = () => {
    fileNameDisplay.innerText = 'Soporte existente adjunto';
    btnClearFile.classList.add('hidden');
};

export const initAttachments = () => {
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type === 'application/pdf' && file.size > 500 * 1024) {
            showToast('El archivo PDF excede los 500KB. Por favor, redúcelo.', 'error');
            fileInput.value = '';
            return;
        }

        fileNameDisplay.innerText = "Procesando...";

        try {
            if (file.type.startsWith('image/')) {
                const compressed = await compressImage(file);
                state.currentFileBase64 = compressed.data;
                state.currentFileType = compressed.type;
            } else {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    state.currentFileBase64 = evt.target.result;
                    state.currentFileType = file.type;
                    fileNameDisplay.innerText = file.name.length > 15 ? file.name.substring(0, 15) + '...' : file.name;
                    btnClearFile.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
                return;
            }
            fileNameDisplay.innerText = file.name.length > 15 ? file.name.substring(0, 15) + '...' : file.name;
            btnClearFile.classList.remove('hidden');
        } catch (err) {
            showToast('Error al procesar el archivo', 'error');
            resetFileInput();
        }
    });

    btnClearFile.addEventListener('click', resetFileInput);

    window.viewAttachment = (id) => {
        const tx = state.allTransactions.find(t => t.id === id);
        if (!tx || !tx.fileAttachment) return;

        const modal = document.getElementById('attachment-modal');
        const contentDiv = document.getElementById('attachment-content');
        const card = document.getElementById('attachment-modal-card');

        contentDiv.innerHTML = '<div class="animate-pulse flex flex-col items-center text-slate-500"><i class="ph ph-spinner-gap animate-spin text-4xl mb-2"></i> Cargando documento...</div>';

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0', 'pointer-events-none');
            card.classList.remove('scale-95');
            card.classList.add('scale-100');
        }, 10);

        setTimeout(() => {
            if (tx.fileType === 'application/pdf') {
                contentDiv.innerHTML = `<iframe src="${tx.fileAttachment}" class="w-full h-full border-0 shadow-sm rounded-lg" title="Soporte PDF"></iframe>`;
            } else {
                contentDiv.innerHTML = `<img src="${tx.fileAttachment}" class="max-w-full max-h-full object-contain rounded-lg shadow-sm" alt="Soporte de transacción" />`;
            }
        }, 300);
    };

    window.closeAttachmentModal = () => {
        const modal = document.getElementById('attachment-modal');
        const card = document.getElementById('attachment-modal-card');
        modal.classList.add('opacity-0', 'pointer-events-none');
        card.classList.remove('scale-100');
        card.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.getElementById('attachment-content').innerHTML = '';
        }, 300);
    };
};
