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
    <div className="w-full bg-[#121826] rounded border border-slate-700 flex flex-col font-sans overflow-hidden">
      <div className="bg-[#1e40af] text-white text-center py-2 text-sm font-bold uppercase tracking-wider">
        Números Possíveis
      </div>
      
      {/* BINGO Header Row */}
      <div className="grid grid-cols-5 text-center bg-black text-white font-bold p-1">
        {columns.map(col => (
          <div key={col.letter} className="py-1">{col.letter}</div>
        ))}
      </div>

      {/* Grid of 15 rows x 5 columns */}
      <div className="flex-1 bg-[#121826] p-1">
        {Array.from({ length: 15 }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-5 gap-px bg-slate-700 border-b border-slate-700 last:border-b-0">
            {columns.map((col, colIndex) => {
              const num = col.offset + rowIndex + 1;
              const isDrawn = drawnSet.has(num);
              return (
                <button
                  key={num}
                  onClick={() => toggleDrawnNumber(num)}
                  className={cn(
                    "h-6 sm:h-7 text-center font-medium transition-colors text-xs sm:text-sm outline-none",
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
