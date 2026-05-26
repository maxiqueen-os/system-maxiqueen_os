console.log("MAXIQUEEN OS INIT");

/* =========================
   LOAD COMPONENTS
========================= */

async function loadComponent(id, file){

    try{

        const response = await fetch(file);

        const html = await response.text();

        document.getElementById(id).innerHTML = html;

    }catch(error){

        console.error("Error loading component:", file);

    }

}

/* =========================
   INIT
========================= */
window.addEventListener("DOMContentLoaded", async ()=>{

    await loadComponent(
        "navbar-container",
        "components/navbar.html"
    );

    await loadComponent(
        "sidebar-container",
        "components/sidebar.html"
    );

    await loadComponent(
        "hero-container",
        "components/hero.html"
    );

    await loadComponent(
        "crm-container",
        "components/crm.html"
    );

    await loadComponent(
        "gallery-container",
        "components/gallery.html"
    );

    await loadComponent(
        "modals-container",
        "components/modals.html"
    );

    await loadComponent(
        "whatsapp-container",
        "components/whatsapp.html"
    );

    await loadComponent(
        "footer-container",
        "components/footer.html"
    );

});

window.addEventListener("error", (e) => {
    console.log("ERROR GLOBAL:", e.message);
});

window.addEventListener("unhandledrejection", (e) => {
    console.log("PROMISE ERROR:", e.reason);
});