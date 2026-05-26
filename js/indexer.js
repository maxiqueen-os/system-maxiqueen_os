require("dotenv").config();
const fs = require("fs");
const mongoose = require("mongoose");
const OpenAI = require("openai");

const Doc = require("./models/Doc");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

mongoose.connect(process.env.MONGO_URI);

async function indexDocs() {
  const raw = fs.readFileSync("data/knowledge.txt", "utf-8");

  // dividir en chunks
  const chunks = raw.split("\n\n");

  for (const chunk of chunks) {
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk
    });

    const embedding = embeddingRes.data[0].embedding;

    await Doc.create({
      text: chunk,
      embedding
    });

    console.log("✅ guardado chunk");
  }

  console.log("🔥 indexación completa");
}

indexDocs();