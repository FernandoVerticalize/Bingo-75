import React, { useEffect, useState } from 'react';
import { Database, Download, Save, Trash2 } from 'lucide-react';
import { hasSavedData, loadAppSnapshot, saveAppSnapshot, clearAppSnapshot, getSnapshotMeta } from '../storage';

export function StoragePanel({ onLoaded }: { onLoaded?: () => void }) {
  const [meta, setMeta] = useState<any>(null);

  const refreshMeta = () => {
    getSnapshotMeta().then(setMeta);
  };

  useEffect(() => {
    refreshMeta();
  }, []);

  const handleSave = async () => {
    await saveAppSnapshot();
    refreshMeta();
    alert("Dados salvos com sucesso.");
  };

  const handleRestore = async () => {
    if (!meta) return;
    await loadAppSnapshot();
    if (onLoaded) onLoaded();
    alert("Dados restaurados com sucesso.");
  };

  const handleClear = async () => {
    if (confirm("Tem certeza que deseja apagar todos os dados locais?")) {
      await clearAppSnapshot();
      refreshMeta();
      alert("Dados locais removidos.");
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mt-6">
      <h3 className="text-xl font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
        <Database className="text-emerald-500" /> Gerenciar Dados Locais
      </h3>
      <p className="text-sm text-slate-400 mb-6">
        Salve manualmente o progresso atual. A aplicação salva dados automaticamente, 
        mas você pode forçar um salvamento aqui.
      </p>

      {meta && (
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <span className="text-xs uppercase font-bold text-slate-500 mb-1">Último salvamento:</span>
            <span className="text-sm text-slate-200 font-medium">
              {new Date(meta.saved_at).toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase font-bold text-slate-500 mb-1">Cartelas salvas:</span>
            <span className="text-xl text-emerald-400 font-bold">{meta.cardsCount}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase font-bold text-slate-500 mb-1">Números sorteados:</span>
            <span className="text-xl text-blue-400 font-bold">{meta.drawnCount}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <button 
          onClick={handleSave}
          className="flex-1 min-w-[140px] py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Save size={18} /> Salvar Dados
        </button>
        <button 
          onClick={handleRestore}
          disabled={!meta}
          className="flex-1 min-w-[140px] py-3 px-4 rounded-lg bg-[#1e40af] hover:bg-blue-700 disabled:opacity-50 text-white font-bold uppercase tracking-wider text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Download size={18} /> Carregar Dados
        </button>
        <button 
          onClick={handleClear}
          disabled={!meta}
          className="flex-1 min-w-[140px] py-3 px-4 rounded-lg border border-red-500/50 hover:bg-red-500/20 disabled:opacity-50 text-red-400 font-bold uppercase tracking-wider text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 size={18} /> Limpar Dados
        </button>
      </div>
    </div>
  );
}
