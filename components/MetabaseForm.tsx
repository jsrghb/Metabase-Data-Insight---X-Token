
import React, { useState } from 'react';

interface Props {
  onLoad: (url: string, token: string, useProxy: boolean) => void;
  isLoading: boolean;
}

const STORAGE_KEY = 'metabase_session_token';

const MetabaseForm: React.FC<Props> = ({ onLoad, isLoading }) => {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [useProxy, setUseProxy] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && token) {
      localStorage.setItem(STORAGE_KEY, token);
      onLoad(url, token, useProxy);
    }
  };

  return (
    <div className="bg-white border-b border-slate-300 w-full px-4 py-2 sticky top-0 z-50 shadow-sm">
      <form onSubmit={handleSubmit} className="max-w-[1600px] mx-auto flex flex-wrap items-end gap-4">
        
        <div className="flex-1 min-w-[300px]">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">
            URL do Metabase (Question ou Dashboard)
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 focus:outline-none focus:border-indigo-600 bg-white rounded-none font-medium"
            placeholder="https://metabase.company.com/..."
            required
          />
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
