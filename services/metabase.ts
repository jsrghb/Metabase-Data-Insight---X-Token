
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
 * Encapsula a lógica de URL com proxy
 */
const getProxiedUrl = (url: string, useProxy: boolean): string => {
  if (!useProxy) return url;
  return `/api/proxy?url=${encodeURIComponent(url)}`;
};

/**
 * Busca metadados completos do dashboard
 */
export const fetchDashboardMetadata = async (
  baseUrl: string, 
  dashboardId: string, 
  token: string, 
  useProxy: boolean
): Promise<{ cards: MetabaseCardInfo[], parameters: MetabaseParameter[] }> => {
  const apiUrl = getProxiedUrl(`${baseUrl}/api/dashboard/${dashboardId}`, useProxy);

  const response = await fetch(apiUrl, {
    headers: { 'X-Metabase-Session': token }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao carregar dashboard (HTTP ${response.status}): ${errorText || 'Sem detalhes'}`);
  }
  
  const data = await response.json();
  
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
 * Mapeia os parâmetros da URL para o formato Metabase
 */
export const mapUrlParamsToMetabase = (
  rawParams: Record<string, string>, 
  dashboardParams: MetabaseParameter[]
): any[] => {
  const EXCLUDED = ['tab', 'dashboard_load_id', 'dashboard_id'];
  const metabaseParams: any[] = [];

  dashboardParams.forEach(p => {
    if (rawParams[p.slug] !== undefined) {
      metabaseParams.push({
        id: p.id,
        value: rawParams[p.slug]
      });
    }
  });

  Object.entries(rawParams).forEach(([key, value]) => {
    if (EXCLUDED.includes(key.toLowerCase()) || value === undefined || value === null) return;
    
    const alreadyMappedBySlug = dashboardParams.some(dp => dp.slug === key);
    const alreadyMappedById = metabaseParams.some(mp => mp.id === key);
    
    if (!alreadyMappedBySlug && !alreadyMappedById) {
      metabaseParams.push({ id: key, value: value });
    }
  });

  return metabaseParams;
};

/**
 * Busca o CSV de um card
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
  let targetUrl = '';
  if (dashboardId && dashcardId) {
    targetUrl = `${baseUrl}/api/dashboard/${dashboardId}/dashcard/${dashcardId}/card/${cardId}/query/csv`;
  } else {
    targetUrl = `${baseUrl}/api/card/${cardId}/query/csv`;
  }

  const apiUrl = getProxiedUrl(targetUrl, useProxy);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Metabase-Session': token,
    },
    body: JSON.stringify({ parameters }),
  });

  if (!response.ok) {
    let errorMsg = `Erro ${response.status}`;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.message || errorJson.error || JSON.stringify(errorJson);
    } catch {
      const text = await response.text();
      errorMsg = text || errorMsg;
    }
    throw new Error(`Erro Metabase: ${errorMsg}`);
  }

  return await response.text();
};

export const parseCsv = (csvText: string): MetabaseData => {
  if (!csvText || csvText.trim().startsWith('<!DOCTYPE html>')) {
    throw new Error('A resposta do Metabase não é um CSV válido (pode ser uma página de erro HTML).');
  }

  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) throw new Error('O dataset retornado está vazio.');

  const parseLine = (line: string) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i+1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const rowObj: any = {};
    headers.forEach((header, index) => {
      const val = values[index];
      if (val && val !== '' && !isNaN(val as any) && isFinite(val as any)) {
        rowObj[header] = Number(val);
      } else {
        rowObj[header] = val;
      }
    });
    return rowObj;
  });

  return { headers, rows, rawCsv: csvText };
};
