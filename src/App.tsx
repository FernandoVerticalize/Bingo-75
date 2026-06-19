import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { 
  Menu, 
  Settings, 
  Camera, 
  BarChart2, 
  Play,
  Trash2,
  Home,
  History,
  Edit,
  Undo2,
  Redo2,
  ChevronDown,
  Hash,
  X
} from 'lucide-react';
import { cn } from './lib/utils';
import { CallerBoard } from './components/CallerBoard';
import { CardsGrid } from './components/CardsGrid';
import { CardScanner } from './components/CardScanner';
import { StatsPanel } from './components/StatsPanel';

export default function App() {
  const [activeTab, setActiveTab] = useState<'BOARD' | 'SCANNER' | 'STATS' | 'ADMIN'>('BOARD');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCallerBoardOpen, setIsCallerBoardOpen] = useState(false);
  const { masterCards, rounds, activeRoundId, addRound, setActiveRound, deleteRound, normalizeRounds } = useStore();

  const activeRound = rounds.find(r => r.id === activeRoundId);

  const getNextRoundName = () => {
      return `RODADA ${String(rounds.length + 1).padStart(2, '0')}`;
  };

  useEffect(() => {
    // Ensure we have at least 10 rounds
    if (rounds.length < 10) {
      const needed = 10 - rounds.length;
      let nextIndex = rounds.length + 1;
      for (let i = 0; i < needed; i++) {
        addRound(`RODADA ${String(nextIndex).padStart(2, '0')}`);
        nextIndex++;
      }
    } else {
      // Normalize existing rounds to strict format "RODADA 0X" based on their position
      const needsNormalization = rounds.some((r, i) => r.name !== `RODADA ${String(i + 1).padStart(2, '0')}`);
      if (needsNormalization) {
        normalizeRounds();
      }
    }
  }, [rounds.length, addRound, normalizeRounds]);

  return (
    <div className="min-h-screen bg-[#0f111a] text-slate-100 font-sans flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="h-14 bg-[#0f111a] border-b border-slate-800 flex items-center justify-between px-4 shrink-0 gap-4">
        {/* Left */}
        <div className="flex items-center gap-4 shrink-0">
          <button 
            onClick={() => setActiveTab('BOARD')}
            className="flex items-center gap-4 text-slate-400 hover:text-white transition-colors group"
            title="Início"
          >
            <Home size={24} className="group-hover:text-emerald-400 transition-colors" />
            <h1 className="text-xl font-bold tracking-wider hidden md:block group-hover:text-emerald-400 transition-colors">BINGO 75</h1>
          </button>
          <button className="text-slate-400 hover:text-white ml-2 hidden md:block">
            <Menu size={24} />
          </button>
        </div>

        {/* Center - Round Tabs */}
        <div className="flex-1 flex justify-center overflow-visible">
          <div className="relative">
            <button 
               onClick={() => setIsDropdownOpen(!isDropdownOpen)}
               className="flex items-center gap-4 bg-transparent hover:bg-slate-800 border border-slate-700 text-white font-bold rounded-lg py-2 px-6 text-[13px] outline-none transition-colors justify-between uppercase tracking-wider min-w-[220px]"
            >
               <span>{activeRound?.name || 'Selecione a Rodada'}</span>
               <ChevronDown size={16} />
            </button>
            
            {isDropdownOpen && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0b0c10] border border-slate-800 rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden flex flex-col min-w-[220px]">
                    {rounds.map(r => (
                        <div key={r.id} className="flex items-center group relative border-b border-slate-800/50 last:border-0">
                            <button
                                onClick={() => { setActiveRound(r.id); setIsDropdownOpen(false); }}
                                className={cn(
                                    "flex-1 text-left px-6 py-3 text-[13px] font-bold uppercase tracking-wider transition-colors z-10",
                                    r.id === activeRoundId ? "bg-[#1e3a8a] text-white" : "text-slate-300 hover:text-white hover:bg-slate-800"
                                )}
                            >
                                {r.name}
                            </button>
                            {rounds.length > 1 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`Tem certeza que deseja excluir a ${r.name}?`)) {
                                            deleteRound(r.id);
                                        }
                                    }}
                                    className="absolute right-0 top-0 bottom-0 px-4 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center hover:bg-red-950/30"
                                    title="Excluir Rodada"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        onClick={() => {
                            addRound(getNextRoundName());
                            setIsDropdownOpen(false);
                        }}
                        className="px-6 py-3 text-[13px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 border-t border-slate-700 text-left transition-colors flex items-center justify-center"
                    >
                        + Adicionar Rodada Extra
                    </button>
                </div>
                </>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4 md:gap-6 shrink-0 text-[10px] md:text-xs uppercase tracking-wider font-semibold text-slate-300">
          <button 
            onClick={() => setActiveTab('STATS')}
            className={cn("flex items-center gap-1 md:gap-2 hover:text-white transition-colors", activeTab === 'STATS' && "text-emerald-400")}
          >
            <BarChart2 size={18} className="hidden md:block" /> ESTATÍSTICAS
          </button>
          <button className="flex items-center gap-1 md:gap-2 hover:text-white transition-colors">
            <History size={18} className="hidden md:block" /> HISTÓRICO
          </button>
          <button 
            onClick={() => setActiveTab('ADMIN')}
            className={cn("hover:text-white transition-colors", activeTab === 'ADMIN' && "text-emerald-400")}
          >
            <Settings size={20} />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col bg-[#0b0c10] p-2">
        {!activeRound ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">Criando rodada inicial...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-2">
            
            {activeTab === 'BOARD' && (
              <>
                {/* Cards Container (Left, Flexible Width) */}
                <div className="flex-1 min-h-0 relative">
                  <div className="absolute inset-0">
                    <CardsGrid round={activeRound} />
                  </div>
                  
                  {/* Mobile Floating Action Button to open CallerBoard */}
                  <button 
                    onClick={() => setIsCallerBoardOpen(true)}
                    className="lg:hidden absolute bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-[0_0_15px_rgba(5,150,105,0.5)] flex items-center justify-center transition-all z-10"
                    title="Números Sorteados"
                  >
                    <Hash size={24} />
                  </button>
                </div>
                
                {/* Caller Board Container (Right, Responsive Width) - Desktop */}
                <div className="hidden lg:block w-[180px] xl:w-[220px] shrink-0 overflow-y-auto min-h-0 bg-[#0b0c10]">
                  <CallerBoard round={activeRound} />
                </div>

                {/* Mobile CallerBoard Modal */}
                {isCallerBoardOpen && (
                  <div className="fixed inset-0 z-50 flex justify-end bg-black/60 lg:hidden" onClick={() => setIsCallerBoardOpen(false)}>
                    <div 
                      className="w-4/5 max-w-[300px] h-full bg-[#0b0c10] shadow-2xl flex flex-col pt-4 overflow-y-auto"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex justify-between items-center px-4 mb-2">
                         <h3 className="text-white font-bold uppercase tracking-wider text-sm">Painel de Sorteio</h3>
                         <button onClick={() => setIsCallerBoardOpen(false)} className="text-slate-400 hover:text-white p-1">
                           <X size={20} />
                         </button>
                      </div>
                      <CallerBoard round={activeRound} />
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'SCANNER' && (
               <div className="flex-1 overflow-y-auto"><CardScanner round={activeRound} /></div>
            )}
            
            {activeTab === 'STATS' && (
               <div className="flex-1 overflow-y-auto p-4"><StatsPanel round={activeRound} /></div>
            )}

            {activeTab === 'ADMIN' && (
              <div className="flex-1 overflow-y-auto p-4 flex justify-center">
                <div className="max-w-2xl w-full">
                  <h2 className="text-2xl font-bold text-white mb-6">Configurações</h2>
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <button 
                      onClick={() => addRound(`RODADA ${String(rounds.length + 1).padStart(2, '0')}`)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm transition-colors mb-6"
                    >
                      Criar Nova Rodada
                    </button>
                    <div className="space-y-3">
                      {rounds.map(r => (
                        <div key={r.id} className="flex justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
                          <div>
                            <p className="font-bold text-white">{r.name}</p>
                            <p className="text-xs text-slate-400">{masterCards.length} cartelas</p>
                          </div>
                          <button 
                            onClick={() => { if(confirm('Excluir esta rodada irreversivelmente?')) useStore.getState().deleteRound(r.id); }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </main>

      {/* Bottom Action Bar */}
      <footer className="h-16 bg-[#0f111a] border-t border-slate-800 flex items-center justify-between px-4 gap-4 shrink-0">
         <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto">
            <button 
              onClick={() => setActiveTab('SCANNER')}
              className="h-10 px-6 bg-[#1e40af] hover:bg-blue-700 text-white rounded font-bold uppercase text-[11px] tracking-wider flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Camera size={18} /> Adicionar Cartela
            </button>
            <button 
              onClick={() => {
                if(confirm('Tem certeza que deseja zerar TODAS as marcações desta rodada?')) {
                  useStore.getState().clearDrawnNumbers();
                }
              }}
              className="h-10 px-6 bg-red-800 hover:bg-red-700 text-white rounded font-bold uppercase text-[11px] tracking-wider flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Trash2 size={18} /> Zerar Tudo
            </button>
         </div>

         <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            <button 
              onClick={() => useStore.getState().undoDraw()}
              disabled={!activeRound?.drawnNumbers?.length}
              className="h-10 px-6 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded font-bold uppercase text-[11px] tracking-wider flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Undo2 size={18} /> Desfazer
            </button>
            
            <button 
              onClick={() => useStore.getState().redoDraw()}
              disabled={!activeRound?.undoneNumbers?.length}
              className="h-10 px-6 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded font-bold uppercase text-[11px] tracking-wider flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Redo2 size={18} /> Refazer
            </button>
         </div>
      </footer>
    </div>
  );
}

