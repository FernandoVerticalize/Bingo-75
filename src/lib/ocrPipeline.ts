import cv from '@techstark/opencv-js';
import Tesseract from 'tesseract.js';

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
        
        // 1. Convert to Grayscale
        const gray = new cv.Mat();
        cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
        
        // ETAPA 8: Quality Validation (Blur/Focus & Brightness)
        const laplacian = new cv.Mat();
        cv.Laplacian(gray, laplacian, cv.CV_64F);
        const mean = new cv.Mat();
        const stddev = new cv.Mat();
        cv.meanStdDev(laplacian, mean, stddev);
        const variance = stddev.data64F[0] * stddev.data64F[0];
        
        cv.meanStdDev(gray, mean, stddev);
        const brightness = mean.data64F[0];
        
        laplacian.delete(); mean.delete(); stddev.delete();
        
        // Thresholds based on general OpenCV practices
        // If variance is too low, image is fundamentally blurry
        // If brightness is too extremely low or high, it's bad lighting
        if (variance < 20 || brightness < 20 || brightness > 240) {
            mat.delete(); gray.delete();
            reject(new Error("Imagem com qualidade insuficiente para leitura precisa. Ajuste o enquadramento ou a iluminação."));
            return;
        }
        
        // 2. Enhance Contrast (CLAHE or Equalize Hist)
        const equalized = new cv.Mat();
        cv.equalizeHist(gray, equalized);

        // 3. Noise Reduction (Gaussian Blur)
        const blurred = new cv.Mat();
        cv.GaussianBlur(equalized, blurred, new cv.Size(5, 5), 0);
        
        // 4. Edge detection
        const edges = new cv.Mat();
        cv.Canny(blurred, edges, 75, 200, 3, false);
        
        // 5. Find contours for perspective correction
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        let maxArea = 0;
        let bestContour: any = null;
        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt);
          // Look for large rectangles
          if (area > (mat.cols * mat.rows * 0.1)) {
            const peri = cv.arcLength(cnt, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
            if (approx.rows === 4) {
              if (area > maxArea) {
                maxArea = area;
                if (bestContour) bestContour.delete();
                bestContour = approx;
              } else {
                approx.delete();
              }
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
          cv.warpPerspective(gray, warped, M, new cv.Size(width, height));
          targetMat = warped;
          
          srcTri.delete(); dstTri.delete(); M.delete(); bestContour.delete();
        } else {
            targetMat = gray.clone();
        }
        
        // 6. Deskew & Sharpen targetMat
        const sharpMat = new cv.Mat();
        const kernel = cv.matFromArray(3, 3, cv.CV_32F, [
           0, -1,  0,
          -1,  5, -1,
           0, -1,  0
        ]);
        cv.filter2D(targetMat, sharpMat, cv.CV_8U, kernel);
        kernel.delete();

        const tw = sharpMat.cols;
        const th = sharpMat.rows;
        
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
            
            // Tighten margin to avoid lines (increased margin)
            const marginX = cellW * 0.15;
            const marginY = cellH * 0.15;
            const finalX = Math.min(Math.max(x + marginX, 0), tw - 1);
            const finalY = Math.min(Math.max(y + marginY, 0), th - 1);
            const finalW = Math.max(cellW - marginX * 2, 1);
            const finalH = Math.max(cellH - marginY * 2, 1);
            
            const cellMat = sharpMat.roi(new cv.Rect(finalX, finalY, finalW, finalH));
            
            // 7. Binarization (Adaptive Thresholding) explicitly on each cell for best local contrast
            const bwCell = new cv.Mat();
            cv.adaptiveThreshold(cellMat, bwCell, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 15, 5);
            
            // Add a small padding of white to help Tesseract
            const paddedCell = new cv.Mat();
            cv.copyMakeBorder(bwCell, paddedCell, 10, 10, 10, 10, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255, 255));

            canvas.width = paddedCell.cols;
            canvas.height = paddedCell.rows;
            cv.imshow(canvas, paddedCell);
            cellsBase64.push(canvas.toDataURL('image/jpeg', 1.0)); // Max quality
            
            cellMat.delete();
            bwCell.delete();
            paddedCell.delete();
          }
        }
        
        mat.delete(); gray.delete(); equalized.delete(); blurred.delete(); edges.delete(); hierarchy.delete(); contours.delete(); sharpMat.delete();
        if (targetMat !== mat && targetMat !== gray) targetMat.delete();
        
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

