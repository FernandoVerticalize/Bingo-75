import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export const app = express();
app.use(express.json({ limit: "50mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/debug-ocr", (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  res.json({
    geminiKeyLoaded: !!geminiKey,
    keyLength: geminiKey ? geminiKey.length : 0,
    environment: process.env.NODE_ENV || "development",
    vercel: !!process.env.VERCEL,
    apiReachable: true,
  });
});

app.post("/api/scan-card", async (req, res) => {
  console.log("=== OCR REQUEST STARTED ===");
  console.log(`URL: ${req.url}`);
  console.log(`Environment: ${process.env.NODE_ENV}, VERCEL: ${!!process.env.VERCEL}`);
  console.log(`GEMINI_API_KEY present: ${!!process.env.GEMINI_API_KEY}`);

  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY não encontrada em produção.");
      return res.status(500).json({ error: "GEMINI_API_KEY não encontrada em produção." });
    }

    const { image } = req.body;
    if (!image) {
      console.error("Missing image in request body");
      return res.status(400).json({ error: "Missing image" });
    }

    console.log(`Image received, payload size: ${image.length} bytes`);

    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: image.replace(/^data:image\/\w+;base64,/, ""),
      },
    };

    const systemInstruction = `Analyze this bingo card image. It contains a 5x5 grid of numbers for a Bingo 75 game.
The columns are B (1-15), I (16-30), N (31-45), G (46-60), O (61-75).
The center space is usually 'FREE' or a star, which you should represent as the number 0.
Your goal is to extract the 25 numbers from left-to-right (column-by-column or row-by-row, but output it as a flat array of 25 numbers read from left to right, top to bottom: Row 1 left-to-right, Row 2 left-to-right, etc.).
Also extract the card's serial number if visible (often near "Nº", "No" or just a printed ID).
Ensure you only return a JSON object with this shape:
{
  "numbers": [1, 16, 31, 46, 61], // MUST BE exactly 25 integers
  "cardNumber": "123" // String, optional. The printed serial/ID of the card. Empty string if none.
}
If a number is unreadable, make your best guess or use 0. Ensure no extra text or markdown is returned outside the JSON.`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [imagePart],
        config: {
          systemInstruction,
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              numbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
              cardNumber: { type: Type.STRING },
            },
            required: ["numbers"]
          }
        }
      });
    } catch (err: any) {
      console.error("OCR ERROR during Gemini generateContent:", err);
      console.error(err.stack);
      if (err.status === 503 || err.message?.includes('503') || err.message?.includes('UNAVAILABLE')) {
         console.log("Falling back due to 503 error");
         response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [imagePart],
          config: {
            systemInstruction,
            temperature: 0,
            responseMimeType: "application/json",
          }
        });
      } else {
         throw err;
      }
    }

    if (!response || !response.text) {
      throw new Error("Empty response from AI");
    }

    const resultData = JSON.parse(response.text);
    if (!resultData.numbers || !Array.isArray(resultData.numbers) || resultData.numbers.length !== 25) { 
        throw new Error("Invalid number elements in generated JSON");
    }

    console.log("=== OCR REQUEST COMPLETED SUCCESSFULLY ===");
    res.json(resultData);
  } catch (error: any) {
    console.error("OCR UNHANDLED ERROR:", error);
    console.error(error.stack);
    res.status(500).json({ error: error.message || "Failed to process image with Gemini." });
  }
});

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Em produção na Vercel o ambiente não precisa inicializar o listen, pois a Vercel já gerencia as rotas através da serverless function.
// Aqui inicializamos via condicional, pois a Vercel injeta a flag VERCEL
if (!process.env.VERCEL) {
  startServer();
}

export default app;
