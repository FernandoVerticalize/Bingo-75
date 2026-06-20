import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { initAuth } from './lib/sync';
import { 
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
  const [callerWidth, setCallerWidth] = useState<number | string>('30%');
  const [callerHeight, setCallerHeight] = useState<number | string>('100%');
  const { masterCards, rounds, activeRoundId, addRound, setActiveRound, deleteRound, updateRoundName } = useStore();

  const activeRound = rounds.find(r => r.id === activeRoundId);

  useEffect(() => {
    initAuth();
  }, []);

  const getNextRoundName = () => {
      return `RODADA ${String(rounds.length + 1).padStart(2, '0')}`;
  };



  return (
    <div className="min-h-screen bg-[#0f111a] text-slate-100 font-sans flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="h-14 bg-[#0f111a] border-b border-slate-800 flex items-center justify-between px-2 md:px-4 shrink-0 gap-2 md:gap-4">
        {/* Left Elements */}
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <button 
            onClick={() => setActiveTab('BOARD')}
            className="flex items-center gap-2 md:gap-4 text-slate-400 hover:text-white transition-colors group"
            title="Início"
          >
            <Home size={24} className="group-hover:text-emerald-400 transition-colors" />
            <h1 className="text-lg md:text-xl font-bold tracking-wider hidden md:block group-hover:text-emerald-400 transition-colors">BINGO 75</h1>
          </button>

          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 lg:gap-4 bg-transparent hover:bg-slate-800 border border-slate-700 text-white font-bold rounded-lg py-1.5 px-3 lg:px-4 text-[11px] lg:text-[13px] outline-none transition-colors justify-between uppercase tracking-wider min-w-[140px] lg:min-w-[180px]"
            >
               <span className="truncate">{activeRound?.name || 'Rodada'}</span>
               <ChevronDown size={14} className="shrink-0" />
            </button>
            
            {isDropdownOpen && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                <div className="absolute top-10 left-0 mt-2 bg-[#0b0c10] border border-slate-800 rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden flex flex-col min-w-[220px]">
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

        {/* Center - Action Buttons */}
        <div className="flex-1 flex justify-start items-center px-1 overflow-x-hidden">
            <button 
              onClick={() => setActiveTab('SCANNER')}
              className="h-8 px-2 md:px-4 bg-[#1e40af] hover:bg-blue-700 text-white rounded font-bold uppercase text-[10px] md:text-[11px] tracking-wider flex items-center justify-center gap-1 md:gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Camera size={14} className="shrink-0" /> <span className="hidden sm:inline">Importar Cartelas</span><span className="sm:hidden">Importar</span>
            </button>
        </div>

        {/* Right Elements */}
        <div className="flex items-center gap-3 md:gap-5 shrink-0 text-[9px] lg:text-[11px] uppercase tracking-wider font-semibold text-slate-300 relative z-0">
          <div className="hidden lg:flex items-center gap-3 lg:gap-4 mr-0 md:mr-2">
             <button 
               onClick={() => useStore.getState().undoDraw()}
               disabled={!activeRound?.drawnNumbers?.length}
               className="flex items-center gap-1 hover:text-white transition-colors disabled:opacity-50 tracking-wider font-bold"
               title="Desfazer"
             >
               <Undo2 size={16} /> DESFAZER
             </button>
             
             <button 
               onClick={() => useStore.getState().redoDraw()}
               disabled={!activeRound?.undoneNumbers?.length}
               className="flex items-center gap-1 hover:text-white transition-colors disabled:opacity-50 tracking-wider font-bold"
               title="Refazer"
             >
               <Redo2 size={16} /> REFAZER
             </button>
          </div>
          <button 
            onClick={() => setActiveTab('STATS')}
            className={cn("flex items-center gap-1 hover:text-white transition-colors", activeTab === 'STATS' && "text-emerald-400")}
          >
            <BarChart2 size={16} className="hidden md:block" /> ESTATÍSTICAS
          </button>
          <button className="flex items-center gap-1 hover:text-white transition-colors">
            <History size={16} className="hidden md:block" /> HISTÓRICO
          </button>
          <button 
            onClick={() => setActiveTab('ADMIN')}
            className={cn("hover:text-white transition-colors", activeTab === 'ADMIN' && "text-emerald-400")}
          >
            <Settings size={18} />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col bg-[#0b0c10] p-2">
        {!activeRound ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-slate-400">Nenhuma rodada configurada.</p>
            <button 
              onClick={() => {
                addRound(`RODADA ${String(rounds.length + 1).padStart(2, '0')}`);
              }}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold"
            >
              Criar Nova Rodada
            </button>
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
                <div 
                   className="hidden lg:flex shrink-0 min-h-0 bg-[#0b0c10] flex-col relative group"
                   style={{ 
                      width: typeof callerWidth === 'number' ? `${callerWidth}px` : callerWidth, 
                      height: typeof callerHeight === 'number' ? `${callerHeight}px` : callerHeight,
                      minWidth: '220px',
                      minHeight: '300px',
                      maxWidth: '60vw',
                      maxHeight: '100%'
                   }}
                >
                  <CallerBoard round={activeRound} />
                  
                  {/* Resize Handle - Horizontal (Left edge) */}
                  <div 
                    className="absolute -left-3 top-0 bottom-0 w-6 cursor-col-resize hover:bg-emerald-500/20 group-hover:bg-slate-700/20 transition-colors z-20 flex items-center justify-center group/handle"
                    onMouseDown={(e) => {
                       e.preventDefault();
                       const startX = e.clientX;
                       const container = e.currentTarget.parentElement;
                       if (!container) return;
                       const startWidth = container.offsetWidth;

                       const handleMouseMove = (moveEvent: MouseEvent) => {
                          const deltaX = startX - moveEvent.clientX; 
                          let newWidth = startWidth + deltaX;
                          if (newWidth < 220) newWidth = 220;
                          setCallerWidth(newWidth);
                       };

                       const handleMouseUp = () => {
                         document.removeEventListener('mousemove', handleMouseMove);
                         document.removeEventListener('mouseup', handleMouseUp);
                       };

                       document.addEventListener('mousemove', handleMouseMove);
                       document.addEventListener('mouseup', handleMouseUp);
                    }}
                  >
                     <div className="w-[3px] h-12 bg-slate-500/30 group-hover/handle:bg-slate-400 group-hover/handle:shadow-[0_0_8px_rgba(5,150,105,0.8)] rounded-full transition-all" />
                  </div>
                  
                  {/* Resize Handle - Vertical (Bottom edge) */}
                  <div 
                    className="absolute left-0 right-0 -bottom-3 h-6 cursor-row-resize hover:bg-emerald-500/20 group-hover:bg-slate-700/20 transition-colors z-20 flex items-center justify-center group/handle"
                    onMouseDown={(e) => {
                       e.preventDefault();
                       const startY = e.clientY;
                       const container = e.currentTarget.parentElement;
                       if (!container) return;
                       const startHeight = container.offsetHeight;

                       const handleMouseMove = (moveEvent: MouseEvent) => {
                          const deltaY = moveEvent.clientY - startY; 
                          let newHeight = startHeight + deltaY;
                          if (newHeight < 300) newHeight = 300;
                          setCallerHeight(newHeight);
                       };

                       const handleMouseUp = () => {
                         document.removeEventListener('mousemove', handleMouseMove);
                         document.removeEventListener('mouseup', handleMouseUp);
                       };

                       document.addEventListener('mousemove', handleMouseMove);
                       document.addEventListener('mouseup', handleMouseUp);
                    }}
                  >
                     <div className="h-[3px] w-12 bg-slate-500/30 group-hover/handle:bg-slate-400 group-hover/handle:shadow-[0_0_8px_rgba(5,150,105,0.8)] rounded-full transition-all" />
                  </div>
                  
                  {/* Corner Resize Handle */}
                  <div 
                    className="absolute -left-4 -bottom-4 w-8 h-8 cursor-sw-resize z-30 flex items-end justify-start pl-2 pb-2 group/corner"
                    onMouseDown={(e) => {
                       e.preventDefault();
                       const startX = e.clientX;
                       const startY = e.clientY;
                       const container = e.currentTarget.parentElement;
                       if (!container) return;
                       const startWidth = container.offsetWidth;
                       const startHeight = container.offsetHeight;

                       const handleMouseMove = (moveEvent: MouseEvent) => {
                          const deltaX = startX - moveEvent.clientX; 
                          const deltaY = moveEvent.clientY - startY; 
                          
                          let newWidth = startWidth + deltaX;
                          if (newWidth < 220) newWidth = 220;
                          
                          let newHeight = startHeight + deltaY;
                          if (newHeight < 300) newHeight = 300;
                          
                          setCallerWidth(newWidth);
                          setCallerHeight(newHeight);
                       };

                       const handleMouseUp = () => {
                         document.removeEventListener('mousemove', handleMouseMove);
                         document.removeEventListener('mouseup', handleMouseUp);
                       };

                       document.addEventListener('mousemove', handleMouseMove);
                       document.addEventListener('mouseup', handleMouseUp);
                    }}
                  >
                     <div className="w-4 h-4 bg-slate-500/40 rounded-bl-sm rounded-tr-full group-hover/corner:bg-slate-400 group-hover/corner:shadow-[0_0_12px_rgba(5,150,105,1)] transition-all flex items-end justify-start p-1">
                       <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                     </div>
                  </div>
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
               <div className="flex-1 overflow-y-auto bg-[#0b0c10] flex flex-col items-center">
                 <div className="w-full max-w-4xl p-4 flex justify-between items-center bg-[#0b0c10] sticky top-0 z-10 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider">Adicionar Cartela</h2>
                    <button 
                      onClick={() => setActiveTab('BOARD')}
                      className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                      <X size={24} />
                      <span className="text-sm font-semibold uppercase tracking-wider hidden sm:block">Fechar</span>
                    </button>
                 </div>
                 <div className="w-full pt-4"><CardScanner round={activeRound} /></div>
               </div>
            )}
            
            {activeTab === 'STATS' && (
               <div className="flex-1 overflow-y-auto bg-[#0b0c10] flex flex-col items-center p-4">
                 <div className="w-full max-w-5xl flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white uppercase tracking-wider">Estatísticas</h2>
                    <button 
                      onClick={() => setActiveTab('BOARD')}
                      className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                      <X size={24} />
                      <span className="text-sm font-semibold uppercase tracking-wider hidden sm:block">Fechar</span>
                    </button>
                 </div>
                 <div className="w-full max-w-5xl"><StatsPanel round={activeRound} /></div>
               </div>
            )}

            {activeTab === 'ADMIN' && (
              <div className="flex-1 overflow-y-auto p-4 flex justify-center relative">
                <div className="max-w-2xl w-full">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Configurações</h2>
                    <button 
                      onClick={() => setActiveTab('BOARD')}
                      className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                      <X size={24} />
                      <span className="text-sm font-semibold uppercase tracking-wider hidden sm:block">Fechar</span>
                    </button>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <button 
                      onClick={() => addRound(`RODADA ${String(rounds.length + 1).padStart(2, '0')}`)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm transition-colors mb-6"
                    >
                      Criar Nova Rodada
                    </button>
                    <div className="space-y-3">
                      {rounds.map(r => (
                        <div key={r.id} className="flex justify-between items-center p-4 bg-slate-900 rounded-lg border border-slate-700">
                          <div className="flex-1 flex items-center gap-2 group">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="text"
                                  value={r.name}
                                  onChange={(e) => updateRoundName(r.id, e.target.value)}
                                  className="font-bold text-white bg-transparent border-none outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1 -ml-1 w-[200px]"
                                />
                                <Edit size={14} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <p className="text-xs text-slate-400">{masterCards.length} cartelas</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => { if(confirm(`Tem certeza que deseja excluir a ${r.name}? Esta ação é irreversível.`)) deleteRound(r.id); }}
                            className="text-red-400 hover:text-red-300 p-2"
                            title="Excluir Rodada"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-700">
                      <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-4">Diagnóstico OCR</h3>
                      <div className="bg-[#0b0c10] p-4 rounded-xl border border-slate-700 grid grid-cols-2 gap-4 text-sm">
                         <div className="flex flex-col gap-1">
                            <span className="text-slate-500 uppercase font-bold text-[10px]">Motor OCR</span>
                            <span className="text-emerald-400 font-medium">Tesseract.js (Local)</span>
                         </div>
                         <div className="flex flex-col gap-1">
                            <span className="text-slate-500 uppercase font-bold text-[10px]">Status</span>
                            <span className="text-slate-200 font-medium flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div> Operacional
                            </span>
                         </div>
                         <div className="flex flex-col gap-1">
                            <span className="text-slate-500 uppercase font-bold text-[10px]">Processamento de Imagem</span>
                            <span className="text-slate-200 font-medium">Canvas (Contraste 70%)</span>
                         </div>
                         <div className="flex flex-col gap-1">
                            <span className="text-slate-500 uppercase font-bold text-[10px]">Custo por Leitura</span>
                            <span className="text-slate-200 font-medium">$0.00 (Gratuito)</span>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </main>

    </div>
  );
}

