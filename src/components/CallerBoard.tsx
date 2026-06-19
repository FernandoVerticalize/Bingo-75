import React from 'react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import type { BingoRound } from '../types';

export function CallerBoard({ round }: { round: BingoRound }) {
  const { toggleDrawnNumber } = useStore();
  const drawnSet = new Set(round.drawnNumbers);

  const columns = [
    { letter: 'B', offset: 0 },
    { letter: 'I', offset: 15 },
    { letter: 'N', offset: 30 },
    { letter: 'G', offset: 45 },
    { letter: 'O', offset: 60 },
  ];

  return (
    <div className="w-full h-full bg-[#121826] rounded-lg border border-slate-700 flex flex-col font-sans overflow-hidden shadow-xl">
      <div className="bg-[#1e40af] text-white text-center py-2 text-sm font-bold uppercase tracking-wider flex justify-between items-center px-4">
        <span>Números Possíveis</span>
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
      
      {/* BINGO Header Row */}
      <div className="grid grid-cols-5 text-center bg-black text-white font-bold p-1" translate="no">
        {columns.map(col => (
          <div key={col.letter} className="py-1">{col.letter}</div>
        ))}
      </div>

      {/* Grid of 15 rows x 5 columns */}
      <div className="flex-1 bg-[#121826] p-1 pt-0 flex flex-col">
        {Array.from({ length: 15 }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-5 gap-px bg-slate-700 border-b border-slate-700 last:border-b-0 flex-1">
            {columns.map((col, colIndex) => {
              const num = col.offset + rowIndex + 1;
              const isDrawn = drawnSet.has(num);
              return (
                <button
                  key={num}
                  onClick={() => toggleDrawnNumber(num)}
                  className={cn(
                    "w-full h-full flex items-center justify-center font-medium transition-colors text-xs sm:text-sm outline-none",
                    isDrawn 
                      ? "bg-blue-600 text-white font-bold" 
                      : "bg-[#182132] text-slate-300 hover:bg-slate-700"
                  )}
                >
                  {num}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
