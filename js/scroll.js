/* =========================
   FOOTER SCROLL EFFECT
========================= */

const footer =
    document.querySelector("footer");

let ticking = false;

let lastScrollY = window.scrollY;

/* =========================
   UPDATE FOOTER
========================= */

function updateFooter(){

    const scrollY = window.scrollY;

    const maxScroll =
        document.body.scrollHeight
        - window.innerHeight || 1;

    const footerLift =
        (scrollY / maxScroll) * 26;

    if(footer){

        footer.style.transform =
            `translateY(-${footerLift}px)`;

        footer.style.boxShadow =
            `0 ${10 + footerLift/2}px
             ${20 + footerLift/2}px
             rgba(0,0,0,0.45)`;

    }

    ticking = false;

}

/* =========================
   SCROLL LISTENER
========================= */

window.addEventListener("scroll", ()=>{

    const currentScroll = window.scrollY;

    if(Math.abs(currentScroll - lastScrollY) < 3)
        return;

    lastScrollY = currentScroll;

    if(!ticking){

        window.requestAnimationFrame(
            updateFooter
        );

        ticking = true;

    }

},{
    passive:true
});