/* =========================
   GALLERY LIGHTBOX
========================= */

function openLightbox(src){

    let lightbox =
        document.getElementById("mq-lightbox");

    /* CREATE */

    if(!lightbox){

        lightbox =
            document.createElement("div");

        lightbox.id = "mq-lightbox";

        lightbox.innerHTML = `
            <div class="mq-lightbox-content">
                <img id="mq-lightbox-img">
            </div>
        `;

        document.body.appendChild(lightbox);

        /* CLOSE */

        lightbox.addEventListener("click",()=>{

            lightbox.classList.remove("active");

        });

    }

    /* IMAGE */

    const image =
        document.getElementById(
            "mq-lightbox-img"
        );

    if(image){

        image.src = src;

    }

    lightbox.classList.add("active");

}