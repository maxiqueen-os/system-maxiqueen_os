document.addEventListener("DOMContentLoaded", () => {

  loadComponent("hero-container", "/components/hero.html");

  loadComponent("crm-container", "/components/pruebacrm.html");

  loadComponent("mercado-container", "/components/mercado-pago.html");

  loadComponent("lightbox-container", "/components/lightbox.html", () => {
    if(typeof initLightbox === "function"){
      initLightbox();
    }
  });

  loadComponent("licencia-container", "/components/licencia.html", () => {
    if(typeof initLicencia === "function"){
      initLicencia();
    }
  });

  loadComponent("footer-container", "/components/footer.html");

});