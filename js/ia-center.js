document.addEventListener("DOMContentLoaded", () => {
    const accept = document.getElementById("acceptMQ");
    const continueBtn = document.getElementById("continueMQ");
    const supportAvatar = document.getElementById("avatar-soporte-action");

    if (accept && continueBtn) {
        accept.addEventListener("change", () => {
            continueBtn.disabled = !accept.checked;
            continueBtn.classList.toggle("mq-btn-disabled", !accept.checked);
        });

        continueBtn.addEventListener("click", () => {
            if (continueBtn.disabled) return;

            const chat = document.getElementById("mqChat");
            if (chat?.classList.contains("minimized") && typeof window.toggleChat === "function") {
                window.toggleChat();
            }

            document.getElementById("mqInput")?.focus();
        });
    }

    if (supportAvatar) {
        supportAvatar.addEventListener("click", () => {
            const input = document.getElementById("mqInput");

            if (typeof window.toggleChat === "function") {
                const chat = document.getElementById("mqChat");
                if (chat?.classList.contains("minimized")) {
                    window.toggleChat();
                }
            }

            if (input && !input.value.trim()) {
                input.value = "Necesito soporte tecnico y asistencia estrategica.";
                input.focus();
            }
        });
    }
});
