import React from 'react';
import type { BingoRound } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { useStore, getRoundCards } from '../store';

export function StatsPanel({ round }: { round: BingoRound }) {
  const masterCards = useStore(state => state.masterCards);
  const cards = getRoundCards(masterCards, round);
  const totalDrawn = round.drawnNumbers.length;

  if (cards.length === 0) {
    return (
       <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 text-center">
        <p className="text-slate-400">Dados insuficientes para estatísticas.</p>
      </div>
    );
  }

  // Bar Chart Data
  const barData = cards.map(c => ({
    name: c.name.length > 10 ? c.name.substring(0, 10) + '...' : c.name,
    marcas: c.markedCount,
    fullData: c
  })).sort((a, b) => b.marcas - a.marcas).slice(0, 10); // top 10

  // Pie Chart Data (Global average progress)
  const avgMarked = cards.reduce((acc, c) => acc + c.markedCount, 0) / cards.length;
  const pieData = [
    { name: 'Marcados', value: Math.round(avgMarked), color: '#10b981' }, // emerald-500
    { name: 'Restantes', value: 25 - Math.round(avgMarked), color: '#334155' } // slate-700
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Números Sorteados" value={totalDrawn.toString()} sub="de 75 totais" />
        <StatCard title="Cartelas na Rodada" value={cards.length.toString()} sub="cadastradas" />
        <StatCard 
          title="Maior Acerto Atual" 
          value={Math.max(...cards.map(c => c.markedCount)).toString()} 
          sub="números marcados" 
          highlight
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6">Top Cartelas (Mais Próximas)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 25]} />
                <Tooltip 
                  cursor={{fill: '#1e293b'}} 
                  contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc'}}
                />
                <Bar dataKey="marcas" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fullData.isWinner ? '#eab308' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl flex flex-col">
          <h3 className="text-lg font-bold text-white mb-2">Média Geral</h3>
          <p className="text-slate-400 text-sm mb-4">Progresso médio de todas as cartelas</p>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px'}}
                  itemStyle={{color: '#fff'}}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-sm mt-4">
             <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 block"></span> Marcados</div>
             <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-700 block"></span> Restantes</div>
          </div>
        </div>
      </div>
      
      {/* Ranking List */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
         <h3 className="text-lg font-bold text-white mb-6">Ranking Completo</h3>
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.sort((a,b) => b.markedCount - a.markedCount).map((card, i) => (
              <div key={card.id} className="flex items-center gap-4 bg-slate-900 p-3 rounded-lg border border-slate-700">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 text-sm">
                  {i + 1}º
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white">{card.name}</div>
                  <div className="text-xs text-slate-400">Faltam {25 - card.markedCount} números</div>
                </div>
                <div className="text-lg font-black text-emerald-400">
                  {Math.round((card.markedCount / 25) * 100)}%
                </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, highlight }: { title: string, value: string, sub: string, highlight?: boolean }) {
  return (
    <div className={`p-6 rounded-xl border ${highlight ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-slate-800 border-slate-700'}`}>
      <h4 className="text-slate-400 text-sm font-medium mb-2">{title}</h4>
      <div className={`text-4xl font-black mb-1 ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
      <div className="text-sm text-slate-500">{sub}</div>
    </div>
  );
}
