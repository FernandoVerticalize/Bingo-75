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

  // 'auto' or percentage (50 to 300)
  const [zoomLevel, setZoomLevel] = useState<number | 'auto'>('auto');

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

  const MIN_CELL_SIZE = 24; 
  const fixedCellSize = 44; // 100% standard size

  let computedCellSize = fixedCellSize;

  // Calculate maximum auto-fit cell size
  if (zoomLevel === 'auto') {
    if (containerHeight > 0) {
       // Table has 16 rows and 5 columns. Gap is 1px.
       // height = 16 * cellSize + 15
       const maxByHeight = Math.floor((containerHeight - 15) / 16);
       
       let bestSize = maxByHeight;
       // If container is strictly constraint horizontally (like on mobile) we factor it in
       if (containerWidth > 0 && typeof window !== 'undefined' && window.innerWidth < 1024) {
           const maxByWidth = Math.floor((containerWidth - 4) / 5);
           bestSize = Math.min(maxByHeight, maxByWidth);
       }
       computedCellSize = Math.max(MIN_CELL_SIZE, bestSize); 
    }
  } else {
    computedCellSize = (fixedCellSize * zoomLevel) / 100;
  }

  if (computedCellSize < MIN_CELL_SIZE) computedCellSize = MIN_CELL_SIZE;

  const currentZoomPercent = zoomLevel === 'auto' ? Math.round((computedCellSize / fixedCellSize) * 100) : zoomLevel;

  const handleZoomOut = () => {
     if (currentZoomPercent > 50) setZoomLevel(Math.max(50, currentZoomPercent - 25));
  };

  const handleZoomIn = () => {
     if (currentZoomPercent < 300) setZoomLevel(Math.min(300, currentZoomPercent + 25));
  };

  const handleZoomReset = () => setZoomLevel(100);
  const handleZoomAuto = () => setZoomLevel('auto');
  
  const tableWidth = (computedCellSize * 5) + 4; // 5 cols + 4 gaps

  return (
    <div className="w-full h-full bg-[#121826] rounded-lg border border-slate-700 flex flex-col font-sans overflow-hidden shadow-xl lg:max-w-full" style={{ width: zoomLevel === 'auto' && tableWidth > 0 ? tableWidth + 2 : '100%' }}>
      {/* Header and Controls */}
      <div className="bg-[#1e40af] text-white flex flex-col pt-2 pb-2 shrink-0 border-b border-slate-700">
        <div className="flex justify-between items-center px-4 mb-2">
           <span className="text-sm font-bold uppercase tracking-wider">Números Possíveis</span>
           <button 
             onClick={() => {
                if (window.confirm("Tem certeza que deseja zerar os números sorteados desta rodada?")) {
                    useStore.getState().clearDrawnNumbers();
                }
             }}
             title="Zerar Tudo"
             className="text-white/70 hover:text-red-400 transition-colors"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
           </button>
        </div>
        
        {/* Zoom Controls Area */}
        <div className="flex items-center justify-center gap-1.5 px-2">
           <button 
             onClick={handleZoomOut} 
             title="Reduzir (➖)" 
             className="p-1.5 rounded bg-black/20 hover:bg-black/40 text-white transition-colors flex items-center justify-center disabled:opacity-50"
             disabled={currentZoomPercent <= 50}
           >
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
           </button>

           <button 
             onClick={handleZoomReset} 
             title="Zoom Padrão (100%)" 
             className={cn(
               "px-2 h-7 text-[11px] font-bold rounded flex items-center gap-1.5 transition-colors border",
               zoomLevel === 100 ? "bg-emerald-600 text-white border-emerald-400" : "bg-black/20 hover:bg-black/40 text-white/90 border-transparent"
             )}
           >
             <Search size={12} strokeWidth={3} /> 100%
           </button>

           <button 
             onClick={handleZoomAuto} 
             title="Ajustar à Tela" 
             className={cn(
               "px-2 h-7 text-[11px] font-bold rounded flex items-center gap-1.5 transition-colors border",
               zoomLevel === 'auto' ? "bg-emerald-600 text-white border-emerald-400" : "bg-black/20 hover:bg-black/40 text-white/90 border-transparent"
             )}
           >
             <Monitor size={12} strokeWidth={3} /> AJUSTAR
           </button>

           <button 
             onClick={handleZoomIn} 
             title="Ampliar (➕)" 
             className="p-1.5 rounded bg-black/20 hover:bg-black/40 text-white transition-colors flex items-center justify-center disabled:opacity-50"
             disabled={currentZoomPercent >= 300}
           >
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
           </button>
        </div>
      </div>
      
      {/* Scrollable Container */}
      <div 
         className="flex-1 overflow-auto bg-[#121826] flex justify-center" 
         ref={containerRef}
      >
         <div 
            className="grid grid-cols-5 gap-px bg-slate-700 m-auto shrink-0 border-x border-slate-700"
            style={{ width: tableWidth, alignSelf: 'flex-start' }}
         >
            {/* Header row */}
            {columns.map(col => (
               <div 
                 key={col.letter} 
                 className="bg-black text-white font-bold flex items-center justify-center pointer-events-none"
                 translate="no"
                 style={{ height: computedCellSize }}
               >
                  <span style={{ fontSize: Math.max(10, computedCellSize * 0.45) }}>{col.letter}</span>
               </div>
            ))}
            
            {/* Number rows */}
            {Array.from({ length: 15 }).map((_, rowIndex) => (
                <React.Fragment key={rowIndex}>
                  {columns.map((col) => {
                    const num = col.offset + rowIndex + 1;
                    const isDrawn = drawnSet.has(num);
                    const isLast = num === lastDrawnNumber;

                    return (
                      <button
                        key={num}
                        onClick={() => toggleDrawnNumber(num)}
                        className={cn(
                          "w-full h-full flex items-center justify-center font-medium transition-all outline-none",
                          "hover:brightness-110 active:scale-95 touch-manipulation",
                          isLast 
                             ? "bg-yellow-400 text-black border-2 border-yellow-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] z-10 font-bold relative"
                             : isDrawn 
                                ? "bg-emerald-600 text-white font-bold" 
                                : "bg-[#0b1220] text-white hover:bg-slate-700"
                        )}
                        style={{ 
                            height: computedCellSize,
                            fontSize: Math.max(11, computedCellSize * 0.42) 
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
    </div>
  );
}
