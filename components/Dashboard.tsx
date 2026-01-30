
import React, { useState, useMemo } from 'react';
import { MetabaseData } from '../types';

interface Props {
  data: MetabaseData;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc' | null;
};

const Dashboard: React.FC<Props> = ({ data }) => {
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });
  const [displayLimit, setDisplayLimit] = useState(100);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data.rows];

    if (filterText) {
      const lowerFilter = filterText.toLowerCase();
      result = result.filter(row => 
        data.headers.some(header => 
          String(row[header] ?? '').toLowerCase().includes(lowerFilter)
        )
      );
    }

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        const modifier = sortConfig.direction === 'asc' ? 1 : -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * modifier;
        return String(aVal).localeCompare(String(bVal)) * modifier;
      });
    }

    return result;
  }, [data, filterText, sortConfig]);

  const paginatedData = filteredAndSortedData.slice(0, displayLimit);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      {data.cardName && (
        <div className="flex items-center gap-3 text-slate-400 mb-2">
          <i className="fas fa-file-csv text-xs"></i>
          <h2 className="text-[10px] font-black uppercase tracking-widest">Dataset: {data.cardName}</h2>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-300 p-4 shadow-sm">
        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <i className="fas fa-filter absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
            <input
              type="text"
              placeholder="BUSCAR NO DATASET..."
              className="w-full pl-9 pr-3 py-2 text-[10px] border border-slate-200 focus:outline-none focus:border-slate-800 rounded-none font-bold uppercase tracking-widest placeholder:text-slate-300 transition-colors"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Mostrar:</label>
            <select 
              className="px-2 py-2 text-[10px] border border-slate-200 bg-white rounded-none font-black focus:outline-none uppercase cursor-pointer hover:border-slate-400"
              value={displayLimit}
              onChange={(e) => setDisplayLimit(Number(e.target.value))}
            >
              <option value={50}>50 Linhas</option>
              <option value={100}>100 Linhas</option>
              <option value={500}>500 Linhas</option>
              <option value={1000}>1000 Linhas</option>
              <option value={9999999}>Ver Tudo</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">Registros Encontrados</span>
            <span className="text-sm font-black text-slate-800 tracking-tight">{filteredAndSortedData.length.toLocaleString()}</span>
          </div>
          <button 
            onClick={() => {
              const blob = new Blob([data.rawCsv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${data.cardName || 'export'}_${new Date().getTime()}.csv`;
              a.click();
            }}
            className="px-5 py-2.5 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all rounded-none"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-300 shadow-sm relative">
        <div className="overflow-x-auto overflow-y-auto max-h-[72vh] custom-scrollbar bg-white">
          <table className="w-full text-left border-collapse min-w-full">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50 border-b border-slate-300">
                {data.headers.map(h => (
                  <th 
                    key={h} 
                    className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase border-r border-slate-200 last:border-0 cursor-pointer hover:bg-slate-100 transition-colors select-none group min-w-[160px]"
                    onClick={() => handleSort(h)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate pr-2">{h}</span>
                      <span className="text-[9px] w-3 flex justify-center">
                        {sortConfig.key === h ? (
                          sortConfig.direction === 'asc' ? <i className="fas fa-arrow-up text-slate-800"></i> :
                          sortConfig.direction === 'desc' ? <i className="fas fa-arrow-down text-slate-800"></i> :
                          <i className="fas fa-sort opacity-20"></i>
                        ) : (
                          <i className="fas fa-sort opacity-10 group-hover:opacity-100"></i>
                        )}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                  {data.headers.map(h => (
                    <td key={h} className="px-4 py-3 text-[11px] text-slate-600 border-r border-slate-100 last:border-0 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[400px]">
                      {row[h]?.toLocaleString() ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={data.headers.length} className="px-6 py-40 text-center text-slate-300 uppercase font-black tracking-[0.4em] text-xs">
                    Sem registros compatíveis
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="bg-slate-50 border-t border-slate-300 px-6 py-3 flex justify-between items-center">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-slate-900"></div>
            {filteredAndSortedData.length > 0 ? (
              `Mostrando ${Math.min(displayLimit, filteredAndSortedData.length)} de ${filteredAndSortedData.length} registros`
            ) : (
              'Visualização Vazia'
            )}
          </div>
          <div className="text-[9px] font-bold text-slate-400 uppercase">
            Dataset Explorer Engine v2.1
          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border: 2px solid #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default Dashboard;
