import * as XLSX from 'xlsx';
import { GoogleGenAI, Type } from "@google/genai";
import { CompanyProfile, DealHistory, WinLossOutcome, SpendData, CallInsight, DashboardState, ICPMetric, FunnelStage, ChannelPerformance, FinancialScenario, SentimentCorrelation, RawData } from '../types';
import { generateSampleData } from './sampleData';

// --- Gemini AI Integration ---

const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Strategic Sampling Logic ---

export type SamplingMode = 'DIAGNOSTIC' | 'PRECISION' | 'RISK' | 'MOMENTUM';

const sampleArray = <T>(array: T[], n: number): T[] => {
    if (!array || array.length === 0) return [];
    // Fisher-Yates shuffle for true randomness
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, n);
};

export const getStrategicSample = (raw: RawData, mode: SamplingMode = 'DIAGNOSTIC') => {
    let targetDeals = raw.deals;

    // Mode-based filtering before sampling
    switch (mode) {
        case 'PRECISION':
            // Sample High Value or Late Stage deals
            targetDeals = raw.deals.filter(d => d.Amount > 50000 || ['Negotiation', 'Proposal', 'Closed Won'].includes(d.Stage));
            break;
        case 'RISK':
            // Sample Stalled deals or Lost deals
            targetDeals = raw.deals.filter(d => d.Stage.includes('Lost') || (d.Stage !== 'Closed Won' && new Date(d.CreateDate).getTime() < new Date().getTime() - 90 * 24 * 60 * 60 * 1000));
            break;
        case 'MOMENTUM':
            // Sample Active deals to check velocity
            targetDeals = raw.deals.filter(d => !d.Stage.includes('Closed'));
            break;
        case 'DIAGNOSTIC':
        default:
            // Broad sample
            break;
    }

    // Fallback if filter is too aggressive
    if (targetDeals.length < 10) targetDeals = raw.deals;

    // Sample Size: 40 Deals (token efficiency + statistical significance)
    const sampledDeals = sampleArray(targetDeals, 40);
    const dealIds = new Set(sampledDeals.map(d => d.DealID));

    // Get correlated data for the sampled deals
    const relatedCalls = raw.calls.filter(c => dealIds.has(c.DealID));
    const relatedOutcomes = raw.outcomes.filter(o => dealIds.has(o.DealID));
    // Sample companies independently to ensure we see the market breadth, not just deal-related ones
    const sampledCompanies = sampleArray(raw.companies, 20);

    return {
        mode,
        sampleSize: sampledDeals.length,
        deals: sampledDeals,
        outcomes: relatedOutcomes,
        calls: sampleArray(relatedCalls, 30), // Limit calls context
        companies: sampledCompanies
    };
};

