const MQ_FILE_LIMIT = 6;
const MQ_INLINE_LIMIT = 4 * 1024 * 1024;
const MQ_TEXT_LIMIT = 30000;
const MQ_QUICK_ACTIONS = [
    { label: "Diagnostico", prompt: "Quiero un diagnostico de claridad y prioridades." },
    { label: "Archivo", prompt: "Quiero analizar un archivo o documento." },
    { label: "Imagen", prompt: "Quiero revisar una imagen o foto." },
    { label: "Ventas", prompt: "Quiero mejorar ventas y conseguir clientes." },
    { label: "Contenido", prompt: "Quiero crear contenido para redes." },
    { label: "Soporte", prompt: "Necesito soporte o hablar con un humano." },
    { label: "Llaves IA", prompt: "Quiero activar llaves Gemini." }
];

const mqState = {
    attachments: [],
    currentUtterance: null,
    isListening: false,
    isSending: false,
    recognition: null,
    voiceDraftBase: "",
    voiceEnabled: true,
    voices: []
};

const mqEls = {};

function initMaxiQueenChat() {
    mqEls.chat = document.getElementById("mqChat");
    mqEls.body = document.getElementById("mqChatBody");
    mqEls.input = document.getElementById("mqInput");
    mqEls.sendBtn = document.getElementById("mqSendBtn");
    mqEls.fileInput = document.getElementById("mqFileInput");
    mqEls.tray = document.getElementById("mqAttachmentTray");
    mqEls.avatar = document.getElementById("mqAvatar");
    mqEls.status = document.getElementById("mqStatus");
    mqEls.micBtn = document.getElementById("mqMicBtn");
    mqEls.pauseVoiceBtn = document.getElementById("mqPauseVoiceBtn");
    mqEls.resumeVoiceBtn = document.getElementById("mqResumeVoiceBtn");
    mqEls.stopVoiceBtn = document.getElementById("mqStopVoiceBtn");
    mqEls.voiceToggle = document.getElementById("mqVoiceToggle");
    mqEls.minimizeBtn = document.getElementById("mqMinimizeBtn");
    mqEls.launcher = document.querySelector(".mq-burbuja-v2");

    if (!mqEls.chat || !mqEls.body || !mqEls.input) return;

    mqEls.sendBtn?.addEventListener("click", sendMessage);
    mqEls.fileInput?.addEventListener("change", handleFileSelection);
    mqEls.micBtn?.addEventListener("click", toggleListening);
    mqEls.pauseVoiceBtn?.addEventListener("click", pauseVoice);
    mqEls.resumeVoiceBtn?.addEventListener("click", resumeVoice);
    mqEls.stopVoiceBtn?.addEventListener("click", stopVoice);
    mqEls.voiceToggle?.addEventListener("click", toggleVoiceOutput);
    mqEls.minimizeBtn?.addEventListener("click", toggleChat);
    mqEls.launcher?.addEventListener("click", toggleChat);
    mqEls.voiceToggle?.classList.add("is-active");

    mqEls.input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    setupVoiceRecognition();
    hydrateVoices();
    renderAttachments();
    updateLauncherVisibility();
    updateApiModeLabel();
    renderQuickActions(MQ_QUICK_ACTIONS);
}

async function sendMessage() {
    if (mqState.isSending) return;

    const message = mqEls.input.value.trim();
    const attachments = mqState.attachments.slice();

    if (!message && !attachments.length) return;

    removeQuickActions();
    addMessage(buildUserEcho(message, attachments), "user");
    mqEls.input.value = "";
    setSending(true);
    setAvatarMode("thinking", "Analizando");

    const thinkingBubble = addMessage("Procesando", "bot", { thinking: true });

    try {
        if (typeof chatWithMaxiQueen !== "function") {
            throw new Error("chatWithMaxiQueen no esta disponible");
        }

        const response = await chatWithMaxiQueen(message, { attachments });
        updateBotMessage(thinkingBubble, response);
        clearAttachments();
        setAvatarMode("idle", "Nucleo listo");
        speakText(response);
        renderQuickActions(getContextualQuickActions(message, attachments));
    } catch (err) {
        console.error("[MQ_CHAT] Error:", err);
        updateBotMessage(
            thinkingBubble,
            "Error conectando con el panel de IA. Revisa tu conexion o la configuracion de la API."
        );
        setAvatarMode("idle", "Conexion pendiente");
        renderQuickActions(MQ_QUICK_ACTIONS);
    } finally {
        setSending(false);
    }
}

