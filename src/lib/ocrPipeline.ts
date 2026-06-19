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
};

// Utilities for validation
const isValidForColumn = (val: number, colIndex: number): boolean => {
  if (colIndex === 0) return val >= 1 && val <= 15;
  if (colIndex === 1) return val >= 16 && val <= 30;
  if (colIndex === 2) return val >= 31 && val <= 45; // center is free and won't be checked
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
        
        // At this point targetMat is our card or original if no contour found.
        // We will assume the grid is standard: 5x5, maybe covering the bottom 80% if there is a BINGO header.
        // To be safe, let's just divide into 5x5 by making 25 sub-mats.
        // In real cases, we'd do horizontal/vertical line detection, but bounding box slicing works best for a corrected perspective image without header... Wait! The user says:
        // "Localizar a grade BINGO. Identificar: 5 colunas 5 linhas".
        // It's much safer to just slice the card! If the card has a header, the grid is bottom ~80%. Let's assume standard cards: grid is mostly the whole square after cropped.
        
        // Actually, detecting the inner 5x5 grid contour would be more robust. Let's do simple slicing for now: assume header might be top 20%.
        const tw = targetMat.cols;
        const th = targetMat.rows;
        
        // If it's a rectangle (h > w), usually the top is header. So grid is roughly square.
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
            
            // Adjust to safely avoid borders by inner cropping slightly (e.g., 5% margin)
            const marginX = cellW * 0.1;
            const marginY = cellH * 0.1;
            const finalX = Math.min(Math.max(x + marginX, 0), tw - 1);
            const finalY = Math.min(Math.max(y + marginY, 0), th - 1);
            const finalW = Math.max(cellW - marginX * 2, 1);
            const finalH = Math.max(cellH - marginY * 2, 1);
            
            const cellMat = targetMat.roi(new cv.Rect(finalX, finalY, finalW, finalH));
            
            // Convert to black and white using adaptive thresholding for better OCR
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
        
        // Cleanup main Mats
        mat.delete(); gray.delete(); blurred.delete(); edges.delete(); hierarchy.delete(); contours.delete();
        if (targetMat !== mat) targetMat.delete();
        
        resolve(cellsBase64);
        
      } catch (err) {
        console.error("OpenCV processing failed", err);
        reject();
      }
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
};

export const runOCRPass = async (worker: Tesseract.Worker, imageBase64: string, psm: number = 8): Promise<OCRCellResult> => {
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789',
    tessedit_pageseg_mode: psm as any, // 8 = SINGLE_WORD
  });
  
  const result = await worker.recognize(imageBase64);
  const text = result.data.text.trim().replace(/\D/g, '');
  let conf = result.data.confidence;
  
  // If nothing found
  if (!text) {
     return { value: 0, confidence: 0 };
  }
  
  return { value: parseInt(text, 10), confidence: conf };
};

export const processBingoCardCells = async (
  cellsBase64: string[], 
  onProgress?: (progress: number) => void
): Promise<{ numbers: number[], confidences: number[] }> => {
  const numbers: number[] = new Array(25).fill(0);
  const confidences: number[] = new Array(25).fill(0);
  
  // Initialize worker for pass 1 (single word)
  const worker1 = await Tesseract.createWorker('eng', 1);
  
  // Initialize worker for pass 2 (single line)
  const worker2 = await Tesseract.createWorker('eng', 1);

  for (let i = 0; i < 25; i++) {
    const colIndex = i % 5;
    if (i === 12) { // Free space
      numbers[i] = 0;
      confidences[i] = 100;
      if (onProgress) onProgress((i + 1) / 25);
      continue;
    }
    
    // Pass 1
    const res1 = await runOCRPass(worker1, cellsBase64[i], 8); // PSM_SINGLE_WORD
    // Pass 2
    const res2 = await runOCRPass(worker2, cellsBase64[i], 7); // PSM_SINGLE_LINE
    
    let bestRes = res1.confidence > res2.confidence ? res1 : res2;
    
    // Validation + Auto-Correction
    if (!isValidForColumn(bestRes.value, colIndex)) {
      if (bestRes.value > 0) {
        // Find best match if reasonable string
        const corrected = findBestMatch(bestRes.value.toString(), colIndex);
        bestRes.value = corrected;
        // penalty for correction
        bestRes.confidence = bestRes.confidence * 0.8;
      }
    }
    
    numbers[i] = bestRes.value;
    confidences[i] = bestRes.confidence;
    
    if (onProgress) onProgress((i + 1) / 25);
  }
  
  await worker1.terminate();
  await worker2.terminate();
  
  return { numbers, confidences };
};
