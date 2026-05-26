// MaxiQueen OS funciona en modo automatico:
// - sin llaves: responde con motor local
// - con llaves: usa Gemini y rota entre cuentas
// - si Gemini falla: vuelve al motor local sin dejar mudo el chat
const API_KEYS_POOL = getConfiguredGeminiKeys();

let currentKeyIndex = 0;

function buildGeminiParts(message, options = {}) {
    const attachments = Array.isArray(options.attachments) ? options.attachments : [];
    const parts = [];
    const safeMessage = message && message.trim()
        ? message.trim()
        : "Analiza los archivos adjuntos y entrega un resumen claro con hallazgos, riesgos y siguientes pasos.";

    if (attachments.length) {
        const fileList = attachments
            .map((file, index) => `${index + 1}. ${file.name} (${file.mimeType || "sin tipo"}, ${formatBytesForPrompt(file.size)})`)
            .join("\n");

        parts.push({
            text:
                "El usuario adjunto archivos para analizar dentro de MaxiQueen OS.\n" +
                "Responde en espanol claro, con estructura breve y accionable.\n\n" +
                `Archivos:\n${fileList}\n\n` +
                `Solicitud del usuario:\n${safeMessage}`
        });
    } else {
        parts.push({ text: safeMessage });
    }

    attachments.forEach((file) => {
        if (file.text) {
            parts.push({
                text:
                    `\n--- Contenido del archivo: ${file.name} ---\n` +
                    `${file.text}\n` +
                    `--- Fin del archivo: ${file.name} ---`
            });
            return;
        }

        if (file.base64 && file.mimeType) {
            parts.push({
                inline_data: {
                    mime_type: file.mimeType,
                    data: file.base64
                }
            });
        }
    });

    return parts;
}

function formatBytesForPrompt(bytes = 0) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, power);
    return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
}

async function chatWithMaxiQueen(message, options = {}) {
    const attachments = Array.isArray(options.attachments) ? options.attachments : [];

    if (!API_KEYS_POOL.length) {
        console.info("[MQ_OS] Sin llaves activas. Usando modo local.");
        return localMaxiQueenResponse(message, attachments);
    }

    const parts = buildGeminiParts(message, options);

    for (let i = 0; i < API_KEYS_POOL.length; i++) {
        const activeKey = API_KEYS_POOL[currentKeyIndex];

        try {
            console.log(`[MQ_OS] Intentando conexion con llave indice: ${currentKeyIndex}`);

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        systemInstruction: {
                            parts: [{ text: typeof SYSTEM_PROMPT !== "undefined" ? SYSTEM_PROMPT : "" }]
                        },
                        contents: [{
                            role: "user",
                            parts
                        }]
                    })
                }
            );

            const data = await response.json();

            if (data.error && shouldRotateKey(data.error)) {
                console.warn("[MQ_OS] Llave no disponible. Rotando cuenta...", data.error.message);
                rotarLlave();
                continue;
            }

            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                return data.candidates[0].content.parts[0].text;
            }

            if (data.error) {
                console.warn("[MQ_OS] API no disponible. Activando modo local:", data.error.message);
                return localMaxiQueenResponse(message, attachments);
            }

            return localMaxiQueenResponse(message, attachments);
        } catch (err) {
            console.error("[MQ_OS] Error de red. Activando modo local:", err);
            rotarLlave();
        }
    }

    return localMaxiQueenResponse(message, attachments);
}

function getConfiguredGeminiKeys() {
    const fromWindow = Array.isArray(window.MQ_GEMINI_KEYS)
        ? window.MQ_GEMINI_KEYS
        : [];

    const fromStorage = readStoredGeminiKeys();
    const keys = [...fromWindow, ...fromStorage]
        .map((key) => String(key || "").trim())
        .filter((key) => key && !key.includes("TU_LLAVE") && !key.includes("AQUI"));

    return [...new Set(keys)];
}

