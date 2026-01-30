
export interface MetabaseParameter {
  id: string; // UUID interno do Metabase
  slug: string; // O nome amigável que aparece na URL
  type: string;
  name: string;
}

export interface MetabaseCardInfo {
  id: number;      // Card ID
  dashcardId: number; // Dashcard ID (instância do card no dashboard)
  name: string;
}

export interface MetabaseData {
  headers: string[];
  rows: any[];
  rawCsv: string;
  cardName?: string;
}

export interface AppState {
  data: MetabaseData | null;
  loading: boolean;
  error: string | null;
  dashboardCards: MetabaseCardInfo[] | null;
  dashboardParameters: MetabaseParameter[] | null;
  currentDashboardId: string | null;
  urlParams: Record<string, string>;
}