export const runOCRPass = async (worker: Tesseract.Worker, imageBase64: string, psm: number = 8): Promise<OCRCellResult> => {
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789',
    tessedit_pageseg_mode: psm as any, 
  });
  
  const result = await worker.recognize(imageBase64);
  const text = result.data.text.trim().replace(/\D/g, '');
  let conf = result.data.confidence;
  
  if (!text) {
     return { value: 0, confidence: 0, row: 0, col: 0 };
  }
  
  return { value: parseInt(text, 10), confidence: conf, row: 0, col: 0 };
};

export const processBingoCardCells = async (
  cellsBase64: string[], 
  onProgress?: (progress: number) => void
): Promise<{ 
  numbers: number[], 
  confidences: number[], 
  autoCorrectedCount: number,
  reprocessCount: number 
}> => {
  const numbers: number[] = new Array(25).fill(0);
  const confidences: number[] = new Array(25).fill(0);
  let autoCorrectedCount = 0;
  let reprocessCount = 0;
  
  const worker1 = await Tesseract.createWorker('eng', 1);
  const worker2 = await Tesseract.createWorker('eng', 1);

  for (let i = 0; i < 25; i++) {
    const colIndex = i % 5;
    
    let res1 = await runOCRPass(worker1, cellsBase64[i], 8); 
    let res2 = await runOCRPass(worker2, cellsBase64[i], 7); 
    
    let bestRes = res1.confidence > res2.confidence ? res1 : res2;
    
    if (i === 12 && (!bestRes.value || bestRes.value === 0)) {
        numbers[i] = 0;
        confidences[i] = 100;
        if (onProgress) onProgress((i + 1) / 25);
        continue;
    }

    // ETAPA 6: Validar limites
    // ETAPA 7: Sistema de confiança (reprocessar se < 90%)
    if (!isValidForColumn(bestRes.value, colIndex, i) || bestRes.confidence < 90) {
      reprocessCount++;
      // Executar nova leitura com PSM 6 (single block) ou PSM 10 (single char)
      const res3 = await runOCRPass(worker1, cellsBase64[i], 6);
      const res4 = await runOCRPass(worker2, cellsBase64[i], 10);
      
      const candidates = [bestRes, res3, res4].filter(r => isValidForColumn(r.value, colIndex, i));
      if (candidates.length > 0) {
          bestRes = candidates.reduce((prev, curr) => prev.confidence > curr.confidence ? prev : curr);
      } else {
          // Fallback if none are valid
          const allTry = [bestRes, res3, res4];
          bestRes = allTry.reduce((prev, curr) => prev.confidence > curr.confidence ? prev : curr);
      }
    }

    if (!isValidForColumn(bestRes.value, colIndex, i)) {
      if (bestRes.value > 0) {
        const corrected = findBestMatch(bestRes.value.toString(), colIndex);
        bestRes.value = corrected;
        bestRes.confidence = bestRes.confidence * 0.8;
        autoCorrectedCount++;
      } else if (i === 12) {
        bestRes.value = 0;
        bestRes.confidence = 100;
      }
    }
    
    numbers[i] = bestRes.value;
    confidences[i] = bestRes.confidence;
    
    if (onProgress) onProgress((i + 1) / 25);
  }
  
  await worker1.terminate();
  await worker2.terminate();
  
  return { numbers, confidences, autoCorrectedCount, reprocessCount };
};

