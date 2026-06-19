import React, { useState, useRef, useEffect } from 'react';
import type { BingoRound, BingoCard } from '../types';
import { cn } from '../lib/utils';
import { X, Trophy, Edit2, Save, Trash2, Eraser, Undo2, Redo2 } from 'lucide-react';
import { useStore, getRoundCards } from '../store';

export function CardsGrid({ round }: { round: BingoRound }) {
  const masterCards = useStore(state => state.masterCards);
  const cards = getRoundCards(masterCards, round);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editNumbers, setEditNumbers] = useState<number[]>(Array(25).fill(0));
  const [undoHistory, setUndoHistory] = useState<number[][]>([]);
  const [redoHistory, setRedoHistory] = useState<number[][]>([]);
  const [editCardName, setEditCardName] = useState("");
  const updateCard = useStore(state => state.updateMasterCard);
  const deleteCard = useStore(state => state.deleteMasterCard);

  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutScale, setLayoutScale] = useState({ cols: 1, cardWidth: 200, scale: 1 });

  // Do not pad to 12. Only show actual cards per prompt:
  // "Independentemente de existirem 5... o sistema reorganizar..."
  const displayCards = cards;
  const numCards = Math.max(1, displayCards.length);

  useEffect(() => {
    const recalculateLayout = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth === 0 || clientHeight === 0) return;

      const padding = 8;
      const gap = 4;
      const availableW = clientWidth - padding * 2;
      const availableH = clientHeight - padding * 2;

      let bestW = 0;
      let bestCols = 1;

      // Cards have fixed extra height (~76px total from headers/footers + 2px borders) + width (square grid)
      // Height of card = width + 76
      // Try cols from 1 to numCards
      for (let cols = 1; cols <= numCards; cols++) {
        const rows = Math.ceil(numCards / cols);
        
        let wFromWidth = (availableW - (cols - 1) * gap) / cols;
        let hFromHeight = (availableH - (rows - 1) * gap) / rows;
        // Card base size is 200 width and approximately 276 height (200 + 76)
        let wFromHeight = hFromHeight * (200 / 276);

        let w = Math.min(wFromWidth, wFromHeight);

        // Limit minimum width so text remains readable; if too small, fallback to scrolling vertically
        if (w < 80) w = wFromWidth;

        if (w > bestW) {
           bestW = w;
           bestCols = cols;
        }
      }

      // Limit maximum width so one card doesn't stretch huge across the screen
      const maxW = Math.min(bestW, 300);

      setLayoutScale({ cols: bestCols, cardWidth: maxW, scale: maxW / 200 });
    };

    const resizeObserver = new ResizeObserver(() => recalculateLayout());
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    recalculateLayout();

    window.addEventListener('resize', recalculateLayout);
    window.addEventListener('orientationchange', recalculateLayout);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', recalculateLayout);
      window.removeEventListener('orientationchange', recalculateLayout);
    };
  }, [numCards]);

  const selectedCard = selectedCardId ? cards.find(c => c.id === selectedCardId) : null;

  // Initialize edit state when selecting a card
  React.useEffect(() => {
    if (selectedCard) {
      setEditNumbers([...selectedCard.numbers]);
      setUndoHistory([]);
      setRedoHistory([]);
      setEditCardName(selectedCard.name);
    }
  }, [selectedCardId, isEditing]);

  const saveEdits = () => {
    if (selectedCardId) {
      updateCard(selectedCardId, { numbers: editNumbers, name: editCardName });
    }
    setIsEditing(false);
  };

  return (
    <>
      <div 
        ref={containerRef}
        className="w-full h-full overflow-y-auto flex flex-col items-center p-2"
      >
        <div 
          className="grid gap-[4px] w-full"
          style={{ 
            gridTemplateColumns: `repeat(${layoutScale.cols}, minmax(0, 1fr))`,
            maxWidth: layoutScale.cols * layoutScale.cardWidth + (layoutScale.cols - 1) * 4 // gap is 4px
          }}
        >
          {displayCards.length > 0 ? displayCards.map((card, i) => (
            <div key={card.id}>
              <CardThumbnail 
                card={card} 
                index={i + 1}
                drawnNumbers={round.drawnNumbers} 
                scale={layoutScale.scale}
                onClick={() => setSelectedCardId(card.id)}
              />
            </div>
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
              <input 
                type="text"
                value={editCardName}
                onChange={(e) => setEditCardName(e.target.value)}
                className="text-xl font-bold text-white mb-6 text-center tracking-wider bg-slate-800 border border-slate-600 rounded px-2 w-full outline-none focus:ring-2 focus:ring-emerald-500"
              />
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
                    <div className="grid grid-cols-5 bg-black text-white px-px">
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
                          placeholder={idx === 12 ? '★' : ''}
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
                      className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-1 text-[10px] uppercase transition-colors"
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
                      className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-1 text-[10px] uppercase transition-colors"
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
                      className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-1 text-[10px] uppercase transition-colors"
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
                      className="flex-1 py-1 bg-red-800 hover:bg-red-700 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-1 text-[10px] uppercase transition-colors"
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

function CardThumbnail({ card, index, drawnNumbers, scale, onClick }: { card: BingoCard, index: number, drawnNumbers: number[], scale?: number, onClick: () => void }) {
  const isEmpty = card.numbers[0] === null;
  let displayName = isEmpty ? `${index}ª CARTELA` : card.name;
  if (/^Cartela\s+(\d+)$/i.test(displayName)) {
    displayName = displayName.replace(/^Cartela\s+(\d+)$/i, "$1ª CARTELA");
  }

  return (
    <div 
      onClick={isEmpty ? undefined : onClick}
      style={{ zoom: scale ? scale : 1, width: 200 }}
      className={cn(
        "rounded overflow-hidden border flex flex-col font-sans transition-all mx-auto",
        !isEmpty && "cursor-pointer hover:border-slate-500",
        card.isWinner ? "border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)] ring-2 ring-yellow-500" : "border-[#1e293b]"
      )}
    >
      {/* Header Blue */}
      <div className={cn(
        "text-center text-[10px] sm:text-[11px] md:text-xs font-bold text-white truncate px-1 tracking-wide",
        card.isWinner ? "bg-yellow-600" : "bg-[#1e40af]"
      )} style={{ height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {displayName}
      </div>

      <BingoGrid card={card} drawnNumbers={drawnNumbers} />
      
      {/* Footer */}
      <div className="bg-black text-[#ef4444] px-1 py-0 text-[10px] sm:text-[11px] font-bold flex justify-between items-center" style={{ height: '22px' }}>
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
      <div className="grid grid-cols-5 bg-black text-white px-px">
        {letters.map((letter) => (
          <div 
            key={letter} 
            className={cn(
              "flex items-center justify-center font-bold",
               fullSize ? "text-xl pb-3 pt-2" : "text-[10px] sm:text-[11px]"
            )}
            style={{ height: fullSize ? 'auto' : '24px' }}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Grid Cells */}
      <div className="grid grid-cols-5 gap-px bg-slate-700 p-px flex-1">
        {card.numbers.map((num, idx) => {
          const isFree = num === 0 || (idx === 12 && num === 0);
          const isMarked = isFree || (num !== null && drawnSet.has(num));
          const isEmpty = num === null;

          return (
            <div 
              key={idx}
              className={cn(
                "w-full aspect-square flex items-center justify-center transition-colors overflow-hidden",
                fullSize ? "text-xl font-bold" : "text-[10px] sm:text-[11px] lg:text-xs font-semibold leading-none",
                isMarked && !isEmpty ? "bg-emerald-600 text-white shadow-inner" : "bg-[#182132] text-slate-300",
                isEmpty && "bg-[#182132]", // Just empty dark cell
                isFree && !isEmpty && "bg-slate-700 text-slate-400"
              )}
            >
              {!isEmpty && !isFree ? num : null}
              {isFree && !isEmpty && (fullSize ? '★' : '★')}
            </div>
          );
        })}
      </div>
    </div>
  );
}
