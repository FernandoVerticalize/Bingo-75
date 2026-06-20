import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { hasSavedData, loadAppSnapshot, saveAppSnapshot, clearAppSnapshot } from '../storage';
import { Database, Download, Save, Trash2, X } from 'lucide-react';

export function StorageManager({ 
  onClose,
  onLoaded
}: { 
  onClose?: () => void,
  onLoaded?: () => void
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    hasSavedData().then(has => {
      if (has) {
        setShowPrompt(true);
      } else {
        setIsReady(true);
      }
    });
  }, []);

  // Set up auto-save every 30 seconds
  useEffect(() => {
    if (!isReady) return;
    
    const interval = setInterval(() => {
      saveAppSnapshot();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isReady]);

  // Set up auto-save on state change
  useEffect(() => {
    if (!isReady) return;
    return useStore.subscribe((state, prevState) => {
       saveAppSnapshot();
    });
  }, [isReady]);

  const handleRestore = async () => {
    await loadAppSnapshot();
    setShowPrompt(false);
    setIsReady(true);
    if (onLoaded) onLoaded();
    alert("Dados restaurados com sucesso.");
  };

  const handleIgnore = () => {
    setShowPrompt(false);
    setIsReady(true);
  };

  if (showPrompt) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
           <div className="flex justify-center mb-4 text-emerald-500">
             <Database size={48} />
           </div>
           <h3 className="text-xl font-bold text-white text-center mb-2">Restaurar Sessão</h3>
           <p className="text-slate-300 text-center mb-8">Deseja restaurar a última sessão salva?</p>
           
           <div className="flex gap-4">
             <button 
               onClick={handleIgnore}
               className="flex-1 py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase tracking-wider text-sm transition-colors"
             >
               Ignorar
             </button>
             <button 
               onClick={handleRestore}
               className="flex-1 py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm transition-colors"
             >
               Restaurar
             </button>
           </div>
        </div>
      </div>
    );
  }

  return null; // Return nothing when not prompting. Auto-save runs in background because of useEffect
}