function readStoredGeminiKeys() {
    try {
        const raw = localStorage.getItem("MQ_GEMINI_KEYS");
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn("[MQ_OS] No pude leer MQ_GEMINI_KEYS de localStorage:", error);
        return [];
    }
}

function shouldRotateKey(error) {
    const status = String(error?.status || "");
    const message = String(error?.message || "").toLowerCase();
    const code = Number(error?.code || 0);

    return code === 400
        || code === 401
        || code === 403
        || code === 429
        || status === "INVALID_ARGUMENT"
        || status === "PERMISSION_DENIED"
        || status === "RESOURCE_EXHAUSTED"
        || message.includes("api key")
        || message.includes("quota");
}

function localMaxiQueenResponse(message = "", attachments = []) {
    const text = String(message || "").trim();
    const lower = normalizeText(text);

    if (attachments.length) {
        return buildLocalAttachmentReport(text, attachments);
    }

    if (hasAny(lower, ["activar llave", "activar llaves", "configurar llave", "configurar llaves", "gemini", "api"])) {
        return responseActivation();
    }

    if (!text || hasAny(lower, ["hola", "ayuda", "inicio", "empezar", "menu", "opciones", "que puedes hacer"])) {
        return responseMenu();
    }

    if (hasAny(lower, ["imagen", "foto", "archivo", "pdf", "documento", "analiza", "analizar", "subir", "adjuntar", "leer"])) {
        return responseFiles();
    }

    if (hasAny(lower, ["vender", "venta", "ventas", "negocio", "clientes", "marketing", "automatizar", "emprender", "oferta", "producto", "servicio"])) {
        return responseBusiness();
    }

    if (hasAny(lower, ["bloqueo", "bloqueado", "cansado", "agotado", "confusion", "orden", "ideas", "claridad", "prioridades", "no se"])) {
        return responseClarity();
    }

    if (hasAny(lower, ["contenido", "redes", "instagram", "tiktok", "youtube", "publicacion", "post", "guion", "copy", "anuncio"])) {
        return responseContent();
    }

    if (hasAny(lower, ["soporte", "humano", "whatsapp", "asesor", "contacto", "ayudame"])) {
        return responseSupport();
    }

    if (hasAny(lower, ["precio", "precios", "plan", "planes", "cuanto cuesta", "pagar", "membresia"])) {
        return responsePlans();
    }

    if (hasAny(lower, ["privacidad", "datos", "cookies", "terminos", "legal", "seguridad"])) {
        return responseSecurity();
    }

    if (hasAny(lower, ["web", "pagina", "landing", "sitio", "frontend", "backend", "codigo", "programacion"])) {
        return responseTechnical();
    }

    return [
        "MAXIQUEEN OS - Respuesta local",
        "",
        "Te leo. Puedo ayudarte a ordenar la idea, revisar un archivo, analizar una imagen de forma basica o guiarte hacia ventas, soporte y automatizacion.",
        "",
        "Para darte una respuesta mas precisa, elige una ruta:",
        "",
        buildOptionList(["Diagnostico", "Archivo o imagen", "Ventas", "Automatizacion", "Soporte"])
    ].join("\n");
}

function responseMenu() {
    return [
        "MAXIQUEEN OS - Centro de ayuda",
        "",
        "Estoy activo en modo automatico.",
        "",
        "Si tus llaves Gemini estan activas, respondo con IA conectada. Si no hay llave, si se agota cuota o si falla una cuenta, respondo con mi motor local para que el chat nunca quede mudo.",
        "",
        "Puedo ayudar en estas areas:",
        "1. Diagnostico: claridad, bloqueo, prioridades y etapa actual.",
        "2. Archivos: leer TXT, MD, CSV, JSON, HTML, CSS, JS y PY.",
        "3. Imagenes: vista previa, dimensiones, orientacion, brillo y colores dominantes.",
        "4. Negocio: oferta, ventas, clientes, automatizacion y contenido.",
        "5. Soporte: guiar al usuario hacia WhatsApp, Instagram o siguiente paso.",
        "6. Activacion IA: explicar como poner tus 3 llaves y rotarlas.",
        "",
        "Para vision profunda tipo objetos, escenas o texto dentro de imagen, se activa cuando conectes Gemini o un backend de vision.",
        "",
        buildOptionList(["Quiero diagnostico", "Analizar archivo", "Revisar imagen", "Quiero vender", "Activar llaves"])
    ].join("\n");
}

