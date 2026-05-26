require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

const Chat = mongoose.model("Chat", {
  userId: String,
  message: String,
  reply: String,
  createdAt: { type: Date, default: Date.now }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, state, memory, leadType } = req.body;
    const userId = "demo-user"; // luego lo haces dinámico

    // 🧠 historial corto
    const history = await Chat.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5);

    const messages = [
      {
        role: "system",
        content: `
Eres un asistente de ventas para MaxiQueen.

Tipo de usuario: ${leadType}

Estado:
- etapa: ${state.stage}
- interés: ${state.interest}

Reglas:
- Responde corto y claro
- Lleva a conversión
- Si está listo → CTA
- Si duda → educa
`
      },
      ...history.reverse().map(h => ({
        role: "user",
        content: h.message
      })),
      { role: "user", content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages
    });

    const reply = completion.choices[0].message.content;

    // guardar conversación
    await Chat.create({ userId, message, reply });

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error IA" });
  }
});

app.listen(3000, () => {
  console.log("🚀 API PRO corriendo en http://localhost:3000");
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  // 1. embedding de la pregunta
  const queryEmbed = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: message
  });

  const queryVector = queryEmbed.data[0].embedding;

  // 2. buscar contexto relevante
  const results = await searchRelevant(queryVector);

  const context = results.map(r => r.text).join("\n\n");

  // 3. enviar a IA con contexto
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
Usa esta información para responder:

${context}

Responde claro y útil.
`
      },
      { role: "user", content: message }
    ]
  });

  res.json({
    reply: completion.choices[0].message.content
  });
});

const multer = require("multer");
const fs = require("fs");

const upload = multer({ dest: "uploads/" });