const getGeminiAnalysis = async (
    rawData: RawData,
    metrics: {
        icp: ICPMetric[], 
        funnel: FunnelStage[], 
        marketing: ChannelPerformance[],
        revenue: number,
        sentiment: SentimentCorrelation[]
    }
): Promise<{ insights: string[], riskRegister: Array<{risk: string; impact: string; mitigation: string}> }> => {
    
    // 1. Perform Strategic Sampling (Diagnostic Mode)
    const sample = getStrategicSample(rawData, 'DIAGNOSTIC');

    // 2. Aggregate Context (High Level)
    const aggregateContext = {
        top_segment: metrics.icp[0]?.segment,
        overall_win_rate: metrics.icp[0]?.winRate,
        funnel_bottleneck: metrics.funnel.reduce((prev, curr) => (curr.dropOff > prev.dropOff ? curr : prev), metrics.funnel[0]).stage,
        projected_revenue: metrics.revenue
    };

    const prompt = `
        You are the NovaTech Growth Strategist AI. 
        OPERATING PRINCIPLE: Precision over Volume. Prevent "False Confidence" from vanity metrics.
        
        DATA SOURCE:
        You are analyzing a STATISTICALLY REPRESENTATIVE RANDOM SAMPLE (N=${sample.sampleSize}) of the raw dataset.
        Use this sample to find CAUSAL PATTERNS, not just correlations.

        SAMPLED RAW DATA (Examples):
        ${JSON.stringify({ deals: sample.deals, calls: sample.calls, outcomes: sample.outcomes }, null, 2)}

        AGGREGATE CONTEXT:
        ${JSON.stringify(aggregateContext, null, 2)}

        ANALYSIS TASKS:
        1. **Champion Problem Detection**: Look at the sampled deals. Are there deals with high call volume (Sentiment: Positive/Neutral) that are NOT progressing? This indicates we are talking to friends, not decision makers.
        2. **False Confidence Check**: Look for "Positive" sentiment calls in deals that were eventually Lost. Why did we lose despite good vibes?
        3. **Engineered Momentum**: Identify one stage where deals seem to rot based on the CreateDate vs Stage.

        OUTPUT (Strict JSON):
        {
            "insights": [
                "Specific insight about [Segment/Pattern] derived from sample.", 
                "Warning about [Risk Pattern] observed in [X]% of sampled deals.",
                "Strategic observation regarding [Metric] vs [Reality].",
                "Actionable recommendation to fix [Bottleneck]."
            ],
            "riskRegister": [
                {"risk": "Specific Operational Risk", "impact": "High" | "Medium" | "Low", "mitigation": "Concrete Step"}
            ]
        }
    `;

    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: prompt,
            config: {
                maxOutputTokens: 2500,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        insights: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        riskRegister: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    risk: { type: Type.STRING },
                                    impact: { type: Type.STRING },
                                    mitigation: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        let text = response.text;
        if (!text) throw new Error("No response from AI");
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(text);

    } catch (error) {
        console.warn("Gemini Analysis Partial Failure:", error);
        throw error;
    }
};

// --- Helper: Timeout Wrapper ---
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            console.warn(`AI Analysis timed out after ${ms}ms, using fallback.`);
            resolve(fallback);
        }, ms);

        promise.then((val) => {
            clearTimeout(timer);
            resolve(val);
        }).catch((err) => {
            console.warn("AI Analysis failed, switching to fallback data.", err);
            clearTimeout(timer);
            resolve(fallback);
        });
    });
};

// --- Data Parsing Helpers ---

const readFileSheets = (file: File): Promise<Record<string, any[]>> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheets: Record<string, any[]> = {};
            workbook.SheetNames.forEach(name => {
                sheets[name.toLowerCase()] = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
            });
            resolve(sheets);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

// --- Explicit Mappers based on User Schema ---

const mapCompanyProfile = (row: any): CompanyProfile => ({
    AccountID: row['Account ID'] || row['AccountID'],
    Company: row['Company Name'],
    Industry: row['Industry'],
    EmployeeCount: Number(row['Employee Count']) || 0,
    Region: row['Region'],
    Tier: row['Customer Tier'] || row['Tier']
});

const mapDealHistory = (row: any): DealHistory => {
    const parseDate = (val: any) => {
        if (!val) return new Date().toISOString();
        if (typeof val === 'number') {
            return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().split('T')[0];
        }
        return String(val);
    };

    return {
        DealID: row['Deal ID'] || row['DealID'],
        AccountID: row['Account ID'] || row['AccountID'],
        Stage: row['Current Stage'] || row['Stage'],
        Amount: Number(row['Expected Value USD']) || Number(row['Amount']) || 0,
        CreateDate: parseDate(row['Deal Created Timestamp'] || row['CreateDate']),
        CloseDate: row['Expected Close Date'] ? parseDate(row['Expected Close Date']) : undefined,
        RepID: row['Deal Owner Rep ID'] || row['RepID']
    };
};

const mapWinLossOutcome = (row: any): WinLossOutcome => {
    const parseDate = (val: any) => {
        if (!val) return undefined;
        if (typeof val === 'number') {
            return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().split('T')[0];
        }
        return String(val);
    };

    let outcome: 'Won' | 'Lost' = 'Lost';
    const status = (row['Final Status'] || row['Outcome'] || '').toLowerCase();
    if (status.includes('won')) outcome = 'Won';

    return {
        DealID: row['Deal ID'] || row['DealID'],
        Outcome: outcome,
        LossReason: row['Loss Reason'],
        Competitor: row['Competitor Named'],
        ActualAmount: Number(row['Revenue Closed USD']),
        CloseDate: parseDate(row['Deal Closed Timestamp'])
    };
};

