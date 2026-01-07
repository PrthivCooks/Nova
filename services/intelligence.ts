import { GoogleGenAI, Type } from "@google/genai";
import { DashboardState } from '../types';
import { getStrategicSample, SamplingMode } from './processing';

const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface IntelligenceResponse {
    text: string;
    action: {
        type: 'NAVIGATE' | 'FILTER' | 'RESET' | 'NONE';
        payload?: string; // Tab name or filter keyword
    };
    suggestedQuestions?: string[];
}

const withTimeout = <T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => 
            setTimeout(() => {
                console.warn(`AI Request Timed Out after ${ms}ms`);
                resolve(fallbackValue);
            }, ms)
        )
    ]);
};

// Heuristic to detect strategic mode from query
const determineSamplingMode = (query: string): SamplingMode => {
    const q = query.toLowerCase();
    if (q.includes('risk') || q.includes('churn') || q.includes('lost') || q.includes('warning')) return 'RISK';
    if (q.includes('velocity') || q.includes('stuck') || q.includes('slow') || q.includes('stage')) return 'MOMENTUM';
    if (q.includes('enterprise') || q.includes('segment') || q.includes('icp') || q.includes('specific')) return 'PRECISION';
    return 'DIAGNOSTIC';
};

export const askStrategist = async (
    data: DashboardState,
    history: { role: 'user' | 'model'; content: string }[],
    userQuery: string
): Promise<IntelligenceResponse> => {
    
    // 1. Determine Sampling Mode based on user intent
    const mode = determineSamplingMode(userQuery);
    
    // 2. Get Strategic Sample of Raw Data
    let strategicContext = {};
    if (data.rawData) {
        strategicContext = getStrategicSample(data.rawData, mode);
    }

    const context = {
        analysis_mode: mode,
        aggregate_metrics: {
            top_segments: data.icpAnalysis.slice(0, 3),
            funnel_bottlenecks: data.funnelMetrics.filter(f => f.dropOff > 40),
            marketing_roi: data.marketingPerformance.slice(0, 3),
            financial_forecast: data.financials.base[17],
            engagement_sentiment: data.sentimentAnalysis,
        },
        raw_data_sample: strategicContext
    };

    // Optimized prompt for Strategic Reasoning
    const prompt = `
    You are the NovaTech Growth Strategist AI.
    
    STRATEGIC CONTEXT:
    You are analyzing the data in **${mode} MODE**.
    We value "Precision over Volume" and "Engineered Momentum".
    Avoid explaining *what* the data says; explain *why* it matters and *what* to do.
    
    DATA SOURCE:
    - Aggregate Metrics: Full dataset summary.
    - Raw Data Sample: A randomized, statistically representative sample (N=~40) to help you find specific patterns/examples.

    CONTEXT JSON:
    ${JSON.stringify(context)}

    USER QUERY: "${userQuery}"

    RESPONSE GUIDELINES:
    1. If the user asks "Why", use the Raw Data Sample to find a pattern (e.g. "I see several Enterprise deals stuck in Proposal...").
    2. Be transparent: Start with "Based on a sample of X deals..." if citing specific examples.
    3. Keep answers concise (max 3 sentences). Start with the strategic implication.

    AVAILABLE ACTIONS:
    - NAVIGATE: 'overview', 'icp', 'funnel', 'financial', 'engagement'.
    - FILTER: keyword (e.g., 'Enterprise', 'LinkedIn').
    - RESET: Clear filters.
    - NONE: No dashboard action.

    OUTPUT SCHEMA (JSON):
    {
        "text": "Your strategic answer.",
        "action": { "type": "NAVIGATE", "payload": "icp" },
        "suggestedQuestions": ["Q1?", "Q2?"]
    }
    `;

    const fallbackResponse: IntelligenceResponse = {
        text: "I'm analyzing the data, but the connection is slower than expected. While I reconnect, try using the new 'Region' or 'Rep' filters above the charts to slice the data manually.",
        action: { type: 'NONE' },
        suggestedQuestions: ["Analyze Profitability", "Show Top Segments"]
    };

    try {
        const responsePromise = genAI.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING },
                        action: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, enum: ['NAVIGATE', 'FILTER', 'RESET', 'NONE'] },
                                payload: { type: Type.STRING }
                            }
                        },
                        suggestedQuestions: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        // Increased timeout to 45 seconds to handle network/model latency
        const response = await withTimeout(responsePromise, 45000, null);

        if (!response) return fallbackResponse;

        const jsonText = response.text?.replace(/```json/g, "").replace(/```/g, "").trim();
        if (!jsonText) throw new Error("Empty AI response");
        
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("Strategist Error:", e);
        return fallbackResponse;
    }
};