function responseActivation() {
    return [
        "MAXIQUEEN OS - Activacion de IA",
        "",
        "Puedes activar Gemini sin cambiar el chat ni tocar el diseno.",
        "",
        "Opcion recomendada:",
        "1. Abre js/api-keys.local.js.",
        "2. Pega tus 3 llaves dentro de window.MQ_GEMINI_KEYS.",
        "3. Recarga la pagina.",
        "4. El sistema detecta las llaves y cambia a modo IA Gemini.",
        "",
        "Tambien puedes activarlas desde consola con:",
        "setMaxiQueenGeminiKeys(['LLAVE_1','LLAVE_2','LLAVE_3'])",
        "",
        "Si una llave falla, roto a la siguiente. Si todas fallan, sigo respondiendo en modo local.",
        "",
        buildOptionList(["Probar modo local", "Subir archivo", "Diagnostico", "Hablar con humano"])
    ].join("\n");
}

function responseFiles() {
    return [
        "MAXIQUEEN OS - Analisis de archivos",
        "",
        "Listo. Sube la foto o archivo con el boton + del chat.",
        "",
        "Puedo revisar en modo local:",
        "- documentos de texto y codigo",
        "- CSV o JSON para detectar estructura",
        "- HTML/CSS/JS para revisar contenido y posibles secciones",
        "- imagenes para datos tecnicos y lectura visual basica",
        "- PDF como archivo registrado; leer contenido completo de PDF necesita backend o IA conectada",
        "",
        "Cuando subas el archivo, te devuelvo resumen, hallazgos, riesgos y siguientes pasos.",
        "",
        buildOptionList(["Subir imagen", "Subir documento", "Revisar codigo", "Explicar limites"])
    ].join("\n");
}

function responseBusiness() {
    return [
        "MAXIQUEEN OS - Ruta de crecimiento",
        "",
        "Detecto una intencion de negocio o ventas.",
        "",
        "Ruta local recomendada:",
        "1. Oferta: define que vendes, para quien y que resultado prometes.",
        "2. Entrada: decide si el usuario llega por WhatsApp, Instagram, web, anuncio o referido.",
        "3. Diagnostico: haz 3 preguntas para entender necesidad, urgencia y presupuesto.",
        "4. Propuesta: presenta una solucion simple con beneficios claros.",
        "5. Seguimiento: automatiza recordatorios, respuestas frecuentes y entrega de informacion.",
        "6. Medicion: revisa visitas, mensajes, cierres y objeciones.",
        "",
        "Puedes subir una captura, texto de venta, pagina, propuesta o archivo y lo reviso.",
        "",
        buildOptionList(["Crear oferta", "Mejorar ventas", "Automatizar proceso", "Revisar texto"])
    ].join("\n");
}

function responseClarity() {
    return [
        "MAXIQUEEN OS - Diagnostico de claridad",
        "",
        "Lo que describes puede ser exceso de carga sin estructura.",
        "",
        "Te propongo empezar simple:",
        "1. Situacion: que estas intentando resolver.",
        "2. Ruido: que cosas te estan quitando energia.",
        "3. Objetivo: que resultado quieres conseguir primero.",
        "4. Bloqueo: que decision estas evitando.",
        "5. Siguiente paso: una accion pequena para mover el sistema.",
        "",
        "Si subes un documento, captura o lista de ideas, lo organizo en prioridades y acciones.",
        "",
        buildOptionList(["Ordenar mis ideas", "Estoy bloqueado", "Tengo muchas tareas", "Hacer plan"])
    ].join("\n");
}

