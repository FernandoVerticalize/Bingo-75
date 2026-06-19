import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: "15mb" }));

  // Initialize Gemini API
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // API handling image upload via base64 for Bingo card extraction
  app.post("/api/scan-card", async (req, res) => {
    try {
      const { imageParams } = req.body;
      // imageParams should be { inlineData: { data: string, mimeType: "image/jpeg" } }

      if (!imageParams || !imageParams.inlineData) {
        return res.status(400).json({ error: "Missing imageParams" });
      }

      const prompt = `Analyze this bingo card image. It contains a 5x5 grid of numbers for a Bingo 75 game.
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
          contents: [
            prompt,
            {
              inlineData: {
                data: imageParams.inlineData.data,
                mimeType: imageParams.inlineData.mimeType,
              },
            },
          ],
          config: {
            responseMimeType: "application/json",
          },
        });
      } catch (err: any) {
        if (err.status === 503 || err.status === "UNAVAILABLE") {
          console.warn("gemini-2.5-flash unavailable, falling back to gemini-2.0-flash");
          response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [
              prompt,
              {
                inlineData: {
                  data: imageParams.inlineData.data,
                  mimeType: imageParams.inlineData.mimeType,
                },
              },
            ],
            config: {
              responseMimeType: "application/json",
            },
          });
        } else {
          throw err;
        }
      }

      const responseText = response.text || "{}";
      const resultData = JSON.parse(responseText);

      if (!resultData.numbers || !Array.isArray(resultData.numbers) || resultData.numbers.length !== 25) {
         throw new Error("Invalid format returned by Gemini: " + JSON.stringify(resultData));
      }

      res.json(resultData);
    } catch (error: any) {
      console.error("Error scanning card:", error);
      res.status(500).json({ error: "Failed to scan card", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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

startServer();
