from sqlalchemy.orm import Session
from fastapi import Depends
from app.database import get_db
from app.models import user as user_model
from app.routes import rpg
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
from app.routes import users, chat  
from app import user
from app.database import engine

from fastapi import Depends, HTTPException
from pydantic import BaseModel


# 📂 Definir rutas base
BASE_DIR = Path(__file__).resolve().parent        # carpeta app
FRONTEND_DIR = BASE_DIR.parent.parent / "ACTIVE_SYSTEM"
STATIC_DIR = FRONTEND_DIR / "static"              # supongo que tu frontend tiene carpeta "static"

print("🔥 BASE_DIR:", BASE_DIR)
print("🔥 STATIC_DIR:", STATIC_DIR)
print("🔥 FRONTEND_DIR:", FRONTEND_DIR)
print("🔥 STATIC EXISTE:", STATIC_DIR.exists())

# 🖥️ Crear instancia de FastAPI
app = FastAPI()

# 🌐 Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🗄️ Crear tablas en la base de datos
user.Base.metadata.create_all(bind=engine)

# 📌 Rutas API
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])

# 📁 Montar carpeta estática
if FRONTEND_DIR.exists():
    app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:
    print("⚠️ Carpeta static no encontrada en FRONTEND_DIR")

# 🏠 Ruta index
@app.get("/")
def read_index():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"error": "index.html no encontrado"}

class XPRequest(BaseModel):
    user_id: int
    xp: int

app.include_router(rpg.router, prefix="/rpg", tags=["rpg"])

@app.post("/add-xp")
def add_xp(data: XPRequest, db: Session = Depends(get_db)):
    
    # Buscar usuario en la base de datos
    user_db = db.query(user_model.User).filter(user_model.User.id == data.user_id).first()

    if not user_db:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Sumar XP
    user_db.xp += data.xp

    # Sistema de niveles
    while user_db.xp >= 100:
        user_db.level += 1
        user_db.xp -= 100

    db.commit()
    db.refresh(user_db)

    return {
        "user_id": user_db.id,
        "level": user_db.level,
        "xp": user_db.xp
    }