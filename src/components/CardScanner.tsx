import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import type { BingoRound } from '../types';
import { useStore, getRoundCards } from '../store';
import { Camera, CheckCircle2, RotateCcw, AlertTriangle, UploadCloud, Edit3, X } from 'lucide-react';
import { cn } from '../lib/utils';

export function CardScanner({ round }: { round: BingoRound }) {
  const masterCards = useStore(state => state.masterCards);
  const addMasterCard = useStore(state => state.addMasterCard);
  
  const [mode, setMode] = useState<'IDLE' | 'CAMERA' | 'PROCESSING' | 'REVIEW'>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [scannedNumbers, setScannedNumbers] = useState<number[]>(Array(25).fill(0));
  const [cardName, setCardName] = useState(`${masterCards.length + 1}ª CARTELA`);
  const [cardNumber, setCardNumber] = useState("");
  const webcamRef = useRef<Webcam>(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      processImage(imageSrc);
    } else {
      setError("Não foi possível capturar a imagem da câmera.");
    }
  }, [webcamRef]);

  const processImage = async (base64Image: string) => {
    setMode('PROCESSING');
    setError(null);
    try {
      const mimeType = base64Image.split(';')[0].replace('data:', '');
      const base64Data = base64Image.split(',')[1];
      
      const response = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageParams: {
            inlineData: { data: base64Data, mimeType },
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.numbers && Array.isArray(data.numbers) && data.numbers.length === 25) {
        setScannedNumbers(data.numbers);
        setCardNumber(data.cardNumber || "");
        setMode('REVIEW');
      } else {
        throw new Error("Formato de resposta inválido.");
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao processar a imagem. O OCR requer que a imagem esteja nítida e seja de uma cartela de Bingo 75.');
      setMode('IDLE');
    }
  };

  const saveCard = () => {
    addMasterCard({
      name: cardName,
      cardNumber: cardNumber,
      numbers: scannedNumbers
    });
    // Reset state for next card // Reset state for next card
    setMode('IDLE');
    setCardName(`${masterCards.length + 2}ª CARTELA`);
    setCardNumber("");
    setScannedNumbers(Array(25).fill(0));
  };

  const handleManualEntry = () => {
    // Generate a blank grid for manual entry
    const blank = Array(25).fill(0);
    // FREE SPACE
    blank[12] = 0; 
    setScannedNumbers(blank);
    setMode('REVIEW');
  };

  return (
    <div className="max-w-3xl mx-auto bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
        <div>
           <h2 className="text-xl font-bold text-white flex items-center gap-2">
             <Camera className="text-emerald-500" />
             Adicionar Cartela
           </h2>
           <p className="text-sm text-slate-400 mt-1">
             Fotografe a cartela física para leitura automática via OCR.
           </p>
        </div>
      </div>

      <div className="p-6">
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
              className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-2xl w-full sm:w-64 tracking-wide transition-all"
            >
              <Camera size={48} className="mb-4" />
              <span className="font-semibold text-lg">Abrir Câmera</span>
              <span className="text-xs text-emerald-500/70 mt-1">Recomendado</span>
            </button>

            <button 
              onClick={handleManualEntry}
              className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-500 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl w-full sm:w-64 tracking-wide transition-all"
            >
              <Edit3 size={48} className="mb-4" />
              <span className="font-semibold text-lg">Digitar Manualmente</span>
            </button>
          </div>
        )}

        {mode === 'CAMERA' && (
          <div className="flex flex-col items-center">
            <div className="relative rounded-2xl overflow-hidden bg-black mx-auto border-4 border-slate-700 w-full max-w-sm aspect-[4/5]">
               {/* @ts-ignore webcam props issue */}
               <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 pointer-events-none border-[2px] m-8 border-dashed border-white/50 rounded-lg"></div>
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
            <p className="text-sm text-slate-400 mt-2">Extraindo números da cartela</p>
          </div>
        )}

        {mode === 'REVIEW' && (
          <div className="max-w-md mx-auto">
            <div className="mb-6 flex gap-4">
               <div className="flex-1">
                 <label className="block text-sm font-medium text-slate-300 mb-2">Identificação</label>
                 <input 
                   type="text" 
                   value={cardName}
                   onChange={(e) => setCardName(e.target.value)}
                   className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                   placeholder="Ex: 1ª CARTELA"
                 />
               </div>
               <div className="w-1/3">
                 <label className="block text-sm font-medium text-slate-300 mb-2">Nº (Serial)</label>
                 <input 
                   type="text" 
                   value={cardNumber}
                   onChange={(e) => setCardNumber(e.target.value)}
                   className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                   placeholder="Ex: 123"
                 />
               </div>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 mb-8">
              <div className="text-center mb-4 text-slate-400 text-sm flex items-center justify-center gap-2">
                <AlertTriangle size={16} className="text-yellow-500" /> Confira e corrija caso haja erro no OCR
              </div>
              <div className="grid grid-cols-5 gap-2">
                {['B', 'I', 'N', 'G', 'O'].map((l, i) => (
                  <div key={l} className={cn("text-center font-bold pb-2", i===0?'text-blue-400':i===1?'text-red-400':i===2?'text-yellow-400':i===3?'text-emerald-400':'text-purple-400')}>{l}</div>
                ))}
                {scannedNumbers.map((num, idx) => (
                  <input
                    key={idx}
                    type="number"
                    min="0"
                    max="75"
                    className={cn(
                      "w-full aspect-square text-center font-bold rounded-md outline-none focus:ring-2 focus:ring-emerald-500",
                      (idx === 12 || num === 0) 
                        ? "bg-slate-700 text-slate-400 text-xs" 
                        : "bg-slate-800 text-white border border-slate-600"
                    )}
                    value={num === 0 ? '' : num}
                    onChange={(e) => {
                      const newNums = [...scannedNumbers];
                      if (e.target.value === '') {
                        newNums[idx] = 0;
                      } else {
                        newNums[idx] = parseInt(e.target.value) || 0;
                      }
                      setScannedNumbers(newNums);
                    }}
                    placeholder={idx === 12 ? '★' : ''}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setMode('IDLE')}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium"
              >
                Descartar
              </button>
              <button 
                onClick={saveCard}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} /> Salvar Cartela
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