function addMessage(text, type, options = {}) {
    const message = document.createElement("div");
    message.className = `mq-message ${type}`;

    const bubble = document.createElement("div");
    bubble.className = "mq-bubble";
    if (options.thinking) bubble.classList.add("is-thinking");
    bubble.innerText = text;

    message.appendChild(bubble);
    mqEls.body.appendChild(message);
    scrollChatToBottom();

    return bubble;
}

function updateBotMessage(bubble, text) {
    bubble.classList.remove("is-thinking");
    bubble.innerText = text;
    scrollChatToBottom();
}

function buildUserEcho(message, attachments) {
    const baseText = message || "Analiza los archivos adjuntos.";

    if (!attachments.length) return baseText;

    const fileLines = attachments.map((file) => `- ${file.name}`).join("\n");
    return `${baseText}\n\nAdjuntos:\n${fileLines}`;
}

function scrollChatToBottom() {
    requestAnimationFrame(() => {
        mqEls.body.scrollTop = mqEls.body.scrollHeight;
    });
}

function setSending(isSending) {
    mqState.isSending = isSending;
    if (mqEls.sendBtn) {
        mqEls.sendBtn.disabled = isSending;
        mqEls.sendBtn.innerText = isSending ? "..." : "Enviar";
    }
}

async function handleFileSelection(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const remaining = MQ_FILE_LIMIT - mqState.attachments.length;
    const acceptedFiles = files.slice(0, Math.max(remaining, 0));

    if (!acceptedFiles.length) {
        addMessage(`Puedes adjuntar hasta ${MQ_FILE_LIMIT} archivos por mensaje.`, "bot");
        event.target.value = "";
        return;
    }

    setAvatarMode("thinking", "Leyendo archivos");

    for (const file of acceptedFiles) {
        try {
            const attachment = await prepareAttachment(file);
            mqState.attachments.push(attachment);
        } catch (err) {
            console.error("[MQ_FILE] Error:", err);
            addMessage(err.message || `No pude preparar el archivo ${file.name}.`, "bot");
        }
    }

    renderAttachments();
    setAvatarMode("idle", mqState.attachments.length ? "Adjuntos listos" : "Nucleo listo");
    event.target.value = "";
}

async function prepareAttachment(file) {
    const mimeType = file.type || inferMimeType(file.name);

    if (file.size > MQ_INLINE_LIMIT && !isTextLike(file, mimeType)) {
        throw new Error(`${file.name} supera el limite de 4 MB para analisis directo.`);
    }

    const baseAttachment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        kind: getAttachmentKind(file, mimeType),
        mimeType,
        name: file.name,
        previewUrl: "",
        size: file.size
    };

    if (isTextLike(file, mimeType)) {
        const text = await readFileAsText(file);
        return {
            ...baseAttachment,
            text: text.length > MQ_TEXT_LIMIT
                ? `${text.slice(0, MQ_TEXT_LIMIT)}\n\n[Contenido truncado por tamano. Analiza este fragmento inicial.]`
                : text
        };
    }

    if (mimeType.startsWith("image/")) {
        const dataUrl = await readFileAsDataUrl(file);
        const previewUrl = URL.createObjectURL(file);
        const imageAnalysis = await analyzeImagePreview(previewUrl);

        return {
            ...baseAttachment,
            base64: dataUrl.split(",")[1],
            imageAnalysis,
            previewUrl
        };
    }

    if (mimeType === "application/pdf") {
        const dataUrl = await readFileAsDataUrl(file);
        return {
            ...baseAttachment,
            base64: dataUrl.split(",")[1]
        };
    }

    throw new Error(`${file.name} no es compatible todavia. Usa imagen, PDF, TXT, MD, CSV, JSON, HTML, CSS, JS o PY.`);
}

