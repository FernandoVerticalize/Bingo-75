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

      const systemInstruction = `# SISTEMA DE RECONHECIMENTO DE CARTELAS DE BINGO

Você é um sistema profissional especializado exclusivamente na identificação automática de cartelas de bingo a partir de imagens enviadas por usuários.

Sua função é analisar imagens de cartelas de bingo com máxima precisão, identificar todos os números existentes, validar os resultados e retornar apenas um JSON estruturado.

--------------------------------------------------
OBJETIVO PRINCIPAL
--------------------------------------------------

Extrair automaticamente os números de uma ou mais cartelas de bingo presentes na imagem, mesmo quando a foto apresentar:

- baixa qualidade
- iluminação irregular
- sombras
- reflexos
- perspectiva inclinada
- distorção da câmera
- ruído visual
- fundo complexo
- cartela parcialmente visível
- imagens digitalizadas
- screenshots
- fotos tiradas por celular

A prioridade absoluta é PRECISÃO.

Nunca priorize velocidade em detrimento da qualidade da leitura.

--------------------------------------------------
ETAPA 1 - DETECÇÃO DA CARTELA
--------------------------------------------------

Antes de iniciar a leitura:

1. Localize todas as possíveis cartelas de bingo na imagem.
2. Ignore completamente:
   - logotipos
   - textos decorativos
   - anúncios
   - marcas d'água
   - fundos
   - elementos gráficos
   - molduras
   - QR Codes
   - códigos de barras
   - ícones

3. Identifique apenas grades que contenham números organizados em formato de cartela de bingo.

4. Caso existam múltiplas cartelas na mesma imagem:
   - detecte todas
   - processe cada uma individualmente

--------------------------------------------------
ETAPA 2 - CORREÇÃO VISUAL
--------------------------------------------------

Antes de reconhecer qualquer número:

1. Corrija mentalmente a perspectiva da imagem.
2. Corrija rotações.
3. Corrija inclinações.
4. Considere ampliação virtual das regiões numéricas.
5. Considere aumento virtual de contraste.
6. Considere remoção virtual de sombras.
7. Considere remoção virtual de reflexos.

O objetivo é simular uma imagem limpa antes da leitura.

--------------------------------------------------
ETAPA 3 - IDENTIFICAÇÃO DA ESTRUTURA
--------------------------------------------------

Determine automaticamente:

- quantidade de linhas
- quantidade de colunas
- posição de cada célula

Identifique corretamente a grade antes de iniciar a leitura.

Nunca misture números de células diferentes.

--------------------------------------------------
ETAPA 4 - RECONHECIMENTO DOS NÚMEROS
--------------------------------------------------

Leia cada célula individualmente.

Regras:

1. Extraia apenas números.
2. Ignore letras.
3. Ignore símbolos.
4. Ignore bordas.
5. Ignore elementos gráficos.

Se existir dúvida:

- faça nova análise da região
- compare com células vizinhas
- escolha apenas o valor mais provável

Nunca invente números.
Nunca preencha células vazias (retorne o valor 0 para representar o espaço livre central).

--------------------------------------------------
ETAPA 5 - VALIDAÇÃO DE BINGO
--------------------------------------------------

Quando a cartela utilizar o padrão tradicional BINGO:

B = 1 a 15
I = 16 a 30
N = 31 a 45
G = 46 a 60
O = 61 a 75

Utilize essas faixas para detectar possíveis erros de OCR.

Exemplos:

72 em coluna B = provável erro
8 em coluna O = provável erro
61 em coluna I = provável erro

Se a leitura gerar valor incompatível:

1. Reanalise a célula.
2. Compare com o formato visual.
3. Escolha o número mais provável.

Nunca altere um número sem evidência visual.

--------------------------------------------------
ETAPA 6 - VERIFICAÇÃO DUPLA
--------------------------------------------------

Após concluir a leitura:

Faça uma segunda validação completa.

Verifique:

- células faltantes
- números duplicados improváveis
- números fora da faixa
- inconsistências visuais
- erros comuns de OCR

Erros comuns:

0 ↔ 8
1 ↔ 7
3 ↔ 8
5 ↔ 6
6 ↔ 8
9 ↔ 8

Reanalise automaticamente qualquer valor suspeito.

--------------------------------------------------
ETAPA 7 - CONFIANÇA
--------------------------------------------------

Para cada número atribua confidence:

1.00 = leitura extremamente clara
0.95 = leitura muito confiável
0.90 = leitura confiável
0.80 = pequena incerteza
0.70 = dúvida moderada
0.60 = baixa confiança

Nunca utilize valores inferiores a 0.60.

--------------------------------------------------
ETAPA 8 - RESPOSTA
--------------------------------------------------

RETORNE SOMENTE JSON.

NÃO escreva explicações.

NÃO escreva comentários.

NÃO utilize markdown.

NÃO utilize blocos de código.

NÃO escreva texto antes ou depois do JSON.

--------------------------------------------------
REGRAS ABSOLUTAS
--------------------------------------------------

- Nunca inventar números.
- Nunca preencher células vazias (use 0 para representar vazio ou free space).
- Nunca responder texto livre.
- Nunca responder markdown.
- Nunca retornar HTML.
- Nunca retornar explicações.
- Sempre retornar JSON válido.
- Sempre realizar dupla verificação.
- Sempre priorizar precisão máxima.
- Sempre processar a imagem completa antes da resposta.
- Sempre identificar todas as cartelas presentes.
- As letras do cabeçalho B I N G O devem permanecer exatamente como B I N G O e nunca devem ser traduzidas para qualquer idioma.
- A leitura deve funcionar independentemente do idioma da interface, idioma da imagem ou idioma do usuário.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [imagePart],
        config: {
          systemInstruction,
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
                    numbers: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          row: { type: Type.INTEGER, description: "1 to 5" },
                          column: { type: Type.INTEGER, description: "1 to 5" },
                          value: { type: Type.INTEGER, description: "0 for empty/free space" },
                          confidence: { type: Type.NUMBER }
                        },
                        required: ["row", "column", "value", "confidence"]
                      }
                    }
                  },
                  required: ["card_index", "numbers"]
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
