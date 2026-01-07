// Raw Data Interfaces matching Excel Schema (Internal normalized representation)

export interface CompanyProfile {
    AccountID: string;
    Company: string;
    Industry: string;
    EmployeeCount: number;
    Region: string;
    Tier: string; // 'Customer Tier'
}

export interface DealHistory {
    DealID: string;
    AccountID: string;
    Stage: string; // 'Current Stage'
    Amount: number; // 'Expected Value USD'
    CreateDate: string; // 'Deal Created Timestamp'
    CloseDate?: string; // 'Expected Close Date' or actual from outcomes
    RepID: string; // 'Deal Owner Rep ID'
}

export interface WinLossOutcome {
    DealID: string;
    Outcome: 'Won' | 'Lost'; // 'Final Status'
    LossReason?: string;
    Competitor?: string;
    ActualAmount?: number; // 'Revenue Closed USD'
    CloseDate?: string; // 'Deal Closed Timestamp'
}

export interface SpendData {
    CampaignID: string;
    Channel: string;
    Platform: string;
    Cost: number; // 'Ad Spend USD'
    Date: string; // 'Spend Date'
}

export interface CallInsight {
    CallID: string;
    DealID: string;
    Sentiment: 'Positive' | 'Neutral' | 'Negative';
    Date: string;
}

export interface RawData {
    companies: CompanyProfile[];
    deals: DealHistory[];
    outcomes: WinLossOutcome[];
    spend: SpendData[];
    calls: CallInsight[];
}

// Processed Data Interfaces for Dashboard

export interface ICPMetric {
    segment: string; // e.g., "Tech - Enterprise"
    winRate: number;
    avgDealSize: number;
    salesCycle: number;
    cac: number;
    score: number;
}

export interface FunnelStage {
    stage: string;
    count: number;
    conversionRate: number; // to next stage
    dropOff: number;
    avgTimeInStage: number;
}

export interface ChannelPerformance {
    channel: string;
    spend: number;
    leads: number;
    deals: number;
    cac: number;
    roi: number;
}

export interface FinancialScenario {
    month: string;
    revenue: number;
    customers: number;
    costs: number;
}

export interface SentimentCorrelation {
    sentiment: string; // 'Positive', 'Neutral', 'Negative'
    winRate: number;
    avgSalesCycle: number;
    dealCount: number;
}

export interface DashboardState {
    isLoaded: boolean;
    icpAnalysis: ICPMetric[];
    funnelMetrics: FunnelStage[];
    marketingPerformance: ChannelPerformance[];
    financials: {
        conservative: FinancialScenario[];
        base: FinancialScenario[];
        aggressive: FinancialScenario[];
    };
    sentimentAnalysis: SentimentCorrelation[];
    insights: string[];
    riskRegister: Array<{risk: string; impact: string; mitigation: string}>;
    rawData?: RawData; // Optional raw data for dynamic filtering
}