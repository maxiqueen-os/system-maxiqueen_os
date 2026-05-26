from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordBearer

from app.services.ai_service import stream_response
from app.ai.spider6_engine import spider6
from app.core.memory import get_memory, save_message
from app.services.auth import get_current_user  # auth.py existente

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")


class ChatRequest(BaseModel):
    message: str
    image: str | None = None  # 👈 NUEVO

@router.post("/", response_class=StreamingResponse)
async def chat(req: ChatRequest):

    user_id = "test_user"

    save_message("user", req.message, user_id)

    def generator():

        history = get_memory(user_id)[-10:]
        history_text = "\n".join(
            f"{msg['role']}: {msg['content']}" for msg in history
        )

        contexto = spider6(req.message, user_id)[:1000]
image_info = f"Imagen enviada: {req.image}" if req.image else ""

prompt = f"""
Eres MAXIQUEEN OS, una IA profesional avanzada.

Reglas:
- Responde directo
- No repitas preguntas
- No des relleno
- Da soluciones claras

{image_info}

HISTORIAL:
{history_text}

CONTEXTO:
{contexto}

PREGUNTA:
{req.message}

RESPUESTA:
"""
        full_response = ""

        for chunk in stream_response(prompt):
            full_response += chunk
            yield chunk

        save_message("assistant", full_response, user_id)
    # 🔥 ESTO VA AFUERA (CLAVE)
    return StreamingResponse(generator(), media_type="text/plain")