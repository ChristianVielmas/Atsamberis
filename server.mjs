
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.GEMINI_API_KEY) {
  console.error("Falta GEMINI_API_KEY en el archivo .env");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.use(cors({
  origin: process.env.WEB_ORIGIN || "http://localhost:3000"
}));

app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

app.use("/api/", rateLimit({
  windowMs: 60 * 1000,
  limit: 15
}));

app.post("/api/chat", async (req, res) => {
  try {
    const messages = req.body.messages;

    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > 20
    ) {
      return res.status(400).json({
        error: "Mensajes no válidos."
      });
    }

    const history = messages.map((message) => {
      if (
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" ||
        message.content.length > 2000
      ) {
        throw new Error("Mensaje no válido.");
      }

      return {
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      };
    });

    if (history[history.length - 1].role !== "user") {
      return res.status(400).json({
        error: "El último mensaje debe ser del usuario."
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: history,
      config: {
        systemInstruction: `
          Eres el asistente virtual de un negocio.
          Responde en español, con claridad y amabilidad.
          Sé breve y útil.
          No inventes precios, horarios ni políticas.
          Si desconoces información, recomienda contactar
          al equipo del negocio.
        `,
        maxOutputTokens: 500
      }
    });

    res.json({
      reply: response.text || "No pude generar una respuesta."
    });
  } catch (error) {
    console.error("Error de Gemini:", error.message);

    res.status(500).json({
      error: "No pude responder. Inténtalo de nuevo."
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`Chatbot activo en http://localhost:${port}`);
  });
}

export default app;
