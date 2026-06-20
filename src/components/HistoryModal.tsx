import React from 'react';
import { X } from 'lucide-react';
import type { BingoRound, MasterCard, BingoCard } from '../types';
import { getRoundCards } from '../store';
import { cn } from '../lib/utils';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  round: BingoRound;
  masterCards: MasterCard[];
}

export function HistoryModal({ isOpen, onClose, round, masterCards }: HistoryModalProps) {
  if (!isOpen) return null;

  // Let's compute everything on the fly
  const nums = round.drawnNumbers;
  const matchEvolution = [];

  let currentDrawn = new Set<number>();
  let previousWinnings = new Map<string, string>(); // card.id -> "LINE" | "COLUMN" ...

  // To find highest and lowest number drawn time
  const drawnOrder = [...nums];
  const firstDrawnCard = nums.length > 0 ? nums[0] : null;
  const lastDrawnCard = nums.length > 0 ? nums[nums.length - 1] : null;

  let totalLine = new Set<string>();
  let totalLineCol = new Set<string>();
  let totalFull = new Set<string>();

  for (let i = 0; i < nums.length; i++) {
    const num = nums[i];
    currentDrawn.add(num);

    const cardsAtStep = masterCards.map(c => {
       const isMarked = (idx: number) => c.numbers[idx] === 0 || currentDrawn.has(c.numbers[idx]);
       const rows = [0, 5, 10, 15, 20];
       const cols = [0, 1, 2, 3, 4];
       const checkLine = (indices: number[]) => indices.every(isMarked);

       let hasLine = false;
       for (let r of rows) if (checkLine([r, r + 1, r + 2, r + 3, r + 4])) hasLine = true;
       let hasColumn = false;
       for (let c of cols) if (checkLine([c, c + 5, c + 10, c + 15, c + 20])) hasColumn = true;
       let hasFull = true;
       for (let idx = 0; idx < 25; idx++) {
         if (!isMarked(idx)) {
           hasFull = false; break;
         }
       }

       let status = false as false | 'LINE' | 'COLUMN' | 'LINE_AND_COLUMN' | 'FULL';
       if (hasFull) status = 'FULL';
       else if (hasLine && hasColumn) status = 'LINE_AND_COLUMN';
       else if (hasLine) status = 'LINE';
       else if (hasColumn) status = 'COLUMN';

       const markedCount = c.numbers.filter(n => n === 0 || currentDrawn.has(n)).length;

       return { id: c.id, name: c.name, status, markedCount, hasFull, hasLine, hasColumn };
    });

    const top5 = [...cardsAtStep].sort((a, b) => b.markedCount - a.markedCount).slice(0, 5);
    
    let importantEvents = [];

    // Check for new achievements
    for (const card of cardsAtStep) {
        if (card.status) {
            const prevStatus = previousWinnings.get(card.id);
            if (prevStatus !== card.status) {
                if (card.status === 'FULL') {
                   const fullCount = totalFull.size + 1;
                   importantEvents.push(`BINGO COMPLETO: Cartela ${card.name} (Ordem: ${fullCount}º lugar | Precisou de ${i + 1} sorteios)`);
                   totalFull.add(card.id);
                }
                else if (card.status === 'LINE_AND_COLUMN') {
                   importantEvents.push(`DUPLA COMPLETA: Cartela ${card.name} fechou Linha e Coluna!`);
                   totalLineCol.add(card.id);
                }
                else if (card.status === 'LINE' && prevStatus !== 'LINE') {
                   importantEvents.push(`PRIMEIRA LINHA: Cartela ${card.name} completou horizontal!`);
                   totalLine.add(card.id);
                }
                else if (card.status === 'COLUMN' && prevStatus !== 'COLUMN') {
                   importantEvents.push(`PRIMEIRA COLUNA: Cartela ${card.name} completou vertical!`);
                   totalLine.add(card.id);
                }
                previousWinnings.set(card.id, card.status);
            }
        }
    }

    matchEvolution.push({
       step: i + 1,
       drawnNum: num,
       top5,
       events: importantEvents
    });
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#12141c] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col font-sans">
         <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 shrink-0">
           <h2 className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
              HISTÓRICO DA PARTIDA <span className="text-sm font-normal text-slate-400">({round.name})</span>
           </h2>
           <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
             <X size={24} />
           </button>
         </div>

         <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-8 custom-scrollbar">
            
            {/* Secao 4 - Estatisticas */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4 shrink-0">
               <h3 className="text-emerald-400 font-bold mb-4 uppercase tracking-widest text-sm border-b border-slate-700 pb-2">Estatísticas da Partida</h3>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-black/20 p-3 rounded-lg border border-slate-700/30">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Total Sorteados</span>
                    <span className="text-xl font-bold text-white">{nums.length}</span>
                 </div>
                 <div className="bg-black/20 p-3 rounded-lg border border-slate-700/30">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cartelas Participantes</span>
                    <span className="text-xl font-bold text-white">{masterCards.length}</span>
                 </div>
                 <div className="bg-black/20 p-3 rounded-lg border border-slate-700/30">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cartelas com Linha ou Col.</span>
                    <span className="text-xl font-bold text-white">{totalLine.size}</span>
                 </div>
                 <div className="bg-black/20 p-3 rounded-lg border border-slate-700/30">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Bingos Completos</span>
                    <span className="text-xl font-bold text-yellow-500">{totalFull.size}</span>
                 </div>
               </div>
            </div>

            {/* Secao 1 - Numeros Sorteados */}
            <div>
               <h3 className="text-emerald-400 font-bold mb-4 uppercase tracking-widest text-sm border-b border-slate-700 pb-2">Ordem Cronológica de Sorteio</h3>
               <div className="flex flex-wrap gap-2 text-sm">
                 {nums.map((n, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1.5 rounded border border-slate-700 font-mono">
                       <span className="text-slate-500 text-[10px]">{i + 1}º</span>
                       <span className="text-white font-bold">{String(n).padStart(2, '0')}</span>
                    </div>
                 ))}
                 {nums.length === 0 && <p className="text-slate-500 italic text-sm">Nenhum número sorteado.</p>}
               </div>
            </div>

            {/* Evolucao das Cartelas e Eventos */}
            <div>
               <h3 className="text-emerald-400 font-bold mb-4 uppercase tracking-widest text-sm border-b border-slate-700 pb-2">Evolução da Partida & Eventos</h3>
               <div className="flex flex-col gap-4">
                  {[...matchEvolution].reverse().map((step) => (
                     <div key={step.step} className="bg-black/20 rounded-lg border border-slate-800 p-4">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/50">
                           <div className="font-bold text-white flex items-center gap-2">
                             Sorteio nº {step.step} 
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                             <span className="text-emerald-400 text-lg">Bola {step.drawnNum}</span>
                           </div>
                        </div>

                        {step.events.length > 0 && (
                          <div className="mb-4 flex flex-col gap-2">
                             {step.events.map((ev, i) => (
                                <div key={i} className={cn("px-3 py-2 rounded font-medium text-sm flex items-center gap-2", ev.includes('BINGO COMPLETO') ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20")}>
                                   {ev.includes('BINGO COMPLETO') ? "🏆" : "⭐"} {ev}
                                </div>
                             ))}
                          </div>
                        )}

                        <div>
                           <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Top 5 Atualizado</p>
                           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                              {step.top5.map((c, i) => {
                                 // Usually the center is free, so we consider 24 as total needed to finish
                                 const fTotal = 24; 
                                 // Wait, if it has a free space, markedCount is 1 initially. Let's just say "Faltam X números"
                                 let faltam = 25 - c.markedCount;
                                 
                                 return (
                                 <div key={c.id} className="bg-[#1a2133] p-2 rounded border border-slate-700/50">
                                   <div className="flex justify-between items-center mb-1">
                                      <span className="text-slate-300 font-bold text-xs truncate max-w-[100px]">{i+1}º {c.name}</span>
                                   </div>
                                   <div className="text-[10px] text-slate-400">
                                      Falta{faltam === 1 ? '' : 'm'} <span className="font-mono font-bold text-white">{faltam}</span> n°s
                                   </div>
                                 </div>
                              )})}
                           </div>
                        </div>
                     </div>
                  ))}
                  {matchEvolution.length === 0 && <p className="text-slate-500 italic text-sm">A partida ainda não começou.</p>}
               </div>
            </div>

         </div>
      </div>
    </div>
  );
}
