import cv from '@techstark/opencv-js';

let isCvReady = false;
cv.onRuntimeInitialized = () => {
    isCvReady = true;
};

const ensureCvReady = (): Promise<void> => {
    return new Promise((resolve) => {
        if (isCvReady || typeof cv.Mat === 'function') {
            isCvReady = true;
            resolve();
        } else {
            const original = cv.onRuntimeInitialized;
            cv.onRuntimeInitialized = () => {
                isCvReady = true;
                if (original) original();
                resolve();
            }
        }
    });
};

export type OCRCellResult = {
  value: number;
  confidence: number;
  row: number;
  col: number;
};

const isValidForColumn = (val: number, colIndex: number, cellIndex: number): boolean => {
  if (cellIndex === 12 && (!val || val === 0)) return true;
  if (!val) return false;
  if (colIndex === 0) return val >= 1 && val <= 15;
  if (colIndex === 1) return val >= 16 && val <= 30;
  if (colIndex === 2) return val >= 31 && val <= 45;
  if (colIndex === 3) return val >= 46 && val <= 60;
  if (colIndex === 4) return val >= 61 && val <= 75;
  return false;
};

const levenshteinDistance = (s1: string, s2: string): number => {
  const m = s1.length;
  const n = s2.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      if (s1[i - 1] === s2[j - 1]) d[i][j] = d[i - 1][j - 1];
      else d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + 1);
    }
  }
  return d[m][n];
};

const findBestMatch = (str: string, colIndex: number): number => {
  let minDiff = Infinity;
  let bestVal = 0;
  let start = colIndex * 15 + 1;
  let end = start + 14;
  for (let i = start; i <= end; i++) {
    const dist = levenshteinDistance(str, i.toString());
    if (dist < minDiff) {
      minDiff = dist;
      bestVal = i;
    }
  }
  return bestVal;
};