function renderAttachments() {
    if (!mqEls.tray) return;

    mqEls.tray.innerHTML = "";
    mqEls.tray.classList.toggle("is-empty", mqState.attachments.length === 0);

    mqState.attachments.forEach((file) => {
        const item = document.createElement("div");
        item.className = "mq-attachment";

        const thumb = document.createElement("div");
        thumb.className = "mq-attachment-thumb";

        if (file.previewUrl) {
            const img = document.createElement("img");
            img.src = file.previewUrl;
            img.alt = file.name;
            thumb.appendChild(img);
        } else {
            thumb.innerText = file.kind;
        }

        const info = document.createElement("div");

        const name = document.createElement("div");
        name.className = "mq-attachment-name";
        name.innerText = file.name;

        const meta = document.createElement("div");
        meta.className = "mq-attachment-meta";
        meta.innerText = `${file.mimeType || "archivo"} · ${formatBytes(file.size)}`;

        info.appendChild(name);
        info.appendChild(meta);

        const remove = document.createElement("button");
        remove.className = "mq-remove-attachment";
        remove.type = "button";
        remove.title = "Quitar adjunto";
        remove.innerText = "x";
        remove.addEventListener("click", () => removeAttachment(file.id));

        item.appendChild(thumb);
        item.appendChild(info);
        item.appendChild(remove);
        mqEls.tray.appendChild(item);
    });
}

function removeAttachment(id) {
    const target = mqState.attachments.find((file) => file.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);

    mqState.attachments = mqState.attachments.filter((file) => file.id !== id);
    renderAttachments();
    setAvatarMode("idle", mqState.attachments.length ? "Adjuntos listos" : "Nucleo listo");
}

function clearAttachments() {
    mqState.attachments.forEach((file) => {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
    });
    mqState.attachments = [];
    renderAttachments();
}

function setupVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        if (mqEls.micBtn) {
            mqEls.micBtn.disabled = true;
            mqEls.micBtn.title = "Tu navegador no soporta dictado por voz";
        }
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-CO";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
        mqState.isListening = true;
        mqEls.micBtn?.classList.add("is-active");
        setAvatarMode("listening", "Escuchando");
    };

    recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";

        for (let index = event.resultIndex; index < event.results.length; index++) {
            const transcript = event.results[index][0].transcript;
            if (event.results[index].isFinal) {
                finalText += transcript;
            } else {
                interimText += transcript;
            }
        }

        if (finalText) {
            mqState.voiceDraftBase = joinText(mqState.voiceDraftBase, finalText);
        }

        mqEls.input.value = joinText(mqState.voiceDraftBase, interimText);
    };

    recognition.onerror = (event) => {
        console.warn("[MQ_VOICE] Recognition error:", event.error);
        mqState.isListening = false;
        mqEls.micBtn?.classList.remove("is-active");
        setAvatarMode("idle", event.error === "not-allowed" ? "Permiso de microfono requerido" : "Dictado pausado");
    };

    recognition.onend = () => {
        if (mqState.isListening) {
            try {
                recognition.start();
            } catch (err) {
                mqState.isListening = false;
                mqEls.micBtn?.classList.remove("is-active");
                setAvatarMode("idle", "Dictado pausado");
            }
            return;
        }

        mqEls.micBtn?.classList.remove("is-active");
        setAvatarMode("idle", "Nucleo listo");
    };

    mqState.recognition = recognition;
}

function toggleListening() {
    if (!mqState.recognition) return;

    if (mqState.isListening) {
        stopListening();
    } else {
        startListening();
    }
}

function startListening() {
    mqState.voiceDraftBase = mqEls.input.value.trim();

    try {
        mqState.recognition.start();
    } catch (err) {
        console.warn("[MQ_VOICE] Start ignored:", err);
    }
}

function stopListening() {
    mqState.isListening = false;

    try {
        mqState.recognition.stop();
    } catch (err) {
        console.warn("[MQ_VOICE] Stop ignored:", err);
    }

    mqEls.micBtn?.classList.remove("is-active");
    setAvatarMode("idle", "Nucleo listo");
}

function speakText(text) {
    if (!mqState.voiceEnabled || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText(text));
    utterance.lang = "es-CO";
    utterance.rate = 1;
    utterance.pitch = 1.02;

    const voice = selectSpanishVoice();
    if (voice) utterance.voice = voice;

    utterance.onstart = () => setAvatarMode("speaking", "Hablando");
    utterance.onpause = () => setAvatarMode("idle", "Voz pausada");
    utterance.onresume = () => setAvatarMode("speaking", "Hablando");
    utterance.onend = () => setAvatarMode("idle", "Nucleo listo");
    utterance.onerror = () => setAvatarMode("idle", "Voz detenida");

    mqState.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

function pauseVoice() {
    if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        setAvatarMode("idle", "Voz pausada");
    }
}

function resumeVoice() {
    if ("speechSynthesis" in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setAvatarMode("speaking", "Hablando");
    }
}