function responseContent() {
    return [
        "MAXIQUEEN OS - Contenido y comunicacion",
        "",
        "Puedo ayudarte a convertir una idea en una pieza publicable.",
        "",
        "Estructura recomendada:",
        "1. Gancho: una frase que detenga el scroll.",
        "2. Problema: que le duele o confunde al usuario.",
        "3. Giro: una idea clara que cambie la perspectiva.",
        "4. Solucion: que ofrece MaxiQueen OS o el proceso.",
        "5. CTA: mensaje directo, WhatsApp, diagnostico o archivo.",
        "",
        "Sube un texto, captura o borrador y lo convierto en version mas clara.",
        "",
        buildOptionList(["Crear post", "Crear guion", "Mejorar copy", "Crear anuncio"])
    ].join("\n");
}

function responseSupport() {
    return [
        "MAXIQUEEN OS - Soporte humano",
        "",
        "Puedo orientarte aqui mismo o llevarte a contacto humano.",
        "",
        "Canales sugeridos:",
        "- WhatsApp: soporte directo, diagnostico o seguimiento.",
        "- Instagram: comunidad, contenido y actualizaciones.",
        "- Chat: revision de documentos, ideas, capturas y estructura.",
        "",
        "Si el usuario esta listo, el siguiente paso es pedir contexto minimo: nombre, necesidad principal y urgencia.",
        "",
        buildOptionList(["Ir a WhatsApp", "Seguir en chat", "Diagnostico rapido", "Ver opciones"])
    ].join("\n");
}

function responsePlans() {
    return [
        "MAXIQUEEN OS - Orientacion de planes",
        "",
        "No invento precios si no estan definidos en el sistema.",
        "",
        "Lo correcto es identificar primero la etapa:",
        "1. Starter: claridad, orden y estructura base.",
        "2. Pro: proyecto activo, ventas, automatizacion o flujo.",
        "3. Elite: arquitectura, integraciones, dashboards y expansion.",
        "",
        "Con esa lectura se recomienda el tipo de acompanamiento adecuado.",
        "",
        buildOptionList(["Estoy empezando", "Ya tengo negocio", "Quiero automatizar", "Hablar por WhatsApp"])
    ].join("\n");
}

function responseSecurity() {
    return [
        "MAXIQUEEN OS - Seguridad y confianza",
        "",
        "Principio base: no pedir datos sensibles si no son necesarios.",
        "",
        "Buenas practicas para el usuario:",
        "- no compartir claves privadas en el chat",
        "- no subir documentos sensibles sin revisar permisos",
        "- usar canales oficiales para pagos o soporte",
        "- mantener criterio humano en decisiones criticas",
        "",
        buildOptionList(["Privacidad", "Cookies", "Terminos", "Soporte seguro"])
    ].join("\n");
}

function responseTechnical() {
    return [
        "MAXIQUEEN OS - Revision tecnica",
        "",
        "Puedo ayudarte a revisar estructura web, frontend, scripts, estilos, rutas y carga de componentes.",
        "",
        "Revision local sugerida:",
        "1. HTML: IDs duplicados, scripts repetidos y orden de carga.",
        "2. CSS: archivos faltantes, responsive y componentes que se pisan.",
        "3. JS: errores de consola, funciones globales y dependencias externas.",
        "4. IA: modo local, llaves, rotacion y fallback.",
        "5. Despliegue: diferencias entre local, GitHub y Vercel.",
        "",
        buildOptionList(["Revisar HTML", "Revisar CSS", "Revisar JS", "Revisar despliegue"])
    ].join("\n");
}

