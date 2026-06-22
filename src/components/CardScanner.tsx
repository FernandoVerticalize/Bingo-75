import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import type { BingoRound, MasterCard } from '../types';
import { useStore } from '../store';
import { Camera, CheckCircle2, RotateCcw, AlertTriangle, UploadCloud, Edit3, X, ImagePlus, ArrowRight, SkipForward, Copy, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import jsQR from 'jsqr';
import { syncCardToFirestore, uploadCardImage } from '../lib/sync';
import { v4 as uuidv4 } from 'uuid';

type ReviewCard = {
  image?: string;
  numbers: number[];
  confidences?: number[];
  cardNumber: string;
  name: string;
  isDuplicate?: boolean;
  duplicateOfId?: string;
  originalError?: string;
  timeTaken?: number;
  avgConfidence?: number;
  suspiciousCount?: number;
  autoCorrected?: number;
  userCorrections?: number;
};

const isValidNumber = (num: number, idx: number) => {
  if (idx === 12 && (!num || num === 0)) return true; // Centro livre permitido
  if (!num || num === 0) return false;
  const col = idx % 5;
  if (col === 0 && (num < 1 || num > 15)) return false;
  if (col === 1 && (num < 16 || num > 30)) return false;
  if (col === 2 && (num < 31 || num > 45)) return false;
  if (col === 3 && (num < 46 || num > 60)) return false;
  if (col === 4 && (num < 61 || num > 75)) return false;
  return true;
};


export function CardScanner({ round }: { round: BingoRound }) {
  const masterCards = useStore(state => state.masterCards);
  const addMasterCard = useStore(state => state.addMasterCard);
  const updateMasterCard = useStore(state => state.updateMasterCard);
  
  const [mode, setMode] = useState<'IDLE' | 'CAMERA' | 'PROCESSING' | 'REVIEW'>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  
  const [reviewQueue, setReviewQueue] = useState<ReviewCard[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [duplicateAction, setDuplicateAction] = useState<'PROMPT' | 'IGNORE' | 'REPLACE' | 'DUPLICATE'>('PROMPT');
  
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resizeImage = (dataUrl: string, maxWidth = 1000, maxHeight = 1000): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
           ctx.drawImage(img, 0, 0, width, height);
           resolve(canvas.toDataURL('image/jpeg', 0.6));
        } else {
           resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    });
  };

  const processImages = async (base64Images: string[]) => {
    setMode('PROCESSING');
    setError(null);
    setProgress({ current: 0, total: base64Images.length });
    
    const results: ReviewCard[] = [];
    
    for (let i = 0; i < base64Images.length; i++) {
        const base64Image = base64Images[i];
        setProgress({ current: i + 1, total: base64Images.length });
        
        const startTime = performance.now();
        
        // 1. Try to read QR Code first
        setProgressMsg(`Cartela ${i + 1}: Procurando QR Code...`);
        let qrProcessed = false;
        try {
            const img = new Image();
            await new Promise((resolve) => {
               img.onload = resolve;
               img.src = base64Image;
            });
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
                
                if (code && code.data.startsWith('BINGO:')) {
                    const jsonStr = code.data.replace('BINGO:', '');
                    try {
                        const parsed = JSON.parse(jsonStr);
                        if (parsed.arr && parsed.arr.length === 25) {
                            results.push({
                                image: base64Image,
                                numbers: parsed.arr,
                                confidences: Array(25).fill(100),
                                cardNumber: parsed.num || "",
                                name: `${masterCards.length + results.length + 1}ª CARTELA`,
                                timeTaken: Math.round((performance.now() - startTime) / 1000),
                                avgConfidence: 100,
                                suspiciousCount: 0,
                                autoCorrected: 0,
                                userCorrections: 0
                            });
                            qrProcessed = true;
                        }
                    } catch (e) {
                         console.error("Invalid QR JSON", e);
                    }
                }
            }
        } catch (e) {
            console.error("QR Error", e);
        }

        if (qrProcessed) continue;

        try {
          setProgressMsg(`Cartela ${i + 1}: Analisando números via Gemini...`);
          
          const response = await fetch('/api/scan-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image })
          });

          if (!response.ok) {
            let responseText = "";
            try {
               responseText = await response.text();
            } catch (e) {
               responseText = "Não foi possível ler o corpo da resposta.";
            }
            const errorDetails = `OCR Request URL:\n${window.location.origin}/api/scan-card\n\nHTTP Status:\n${response.status}\n\nResponse:\n${responseText}`;
            console.error(errorDetails);
            throw new Error(`Falha no servidor: ${response.status}\n\n${errorDetails}`);
          }

          const result = await response.json();
          const numbers = result.numbers || Array(25).fill(0);
          const cardNumber = result.cardNumber || "";
          
          const confidences = Array(25).fill(100);
          const autoCorrectedCount = 0;

          const timeTakenSeconds = Math.round((performance.now() - startTime) / 1000);

          let suspiciousCount = 0;
          let sumConf = 0;
          for (let j = 0; j < 25; j++) {
             sumConf += confidences[j];
             if (j === 12 && (!numbers[j] || numbers[j] === 0)) continue;
             if (!isValidNumber(numbers[j], j)) {
               suspiciousCount++;
             }
          }
          const avgConfidence = 100;

          results.push({
            image: base64Image,
            numbers: numbers,
            confidences: confidences,
            cardNumber: cardNumber, 
            name: `${masterCards.length + results.length + 1}ª CARTELA`,
            timeTaken: timeTakenSeconds,
            avgConfidence: avgConfidence,
            suspiciousCount: suspiciousCount,
            autoCorrected: autoCorrectedCount,
            userCorrections: 0
          });

        } catch (err: any) {
          results.push({
            image: base64Image,
            numbers: Array(25).fill(0),
            confidences: Array(25).fill(0),
            cardNumber: "",
            name: `${masterCards.length + results.length + 1}ª CARTELA`,
            originalError: err.message || "Falha ao processar a imagem. Tente uma foto mais nítida."
          });
        }
    }
    
    setReviewQueue(results);
    setMode('REVIEW');
  };

  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      const resized = await resizeImage(imageSrc, 1600, 1600);
      processImages([resized]);
    } else {
      setError("Não foi possível capturar a imagem.");
    }
  }, [webcamRef, masterCards.length]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files as FileList);
    
    Promise.all(files.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
           const resized = await resizeImage(reader.result as string, 1600, 1600);
           resolve(resized);
        };
        reader.readAsDataURL(file);
      });
    })).then(base64Images => {
       processImages(base64Images);
    });
    
    e.target.value = ''; // reset
  };

  const currentReview = reviewQueue[0];
  
  // Check duplicates
  useEffect(() => {
      if (mode === 'REVIEW' && currentReview && duplicateAction === 'PROMPT') {
          // check if duplicate
          const isDuplicateNum = currentReview.cardNumber && masterCards.some(m => m.cardNumber === currentReview.cardNumber);
          const isDuplicateContent = masterCards.some(m => JSON.stringify(m.numbers) === JSON.stringify(currentReview.numbers));
          const existing = masterCards.find(m => m.cardNumber === currentReview.cardNumber || JSON.stringify(m.numbers) === JSON.stringify(currentReview.numbers));
          
          if ((isDuplicateNum || isDuplicateContent) && !currentReview.isDuplicate) {
              setReviewQueue(q => [
                  { ...currentReview, isDuplicate: true, duplicateOfId: existing?.id },
                  ...q.slice(1)
              ]);
          }
      }
  }, [mode, currentReview, masterCards, duplicateAction]);

  const isValidReady = currentReview ? (
    currentReview.numbers.every((num, idx) => isValidNumber(num, idx))
  ) : true;

  const nextCard = () => {
     setReviewQueue(q => q.slice(1));
     setDuplicateAction('PROMPT');
     if (reviewQueue.length <= 1) {
         setMode('IDLE');
     }
  };

  const handleDuplicateAction = (action: 'IGNORE' | 'REPLACE' | 'DUPLICATE') => {
      if (!currentReview) return;
      
      if (action === 'IGNORE') {
          nextCard();
      } else if (action === 'REPLACE' && currentReview.duplicateOfId) {
          updateMasterCard(currentReview.duplicateOfId, {
              numbers: currentReview.numbers,
              cardNumber: currentReview.cardNumber,
              name: currentReview.name
          });
          nextCard();
      } else if (action === 'DUPLICATE') {
          addMasterCard({
             name: currentReview.name,
             cardNumber: currentReview.cardNumber,
             numbers: currentReview.numbers
          });
          nextCard();
      }
  };

  const saveCard = async () => {
    if (currentReview.isDuplicate && duplicateAction === 'PROMPT') {
        // user hasn't made a decision, should prompt
        return;
    }
    
    // Prepare card
    const cardId = uuidv4();
    const newCard = {
      id: cardId,
      name: currentReview.name,
      cardNumber: currentReview.cardNumber,
      numbers: currentReview.numbers
    };

    // Save locally
    addMasterCard(newCard);

    // Run remote uploads in background instead of blocking the UI
    if (currentReview.image) {
      uploadCardImage(cardId, currentReview.image).then(() => {
         syncCardToFirestore(newCard);
      });
    } else {
      syncCardToFirestore(newCard);
    }

    nextCard();
  };

  const handleManualEntry = () => {
    const blank = Array(25).fill(0);
    setReviewQueue([{
        numbers: blank,
        cardNumber: "",
        name: `${masterCards.length + 1}ª CARTELA`
    }]);
    setMode('REVIEW');
  };
  
  const updateCurrentReview = (updates: Partial<ReviewCard>) => {
      setReviewQueue(q => [
          { ...q[0], ...updates },
          ...q.slice(1)
      ]);
  };

  return (
    <div className="max-w-4xl mx-auto bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
        <div>
           <h2 className="text-xl font-bold text-white flex items-center gap-2">
             <Camera className="text-emerald-500" />
             Adicionar Cartelas
           </h2>
           <p className="text-sm text-slate-400 mt-1">
             Fotografe ou importe imagens de cartelas para leitura automática.
           </p>
        </div>
      </div>

      <div className="p-6">
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*" 
            multiple 
            className="hidden" 
        />

        {error && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-500/50 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-red-200">{error}</div>
          </div>
        )}

        {mode === 'IDLE' && (
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center py-12">
            <button 
              onClick={() => setMode('CAMERA')}
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-2xl w-full sm:w-48 tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Camera size={40} className="mb-3" />
              <span className="font-semibold text-lg text-center leading-tight">Câmera<br />Dispositivo</span>
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-2xl w-full sm:w-48 tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <ImagePlus size={40} className="mb-3" />
              <span className="font-semibold text-lg text-center leading-tight">Importar<br />Imagens</span>
            </button>

            <button 
              onClick={handleManualEntry}
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-500 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl w-full sm:w-48 tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Edit3 size={40} className="mb-3" />
              <span className="font-semibold text-lg text-center leading-tight">Digitar<br />Manual</span>
            </button>
          </div>
        )}

        {mode === 'CAMERA' && (
          <div className="flex flex-col items-center">
            <div className="relative justify-center rounded-2xl overflow-hidden bg-black mx-auto border-4 border-slate-700 w-full max-w-sm aspect-[4/5] flex items-center">
               <Webcam {...({ audio: false, ref: webcamRef, screenshotFormat: "image/jpeg", videoConstraints: { facingMode: "environment" }, className: "absolute inset-0 w-full h-full object-cover"} as any)} />
              <div className="absolute inset-0 pointer-events-none border-[2px] m-8 border-dashed border-emerald-500/50 rounded-lg"></div>
            </div>
            
            <div className="mt-8 flex gap-4">
              <button 
                onClick={() => setMode('IDLE')}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-full font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={capture}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold shadow-lg flex items-center gap-2"
              >
                <Camera size={20} /> Capturar
              </button>
            </div>
          </div>
        )}

        {mode === 'PROCESSING' && (
          <div className="py-24 flex flex-col items-center justify-center text-emerald-400">
            <RotateCcw size={48} className="animate-spin mb-6" />
            <p className="text-lg font-bold">Analisando imagem com IA...</p>
            {progress.total >= 1 && (
                <p className="text-sm text-slate-400 mt-2 font-medium bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700">Extraindo {progress.current} de {progress.total} {progress.total === 1 ? 'cartela' : 'cartelas'}</p>
            )}
            {progressMsg && (
                <p className="text-xs text-slate-500 mt-2">{progressMsg}</p>
            )}
          </div>
        )}

        {mode === 'REVIEW' && currentReview && (
          <div className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-6">
            
            {/* Left: Original Image Preview */}
            <div className="flex-1 flex flex-col bg-black/40 rounded-xl border border-slate-700 p-2 overflow-hidden h-[400px] lg:h-[600px]">
                {currentReview.image ? (
                    <img src={currentReview.image} alt="Original" className="w-full h-full object-contain" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 flex-col">
                        <Edit3 size={48} className="mb-4 opacity-20" />
                        Sem foto
                    </div>
                )}
            </div>
            
            {/* Right: Validation & Editing */}
            <div className="w-full lg:w-[400px] flex flex-col lg:max-h-[600px] overflow-y-auto pr-2 pb-2">
                <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2">
                    <h3 className="text-white font-bold text-lg">Prévia (Restam {reviewQueue.length})</h3>
                </div>

                {currentReview.originalError && (
                  <div className="mb-4 p-3 bg-red-900/40 border border-red-500/50 rounded-lg flex items-start gap-3 flex-shrink-0">
                    <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={16} />
                    <div className="text-xs text-red-200 uppercase tracking-widest leading-relaxed"><span className="font-bold">Aviso OCR:</span> {currentReview.originalError}</div>
                  </div>
                )}

                {currentReview.avgConfidence !== undefined && (
                  <div className={cn("mb-4 p-3 rounded-lg border flex flex-col gap-1.5 flex-shrink-0 text-sm", 
                     currentReview.avgConfidence < 85 ? "bg-orange-900/40 border-orange-500/50 text-orange-200" : "bg-emerald-900/20 border-emerald-500/30 text-emerald-200"
                  )}>
                     <div className="font-bold uppercase tracking-wider text-xs mb-1 opacity-80 flex items-center gap-2">
                        <span>Análise OCR</span>
                        {currentReview.avgConfidence < 85 && <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-[10px]">VERIFICAÇÃO MANUAL EXIGIDA</span>}
                     </div>
                     <div className="flex justify-between">
                         <span className="opacity-80">Confiança Média:</span>
                         <span className="font-mono font-bold">{Math.round(currentReview.avgConfidence)}%</span>
                     </div>
                     <div className="flex justify-between">
                         <span className="opacity-80">Células Suspeitas:</span>
                         <span className={cn("font-mono font-bold", currentReview.suspiciousCount && currentReview.suspiciousCount > 0 ? "text-red-400" : "")}>{currentReview.suspiciousCount || 0}</span>
                     </div>
                     <div className="flex justify-between">
                         <span className="opacity-80">Auto-Corrigidas:</span>
                         <span className="font-mono font-bold">{currentReview.autoCorrected || 0}</span>
                     </div>
                     <div className="flex justify-between">
                         <span className="opacity-80">Correções do Usuário:</span>
                         <span className="font-mono font-bold">{currentReview.userCorrections || 0}</span>
                     </div>
                     <div className="flex justify-between border-t border-current/20 pt-1 mt-1">
                         <span className="opacity-80 text-xs">Tempo Processamento:</span>
                         <span className="font-mono font-bold text-xs">{currentReview.timeTaken || 0}s</span>
                     </div>
                  </div>
                )}
                
                {currentReview.isDuplicate && duplicateAction === 'PROMPT' && (
                  <div className="mb-4 p-4 bg-orange-900/40 border border-orange-500/50 rounded-lg flex flex-col gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2 text-orange-400 font-bold">
                        <AlertTriangle size={18} /> Cartela Já Cadastrada
                    </div>
                    <p className="text-sm text-orange-200">Uma cartela idêntica já existe no sistema.</p>
                    <div className="flex flex-col gap-2">
                        <button onClick={() => handleDuplicateAction('IGNORE')} className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-medium flex justify-center items-center gap-2"><SkipForward size={16}/> Ignorar Atual</button>
                        <button onClick={() => handleDuplicateAction('REPLACE')} className="py-2.5 bg-orange-800 hover:bg-orange-700 text-white rounded font-medium flex justify-center items-center gap-2"><Save size={16}/> Substituir Antiga</button>
                        <button onClick={() => handleDuplicateAction('DUPLICATE')} className="py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium flex justify-center items-center gap-2 text-sm mt-1"><Copy size={16} /> Adicionar Nova Assim Mesmo</button>
                    </div>
                  </div>
                )}

                <div className="mb-4 flex gap-4 flex-shrink-0">
                   <div className="flex-1">
                     <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Nome</label>
                     <input 
                       type="text" 
                       value={currentReview.name}
                       onChange={(e) => updateCurrentReview({ name: e.target.value })}
                       className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                     />
                   </div>
                   <div className="w-1/3">
                     <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Serial</label>
                     <input 
                       type="text" 
                       value={currentReview.cardNumber}
                       onChange={(e) => updateCurrentReview({ cardNumber: e.target.value })}
                       className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                     />
                   </div>
                </div>

                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 mb-6 flex-shrink-0">
                  <div className="text-center mb-4 text-slate-400 text-[10px] uppercase tracking-wider font-bold items-center justify-center">
                     <span className="text-red-400">Vermelho: erro</span> • <span className="text-yellow-400">Laranja: baixa confiança</span> • <span className="text-slate-400">Cinza: ok</span>
                  </div>
                  
                  <div className="grid grid-cols-5 gap-2" translate="no">
                    {['B', 'I', 'N', 'G', 'O'].map((l, i) => (
                      <div key={l} className={cn("text-center font-bold pb-2", i===0?'text-blue-400':i===1?'text-red-400':i===2?'text-yellow-400':i===3?'text-emerald-400':'text-purple-400')}>{l}</div>
                    ))}
                    {currentReview.numbers.map((num, idx) => {
                      const valid = isValidNumber(num, idx);
                      const conf = currentReview.confidences ? currentReview.confidences[idx] : 100;
                      
                      return (
                      <input
                        key={idx}
                        type="number"
                        min="0"
                        max="75"
                        className={cn(
                          "w-full aspect-[4/3] text-center font-bold rounded-md outline-none focus:ring-2 focus:ring-white transition-colors border",
                          (!valid)
                               ? "bg-red-900/70 text-red-100 border-red-500 focus:bg-red-800"
                               : (conf < 90)
                                  ? "bg-yellow-900/70 text-yellow-200 border-yellow-500 focus:bg-yellow-800"
                               : "bg-emerald-900/30 text-emerald-100 border-emerald-500 hover:bg-emerald-800/80"
                        )}
                        value={num === 0 ? '' : num}
                        onChange={(e) => {
                          const newNums = [...currentReview.numbers];
                          const newConfs = currentReview.confidences ? [...currentReview.confidences] : Array(25).fill(100);
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                          newNums[idx] = val;
                          newConfs[idx] = 100; // Reset confidence on manual edit
                          
                          // update suspicious count
                          let newSuspicious = 0;
                          for (let j = 0; j < 25; j++) {
                             if (j === 12 && (!newNums[j] || newNums[j] === 0)) continue;
                             if (!isValidNumber(newNums[j], j) || newConfs[j] < 90) newSuspicious++;
                          }
                          
                          const userCorrections = (currentReview.userCorrections || 0) + 1;
                          updateCurrentReview({ numbers: newNums, confidences: newConfs, userCorrections, suspiciousCount: newSuspicious });
                        }}
                        placeholder={''}
                        title={conf ? `Confiança: ${Math.round(conf)}%` : undefined}
                      />
                    )})}
                  </div>
                  
                  {(!isValidReady || (currentReview.suspiciousCount && currentReview.suspiciousCount > 0)) && (
                    <div className="mt-4 p-3 bg-red-900/40 border border-red-500/50 rounded flex gap-2 text-red-300 text-sm font-bold items-center">
                       <AlertTriangle size={18} /> Possível erro de leitura identificado.
                    </div>
                  )}
                </div>

                {!currentReview.isDuplicate && (
                    <div className="flex flex-col gap-3 mt-auto">
                      <div className="flex gap-2">
                        <button 
                          disabled={!isValidReady}
                          onClick={saveCard}
                          className={cn(
                            "flex-1 py-3 text-white rounded-lg font-bold flex items-center justify-center gap-2 tracking-wider transition-colors shadow-lg",
                            isValidReady ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20" : "bg-slate-700 cursor-not-allowed opacity-50 text-slate-400"
                          )}
                        >
                          <CheckCircle2 size={20} /> Confirmar
                        </button>
                        <button 
                          onClick={() => {
                             // "Editar" button - gives visual cue that they can edit
                          }}
                          className="flex-1 py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-300 rounded-lg font-bold flex items-center justify-center gap-2 tracking-wider transition-colors"
                        >
                          <Edit3 size={18} /> Editar
                        </button>
                        <button 
                          onClick={() => {
                              if (confirm("Tem certeza que deseja cancelar e descartar esta cartela?")) {
                                  nextCard();
                              }
                          }}
                          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold flex items-center justify-center gap-2 tracking-wider transition-colors"
                        >
                          <X size={18} /> Cancelar
                        </button>
                      </div>
                    </div>
                )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