function stopVoice() {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
    setAvatarMode("idle", "Voz detenida");
}

function toggleVoiceOutput() {
    mqState.voiceEnabled = !mqState.voiceEnabled;
    mqEls.voiceToggle?.classList.toggle("is-active", mqState.voiceEnabled);
    if (mqEls.voiceToggle) {
        mqEls.voiceToggle.innerText = mqState.voiceEnabled ? "Voz" : "Mute";
    }

    if (!mqState.voiceEnabled) {
        stopVoice();
    } else {
        setAvatarMode("idle", "Voz activa");
    }
}

function hydrateVoices() {
    if (!("speechSynthesis" in window)) return;

    mqState.voices = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        mqState.voices = window.speechSynthesis.getVoices();
    };
}

function selectSpanishVoice() {
    const voices = mqState.voices.length ? mqState.voices : window.speechSynthesis.getVoices();

    return voices.find((voice) => voice.lang === "es-CO")
        || voices.find((voice) => voice.lang?.startsWith("es"))
        || null;
}

function setAvatarMode(mode, status) {
    if (mqEls.avatar) {
        mqEls.avatar.classList.remove("is-listening", "is-thinking", "is-speaking");
        if (mode !== "idle") mqEls.avatar.classList.add(`is-${mode}`);
    }

    if (mqEls.status && status) {
        mqEls.status.innerText = status;
    }
}

function toggleChat() {
    mqEls.chat?.classList.toggle("minimized");
    updateLauncherVisibility();
}

function updateLauncherVisibility() {
    if (!mqEls.chat || !mqEls.launcher) return;

    const isMinimized = mqEls.chat.classList.contains("minimized");
    mqEls.launcher.classList.toggle("is-hidden", !isMinimized);
    mqEls.launcher.setAttribute("aria-expanded", String(!isMinimized));
}

function updateApiModeLabel() {
    const mode = typeof window.getMaxiQueenApiMode === "function"
        ? window.getMaxiQueenApiMode()
        : "local";

    setAvatarMode("idle", mode === "gemini" ? "IA Gemini activa" : "Modo local activo");
}

function renderQuickActions(actions = MQ_QUICK_ACTIONS) {
    if (!mqEls.body || !actions.length) return;

    removeQuickActions();

    const wrapper = document.createElement("div");
    wrapper.className = "mq-quick-actions";
    wrapper.setAttribute("aria-label", "Opciones rapidas");

    actions.forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mq-quick-action";
        button.innerText = action.label;
        button.addEventListener("click", () => {
            mqEls.input.value = action.prompt;
            sendMessage();
        });
        wrapper.appendChild(button);
    });

    mqEls.body.appendChild(wrapper);
    scrollChatToBottom();
}

function removeQuickActions() {
    mqEls.body?.querySelectorAll(".mq-quick-actions").forEach((node) => node.remove());
}

function getContextualQuickActions(message = "", attachments = []) {
    const text = normalizeChatText(message);

    if (attachments.length) {
        return [
            { label: "Resumen", prompt: "Hazme un resumen ejecutivo del archivo." },
            { label: "Riesgos", prompt: "Detecta riesgos, errores o puntos debiles." },
            { label: "Acciones", prompt: "Dame siguientes pasos concretos." },
            { label: "Otro archivo", prompt: "Quiero subir otro archivo para comparar." }
        ];
    }

    if (text.includes("venta") || text.includes("negocio") || text.includes("cliente")) {
        return [
            { label: "Oferta", prompt: "Ayudame a crear una oferta clara." },
            { label: "Objeciones", prompt: "Ayudame a responder objeciones de clientes." },
            { label: "WhatsApp", prompt: "Crea un guion para WhatsApp de ventas." },
            { label: "Contenido", prompt: "Crea contenido para atraer clientes." }
        ];
    }

    if (text.includes("diagnostico") || text.includes("claridad") || text.includes("prioridad") || text.includes("bloqueo")) {
        return [
            { label: "Ordenar ideas", prompt: "Ayudame a ordenar mis ideas en prioridades." },
            { label: "Plan simple", prompt: "Hazme un plan simple de 3 pasos." },
            { label: "Bloqueo", prompt: "Estoy bloqueado y necesito saber por donde empezar." },
            { label: "Subir contexto", prompt: "Voy a subir un archivo o captura con mi contexto." }
        ];
    }

    if (text.includes("imagen") || text.includes("foto") || text.includes("archivo")) {
        return [
            { label: "Subir imagen", prompt: "Voy a subir una imagen para revisar." },
            { label: "Subir doc", prompt: "Voy a subir un documento para analizar." },
            { label: "Limites", prompt: "Explicame que puedes analizar sin llave activa." },
            { label: "Activar IA", prompt: "Quiero activar llaves Gemini." }
        ];
    }

    if (text.includes("llave") || text.includes("gemini") || text.includes("api")) {
        return [
            { label: "Como activar", prompt: "Explicame como activar mis 3 llaves paso a paso." },
            { label: "Modo local", prompt: "Explicame que hace el modo local." },
            { label: "Rotacion", prompt: "Explicame como rota entre cuentas si falla una llave." },
            { label: "Probar chat", prompt: "Quiero probar el chat sin llave." }
        ];
    }

    return MQ_QUICK_ACTIONS.slice(0, 5);
}