function buildOptionList(options = []) {
    return [
        "Opciones para continuar:",
        ...options.map((option, index) => `${index + 1}. ${option}`)
    ].join("\n");
}

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function hasAny(text, keywords) {
    return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function buildLocalAttachmentReport(message, attachments) {
    const intro = message
        ? `Solicitud recibida: ${message}`
        : "Analisis local de adjuntos:";

    const reports = attachments.map((file, index) => {
        const lines = [
            `${index + 1}. ${file.name}`,
            `Tipo: ${file.mimeType || "archivo"}`,
            `Peso: ${formatBytesForPrompt(file.size)}`
        ];

        if (file.text) {
            lines.push(...summarizeTextFile(file.text));
        } else if (file.imageAnalysis) {
            lines.push(...summarizeImageFile(file.imageAnalysis));
        } else if (file.mimeType === "application/pdf") {
            lines.push("PDF detectado. En modo local puedo registrar el archivo, pero para leer su contenido necesito un lector PDF en backend o una IA conectada.");
        } else {
            lines.push("Archivo detectado. No tengo lector local especifico para este formato.");
        }

        return lines.join("\n");
    });

    return [
        "MAXIQUEEN OS - modo local",
        "",
        intro,
        "",
        reports.join("\n\n"),
        "",
        buildOptionList(["Hacer resumen", "Detectar riesgos", "Siguientes pasos", "Subir otro archivo"]),
        "",
        "Nota: este modo no usa Google ni llaves externas. La lectura profunda de imagenes requiere conectar un modelo de vision o backend."
    ].join("\n");
}

function summarizeTextFile(text) {
    const clean = String(text || "").trim();
    const lines = clean.split(/\r?\n/).filter((line) => line.trim());
    const words = clean ? clean.split(/\s+/).length : 0;
    const urls = clean.match(/https?:\/\/\S+/g) || [];
    const headings = lines
        .filter((line) => /^(#{1,6}\s|<h[1-6]|\w.*:$)/i.test(line.trim()))
        .slice(0, 5);

    const result = [
        `Lectura local: ${lines.length} lineas con contenido, ${words} palabras aproximadas.`
    ];

    if (headings.length) {
        result.push(`Posibles secciones: ${headings.map((line) => line.replace(/<[^>]+>/g, "").trim()).join(" | ")}`);
    }

    if (urls.length) {
        result.push(`Enlaces detectados: ${urls.slice(0, 3).join(" | ")}${urls.length > 3 ? "..." : ""}`);
    }

    result.push(`Vista rapida: ${clean.slice(0, 650)}${clean.length > 650 ? "..." : ""}`);
    return result;
}

function summarizeImageFile(analysis) {
    const result = [
        `Imagen: ${analysis.width} x ${analysis.height}px (${analysis.orientation}, ${analysis.megapixels} MP).`,
        `Brillo promedio: ${analysis.brightnessLabel}.`,
        `Color dominante aproximado: ${analysis.dominantColor}.`
    ];

    if (analysis.palette?.length) {
        result.push(`Paleta detectada: ${analysis.palette.join(", ")}.`);
    }

    result.push("Puedo revisar datos visuales basicos; reconocer objetos/personas/escenas requiere IA de vision conectada.");
    return result;
}

function rotarLlave() {
    if (!API_KEYS_POOL.length) return;
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS_POOL.length;
    console.log(`[MQ_OS] Nueva llave activa. Indice actual: ${currentKeyIndex}`);
}

window.chatWithMaxiQueen = chatWithMaxiQueen;
window.getMaxiQueenApiMode = () => API_KEYS_POOL.length ? "gemini" : "local";
window.setMaxiQueenGeminiKeys = (keys = []) => {
    const cleanKeys = Array.isArray(keys)
        ? keys.map((key) => String(key || "").trim()).filter(Boolean)
        : [];

    localStorage.setItem("MQ_GEMINI_KEYS", JSON.stringify(cleanKeys));
    window.location.reload();
};
window.clearMaxiQueenGeminiKeys = () => {
    localStorage.removeItem("MQ_GEMINI_KEYS");
    window.location.reload();
};