const mapSpendData = (row: any): SpendData => {
     const parseDate = (val: any) => {
        if (!val) return new Date().toISOString();
        if (typeof val === 'number') {
            return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().split('T')[0];
        }
        return String(val);
    };

    return {
        CampaignID: row['Campaign ID'] || row['CampaignID'],
        Channel: row['Channel'],
        Platform: row['Platform'],
        Cost: Number(row['Ad Spend USD']) || Number(row['Cost']) || 0,
        Date: parseDate(row['Spend Date'] || row['Date'])
    };
};

const mapCallInsight = (row: any): CallInsight => {
    const parseDate = (val: any) => {
        if (!val) return new Date().toISOString();
        if (typeof val === 'number') {
            return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().split('T')[0];
        }
        return String(val);
    };

    return {
        CallID: row['Call ID'] || row['CallID'] || `CALL-${Math.random()}`,
        DealID: row['Deal ID'] || row['DealID'],
        Sentiment: row['Call Sentiment'] || row['Sentiment'] || 'Neutral',
        Date: parseDate(row['Call Date'] || row['Date'])
    };
};

// --- Calculation Logic (Exported for Reuse in Dashboard Filtering) ---

export const calculateICPMetrics = (companies: CompanyProfile[], deals: DealHistory[], outcomes: WinLossOutcome[]): ICPMetric[] => {
    const mergedDeals = deals.map(d => {
        const outcome = outcomes.find(o => o.DealID === d.DealID);
        return {
            ...d,
            ActualOutcome: outcome ? outcome.Outcome : null,
            FinalAmount: outcome?.ActualAmount || d.Amount,
            FinalCloseDate: outcome?.CloseDate || d.CloseDate
        };
    });

    const segments: Record<string, { wins: number, total: number, revenue: number, cycles: number[] }> = {};

    mergedDeals.forEach(deal => {
        const comp = companies.find(c => c.AccountID === deal.AccountID);
        if (!comp) return;

        const ind = comp.Industry || 'Unknown';
        const tier = comp.Tier || 'Unknown';
        const segmentKey = `${ind} - ${tier}`;
        
        if (!segments[segmentKey]) segments[segmentKey] = { wins: 0, total: 0, revenue: 0, cycles: [] };
        
        const stage = (deal.Stage || '').toLowerCase();
        const outcomeStatus = (deal.ActualOutcome || '').toLowerCase();
        const isClosed = stage.includes('closed') || stage.includes('won') || stage.includes('lost') || outcomeStatus === 'won' || outcomeStatus === 'lost';
        
        if (isClosed) segments[segmentKey].total++;
        
        const isWon = outcomeStatus === 'won' || stage.includes('won');
        
        if (isWon) {
            segments[segmentKey].wins++;
            segments[segmentKey].revenue += deal.FinalAmount || 0;
            if (deal.CreateDate && deal.FinalCloseDate) {
                const start = new Date(deal.CreateDate).getTime();
                const end = new Date(deal.FinalCloseDate).getTime();
                if (!isNaN(start) && !isNaN(end)) {
                    const days = (end - start) / (1000 * 3600 * 24);
                    if (days > 0) segments[segmentKey].cycles.push(days);
                }
            }
        }
    });

    return Object.entries(segments).map(([segment, data]) => {
        const winRate = data.total > 0 ? (data.wins / data.total) * 100 : 0;
        const avgDealSize = data.wins > 0 ? data.revenue / data.wins : 0;
        const avgCycle = data.cycles.length > 0 ? data.cycles.reduce((a,b)=>a+b,0) / data.cycles.length : 0;
        const score = (winRate * avgDealSize) / 10000;

        return {
            segment,
            winRate,
            avgDealSize,
            salesCycle: avgCycle,
            cac: 0, 
            score
        };
    }).sort((a,b) => b.score - a.score).slice(0, 10);
};