export const extractBingoGrid = async (imageSrc: string): Promise<string[]> => {
  await ensureCvReady();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const mat = cv.imread(img);
        
        // 1. Grayscale
        const gray = new cv.Mat();
        cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
        
        // 2. Blur
        const blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        
        // 3. Edge detection
        const edges = new cv.Mat();
        cv.Canny(blurred, edges, 75, 200, 3, false);
        
        // 4. Find contours
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        let maxArea = 0;
        let bestContour: any = null;
        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt);
          if (area > maxArea) {
            const peri = cv.arcLength(cnt, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
            if (approx.rows === 4) {
              maxArea = area;
              if (bestContour) bestContour.delete();
              bestContour = approx;
            } else {
              approx.delete();
            }
          }
          cnt.delete();
        }
        
        let targetMat = mat;
        if (bestContour) {
          // Perspective transform
          let pts = [];
          for (let i = 0; i < 4; i++) {
            pts.push({ x: bestContour.data32S[i * 2], y: bestContour.data32S[i * 2 + 1] });
          }
          
          // Order points: top-left, top-right, bottom-right, bottom-left
          pts.sort((a, b) => a.y - b.y);
          const top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
          const bottom = pts.slice(2, 4).sort((a, b) => a.x - b.x);
          const orderedPts = [top[0], top[1], bottom[1], bottom[0]];
          
          const widthA = Math.hypot(orderedPts[2].x - orderedPts[3].x, orderedPts[2].y - orderedPts[3].y);
          const widthB = Math.hypot(orderedPts[1].x - orderedPts[0].x, orderedPts[1].y - orderedPts[0].y);
          const width = Math.max(widthA, widthB);
          
          const heightA = Math.hypot(orderedPts[1].x - orderedPts[2].x, orderedPts[1].y - orderedPts[2].y);
          const heightB = Math.hypot(orderedPts[0].x - orderedPts[3].x, orderedPts[0].y - orderedPts[3].y);
          const height = Math.max(heightA, heightB);
          
          const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
            orderedPts[0].x, orderedPts[0].y,
            orderedPts[1].x, orderedPts[1].y,
            orderedPts[2].x, orderedPts[2].y,
            orderedPts[3].x, orderedPts[3].y
          ]);
          
          const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0, 0,
            width - 1, 0,
            width - 1, height - 1,
            0, height - 1
          ]);
          
          const M = cv.getPerspectiveTransform(srcTri, dstTri);
          const warped = new cv.Mat();
          cv.warpPerspective(mat, warped, M, new cv.Size(width, height));
          targetMat = warped;
          
          srcTri.delete(); dstTri.delete(); M.delete(); bestContour.delete();
        }
        
        const tw = targetMat.cols;
        const th = targetMat.rows;
        
        // Assume grid might be in the bottom part (if header is present) or full
        const gridYOffset = th > tw ? th - tw : 0; 
        const gridHeight = th > tw ? tw : th;
        
        const cellW = tw / 5;
        const cellH = gridHeight / 5;
        
        const cellsBase64: string[] = [];
        const canvas = document.createElement('canvas');
        canvas.width = cellW;
        canvas.height = cellH;
        
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            const x = col * cellW;
            const y = gridYOffset + row * cellH;
            
            const marginX = cellW * 0.1;
            const marginY = cellH * 0.1;
            const finalX = Math.min(Math.max(x + marginX, 0), tw - 1);
            const finalY = Math.min(Math.max(y + marginY, 0), th - 1);
            const finalW = Math.max(cellW - marginX * 2, 1);
            const finalH = Math.max(cellH - marginY * 2, 1);
            
            const cellMat = targetMat.roi(new cv.Rect(finalX, finalY, finalW, finalH));
            
            const grayCell = new cv.Mat();
            cv.cvtColor(cellMat, grayCell, cv.COLOR_RGBA2GRAY);
            const bwCell = new cv.Mat();
            cv.adaptiveThreshold(grayCell, bwCell, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
            
            cv.imshow(canvas, bwCell);
            cellsBase64.push(canvas.toDataURL('image/jpeg'));
            
            cellMat.delete();
            grayCell.delete();
            bwCell.delete();
          }
        }
        
        mat.delete(); gray.delete(); blurred.delete(); edges.delete(); hierarchy.delete(); contours.delete();
        if (targetMat !== mat) targetMat.delete();
        
        resolve(cellsBase64);
        
      } catch (err) {
        console.error("OpenCV processing failed", err);
        reject(new Error("Falha ao processar a imagem. Erro no OpenCV."));
      }
    };
    img.onerror = () => reject(new Error("Erro ao carregar a imagem."));
    img.src = imageSrc;
  });
};

// Tesseract has been entirely removed based on the instruction to use Gemini API.

export const processBingoCardCells = async (
  cellsBase64: string[], 
  onProgress?: (progress: number) => void
): Promise<{ numbers: number[], confidences: number[], autoCorrectedCount: number }> => {
  if (onProgress) onProgress(0.1);

  // Instead of using Tesseract, we will use the highly precise Gemini 2.5 Flash endpoint
  const response = await fetch('/api/scan-bingo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Sending all 25 crops. Gemini will process them sequentially in the payload.
    body: JSON.stringify({ images: cellsBase64 })
  });

  if (onProgress) onProgress(0.5);

  if (!response.ok) {
     throw new Error("Falha na validação com IA");
  }

  const result = await response.json();
  
  const numbers: number[] = new Array(25).fill(0);
  const confidences: number[] = new Array(25).fill(100);
  
  if (result.cartela) {
      // Map B I N G O back to 0-24
      const cols = ['B', 'I', 'N', 'G', 'O'];
      for (let c = 0; c < 5; c++) {
          const letter = cols[c];
          const colArr = result.cartela[letter] || [];
          for (let r = 0; r < 5; r++) {
              const idx = r * 5 + c;
              numbers[idx] = colArr[r] || 0;
              // If status was not validated, we can reduce confidence slightly, but user gets to review anyway.
              if (result.status === "revisao_manual" || result.status === "ambiguidade_detectada") {
                  confidences[idx] = 80;
              } else if (result.confianca_geral) {
                  confidences[idx] = result.confianca_geral;
              }
          }
      }
  }

  // Enforce zero at center
  numbers[12] = 0;

  if (onProgress) onProgress(1.0);

  return { numbers, confidences, autoCorrectedCount: 0 };
};

