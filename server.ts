import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/scan-bingo", async (req, res) => {
    try {
      const { images } = req.body;
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Missing images array" });
      }

      // We process the first image (or multiple if provided, but Gemini is better single image per call for this specific prompt to ensure JSON schema matches exactly one output or a list of outputs).
      // The prompt says: "Extrair automaticamente os números de uma ou mais cartelas de bingo presentes na imagem..."
      // We will handle them one by one to keep the JSON schema simple, or pass all images if they requested batch? The UI processes image by image essentially. Let's process the first image.
      
      const imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: images[0].replace(/^data:image\/\w+;base64,/, ""),
        },
      };

      const systemInstruction = `SISTEMA ESPECIALIZADO DE LEITURA, VALIDAÇÃO E ORGANIZAÇÃO DE CARTELAS DE BINGO 75

MISSÃO PRINCIPAL
Você é um sistema especializado exclusivamente na leitura, validação e organização de números presentes em cartelas de Bingo 75.
Sua função NÃO é reconhecer imagens, detectar bordas, localizar cartelas ou executar visão computacional.
Essas etapas já foram realizadas previamente pelo sistema.
Sua única responsabilidade é interpretar corretamente os conteúdos encontrados em cada célula da cartela e organizar os resultados sem alterar nenhuma informação identificada.
A precisão absoluta possui prioridade máxima. A velocidade de resposta é irrelevante.

REGRA FUNDAMENTAL
A imagem é a única fonte de verdade.
Você deve registrar exclusivamente aquilo que estiver efetivamente visível.
Nunca utilize: Inferência; Suposição; Probabilidade; Estatística; Correção automática; Preenchimento automático; Reconstrução de números; Adivinhação.
Se um valor não puder ser confirmado visualmente, ele não deve ser informado.

PROCESSAMENTO DE APENAS UMA CARTELA
A análise deve considerar apenas uma única cartela. Caso existam múltiplas cartelas visíveis: Utilizar exclusivamente a cartela principal. Ignorar completamente todas as demais.

ESTRUTURA DA CARTELA
A cartela possui 5 colunas e 5 linhas (25 posições).
Ordem das colunas: B | I | N | G | O
Cada posição da grade representa uma célula independente.

LEITURA INDEPENDENTE DAS CÉLULAS
Cada célula deve ser analisada individualmente. A leitura deve ocorrer isoladamente. O conteúdo de uma posição nunca pode influenciar a leitura de outra.

EXTRAÇÃO DOS VALORES
Registrar exatamente o conteúdo identificado.
Se houver texto: Registrar exatamente o texto encontrado.
Se houver símbolo: Registrar exatamente o símbolo encontrado.
Se houver espaço vazio: Registrar como vazio (null).

NÚMEROS AMBÍGUOS
Os seguintes pares exigem atenção especial: 0 ↔ 8, 1 ↔ 7, 2 ↔ 7, 3 ↔ 8, 5 ↔ 6, 6 ↔ 8, 6 ↔ 9.
Se existir qualquer dúvida visual, registrar com status "ambiguidade_detectada".

NÚMEROS PARCIAIS
Caso apenas parte do número esteja visível, registrar com status "ilegivel".

VALIDAÇÃO DAS COLUNAS
Utilizar apenas para auditoria. Nunca utilizar para corrigir resultados. Faixas tradicionais: B=1-15, I=16-30, N=31-45, G=46-60, O=61-75.
Se fora da faixa, registrar o que viu e usar campos extras se quiser, mas o valor real lido deve ser o que foi lido.

POSIÇÃO CENTRAL
A posição central deve ser tratada exatamente como qualquer outra célula. Nunca assumir automaticamente que seja FREE.

DUPLA VERIFICAÇÃO OBRIGATÓRIA
Após concluir toda a leitura: Executar uma segunda conferência independente.

REGRAS ABSOLUTAS
NUNCA inventar números. NUNCA corrigir automaticamente. NUNCA utilizar probabilidades. SEMPRE reproduzir exatamente aquilo que foi identificado visualmente.

FORMATO DE SAÍDA OBRIGATÓRIO:
Retornar EXCLUSIVAMENTE um JSON válido.
Exemplo:
{
  "tipo": "BINGO_75",
  "confianca_geral": 99.8,
  "status": "validado",
  "cartela": {
    "B": [5, 8, 12, 14, 15],
    "I": [16, 18, 22, 27, 30],
    "N": [31, 35, 42, 44, 45],
    "G": [47, 50, 53, 58, 60],
    "O": [62, 65, 69, 72, 75]
  }
}`;

      // Gemini needs all images (the 25 cells). We add explicit position labels so it can analyze them independently.
      const contents: any[] = [];
      const cols = ['B', 'I', 'N', 'G', 'O'];
      if (images.length === 25) {
          for (let i = 0; i < 25; i++) {
              const r = Math.floor(i / 5);
              const c = i % 5;
              contents.push({ text: `Célula ${cols[c]}${r + 1}:` });
              contents.push({
                  inlineData: {
                      mimeType: "image/jpeg",
                      data: images[i].replace(/^data:image\/\w+;base64,/, ""),
                  }
              });
          }
      } else {
          // Fallback if not exactly 25
          for (const base64 of images) {
              contents.push({
                  inlineData: {
                      mimeType: "image/jpeg",
                      data: base64.replace(/^data:image\/\w+;base64,/, ""),
                  }
              });
          }
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
          systemInstruction,
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tipo: { type: Type.STRING },
              confianca_geral: { type: Type.NUMBER },
              status: { type: Type.STRING },
              cartela: {
                type: Type.OBJECT,
                properties: {
                  B: { type: Type.ARRAY, items: { type: Type.INTEGER, nullable: true } },
                  I: { type: Type.ARRAY, items: { type: Type.INTEGER, nullable: true } },
                  N: { type: Type.ARRAY, items: { type: Type.INTEGER, nullable: true } },
                  G: { type: Type.ARRAY, items: { type: Type.INTEGER, nullable: true } },
                  O: { type: Type.ARRAY, items: { type: Type.INTEGER, nullable: true } }
                }
              }
            },
            required: ["tipo", "confianca_geral", "status", "cartela"]
          }
        }
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to process image with Gemini." });
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