export const calculateFunnelMetrics = (deals: DealHistory[]): FunnelStage[] => {
    const stages = ['Lead', 'MQL', 'SQL', 'Proposal', 'Closed Won'];
    const counts: Record<string, number> = { 'Lead': 0, 'MQL': 0, 'SQL': 0, 'Proposal': 0, 'Closed Won': 0 };

    deals.forEach(d => {
        let stageIdx = 0;
        const s = (d.Stage || '').toLowerCase();
        if(s.includes('won')) stageIdx = 4;
        else if(s.includes('proposal') || s.includes('negotiation')) stageIdx = 3;
        else if(s.includes('sql') || s.includes('opportunity') || s.includes('discovery')) stageIdx = 2;
        else if(s.includes('mql') || s.includes('qualif')) stageIdx = 1;
        else stageIdx = 0; 

        for(let i=0; i<=stageIdx; i++) {
            counts[stages[i]]++;
        }
    });

    return stages.map((stage, idx) => {
        const count = counts[stage];
        const nextCount = counts[stages[idx+1]] || 0;
        const conversionRate = count > 0 && idx < stages.length - 1 ? (nextCount / count) * 100 : 0;
        
        return {
            stage,
            count,
            conversionRate,
            dropOff: 100 - conversionRate,
            avgTimeInStage: 14 + (idx * 5) 
        };
    });
};

export const calculateMarketingROI = (spend: SpendData[], deals: DealHistory[]): ChannelPerformance[] => {
    const channelMetrics: Record<string, { cost: number, deals: number, revenue: number }> = {};
    spend.forEach(s => {
        const ch = s.Channel || 'Other';
        if (!channelMetrics[ch]) channelMetrics[ch] = { cost: 0, deals: 0, revenue: 0 };
        channelMetrics[ch].cost += s.Cost;
    });

    const totalSpend = Object.values(channelMetrics).reduce((acc, v) => acc + v.cost, 0);
    const wonDeals = deals.filter(d => (d.Stage || '').toLowerCase().includes('won'));
    const totalRevenue = wonDeals.reduce((acc, d) => acc + (d.Amount || 0), 0);

    Object.keys(channelMetrics).forEach(ch => {
        const share = totalSpend > 0 ? channelMetrics[ch].cost / totalSpend : 0;
        channelMetrics[ch].deals = Math.floor(wonDeals.length * share);
        channelMetrics[ch].revenue = totalRevenue * share;
    });

    return Object.entries(channelMetrics).map(([channel, data]) => ({
        channel,
        spend: data.cost,
        leads: Math.floor(data.cost / 50), 
        deals: data.deals,
        cac: data.deals > 0 ? data.cost / data.deals : 0,
        roi: data.cost > 0 ? ((data.revenue - data.cost) / data.cost) * 100 : 0
    })).sort((a,b) => b.roi - a.roi);
};

export const generateFinancialModel = (baseRevenue: number): { conservative: FinancialScenario[], base: FinancialScenario[], aggressive: FinancialScenario[] } => {
    const months = 18;
    const results = { conservative: [], base: [], aggressive: [] } as any;
    let currentBase = baseRevenue / 12; 
    if (currentBase === 0) currentBase = 100000; 

    for(let i=0; i<months; i++) {
        const monthLabel = `M${i+1}`;
        const consGrowth = 1.02; 
        const baseGrowth = 1.05; 
        const aggrGrowth = 1.08; 
        results.conservative.push({
            month: monthLabel,
            revenue: currentBase * Math.pow(consGrowth, i),
            customers: Math.floor((currentBase * Math.pow(consGrowth, i)) / 5000),
            costs: (currentBase * Math.pow(consGrowth, i)) * 0.8
        });
        results.base.push({
            month: monthLabel,
            revenue: currentBase * Math.pow(baseGrowth, i),
            customers: Math.floor((currentBase * Math.pow(baseGrowth, i)) / 5000),
            costs: (currentBase * Math.pow(baseGrowth, i)) * 0.7
        });
        results.aggressive.push({
            month: monthLabel,
            revenue: currentBase * Math.pow(aggrGrowth, i),
            customers: Math.floor((currentBase * Math.pow(aggrGrowth, i)) / 5000),
            costs: (currentBase * Math.pow(aggrGrowth, i)) * 0.6
        });
    }
    return results;
};

