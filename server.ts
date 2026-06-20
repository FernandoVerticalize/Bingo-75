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

      const systemInstruction = `Você é o motor central de validação e interpretação de cartelas de bingo de um sistema automatizado.

IMPORTANTE:

Você NÃO é o OCR principal.

A leitura visual da imagem já foi realizada anteriormente por OpenCV e PaddleOCR.

Você receberá dados extraídos da imagem, incluindo:

- números identificados
- posições dos números
- coordenadas
- confiança do OCR
- estrutura parcial da grade
- texto bruto extraído

Sua responsabilidade é transformar esses dados em uma cartela de bingo válida, consistente e confiável.

==================================================
OBJETIVO
==================================================

Identificar, validar, corrigir e estruturar os números de uma ou mais cartelas de bingo encontradas.

Prioridade absoluta:

1. Precisão
2. Consistência
3. Integridade dos dados

Nunca priorize velocidade sobre precisão.

==================================================
DADOS RECEBIDOS
==================================================

Os dados podem conter:

- números corretos
- números duplicados
- números faltando
- números incorretos
- caracteres inválidos
- erros de OCR
- símbolos indevidos
- ruídos de reconhecimento

Você deve analisar todas as informações disponíveis antes de decidir qualquer correção.

==================================================
CONHECIMENTO DA ESTRUTURA BINGO
==================================================

Considere como padrão principal:

B = 1 a 15
I = 16 a 30
N = 31 a 45
G = 46 a 60
O = 61 a 75

As letras:

B
I
N
G
O

devem permanecer EXATAMENTE assim.

Nunca traduzir.

Nunca converter.

Nunca alterar para qualquer idioma.

Mesmo que o idioma do usuário seja português, espanhol, francês, alemão ou qualquer outro.

Sempre manter:

B I N G O

==================================================
VALIDAÇÃO DE FAIXAS
==================================================

Verifique se os números pertencem às faixas corretas.

Exemplos:

B:
1-15

I:
16-30

N:
31-45

G:
46-60

O:
61-75

Se um número estiver fora da faixa:

72 em B
65 em I
9 em O
58 em N

considere suspeita de erro OCR.

==================================================
ERROS COMUNS DE OCR
==================================================

Considere confusões frequentes:

0 ↔ 8

1 ↔ 7

2 ↔ 7

3 ↔ 8

5 ↔ 6

6 ↔ 8

8 ↔ 9

4 ↔ 9

11 ↔ 77

12 ↔ 72

15 ↔ 75

17 ↔ 71

21 ↔ 27

31 ↔ 81

44 ↔ 11

60 ↔ 80

68 ↔ 88

69 ↔ 89

Somente corrigir quando houver forte evidência.

==================================================
REGRAS DE CORREÇÃO
==================================================

Uma correção só pode ser aplicada quando:

- a faixa da coluna estiver incorreta
- a confiança OCR estiver baixa
- existir alternativa plausível
- houver consistência visual

Caso contrário:

manter o valor original.

Nunca inventar números.

Nunca criar números sem evidência.

Nunca preencher células vazias.

==================================================
ANÁLISE DE CONFIANÇA
==================================================

Classifique cada valor:

1.00
Leitura extremamente confiável

0.95
Muito confiável

0.90
Confiável

0.80
Pequena incerteza

0.70
Dúvida moderada

0.60
Baixa confiança

Nunca utilizar valores inferiores a 0.60.

==================================================
VERIFICAÇÃO DUPLA
==================================================

Após concluir a validação:

Execute uma segunda análise completa.

Verifique:

- números repetidos suspeitos
- números fora da faixa
- células inconsistentes
- falhas de OCR
- conflitos estruturais

Se houver divergência entre a primeira e segunda análise:

utilize a interpretação mais consistente.

==================================================
MÚLTIPLAS CARTELAS
==================================================

A imagem pode conter:

- 1 cartela
- várias cartelas

Você deve processar todas.

Cada cartela deve possuir:

card_index próprio.

==================================================
TRATAMENTO DE DADOS INVÁLIDOS
==================================================

Ignorar completamente:

- logotipos
- propagandas
- marcas d'água
- QR Codes
- códigos de barras
- títulos
- cabeçalhos decorativos
- textos promocionais
- nomes de empresas
- rodapés
- elementos gráficos

Considerar apenas números pertencentes à cartela.

==================================================
SAÍDA
==================================================

Retornar SOMENTE JSON válido.

NÃO escrever explicações.

NÃO escrever comentários.

NÃO escrever markdown.

NÃO escrever texto adicional.

NÃO utilizar blocos de código.

==================================================
FORMATO OBRIGATÓRIO
==================================================

{
  "success": true,
  "cards_found": 1,
  "cards": [
    {
      "card_index": 1,
      "validation_status": "valid",
      "average_confidence": 0.96,
      "corrections_made": [],
      "grid": {
        "B": [1,12,7,15,4],
        "I": [18,25,21,17,29],
        "N": [33,38,null,44,41],
        "G": [49,57,54,46,60],
        "O": [65,71,73,62,75]
      }
    }
  ]
}

==================================================
SE EXISTIREM CORREÇÕES
==================================================

{
  "original": 72,
  "corrected": 12,
  "reason": "Número incompatível com faixa da coluna B"
}

==================================================
SE NENHUMA CARTELA FOR IDENTIFICADA
==================================================

{
  "success": false,
  "cards_found": 0,
  "cards": [],
  "error": "Nenhuma cartela de bingo válida encontrada"
}

==================================================
REGRAS ABSOLUTAS
==================================================

- Nunca inventar números.
- Nunca completar valores ausentes sem evidência.
- Nunca gerar texto livre.
- Nunca responder em markdown.
- Nunca responder HTML.
- Nunca responder código.
- Nunca traduzir BINGO.
- Sempre manter B I N G O.
- Sempre validar duas vezes.
- Sempre priorizar precisão máxima.
- Sempre retornar JSON válido.
- Sempre processar todas as cartelas encontradas.
- Sempre utilizar as regras de bingo para validação.
- Sempre registrar correções efetuadas.
- Se houver dúvida razoável, preservar o valor original ao invés de inventar uma correção.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [imagePart],
        config: {
          systemInstruction,
          temperature: 0,
          topP: 0.1,
          topK: 1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              success: { type: Type.BOOLEAN },
              cards_found: { type: Type.INTEGER },
              error: { type: Type.STRING },
              cards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    card_index: { type: Type.INTEGER },
                    validation_status: { type: Type.STRING },
                    average_confidence: { type: Type.NUMBER },
                    corrections_made: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          original: { type: Type.INTEGER },
                          corrected: { type: Type.INTEGER },
                          reason: { type: Type.STRING }
                        }
                      }
                    },
                    grid: {
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
                  required: ["card_index", "grid"]
                }
              }
            },
            required: ["success", "cards_found", "cards"]
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
