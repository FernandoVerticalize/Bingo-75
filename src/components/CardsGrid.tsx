import React, { useState, useRef, useEffect } from 'react';
import type { BingoRound, BingoCard } from '../types';
import { cn } from '../lib/utils';
import { X, Trophy, Edit2, Save, Trash2, Eraser, Undo2, Redo2 } from 'lucide-react';
import { useStore, getRoundCards, computeCardState } from '../store';

export function CardsGrid({ round }: { round: BingoRound }) {
  const masterCards = useStore(state => state.masterCards);
  const cards = getRoundCards(masterCards, round);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editNumbers, setEditNumbers] = useState<number[]>(Array(25).fill(0));
  const [undoHistory, setUndoHistory] = useState<number[][]>([]);
  const [redoHistory, setRedoHistory] = useState<number[][]>([]);
  const [editCardName, setEditCardName] = useState("");
  const [editCardNumber, setEditCardNumber] = useState("");
  const [showRanking, setShowRanking] = useState(false);
  const updateCard = useStore(state => state.updateMasterCard);
  const deleteCard = useStore(state => state.deleteMasterCard);

  const displayCards = cards;

  const selectedCard = selectedCardId ? cards.find(c => c.id === selectedCardId) : null;

  // Initialize edit state when selecting a card
  React.useEffect(() => {
    if (selectedCard) {
      setEditNumbers([...selectedCard.numbers]);
      setUndoHistory([]);
      setRedoHistory([]);
      setEditCardName(selectedCard.name);
      setEditCardNumber(selectedCard.cardNumber || "");
    }
  }, [selectedCardId, isEditing]);

  const saveEdits = () => {
    if (selectedCardId) {
      updateCard(selectedCardId, { numbers: editNumbers, name: editCardName, cardNumber: editCardNumber });
    }
    setIsEditing(false);
  };

  const top5 = [...displayCards].sort((a, b) => b.markedCount - a.markedCount).slice(0, 5);

  return (
    <>
      <div className="w-full h-full overflow-y-auto overflow-x-hidden flex flex-col px-1 sm:px-2 pt-0 pb-2 bg-[#0b0c10]">
         {/* Live Ranking Bar */}
         {top5.length > 0 && round.drawnNumbers.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-3 shrink-0 sticky top-0 z-20 mt-1">
               <button 
                  onClick={() => setShowRanking(!showRanking)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#12141c] hover:bg-[#1a1c26] border border-slate-800 rounded-lg text-[10px] sm:text-xs font-bold text-emerald-400 uppercase tracking-widest shadow-md transition-colors w-max"
               >
                  <Trophy size={14} /> 
                  {showRanking ? 'Ocultar Ranking' : 'Ranking em Tempo Real'}
               </button>
               
               {showRanking && (
                 <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide items-stretch bg-[#12141c] p-2 rounded-lg border border-slate-800 shadow-md">
                    {top5.map((c, i) => {
                       let faltam = 25 - c.markedCount;
                       return (
                       <div key={c.id} className="bg-black/30 border border-slate-700/50 rounded p-1.5 px-2.5 min-w-[110px] flex flex-col justify-center">
                          <div className="flex items-center justify-between mb-0.5">
                             <span className={cn("font-bold text-[10px] sm:text-[11px] truncate pr-2 max-w-[80px]", i === 0 ? "text-yellow-400" : "text-white")}>
                                {i+1}º {c.name}
                             </span>
                             <span className="text-[9px] text-slate-500 font-mono">{Math.round((c.markedCount/25)*100)}%</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                             Falta{faltam === 1 ? '' : 'm'} <span className="font-bold text-white">{faltam}</span> n°s
                          </div>
                       </div>
                    )})}
                 </div>
               )}
            </div>
         )}
        <div className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1 sm:gap-2 w-full content-start rounded-xl mx-auto">
          {displayCards.length > 0 ? displayCards.map((card, i) => (
            <CardThumbnail 
              key={card.id}
              card={card} 
              index={i + 1}
              drawnNumbers={round.drawnNumbers} 
              onClick={() => setSelectedCardId(card.id)}
            />
          )) : (
            <div className="col-span-full flex flex-col items-center justify-center pt-20 text-slate-500">
               <p>Nenhuma cartela cadastrada.</p>
               <p className="text-sm mt-2">Use o menu lateral ou Scanner para adicionar cartelas.</p>
            </div>
          )}
        </div>
      </div>

      {selectedCard && (
        <div className="fixed inset-0 z-50 bg-[#0f111a]/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121826] rounded-xl border border-slate-600 shadow-2xl p-6 max-w-md w-full relative">
            <button 
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-900 p-2 rounded-full"
              onClick={() => { setSelectedCardId(null); setIsEditing(false); }}
            >
              <X size={20} />
            </button>
            
            {isEditing ? (
              <div className="flex flex-col gap-3 mb-6">
                <input 
                  type="text"
                  value={editCardName}
                  onChange={(e) => setEditCardName(e.target.value)}
                  placeholder="Nome da cartela"
                  className="text-xl font-bold text-white text-center tracking-wider bg-slate-800 border border-slate-600 rounded px-2 py-1 w-full outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex items-center justify-center gap-2 bg-slate-800 border border-slate-600 rounded px-3 py-1">
                  <span className="text-slate-400 font-bold text-sm">Nº:</span>
                  <input 
                    type="text"
                    value={editCardNumber}
                    onChange={(e) => setEditCardNumber(e.target.value)}
                    placeholder="Sem número"
                    className="text-white text-base bg-transparent w-full outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 mb-6">
                <h3 className="text-xl font-bold text-white text-center tracking-wider">{selectedCard.name}</h3>
                <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-white" title="Editar cartela">
                  <Edit2 size={16} />
                </button>
              </div>
            )}
            
            <div className="w-full mx-auto">
               {isEditing ? (
                 <div className="flex flex-col flex-1 bg-black p-0.5 pb-0">
                    <div className="grid grid-cols-5 bg-black text-white px-px" translate="no">
                      {['B', 'I', 'N', 'G', 'O'].map(letter => <div key={letter} className="flex items-center justify-center font-bold text-xl pb-3 pt-2">{letter}</div>)}
                    </div>
                    <div className="grid grid-cols-5 gap-px bg-slate-700 p-px flex-1">
                      {editNumbers.map((num, idx) => (
                        <input 
                          key={idx}
                          type="number"
                          value={num === 0 ? '' : num}
                          onChange={(e) => {
                            setUndoHistory([...undoHistory, editNumbers]);
                            setRedoHistory([]);
                            const newNums = [...editNumbers];
                            if (e.target.value === '') {
                              newNums[idx] = 0;
                            } else {
                              newNums[idx] = parseInt(e.target.value) || 0;
                            }
                            setEditNumbers(newNums);
                          }}
                          className="w-full aspect-square text-center font-bold text-lg bg-slate-800 text-white outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder={''}
                        />
                      ))}
                    </div>
                 </div>
               ) : (
                 <BingoGrid card={selectedCard} drawnNumbers={round.drawnNumbers} fullSize />
               )}
            </div>
            
            {isEditing && (
               <div className="mt-6 flex flex-col gap-2">
                 <button onClick={saveEdits} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center justify-center gap-2">
                   <Save size={20} /> Salvar Alterações
                 </button>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        if (undoHistory.length > 0) {
                          const last = undoHistory[undoHistory.length - 1];
                          setRedoHistory([...redoHistory, editNumbers]);
                          setUndoHistory(undoHistory.slice(0, -1));
                          setEditNumbers(last);
                        }
                      }}
                      disabled={undoHistory.length === 0}
                      className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-1 text-[10px] uppercase transition-colors min-h-[48px]"
                    >
                      <Undo2 size={16} /> Desfazer
                    </button>
                    <button 
                      onClick={() => {
                        if (redoHistory.length > 0) {
                          const next = redoHistory[redoHistory.length - 1];
                          setUndoHistory([...undoHistory, editNumbers]);
                          setRedoHistory(redoHistory.slice(0, -1));
                          setEditNumbers(next);
                        }
                      }}
                      disabled={redoHistory.length === 0}
                      className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-1 text-[10px] uppercase transition-colors min-h-[48px]"
                    >
                      <Redo2 size={16} /> Refazer
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('Tem certeza que deseja limpar os números desta cartela?')) {
                          setUndoHistory([...undoHistory, editNumbers]);
                          setRedoHistory([]);
                          setEditNumbers(Array(25).fill(0));
                        }
                      }} 
                      className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-1 text-[10px] uppercase transition-colors min-h-[48px]"
                    >
                      <Eraser size={16} /> Esvaziar
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('Tem certeza que deseja excluir completamente esta cartela?')) {
                           deleteCard(selectedCard.id);
                           setSelectedCardId(null);
                           setIsEditing(false);
                        }
                      }} 
                      className="flex-1 py-3 bg-red-800 hover:bg-red-700 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-1 text-[10px] uppercase transition-colors min-h-[48px]"
                    >
                      <Trash2 size={16} /> Excluir
                    </button>
                  </div>
               </div>
            )}

            {!isEditing && selectedCard.isWinner && (
               <div className="mt-4 text-center text-yellow-500 font-bold flex items-center justify-center gap-2 text-lg">
                 <Trophy /> BINGO DETECTADO! 
               </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CardThumbnail({ card, index, drawnNumbers, scale, onClick }: { key?: React.Key, card: BingoCard, index: number, drawnNumbers: number[], scale?: number, onClick: () => void }) {
  const isEmpty = card.numbers[0] === null;
  let displayName = isEmpty ? `${index}ª CARTELA` : card.name;
  if (/^Cartela\s+(\d+)$/i.test(displayName)) {
    displayName = displayName.replace(/^Cartela\s+(\d+)$/i, "$1ª CARTELA");
  }

  const checkIsRecentWinner = () => {
     if (card.isWinner === 'FULL') return card.isWinner; // Always highlight full bingo
     if (!card.isWinner) return false;
     
     // Card is WINNER (Line or Column or both). But is it NEW?
     // It is new if it WAS NOT winner in the PREVIOUS step (drawnNumbers without the last one).
     if (drawnNumbers.length === 0) return card.isWinner;

     const prevDrawnSet = new Set(drawnNumbers.slice(0, -1));
     const prevState = computeCardState(card.numbers, prevDrawnSet);
     
     if (card.isWinner === 'LINE_AND_COLUMN' && prevState.isWinner !== 'LINE_AND_COLUMN') return 'LINE_AND_COLUMN';
     if (card.isWinner === 'LINE' && prevState.isWinner !== 'LINE' && prevState.isWinner !== 'LINE_AND_COLUMN') return 'LINE';
     if (card.isWinner === 'COLUMN' && prevState.isWinner !== 'COLUMN' && prevState.isWinner !== 'LINE_AND_COLUMN') return 'COLUMN';
     
     return false;
  };

  const currentHighlight = checkIsRecentWinner();

  const getWinnerBorder = () => {
     if (currentHighlight === 'FULL') return "border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] ring-2 ring-yellow-400";
     if (currentHighlight === 'LINE_AND_COLUMN') return "border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)] ring-2 ring-orange-500/50";
     if (currentHighlight === 'COLUMN') return "border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)] ring-2 ring-yellow-500/50";
     if (currentHighlight === 'LINE') return "border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)] ring-2 ring-yellow-500/50";
     return "border-[#1e293b]";
  };

  const getWinnerBg = () => {
     if (currentHighlight === 'FULL') return "bg-yellow-500 text-black";
     if (currentHighlight === 'LINE_AND_COLUMN') return "bg-orange-600 text-white";
     if (currentHighlight === 'COLUMN') return "bg-yellow-600 text-white";
     if (currentHighlight === 'LINE') return "bg-yellow-600 text-white";
     return "bg-[#1e40af] text-white";
  };

  return (
    <div 
      onClick={isEmpty ? undefined : onClick}
      className={cn(
        "w-full rounded overflow-hidden border flex flex-col font-sans transition-all mx-auto bg-[#121826] relative mt-2",
        !isEmpty && "cursor-pointer hover:border-slate-500",
        getWinnerBorder()
      )}
    >
      {currentHighlight && currentHighlight !== 'FULL' && (
         <div className={cn("absolute inset-0 ring-4 animate-pulse pointer-events-none z-10",
            currentHighlight === 'LINE_AND_COLUMN' ? "ring-orange-500/20" : "ring-yellow-500/20"
         )} />
      )}
      {currentHighlight === 'FULL' && (
         <div className="absolute inset-0 ring-4 ring-yellow-400/30 animate-pulse pointer-events-none z-10" />
      )}
      {/* Header Blue */}
      <div className={cn(
        "text-center text-[10px] sm:text-[11px] lg:text-xs font-bold truncate px-1 tracking-wide py-1 pt-1.5",
        getWinnerBg()
      )} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {displayName}
      </div>

      <BingoGrid card={card} drawnNumbers={drawnNumbers} />
      
      {/* Footer */}
      <div className="bg-black text-[#ef4444] px-1 py-1 text-[9px] sm:text-[10px] lg:text-[11px] font-bold flex justify-between items-center">
        <div className="flex items-center gap-1">
          <span>Nº</span>
          {!isEmpty && (
            <input 
              type="text" 
              value={card.cardNumber || ''} 
              onChange={(e) => useStore.getState().updateMasterCard(card.id, { cardNumber: e.target.value })}
              className="bg-transparent text-[#ef4444] w-12 sm:w-16 outline-none font-bold"
              onClick={(e) => e.stopPropagation()} // Prevent clicking footer from opening modal
            />
          )}
        </div>
        {!isEmpty && <span className="text-slate-500 font-normal leading-none">{Math.round((card.markedCount/25)*100)}%</span>}
      </div>
    </div>
  );
}

function BingoGrid({ card, drawnNumbers, fullSize = false }: { card: BingoCard, drawnNumbers: number[], fullSize?: boolean }) {
  const drawnSet = new Set(drawnNumbers);
  const letters = ['B', 'I', 'N', 'G', 'O'];
  
  return (
    <div className="flex flex-col flex-1 bg-black p-0.5 pb-0">
      {/* Black BINGO Header */}
      <div className="grid grid-cols-5 bg-black text-white px-px" translate="no">
        {letters.map((letter) => (
          <div 
            key={letter} 
            className={cn(
              "flex items-center justify-center font-bold text-[9px] sm:text-[10px] lg:text-[11px]",
               fullSize && "text-xl pb-3 pt-2"
            )}
            style={{ height: fullSize ? 'auto' : '20px' }}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Grid Cells */}
      <div className="grid grid-cols-5 gap-px bg-slate-700 p-px flex-1">
        {card.numbers.map((num, idx) => {
          const isFree = num === 0;
          const isMarked = isFree || (num !== null && drawnSet.has(num));
          const isEmpty = num === null || num === 0;

          return (
            <div 
              key={idx}
              className={cn(
                "w-full aspect-square flex items-center justify-center transition-colors overflow-hidden",
                fullSize ? "text-xl font-bold" : "text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px] font-semibold leading-none",
                isMarked ? "bg-emerald-600 text-white shadow-inner" : "bg-[#182132] text-slate-300"
              )}
            >
              {!isEmpty ? num : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