export const calculateSentimentCorrelation = (calls: CallInsight[], deals: DealHistory[], outcomes: WinLossOutcome[]): SentimentCorrelation[] => {
    const dealSentiments: Record<string, { score: number, count: number }> = {};
    calls.forEach(c => {
        if (!dealSentiments[c.DealID]) dealSentiments[c.DealID] = { score: 0, count: 0 };
        let val = 0;
        if (c.Sentiment === 'Positive') val = 1;
        else if (c.Sentiment === 'Negative') val = -1;
        dealSentiments[c.DealID].score += val;
        dealSentiments[c.DealID].count++;
    });

    const buckets = {
        'Positive': { total: 0, wins: 0, cycles: [] as number[] },
        'Neutral': { total: 0, wins: 0, cycles: [] as number[] },
        'Negative': { total: 0, wins: 0, cycles: [] as number[] }
    };

    deals.forEach(d => {
        const outcome = outcomes.find(o => o.DealID === d.DealID);
        const isWon = outcome?.Outcome === 'Won' || d.Stage.toLowerCase().includes('won');
        const isClosed = outcome || d.Stage.toLowerCase().includes('closed') || d.Stage.toLowerCase().includes('won') || d.Stage.toLowerCase().includes('lost');
        const sentData = dealSentiments[d.DealID];
        let bucketKey: 'Positive' | 'Neutral' | 'Negative' = 'Neutral';
        
        if (sentData) {
            const avg = sentData.score / sentData.count;
            if (avg > 0.2) bucketKey = 'Positive';
            else if (avg < -0.2) bucketKey = 'Negative';
        } else {
            return; 
        }

        if (isClosed) {
            buckets[bucketKey].total++;
            if (isWon) buckets[bucketKey].wins++;
            const closeDate = outcome?.CloseDate || d.CloseDate;
            if (d.CreateDate && closeDate) {
                 const start = new Date(d.CreateDate).getTime();
                 const end = new Date(closeDate).getTime();
                 const days = (end - start) / (1000 * 3600 * 24);
                 if (days > 0) buckets[bucketKey].cycles.push(days);
            }
        }
    });

    return Object.entries(buckets).map(([sentiment, data]) => ({
        sentiment,
        winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
        avgSalesCycle: data.cycles.length > 0 ? data.cycles.reduce((a,b)=>a+b,0)/data.cycles.length : 0,
        dealCount: data.total
    }));
};

// --- Main Parsing Function ---