function normalizeChatText(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error(`No pude leer ${file.name}.`));
        reader.readAsText(file);
    });
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error(`No pude leer ${file.name}.`));
        reader.readAsDataURL(file);
    });
}

function analyzeImagePreview(src) {
    return new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            const sampleSize = 48;

            canvas.width = sampleSize;
            canvas.height = sampleSize;
            ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

            const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
            let r = 0;
            let g = 0;
            let b = 0;
            let count = 0;
            const buckets = new Map();

            for (let i = 0; i < data.length; i += 16) {
                const red = data[i];
                const green = data[i + 1];
                const blue = data[i + 2];
                const alpha = data[i + 3];

                if (alpha < 40) continue;

                r += red;
                g += green;
                b += blue;
                count++;

                const key = [
                    Math.round(red / 48) * 48,
                    Math.round(green / 48) * 48,
                    Math.round(blue / 48) * 48
                ].map((value) => Math.max(0, Math.min(255, value))).join(",");

                buckets.set(key, (buckets.get(key) || 0) + 1);
            }

            const avg = count ? {
                r: Math.round(r / count),
                g: Math.round(g / count),
                b: Math.round(b / count)
            } : { r: 0, g: 0, b: 0 };

            const brightness = Math.round((avg.r * 299 + avg.g * 587 + avg.b * 114) / 1000);
            const palette = [...buckets.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([key]) => rgbToHex(...key.split(",").map(Number)));

            resolve({
                brightness,
                brightnessLabel: brightness > 180 ? "alta" : brightness > 95 ? "media" : "baja",
                dominantColor: rgbToHex(avg.r, avg.g, avg.b),
                height: img.naturalHeight,
                megapixels: ((img.naturalWidth * img.naturalHeight) / 1000000).toFixed(2),
                orientation: img.naturalWidth > img.naturalHeight ? "horizontal" : img.naturalWidth < img.naturalHeight ? "vertical" : "cuadrada",
                palette,
                width: img.naturalWidth
            });
        };

        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function rgbToHex(r, g, b) {
    return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function isTextLike(file, mimeType) {
    return mimeType.startsWith("text/")
        || /\.(txt|md|csv|json|html|css|js|mjs|py|ts|tsx|jsx|xml|yaml|yml)$/i.test(file.name);
}

function inferMimeType(name) {
    const extension = name.split(".").pop()?.toLowerCase();
    const map = {
        css: "text/css",
        csv: "text/csv",
        html: "text/html",
        js: "text/javascript",
        json: "application/json",
        md: "text/markdown",
        pdf: "application/pdf",
        py: "text/x-python",
        txt: "text/plain"
    };
    return map[extension] || "application/octet-stream";
}

function getAttachmentKind(file, mimeType) {
    if (mimeType.startsWith("image/")) return "IMG";
    if (mimeType === "application/pdf") return "PDF";
    if (isTextLike(file, mimeType)) return "TXT";
    return "FILE";
}

function formatBytes(bytes = 0) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, power);
    return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
}

function joinText(base, addition) {
    return [base, addition]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" ");
}

function cleanSpeechText(text) {
    return String(text || "")
        .replace(/[`*_#>\[\](){}]/g, " ")
        .replace(/https?:\/\/\S+/g, " enlace ")
        .replace(/\s+/g, " ")
        .trim();
}

window.sendMessage = sendMessage;
window.toggleChat = toggleChat;
globalThis.sendMessage = sendMessage;
globalThis.toggleChat = toggleChat;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMaxiQueenChat);
} else {
    initMaxiQueenChat();
}
