
import { MetabaseData, MetabaseCardInfo, MetabaseParameter } from '../types';

/**
 * Extrai tipo, ID e parâmetros brutos da URL do Metabase
 */
export const parseMetabaseUrl = (urlStr: string): { type: 'question' | 'dashboard', id: string, rawParams: Record<string, string> } | null => {
  try {
    const url = new URL(urlStr);
    const path = url.pathname;
    const searchParams = url.searchParams;

    const questionMatch = path.match(/\/question\/(\d+)/);
    const dashboardMatch = path.match(/\/dashboard\/(\d+)/);

    const rawParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      let decodedKey = key;
      // Trata dupla codificação comum em redirects (ex: %255B -> %5B -> [)
      if (decodedKey.includes('%')) {
        try { decodedKey = decodeURIComponent(decodedKey); } catch(e) {}
      }
      rawParams[decodedKey] = value;
    });

    if (questionMatch) return { type: 'question', id: questionMatch[1], rawParams };
    if (dashboardMatch) return { type: 'dashboard', id: dashboardMatch[1], rawParams };
  } catch (e) {
    return null;
  }
  return null;
};

export const getBaseUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
};

/**
 * Busca metadados completos do dashboard (cards e definições de filtros)
 */
export const fetchDashboardMetadata = async (
  baseUrl: string, 
  dashboardId: string, 
  token: string, 
  useProxy: boolean
): Promise<{ cards: MetabaseCardInfo[], parameters: MetabaseParameter[] }> => {
  let apiUrl = `${baseUrl}/api/dashboard/${dashboardId}`;
  if (useProxy) apiUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;

  const response = await fetch(apiUrl, {
    headers: { 'X-Metabase-Session': token }
  });

  if (!response.ok) throw new Error('Falha ao carregar dashboard. Verifique o token ou permissões.');
  
  const data = await response.json();
  
  // ordered_cards contém a relação entre dashboard e card
  // oc.id é o dashcard_id, oc.card.id é o card_id
  const cards = (data.ordered_cards || [])
    .filter((oc: any) => oc.card)
    .map((oc: any) => ({
      id: oc.card.id,
      dashcardId: oc.id,
      name: oc.card.name
    }));

  const parameters = (data.parameters || []).map((p: any) => ({
    id: p.id,
    slug: p.slug,
    type: p.type,
    name: p.name
  }));

  return { cards, parameters };
};

/**
 * Mapeia os parâmetros da URL para o formato que o Metabase API espera (usando IDs internos)
 */
export const mapUrlParamsToMetabase = (
  rawParams: Record<string, string>, 
  dashboardParams: MetabaseParameter[]
): any[] => {
  const EXCLUDED = ['tab', 'dashboard_load_id'];
  const metabaseParams: any[] = [];

  // 1. Tenta mapear slugs conhecidos do dashboard
  dashboardParams.forEach(p => {
    if (rawParams[p.slug]) {
      metabaseParams.push({
        id: p.id,
        value: rawParams[p.slug]
      });
    }
  });

  // 2. Tenta mapear chaves da URL que batem exatamente com o slug ou id, evitando duplicatas
  Object.entries(rawParams).forEach(([key, value]) => {
    if (EXCLUDED.includes(key.toLowerCase()) || !value) return;
    
    const alreadyMapped = metabaseParams.some(mp => mp.value === value && (mp.id === key || dashboardParams.find(dp => dp.id === mp.id)?.slug === key));
    
    if (!alreadyMapped) {
      metabaseParams.push({
        id: key,
        value: value
      });
    }
  });

  return metabaseParams;
};

/**
 * Busca o CSV de um card respeitando filtros.
 * Usa o endpoint de dashcard se disponível, que é mais preciso para dashboards.
 */
export const fetchCardCsv = async (
  baseUrl: string, 
  cardId: string, 
  token: string, 
  useProxy: boolean, 
  dashboardId?: string, 
  dashcardId?: number,
  parameters: any[] = []
): Promise<string> => {
  let apiUrl = '';
  
  if (dashboardId && dashcardId) {
    // Endpoint recomendado para cards dentro de um dashboard específico
    apiUrl = `${baseUrl}/api/dashboard/${dashboardId}/dashcard/${dashcardId}/card/${cardId}/query/csv`;
  } else if (dashboardId) {
    apiUrl = `${baseUrl}/api/dashboard/${dashboardId}/card/${cardId}/query/csv`;
  } else {
    apiUrl = `${baseUrl}/api/card/${cardId}/query/csv`;
  }

  if (useProxy) apiUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Metabase-Session': token,
    },
    body: JSON.stringify({ parameters }),
  });

  if (!response.ok) {
    throw new Error(`Erro API Metabase: ${response.status} ao carregar dados.`);
  }

  return await response.text();
};

export const parseCsv = (csvText: string): MetabaseData => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) throw new Error('O Metabase retornou um dataset vazio para estes filtros.');

  const parseLine = (line: string) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else cur += char;
    }
    result.push(cur.trim());
    return result.map(v => v.replace(/^"|"$/g, ''));
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const rowObj: any = {};
    headers.forEach((header, index) => {
      const val = values[index];
      if (val && /^-?\d+(\.\d+)?$/.test(val)) {
        rowObj[header] = Number(val);
      } else {
        rowObj[header] = val;
      }
    });
    return rowObj;
  });

  return { headers, rows, rawCsv: csvText };
};
