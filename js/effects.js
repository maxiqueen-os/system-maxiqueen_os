/* =========================
   DYNAMIC ELEMENTS
========================= */

const floatElements =
    document.querySelectorAll(".float-3d");

const bgCircles =
    document.querySelectorAll(".background-circle");

/* =========================
   PARALLAX / 3D EFFECT
========================= */

function handleMouseMove(e){

    const x =
        (e.clientX / window.innerWidth) - 0.5;

    const y =
        (e.clientY / window.innerHeight) - 0.5;

    /* FLOATING ELEMENTS */

    floatElements.forEach((el,index)=>{

        const depth = 14 + (index * 4);

        el.style.transform = `
            perspective(1200px)
            rotateY(${x * depth}deg)
            rotateX(${y * -depth}deg)
            translateZ(${depth * 0.6}px)
        `;

    });

    /* BACKGROUND */

    bgCircles.forEach((el,index)=>{

        const factor =
            (index + 1) * 22;

        el.style.transform = `
            translate(
                ${x * factor}px,
                ${y * factor}px
            )
            scale(
                ${1 + Math.abs(x * y) * 0.08}
            )
        `;

    });

}

/* =========================
   INIT
========================= */

document.addEventListener(
    "mousemove",
    handleMouseMove,
    {
        passive:true
    }
);