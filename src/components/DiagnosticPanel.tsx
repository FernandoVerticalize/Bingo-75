import React, { useEffect, useState } from 'react';
import { Download, Upload, Activity, Wifi, WifiOff, HardDrive, Database } from 'lucide-react';
import { getSnapshotMeta, hasSavedData } from '../storage';
import { toast } from 'sonner';

export function DiagnosticPanel() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [meta, setMeta] = useState<any>(null);

  const refreshDiagnostics = async () => {
    const sMeta = await getSnapshotMeta();
    setMeta(sMeta);
  };

  useEffect(() => {
    refreshDiagnostics();
    const interval = setInterval(() => {
       setIsOnline(navigator.onLine);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleExportJSON = async () => {
    try {
      const { get } = await import('idb-keyval');
      const data = await get('bingo-auto-save');
      if (!data) {
        toast.warning("Não há dados para exportar.");
        return;
      }
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_bingo_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Backup exportado com sucesso.");
    } catch (e) {
      toast.error("Erro ao exportar dados.");
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.version && typeof data === 'object') {
         const { set } = await import('idb-keyval');
         await set('bingo-auto-save', data);
         await refreshDiagnostics();
         toast.success("Dados importados com sucesso! Recarregue a página para aplicar.");
      } else {
         toast.error("Arquivo de backup inválido.");
      }
    } catch (err) {
      toast.error("Erro ao importar dados.");
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 mt-6">
      <h3 className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
        <Activity className="text-blue-500" /> Diagnóstico do Sistema
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 flex items-center gap-4">
           {isOnline ? <Wifi className="text-emerald-500" size={32} /> : <WifiOff className="text-red-500" size={32} />}
           <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Status da Conexão</p>
              <p className={`text-lg font-bold ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </p>
           </div>
        </div>
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 flex items-center gap-4">
           <HardDrive className="text-purple-500" size={32} />
           <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Status do Cache</p>
              <p className="text-lg font-bold text-purple-400">Ativo</p>
           </div>
        </div>
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 flex items-center gap-4">
           <Database className="text-blue-500" size={32} />
           <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Registros Locais (Cartelas)</p>
              <p className="text-lg font-bold text-blue-400">{meta?.cardsCount || 0}</p>
           </div>
        </div>
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 flex items-center gap-4 sm:col-span-2 lg:col-span-3">
           <Activity className="text-slate-400" size={32} />
           <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Versão da Aplicação</p>
              <p className="text-sm font-medium text-slate-200">v1.2.0 (PWA Ready)</p>
           </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mt-6 border-t border-slate-700 pt-6">
         <button 
           onClick={handleExportJSON}
           className="flex-1 py-3 px-4 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 font-bold uppercase tracking-wider text-sm transition-colors flex items-center justify-center gap-2 border border-emerald-500/30"
         >
           <Download size={18} /> Exportar Backup (JSON)
         </button>
         <label className="flex-1 py-3 px-4 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 font-bold uppercase tracking-wider text-sm transition-colors flex items-center justify-center gap-2 border border-blue-500/30 cursor-pointer">
           <Upload size={18} /> 
           <span>Importar Backup</span>
           <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
         </label>
      </div>
    </div>
  );
}
