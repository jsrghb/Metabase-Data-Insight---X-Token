
import React, { useState, useCallback } from 'react';
import { AppState, MetabaseCardInfo } from './types';
import { 
  fetchCardCsv, 
  fetchDashboardMetadata, 
  parseCsv, 
  parseMetabaseUrl, 
  getBaseUrl,
  mapUrlParamsToMetabase 
} from './services/metabase';
import MetabaseForm from './components/MetabaseForm';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    data: null,
    loading: false,
    error: null,
    dashboardCards: null,
    dashboardParameters: null,
    currentDashboardId: null,
    urlParams: {}
  });

  const [lastConfig, setLastConfig] = useState<{baseUrl: string, token: string, useProxy: boolean} | null>(null);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  const loadCardData = async (
    baseUrl: string, 
    cardId: string, 
    token: string, 
    useProxy: boolean, 
    cardName: string, 
    dashboardId?: string,
    dashcardId?: number,
    currentParams?: Record<string, string>
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const paramsToUse = currentParams || state.urlParams;
      const mappedParams = mapUrlParamsToMetabase(paramsToUse, state.dashboardParameters || []);
      
      const csvText = await fetchCardCsv(baseUrl, cardId, token, useProxy, dashboardId, dashcardId, mappedParams);
      const parsedData = parseCsv(csvText);
      
      setState(prev => ({ 
        ...prev, 
        data: { ...parsedData, cardName }, 
        loading: false 
      }));
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: `Erro ao carregar card: ${err.message}` }));
    }
  };

  const handleLoadData = useCallback(async (url: string, token: string, useProxy: boolean) => {
    const info = parseMetabaseUrl(url);
    const baseUrl = getBaseUrl(url);

    if (!info || !baseUrl) {
      setState(prev => ({ ...prev, error: 'URL inválida ou formato não reconhecido.' }));
      return;
    }

    setLastConfig({ baseUrl, token, useProxy });
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null, 
      data: null, 
      dashboardCards: null,
      dashboardParameters: null,
      currentDashboardId: info.type === 'dashboard' ? info.id : null,
      urlParams: info.rawParams
    }));

    try {
      if (info.type === 'dashboard') {
        const meta = await fetchDashboardMetadata(baseUrl, info.id, token, useProxy);
        
        setState(prev => ({ 
          ...prev, 
          dashboardCards: meta.cards,
          dashboardParameters: meta.parameters
        }));

        if (meta.cards.length > 0) {
          const firstCard = meta.cards[0];
          const mappedParams = mapUrlParamsToMetabase(info.rawParams, meta.parameters);
          
          const csvText = await fetchCardCsv(
            baseUrl, 
            firstCard.id.toString(), 
            token, 
            useProxy, 
            info.id, 
            firstCard.dashcardId, 
            mappedParams
          );
          const parsedData = parseCsv(csvText);
          
          setState(prev => ({ 
            ...prev, 
            data: { ...parsedData, cardName: firstCard.name }, 
            loading: false 
          }));
        } else {
          throw new Error('Este dashboard não contém cards que retornam dados tabulares.');
        }
      } else {
        const csvText = await fetchCardCsv(baseUrl, info.id, token, useProxy, undefined, undefined, mapUrlParamsToMetabase(info.rawParams, []));
        const parsedData = parseCsv(csvText);
        setState(prev => ({ 
          ...prev, 
          data: parsedData, 
          loading: false 
        }));
      }
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  const updateParam = (key: string, value: string) => {
    setState(prev => ({
      ...prev,
      urlParams: {
        ...prev.urlParams,
        [key]: value
      }
    }));
  };

  const handleRefreshWithFilters = () => {
    if (!lastConfig || !state.data) return;
    
    const currentCard = state.dashboardCards?.find(c => c.name === state.data?.cardName);
    const cardId = currentCard ? currentCard.id.toString() : (state.currentDashboardId || 'query');

    loadCardData(
      lastConfig.baseUrl,
      cardId,
      lastConfig.token,
      lastConfig.useProxy,
      state.data.cardName || 'Dataset',
      state.currentDashboardId || undefined,
      currentCard?.dashcardId
    );
  };

  const activeParams = Object.entries(state.urlParams).filter(([k]) => !['tab', 'dashboard_load_id'].includes(k.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <MetabaseForm onLoad={handleLoadData} isLoading={state.loading} />

      {/* Seletor de Cards e Filtros Colapsáveis */}
      {(state.dashboardCards || activeParams.length > 0) && (
        <div className="bg-white border-b border-slate-200 shadow-sm z-40">
          <div className="max-w-[1600px] mx-auto px-6">
            
            {/* Barra de Ações (Views + Botão Filtros) */}
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 overflow-hidden">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 shrink-0">
                  <i className="fas fa-layer-group text-indigo-500"></i>
                  Views:
                </span>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {state.dashboardCards?.map(card => (
                    <button
                      key={card.dashcardId}
                      onClick={() => lastConfig && loadCardData(
                        lastConfig.baseUrl, 
                        card.id.toString(), 
                        lastConfig.token, 
                        lastConfig.useProxy, 
                        card.name, 
                        state.currentDashboardId || undefined,
                        card.dashcardId
                      )}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase transition-all border shrink-0 ${
                        state.data?.cardName === card.name 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-800 shadow-xs'
                      }`}
                    >
                      {card.name}
                    </button>
                  ))}
                </div>
              </div>

              {activeParams.length > 0 && (
                <button 
                  onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                  className={`flex items-center gap-2 px-3 py-1.5 border transition-all text-[10px] font-black uppercase tracking-widest ${
                    isFiltersExpanded 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'
                  }`}
                >
                  <i className={`fas ${isFiltersExpanded ? 'fa-times' : 'fa-filter'}`}></i>
                  {isFiltersExpanded ? 'Fechar Filtros' : `Filtros (${activeParams.length})`}
                </button>
              )}
            </div>

            {/* Seção de Filtros (Collapse) */}
            {isFiltersExpanded && activeParams.length > 0 && (
              <div className="py-4 border-t border-slate-100 animate-in slide-in-from-top duration-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ajustar Parâmetros da Query</h4>
                  <button 
                    onClick={handleRefreshWithFilters}
                    disabled={state.loading}
                    className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 flex items-center gap-2 bg-indigo-50 px-2 py-1 border border-indigo-100"
                  >
                    <i className={`fas fa-sync-alt ${state.loading ? 'animate-spin' : ''}`}></i>
                    Aplicar Alterações
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {activeParams.map(([key, val]) => (
                    <div key={key} className="flex flex-col gap-1.5 border border-slate-100 bg-slate-50/50 p-2.5">
                      <label className="text-[8px] font-black text-slate-400 uppercase truncate" title={key}>
                        {key}
                      </label>
                      <input 
                        type="text" 
                        value={val}
                        onChange={(e) => updateParam(key, e.target.value)}
                        className="bg-white border border-slate-200 px-2 py-1.5 text-[10px] font-bold text-slate-800 focus:outline-none focus:border-indigo-500 rounded-none w-full shadow-inner"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto">
        {state.error && (
          <div className="max-w-[1600px] mx-auto mt-6 px-6">
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold flex items-center gap-3 shadow-xs">
              <i className="fas fa-exclamation-triangle"></i>
              <span>{state.error}</span>
            </div>
          </div>
        )}

        {!state.data && !state.loading && !state.error && (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-300">
            <div className="w-16 h-16 bg-white border border-slate-100 flex items-center justify-center rounded-full mb-6 shadow-sm">
              <i className="fas fa-table text-2xl opacity-20"></i>
            </div>
            <p className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-400">Insira a URL do Dashboard para analisar</p>
          </div>
        )}

        {state.loading && (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <div className="w-10 h-10 border-2 border-indigo-50 border-t-indigo-600 animate-spin mb-6"></div>
            <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[9px]">Sincronizando Datasets...</p>
          </div>
        )}

        {state.data && !state.loading && (
          <Dashboard data={state.data} />
        )}
      </main>

      <footer className="py-3 bg-white border-t border-slate-200 flex justify-center items-center gap-4 text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] select-none shadow-inner">
        <span>CSV Insight Explorer</span>
        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
        <span>Dashboard Engine v3.5</span>
      </footer>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes slide-in-from-top {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-in { animation: slide-in-from-top 0.2s ease-out; }
      `}</style>
    </div>
  );
};

export default App;
