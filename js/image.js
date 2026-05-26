from fastapi import APIRouter
from pydantic import BaseModel
import uuid
import os

router = APIRouter()

class ImageRequest(BaseModel):
    prompt: str

@router.post("/")
def generate_image(data: ImageRequest):

    # 🔹 Simulación de generación (luego conectamos IA real)
    filename = f"{uuid.uuid4()}.png"
    filepath = f"images/{filename}"

    # Crear archivo vacío (simulación)
    with open(filepath, "wb") as f:
        f.write(b"")

    return {
        "message": "imagen generada",
        "path": f"/images/{filename}"
    }