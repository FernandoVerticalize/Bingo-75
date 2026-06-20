import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import type { BingoRound } from '../types';
import { Search, Monitor } from 'lucide-react';

export function CallerBoard({ round }: { round: BingoRound }) {
  const { toggleDrawnNumber } = useStore();
  const drawnSet = new Set(round.drawnNumbers);
  const lastDrawnNumber = round.drawnNumbers[round.drawnNumbers.length - 1];

  const columns = [
    { letter: 'B', offset: 0 },
    { letter: 'I', offset: 15 },
    { letter: 'N', offset: 30 },
    { letter: 'G', offset: 45 },
    { letter: 'O', offset: 60 },
  ];

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, num: number | null}>({ isOpen: false, num: null });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerHeight(entries[0].contentRect.height);
        setContainerWidth(entries[0].contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    
    // Initial size
    setContainerHeight(containerRef.current.clientHeight);
    setContainerWidth(containerRef.current.clientWidth);
    
    return () => observer.disconnect();
  }, []);

  const MIN_CELL_WIDTH = 24; 
  const fixedCellWidth = 44; // 100% standard width

  let cellWidth = fixedCellWidth;
  let cellHeight = fixedCellWidth;

  if (containerHeight > 0 && containerWidth > 0) {
     // Fully elastic stretch-to-fit calculation
     cellWidth = (containerWidth - 6) / 5; // Account for borders and gaps
     cellHeight = (containerHeight - 17) / 16;
  }

  const tableWidth = (cellWidth * 5) + 4; // 5 cols + 4 gaps

  const handleNumberClick = (num: number) => {
    const isDrawn = drawnSet.has(num);
    const isLast = num === lastDrawnNumber;
    
    if (!isDrawn) {
      toggleDrawnNumber(num);
    } else if (isLast) {
      toggleDrawnNumber(num); // Remove immediately if it's the last one
    } else {
      setConfirmModal({ isOpen: true, num }); // Request confirmation for consolidated numbers
    }
  };

  const confirmRemoval = () => {
    if (confirmModal.num !== null) {
      toggleDrawnNumber(confirmModal.num);
    }
    setConfirmModal({ isOpen: false, num: null });
  };

  return (
    <div className="w-full h-full bg-[#121826] rounded-lg border border-slate-700 flex flex-col font-sans overflow-hidden shadow-xl lg:max-w-full">
      {/* Header and Controls */}
      <div className="bg-[#1e40af] text-white flex flex-col shrink-0 border-b border-slate-700 overflow-hidden relative">
        <div className="flex justify-between items-center px-3 py-1.5 w-full">
           <span className="text-sm font-bold uppercase tracking-wider">Números Possíveis</span>
           <button 
             onClick={() => {
                if (window.confirm("Tem certeza que deseja zerar os números sorteados desta rodada?")) {
                    useStore.getState().clearDrawnNumbers();
                }
             }}
             title="Zerar Tudo"
             className="text-white/70 hover:text-red-400 transition-colors p-1"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
           </button>
        </div>
      </div>
      
      {/* Scrollable Container */}
      <div 
         className="flex-1 overflow-auto bg-[#121826] flex justify-stretch items-stretch" 
         ref={containerRef}
      >
         <div 
            className="grid grid-cols-5 gap-px bg-slate-700 shrink-0 border-slate-700 w-full h-full"
            style={{ gridTemplateRows: 'repeat(16, minmax(0, 1fr))' }}
         >
             {/* Header row */}
            {columns.map(col => (
               <div 
                 key={col.letter} 
                 className="bg-black text-white font-bold flex items-center justify-center pointer-events-none"
                 translate="no"
                 style={{ height: '100%' }}
               >
                  <span style={{ fontSize: Math.max(10, Math.min(cellWidth, cellHeight) * 0.45) }}>{col.letter}</span>
               </div>
            ))}
            
            {/* Number rows */}
            {Array.from({ length: 15 }).map((_, rowIndex) => (
                <React.Fragment key={rowIndex}>
                  {columns.map((col) => {
                    const num = col.offset + rowIndex + 1;
                    const isDrawn = drawnSet.has(num);
                    const isLast = num === lastDrawnNumber;
                    
                    const titleText = isLast 
                        ? "Último número sorteado. Clique para corrigir."
                        : isDrawn 
                            ? "Número consolidado. Será solicitada confirmação."
                            : `Número ${num} não sorteado`;

                    return (
                      <button
                        key={num}
                        onClick={() => handleNumberClick(num)}
                        title={titleText}
                        className={cn(
                          "w-full h-full flex items-center justify-center font-medium transition-all outline-none",
                          "hover:brightness-110 active:scale-95 touch-manipulation relative group",
                          isLast 
                             ? "bg-emerald-500 text-white border-2 border-yellow-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),0_0_8px_rgba(250,204,21,0.5)] z-10 font-bold"
                             : isDrawn 
                                ? "bg-emerald-600 text-white font-bold" 
                                : "bg-[#0b1220] text-white hover:bg-slate-700"
                        )}
                        style={{ 
                            height: '100%',
                            fontSize: Math.max(11, Math.min(cellWidth, cellHeight) * 0.42) 
                        }}
                      >
                        {num}
                      </button>
                    );
                  })}
                </React.Fragment>
            ))}
         </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.num !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#1a2035] border border-slate-700 rounded-xl shadow-2xl p-6 max-w-sm w-full flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
               <span className="text-3xl font-black text-red-400">{confirmModal.num}</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">Tem Certeza?</h3>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Este número foi sorteado anteriormente e já está <strong className="text-white">consolidado</strong> na sequência do bingo.
              <br/><br/>
              A remoção poderá alterar a ordem e o histórico da partida.
            </p>
            <div className="flex w-full gap-3">
               <button 
                 onClick={() => setConfirmModal({ isOpen: false, num: null })}
                 className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white shadow-lg shadow-black/20 rounded-lg font-bold text-xs sm:text-sm transition-colors"
               >
                 CANCELAR
               </button>
               <button 
                 onClick={confirmRemoval}
                 className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-lg font-bold text-xs sm:text-sm transition-colors shadow-lg shadow-red-900/50"
               >
                 CONFIRMAR REMOÇÃO
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
