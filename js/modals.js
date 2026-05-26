/* =========================
   LEGAL MODAL
========================= */

const legalModal =
    document.getElementById("legalModal");

const closeLegal =
    document.getElementById("closeLegal");

/* =========================
   CLOSE MODAL
========================= */

function closeLegalModal(){

    if(legalModal){

        legalModal.classList.add("hidden");

    }

}

/* =========================
   OPEN MODAL
========================= */

function openLegalModal(title,content){

    const modalTitle =
        document.getElementById("legalTitle");

    const modalContent =
        document.getElementById("legalContent");

    if(
        legalModal &&
        modalTitle &&
        modalContent
    ){

        modalTitle.innerHTML = title;

        modalContent.innerHTML = content;

        legalModal.classList.remove("hidden");

    }

}

/* =========================
   EVENTS
========================= */

if(closeLegal){

    closeLegal.addEventListener(
        "click",
        closeLegalModal
    );

}

if(legalModal){

    legalModal.addEventListener("click",(e)=>{

        if(e.target === legalModal){

            closeLegalModal();

        }

    });

}