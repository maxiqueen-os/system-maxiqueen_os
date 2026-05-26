document.addEventListener("DOMContentLoaded", () => {

const chatInput = document.getElementById("chat-input");
const chatEnviar = document.getElementById("chat-enviar");
const chatMensajes = document.getElementById("chat-mensajes");

if(!chatInput || !chatEnviar || !chatMensajes){
console.warn("Elementos del chat no encontrados");
return;
}

async function enviarMensaje(){

const mensaje = chatInput.value.trim();

if(!mensaje) return;

const pUser = document.createElement("p");
pUser.textContent = "👤 " + mensaje;
pUser.classList.add("mensaje-usuario");

chatMensajes.appendChild(pUser);

chatInput.value="";

chatMensajes.scrollTop = chatMensajes.scrollHeight;

try{

const response = await fetch("/chat",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
message:mensaje
})

});

const data = await response.json();

const pIA = document.createElement("p");

pIA.textContent = "👑 " + data.response;

pIA.classList.add("mensaje-ia");

chatMensajes.appendChild(pIA);

chatMensajes.scrollTop = chatMensajes.scrollHeight;

}catch(error){

console.error("Error conectando con API:",error);

}

}

chatEnviar.addEventListener("click", enviarMensaje);

chatInput.addEventListener("keypress",(e)=>{
if(e.key==="Enter"){
enviarMensaje();
}
});

});