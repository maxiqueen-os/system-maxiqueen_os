
/* =======================
   LICENCIA CHECK
======================= */
function initLicencia(){

  const acceptMQ = document.getElementById('acceptMQ');
  const continueMQ = document.getElementById('continueMQ');

  if(!acceptMQ || !continueMQ) return;

  acceptMQ.addEventListener('change', () => {
    continueMQ.disabled = !acceptMQ.checked;
  });

  continueMQ.addEventListener('click', () => {

    sessionStorage.setItem('mq-accepted-license', 'true');

    const chatBox = document.getElementById('chatBox');
    if(chatBox){
      chatBox.style.display = 'flex';
    }

    const licenseBox = document.querySelector('.mq-license-box');
    if(licenseBox){
      licenseBox.style.display = 'none';
    }

  });
}
