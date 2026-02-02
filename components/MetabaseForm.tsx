
import React, { useState, useEffect, useRef } from 'react';
import { parseMetabaseUrl } from '../services/metabase';

interface HistoryItem {
  url: string;
  type: 'question' | 'dashboard';
  id: string;
  timestamp: number;
}

interface Props {
  onLoad: (url: string, token: string, useProxy: boolean) => void;
  isLoading: boolean;
}

const TOKEN_STORAGE_KEY = 'metabase_session_token';
const URL_HISTORY_KEY = 'metabase_url_history';
const LAST_URL_KEY = 'metabase_last_url';

const MetabaseForm: React.FC<Props> = ({ onLoad, isLoading }) => {
  const [url, setUrl] = useState(() => localStorage.getItem(LAST_URL_KEY) || '');
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || '');
  const [useProxy, setUseProxy] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem(URL_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addToHistory = (newUrl: string) => {
    const info = parseMetabaseUrl(newUrl);
    if (!info) return;

    const newItem: HistoryItem = {
      url: newUrl,
      type: info.type,
      id: info.id,
      timestamp: Date.now()
    };

    setHistory(prev => {
      // Remove duplicatas (mesmo ID e Tipo)
      const filtered = prev.filter(item => !(item.id === newItem.id && item.type === newItem.type));
      const updated = [newItem, ...filtered].slice(0, 5);
      localStorage.setItem(URL_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(LAST_URL_KEY, url);
      addToHistory(url);
      onLoad(url, token, useProxy);
      setShowHistory(false);
    }
  };

  const selectHistoryItem = (item: HistoryItem) => {
    setUrl(item.url);
    setShowHistory(false);
  };

  return (
    <div className="bg-white border-b border-slate-300 w-full px-4 py-2 sticky top-0 z-50 shadow-sm">
      <form onSubmit={handleSubmit} className="max-w-[1600px] mx-auto flex flex-wrap items-end gap-4">
        
        <div className="flex-1 min-w-[300px] relative" ref={dropdownRef}>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">
            URL do Metabase (Question ou Dashboard)
          </label>
          <div className="relative">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={() => setShowHistory(true)}
              className="w-full px-3 py-2 text-sm border border-slate-300 focus:outline-none focus:border-indigo-600 bg-white rounded-none font-medium pr-10"
              placeholder="https://metabase.company.com/..."
              required
            />
            <button 
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 px-2"
            >
              <i className={`fas fa-chevron-${showHistory ? 'up' : 'down'} text-[10px]`}></i>
            </button>
          </div>

          {showHistory && history.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="bg-slate-50 px-3 py-2 border-b border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Últimas pesquisas acessadas</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {history.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectHistoryItem(item)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-emerald-500 group transition-colors text-left border-b border-slate-50 last:border-0"
                  >
                    <div className="w-10 h-10 bg-slate-100 flex items-center justify-center rounded-sm shrink-0 group-hover:bg-emerald-400 transition-colors">
                      <i className={`fas ${item.type === 'dashboard' ? 'fa-chart-pie' : 'fa-table'} text-slate-400 group-hover:text-white`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight group-hover:text-white truncate">
                          {item.type === 'dashboard' ? 'Dashboard' : 'Question'} #{item.id}
                        </span>
                        <span className="text-[9px] font-medium text-emerald-600 group-hover:text-emerald-100 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-2">
                          Aperte 'enter' para selecionar
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 group-hover:text-emerald-50 truncate font-medium">
                        {item.url}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-64">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">
            X-Metabase-Session Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 focus:outline-none focus:border-indigo-600 bg-white rounded-none"
            placeholder="Insira o session token..."
            required
          />
        </div>

        <div className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            id="proxy-toggle"
            checked={useProxy}
            onChange={(e) => setUseProxy(e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-slate-300 rounded-none focus:ring-0"
          />
          <label htmlFor="proxy-toggle" className="text-[10px] font-bold text-slate-600 uppercase cursor-pointer select-none">
            Bypass CORS
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`px-8 py-2 text-sm font-black uppercase tracking-widest text-white transition-all rounded-none ${
            isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-indigo-700 shadow-lg shadow-indigo-100'
          }`}
        >
          {isLoading ? <i className="fas fa-spinner fa-spin"></i> : 'Consultar'}
        </button>

      </form>
    </div>
  );
};

export default MetabaseForm;
