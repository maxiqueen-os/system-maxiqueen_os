function initLightbox(){
  const lightbox = document.getElementById('lightbox');
  const lightboxContent = document.getElementById('lightboxContent');

  if(!lightbox || !lightboxContent) return;

  window.openLightbox = (src) => {
    lightboxContent.innerHTML = `<img src="${src}" class="w-full rounded-2xl">`;
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
  }

  window.closeLightbox = () => {
    lightbox.classList.add('hidden');
    lightbox.classList.remove('flex');
  }

  lightbox.addEventListener('click', e => {
    if(e.target === lightbox) closeLightbox();
  });
}