export const parseExcelFiles = async (filesMap: Record<string, File>): Promise<DashboardState> => {
    try {
        const [salesSheets, marketingSheets, prospectSheets] = await Promise.all([
             readFileSheets(filesMap['sales']),
             readFileSheets(filesMap['marketing']),
             readFileSheets(filesMap['prospect'])
        ]);
        
        const companiesRaw = salesSheets['company_profiles'] || [];
        const companies: CompanyProfile[] = companiesRaw.map(mapCompanyProfile);
        const dealsRaw = salesSheets['deal_history'] || [];
        const deals: DealHistory[] = dealsRaw.map(mapDealHistory);
        const outcomesRaw = salesSheets['win_loss_outcomes'] || [];
        const outcomes: WinLossOutcome[] = outcomesRaw.map(mapWinLossOutcome);
        const spendRaw = marketingSheets['spend'] || [];
        const spend: SpendData[] = spendRaw.map(mapSpendData);
        const callsRaw = prospectSheets['sales_call_insights'] || [];
        const calls: CallInsight[] = callsRaw.map(mapCallInsight);
        
        const rawData = { companies, deals, outcomes, spend, calls };

        const icpMetrics = calculateICPMetrics(companies, deals, outcomes);
        const funnelMetrics = calculateFunnelMetrics(deals);
        const marketingROI = calculateMarketingROI(spend, deals);
        const sentimentAnalysis = calculateSentimentCorrelation(calls, deals, outcomes);
        
        const totalWonRevenue = outcomes
            .filter(o => o.Outcome === 'Won')
            .reduce((sum, o) => sum + (o.ActualAmount || 0), 0);
            
        const fallbackRevenue = deals
            .filter(d => (d.Stage || '').toLowerCase().includes('won') && !outcomes.some(o => o.DealID === d.DealID))
            .reduce((sum, d) => sum + (d.Amount || 0), 0);

        const revenueBase = totalWonRevenue + fallbackRevenue;
        const financials = generateFinancialModel(revenueBase);

        const defaultAnalysis = {
            insights: [
                "AI Analysis Unavailable (Timeout) - Showing Metric-Based Insights",
                `Top Segment: ${icpMetrics[0]?.segment || 'N/A'} (Score: ${icpMetrics[0]?.score.toFixed(2) || 0})`,
                `Funnel Bottleneck: ${funnelMetrics.find(f => f.dropOff > 50)?.stage || 'N/A'}`,
                "Verify API Key or internet connection for deep strategic insights."
            ],
            riskRegister: [
                { risk: "Analysis Timeout", impact: "Low", mitigation: "Retry with smaller dataset or check connection." }
            ]
        };

        // Pass RAW data for strategic sampling
        const aiAnalysis = await withTimeout(
            getGeminiAnalysis(
                rawData,
                { icp: icpMetrics, funnel: funnelMetrics, marketing: marketingROI, revenue: financials.base[17].revenue, sentiment: sentimentAnalysis }
            ),
            30000, 
            defaultAnalysis
        );

        return {
            isLoaded: true,
            icpAnalysis: icpMetrics,
            funnelMetrics: funnelMetrics,
            marketingPerformance: marketingROI,
            financials: financials,
            sentimentAnalysis: sentimentAnalysis,
            insights: aiAnalysis.insights,
            riskRegister: aiAnalysis.riskRegister,
            rawData: rawData 
        };
    } catch (e) {
        console.error("Parsing Error", e);
        throw e;
    }
};

// Fallback for demo mode
export const processUploadedFiles = async (files: File[]): Promise<DashboardState> => {
    const rawData = generateSampleData(); // Returns raw arrays
    const { companies, deals, outcomes, spend, calls } = rawData;
    
    const icpMetrics = calculateICPMetrics(companies, deals, outcomes);
    const funnelMetrics = calculateFunnelMetrics(deals);
    const marketingROI = calculateMarketingROI(spend, deals);
    const sentimentAnalysis = calculateSentimentCorrelation(calls, deals, outcomes);
    
    const totalWonRevenue = outcomes
        .filter(o => o.Outcome === 'Won')
        .reduce((sum, o) => sum + (o.ActualAmount || 0), 0);

    const financials = generateFinancialModel(totalWonRevenue);
    
    const defaultAnalysis = {
        insights: [
            "Demo Mode: AI Analysis Simulated.",
            "Verify real data uploads to unlock full generative insights.",
            `Top performing segment: ${icpMetrics[0]?.segment || 'N/A'}`
        ],
        riskRegister: [{ risk: "Demo Data", impact: "Low", mitigation: "Use real files." }]
    };

    let aiAnalysis = defaultAnalysis;

    try {
        aiAnalysis = await withTimeout(
            getGeminiAnalysis(
                rawData,
                 { icp: icpMetrics, funnel: funnelMetrics, marketing: marketingROI, revenue: financials.base[17].revenue, sentiment: sentimentAnalysis }
            ),
            30000, 
            defaultAnalysis
        );
    } catch(e) {
        // ignore
    }

    return {
        isLoaded: true,
        icpAnalysis: icpMetrics,
        funnelMetrics: funnelMetrics,
        marketingPerformance: marketingROI,
        financials: financials,
        sentimentAnalysis: sentimentAnalysis,
        insights: aiAnalysis.insights,
        riskRegister: aiAnalysis.riskRegister,
        rawData: rawData
    };
};