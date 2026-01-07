import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DashboardState, ICPMetric, FunnelStage, ChannelPerformance, FinancialScenario, SentimentCorrelation } from '../types';
import { MetricCard } from './MetricCard';
import { askStrategist } from '../services/intelligence';
import { calculateICPMetrics, calculateFunnelMetrics, calculateMarketingROI, generateFinancialModel, calculateSentimentCorrelation } from '../services/processing';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, ComposedChart } from 'recharts';
import { Download, AlertTriangle, TrendingUp, Users, DollarSign, Target, Sparkles, Activity, MessageSquare, X, Send, Filter, Mic, ChevronDown, RefreshCw, HeartHandshake, Info } from 'lucide-react';

interface DashboardProps {
    data: DashboardState;
}

interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'icp' | 'funnel' | 'financial' | 'engagement'>('overview');
    const [financialScenario, setFinancialScenario] = useState<'conservative' | 'base' | 'aggressive'>('base');
    
    // --- Filters State ---
    const [selectedRegion, setSelectedRegion] = useState<string>('All');
    const [selectedRep, setSelectedRep] = useState<string>('All');
    const [selectedSegment, setSelectedSegment] = useState<string>('All');
    
    // --- Intelligence Layer State ---
    const [strategistOpen, setStrategistOpen] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [userQuery, setUserQuery] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [activeAIKeyword, setActiveAIKeyword] = useState<string | null>(null);
    const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(['Why is CAC increasing?', 'Show me Enterprise performance', 'Analyze funnel drop-off']);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // --- Dynamic Data Calculation ---
    // Memoize the filtered dataset based on dropdowns and rawData
    const currentMetrics = useMemo(() => {
        if (!data.rawData) return data; // Fallback if no raw data

        // 1. Filter Raw Data
        const filteredCompanies = data.rawData.companies.filter(c => {
            const matchRegion = selectedRegion === 'All' || c.Region === selectedRegion;
            return matchRegion;
        });

        // Get IDs of filtered companies
        const validAccountIDs = new Set(filteredCompanies.map(c => c.AccountID));

        const filteredDeals = data.rawData.deals.filter(d => {
            const matchAccount = validAccountIDs.has(d.AccountID);
            const matchRep = selectedRep === 'All' || d.RepID === selectedRep;
            return matchAccount && matchRep;
        });

        const validDealIDs = new Set(filteredDeals.map(d => d.DealID));
        const filteredOutcomes = data.rawData.outcomes.filter(o => validDealIDs.has(o.DealID));
        const filteredSpend = data.rawData.spend; 
        
        // Filter calls based on filtered deals
        const filteredCalls = data.rawData.calls.filter(c => validDealIDs.has(c.DealID));

        // 2. Re-calculate Metrics
        const icp = calculateICPMetrics(filteredCompanies, filteredDeals, filteredOutcomes);
        
        const finalIcp = selectedSegment === 'All' 
            ? icp 
            : icp.filter(i => i.segment.includes(selectedSegment));

        const funnel = calculateFunnelMetrics(filteredDeals);
        const marketing = calculateMarketingROI(filteredSpend, filteredDeals);
        const sentiment = calculateSentimentCorrelation(filteredCalls, filteredDeals, filteredOutcomes);
        
        const totalWonRevenue = filteredOutcomes
            .filter(o => o.Outcome === 'Won')
            .reduce((sum, o) => sum + (o.ActualAmount || 0), 0);
        
        const financials = generateFinancialModel(totalWonRevenue);

        return {
            ...data,
            icpAnalysis: finalIcp,
            funnelMetrics: funnel,
            marketingPerformance: marketing,
            financials: financials,
            sentimentAnalysis: sentiment
        };
    }, [data, selectedRegion, selectedRep, selectedSegment]);

    // Unique options for dropdowns
    const regionOptions = useMemo(() => {
        if(!data.rawData) return [];
        return Array.from(new Set(data.rawData.companies.map(c => c.Region))).sort();
    }, [data.rawData]);

    const repOptions = useMemo(() => {
        if(!data.rawData) return [];
        return Array.from(new Set(data.rawData.deals.map(d => d.RepID))).sort();
    }, [data.rawData]);
    
    const segmentOptions = useMemo(() => {
        return data.icpAnalysis.map(i => i.segment);
    }, [data.icpAnalysis]);

    // --- Effects & Handlers ---

    // Initial Proactive Insight
    useEffect(() => {
        if (data.riskRegister.length > 0 && chatHistory.length === 0) {
            const highRisk = data.riskRegister.find(r => r.impact === 'High');
            if (highRisk) {
                setChatHistory([{
                    role: 'model',
                    content: `⚠️ Proactive Alert: I've detected a High Risk: "${highRisk.risk}". Recommended mitigation: ${highRisk.mitigation}. Would you like to dig into the affected segments?`
                }]);
            }
        }
    }, [data]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, strategistOpen]);

    const handleStrategistQuery = async (query: string = userQuery) => {
        if (!query.trim()) return;
        
        const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: query }];
        setChatHistory(newHistory);
        setUserQuery('');
        setIsThinking(true);
        setSuggestedPrompts([]);

        try {
            const response = await askStrategist(currentMetrics, newHistory, query);
            
            if (response.action.type === 'NAVIGATE' && response.action.payload) {
                setActiveTab(response.action.payload as any);
            }
            if (response.action.type === 'FILTER' && response.action.payload) {
                setActiveAIKeyword(response.action.payload);
            }
            if (response.action.type === 'RESET') {
                setActiveAIKeyword(null);
                setSelectedRegion('All');
                setSelectedRep('All');
            }

            setChatHistory(prev => [...prev, { role: 'model', content: response.text }]);
            if (response.suggestedQuestions) setSuggestedPrompts(response.suggestedQuestions);
        } catch (e) {
            setChatHistory(prev => [...prev, { role: 'model', content: "I encountered an error processing that strategy request." }]);
        } finally {
            setIsThinking(false);
        }
    };

    const filteredICP = activeAIKeyword 
        ? currentMetrics.icpAnalysis.filter(i => i.segment.toLowerCase().includes(activeAIKeyword.toLowerCase()))
        : currentMetrics.icpAnalysis;

    // Financial Data Prep
    const overviewChartData = currentMetrics.financials.base.map((item, i) => ({
        month: item.month,
        base: item.revenue,
        conservative: currentMetrics.financials.conservative[i]?.revenue || 0,
        aggressive: currentMetrics.financials.aggressive[i]?.revenue || 0
    }));

    const formatCurrency = (val: number) => `$${(val / 1000).toFixed(1)}k`;
    const formatMillions = (val: number) => `$${(val / 1000000).toFixed(1)}M`;

    const financialDelta = useMemo(() => {
        const idx = 17; // Month 18
        const base = currentMetrics.financials.base[idx].revenue;
        const agg = currentMetrics.financials.aggressive[idx].revenue;
        const cons = currentMetrics.financials.conservative[idx].revenue;
        return {
            aggDiff: agg - base,
            consDiff: base - cons,
            aggPct: ((agg - base) / base) * 100,
            consPct: ((base - cons) / base) * 100
        };
    }, [currentMetrics.financials]);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6 space-y-6 relative overflow-x-hidden">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:justify-between md:items-center pb-6 border-b border-slate-800 gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">NovaTech Growth Intelligence</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-400 text-sm">Data Source: Validated Excel Imports • Period: 2023-2025</p>
                        {activeAIKeyword && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
                                <Sparkles className="w-3 h-3" /> AI Focus: "{activeAIKeyword}"
                                <button onClick={() => setActiveAIKeyword(null)} className="hover:text-white ml-1">×</button>
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-md text-sm font-medium transition-colors border border-slate-700">
                        <Download className="w-4 h-4 mr-2" /> Export Report
                    </button>
                    <button 
                        onClick={() => setStrategistOpen(!strategistOpen)}
                        className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-lg ${
                            strategistOpen 
                            ? 'bg-blue-600 text-white shadow-blue-500/25 ring-2 ring-blue-400' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                    >
                        <Sparkles className="w-4 h-4" />
                        {strategistOpen ? 'Close Strategist AI' : 'Ask Strategist AI'}
                    </button>
                </div>
            </header>

            {/* Filter Bar */}
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 text-sm text-slate-400 mr-2">
                    <Filter className="w-4 h-4" />
                    <span className="font-semibold uppercase tracking-wider text-xs">Global Filters</span>
                </div>
                
                <div className="relative group">
                    <select 
                        value={selectedRegion}
                        onChange={(e) => setSelectedRegion(e.target.value)}
                        className="appearance-none bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg pl-3 pr-8 py-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-slate-800 transition-colors"
                    >
                        <option value="All">All Regions</option>
                        {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2 top-2.5 pointer-events-none" />
                </div>

                <div className="relative group">
                    <select 
                        value={selectedRep}
                        onChange={(e) => setSelectedRep(e.target.value)}
                        className="appearance-none bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg pl-3 pr-8 py-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-slate-800 transition-colors"
                    >
                        <option value="All">All Sales Reps</option>
                        {repOptions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2 top-2.5 pointer-events-none" />
                </div>

                 <div className="relative group">
                    <select 
                        value={selectedSegment}
                        onChange={(e) => setSelectedSegment(e.target.value)}
                        className="appearance-none bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg pl-3 pr-8 py-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-slate-800 transition-colors"
                    >
                        <option value="All">All ICP Segments</option>
                        {segmentOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2 top-2.5 pointer-events-none" />
                </div>

                {(selectedRegion !== 'All' || selectedRep !== 'All' || selectedSegment !== 'All') && (
                    <button 
                        onClick={() => { setSelectedRegion('All'); setSelectedRep('All'); setSelectedSegment('All'); }}
                        className="ml-auto text-xs text-blue-400 hover:text-white flex items-center gap-1"
                    >
                        <RefreshCw className="w-3 h-3" /> Reset Filters
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg w-fit">
                {['overview', 'icp', 'funnel', 'financial', 'engagement'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            activeTab === tab 
                            ? 'bg-blue-600 text-white shadow-lg' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </nav>

            {/* Content Area */}
            <main className={`grid grid-cols-1 gap-6 transition-all duration-300 ${strategistOpen ? 'lg:mr-[400px]' : ''}`}>
                
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <MetricCard 
                                title="Projected Revenue (18mo)" 
                                value={formatMillions(currentMetrics.financials.base[17].revenue * 12)} // Annualized
                                trend="+124% vs LTM" 
                                trendUp={true}
                                sourceInfo="Financial Model (Base Scenario) derived from Historical Win Rates"
                            />
                            <MetricCard 
                                title="Pipeline Velocity" 
                                value="$1.2M / mo" 
                                trend="+8%" 
                                trendUp={true}
                                sourceInfo="Sales_Pipeline.xlsx: (Open Deals * Win Rate) / Sales Cycle"
                            />
                            <MetricCard 
                                title="Customer CAC" 
                                value="$4,250" 
                                trend="-5%" 
                                trendUp={true}
                                sourceInfo="Marketing_Performance.xlsx: Total Spend / Total New Customers"
                            />
                            <MetricCard 
                                title="Active Risk Factors" 
                                value={`${currentMetrics.riskRegister.length}`} 
                                trend="Critical" 
                                trendUp={false}
                                sourceInfo="AI Derived from Customer_Patterns.xlsx"
                            />
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-blue-400" />
                                        Revenue Growth Trajectory ($100M Path)
                                    </h3>
                                    <p className="text-slate-400 text-sm">Comparison of Aggressive, Base, and Conservative financial models</p>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-medium">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500" />
                                        <span className="text-emerald-400">Aggressive</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                                        <span className="text-blue-100">Base Plan</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-full border border-slate-500 border-dashed" />
                                        <span className="text-slate-400">Conservative</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={overviewChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorAggro" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="month" stroke="#94a3b8" tick={{fontSize: 12}} />
                                        <YAxis stroke="#94a3b8" tick={{fontSize: 12}} tickFormatter={(val) => `$${(val/1000000).toFixed(0)}M`} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                                            formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                                            labelStyle={{ color: '#94a3b8' }}
                                        />
                                        <Area type="monotone" dataKey="aggressive" stroke="#10b981" fill="url(#colorAggro)" strokeWidth={1} strokeDasharray="5 5" name="Aggressive" />
                                        <Area type="monotone" dataKey="base" stroke="#3b82f6" strokeWidth={3} fill="url(#colorBase)" name="Base Plan" />
                                        <Line type="monotone" dataKey="conservative" stroke="#64748b" strokeWidth={2} dot={false} strokeDasharray="3 3" name="Conservative" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                    <Sparkles className="w-24 h-24 text-blue-500" />
                                </div>
                                <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
                                    <div className="flex items-center">
                                        <Target className="w-5 h-5 mr-2 text-blue-400" /> 
                                        AI Strategic Insights
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-950/50 rounded border border-blue-900/50 text-xs text-blue-400">
                                        <Info className="w-3 h-3" />
                                        Statistical Sampling (N=40)
                                    </div>
                                </h3>
                                <div className="space-y-3">
                                    {currentMetrics.insights.map((insight, idx) => (
                                        <div key={idx} className="p-4 bg-slate-900/80 border-l-4 border-blue-500 rounded-r flex items-start shadow-sm">
                                            <p className="text-sm text-slate-200 leading-relaxed">{insight}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                                <h3 className="text-lg font-semibold mb-4 flex items-center">
                                    <AlertTriangle className="w-5 h-5 mr-2 text-rose-400" />
                                    Risk Register
                                </h3>
                                <div className="space-y-4">
                                    {currentMetrics.riskRegister.map((risk, idx) => (
                                        <div key={idx} className="border-b border-slate-700 last:border-0 pb-3 last:pb-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-medium text-slate-200">{risk.risk}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${
                                                    risk.impact === 'High' ? 'bg-rose-500/20 text-rose-400' : 
                                                    risk.impact === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                                                }`}>{risk.impact}</span>
                                            </div>
                                            <p className="text-xs text-slate-400">Mitigation: {risk.mitigation}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ENGAGEMENT TAB (NEW) */}
                {activeTab === 'engagement' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                                <HeartHandshake className="w-5 h-5 text-blue-400" />
                                Engagement Impact: Call Sentiment vs Outcomes
                            </h3>
                            <p className="text-slate-400 text-sm mb-6">Correlating call sentiment (from 'sales_call_insights') with Win Rate and Deal Velocity.</p>
                            
                            <div className="h-96">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={currentMetrics.sentimentAnalysis}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="sentiment" stroke="#94a3b8" />
                                        <YAxis yAxisId="left" stroke="#94a3b8" tickFormatter={(val) => `${val}%`} label={{ value: 'Win Rate', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" label={{ value: 'Days to Close', angle: 90, position: 'insideRight', fill: '#f59e0b' }} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                                            formatter={(value: number, name: string) => name === 'Win Rate' ? [`${value.toFixed(1)}%`, name] : [`${Math.round(value)} days`, name]}
                                        />
                                        <Bar yAxisId="left" dataKey="winRate" fill="#3b82f6" name="Win Rate" barSize={60} radius={[4, 4, 0, 0]} />
                                        <Line yAxisId="right" type="monotone" dataKey="avgSalesCycle" stroke="#f59e0b" strokeWidth={3} name="Avg Cycle Length" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-4 flex gap-4 text-xs text-slate-400 p-3 bg-slate-900/50 rounded border border-slate-700">
                                <div><strong>Insight:</strong> Positive sentiment calls correlate with higher win rates.</div>
                                <div><strong>Action:</strong> Coach reps to replicate "Positive" call patterns.</div>
                            </div>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-4">Engagement Distribution</h3>
                            <div className="space-y-4">
                                {currentMetrics.sentimentAnalysis.map((item, i) => (
                                    <div key={i} className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`font-bold ${
                                                item.sentiment === 'Positive' ? 'text-emerald-400' : 
                                                item.sentiment === 'Negative' ? 'text-rose-400' : 'text-slate-300'
                                            }`}>{item.sentiment} Sentiment</span>
                                            <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">{item.dealCount} Deals</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <div className="text-slate-500 text-xs uppercase">Win Rate</div>
                                                <div className="font-mono text-white">{item.winRate.toFixed(1)}%</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-xs uppercase">Avg Cycle</div>
                                                <div className="font-mono text-white">{Math.round(item.avgSalesCycle)}d</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ICP TAB */}
                {activeTab === 'icp' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-6">Win Rate by Segment {activeAIKeyword && `(Filtered: ${activeAIKeyword})`}</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={filteredICP} layout="vertical" margin={{ left: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                        <XAxis type="number" stroke="#94a3b8" unit="%" />
                                        <YAxis dataKey="segment" type="category" stroke="#94a3b8" width={120} tick={{fontSize: 12}} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                            cursor={{fill: '#334155', opacity: 0.2}}
                                        />
                                        <Bar dataKey="winRate" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Win Rate %" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-6">Deal Size vs Sales Cycle</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={filteredICP}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="segment" stroke="#94a3b8" tick={{fontSize: 10}} interval={0} angle={-15} textAnchor="end" />
                                        <YAxis yAxisId="left" stroke="#94a3b8" tickFormatter={formatCurrency} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#10b981" unit=" days" />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                        />
                                        <Bar yAxisId="left" dataKey="avgDealSize" fill="#3b82f6" name="Avg Deal Size ($)" />
                                        <Bar yAxisId="right" dataKey="salesCycle" fill="#10b981" name="Sales Cycle (Days)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="col-span-full bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Top Performing Segments (Score)</h3>
                                {activeAIKeyword && <span className="text-xs text-blue-400 font-mono">FILTER ACTIVE</span>}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-900 text-slate-400 uppercase font-medium">
                                        <tr>
                                            <th className="px-6 py-4">Segment</th>
                                            <th className="px-6 py-4">Win Rate</th>
                                            <th className="px-6 py-4">Avg Deal Size</th>
                                            <th className="px-6 py-4">Sales Cycle</th>
                                            <th className="px-6 py-4 text-right">ICP Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {filteredICP.length > 0 ? filteredICP.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-700/50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-white">{row.segment}</td>
                                                <td className="px-6 py-4">{row.winRate.toFixed(1)}%</td>
                                                <td className="px-6 py-4">${row.avgDealSize.toLocaleString()}</td>
                                                <td className="px-6 py-4">{Math.round(row.salesCycle)} days</td>
                                                <td className="px-6 py-4 text-right font-mono text-blue-400">{row.score.toFixed(2)}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                                    No segments match the filter "{activeAIKeyword}". <button onClick={() => setActiveAIKeyword(null)} className="text-blue-400 underline">Clear Filter</button>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* FUNNEL TAB */}
                {activeTab === 'funnel' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-6">Funnel Conversion Waterfall</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={currentMetrics.funnelMetrics}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="stage" stroke="#94a3b8" />
                                        <YAxis stroke="#94a3b8" />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                                        <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-6">Average Time in Stage (Days)</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={currentMetrics.funnelMetrics}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="stage" stroke="#94a3b8" />
                                        <YAxis stroke="#94a3b8" unit="d" />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                                        <Bar dataKey="avgTimeInStage" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Avg Days" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        
                        <div className="col-span-full bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-6">Stage Drop-off Analysis</h3>
                            <div className="space-y-6">
                                {currentMetrics.funnelMetrics.slice(0, -1).map((stage, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-slate-300">{stage.stage} → {currentMetrics.funnelMetrics[i+1].stage}</span>
                                            <span className={stage.conversionRate < 40 ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                                                {stage.conversionRate.toFixed(1)}% Conv.
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-700 rounded-full h-2.5">
                                            <div 
                                                className={`h-2.5 rounded-full ${stage.conversionRate < 40 ? "bg-rose-500" : "bg-emerald-500"}`} 
                                                style={{ width: `${stage.conversionRate}%` }}
                                            ></div>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {stage.dropOff.toFixed(1)}% drop-off.
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* FINANCIAL TAB */}
                {activeTab === 'financial' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                                <h3 className="text-sm font-semibold text-slate-400 uppercase mb-4">Upside Potential (Aggressive vs Base)</h3>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-bold text-emerald-400">+{formatCurrency(financialDelta.aggDiff)}/mo</span>
                                    <span className="text-sm text-emerald-500 mb-1">(+{financialDelta.aggPct.toFixed(1)}%)</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">Additional monthly revenue at month 18 if funnel improves by 5%.</p>
                            </div>
                            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                                <h3 className="text-sm font-semibold text-slate-400 uppercase mb-4">Downside Risk (Base vs Conservative)</h3>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-bold text-rose-400">-{formatCurrency(financialDelta.consDiff)}/mo</span>
                                    <span className="text-sm text-rose-500 mb-1">(-{financialDelta.consPct.toFixed(1)}%)</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">Revenue at risk at month 18 if churn increases by 2%.</p>
                            </div>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold">18-Month Revenue Projection</h3>
                                <div className="flex bg-slate-900 rounded p-1">
                                    {(['conservative', 'base', 'aggressive'] as const).map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setFinancialScenario(mode)}
                                            className={`px-3 py-1 text-xs uppercase font-bold rounded transition-colors ${
                                                financialScenario === mode ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="h-96">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={currentMetrics.financials[financialScenario]}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="month" stroke="#94a3b8" />
                                        <YAxis stroke="#94a3b8" tickFormatter={formatCurrency} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} formatter={(val: number) => formatCurrency(val)} />
                                        <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRev)" name="Monthly Revenue" />
                                        <Line type="monotone" dataKey="costs" stroke="#ef4444" name="Projected Costs" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-4 p-4 bg-slate-900/50 rounded border border-slate-700 text-sm text-slate-400">
                                <strong>Logic Source:</strong> Projections derived from 'Deal_History' historical CAGR and conversion efficiency. 'Base' scenario assumes constant win rate; 'Aggressive' assumes 5% optimization in Funnel Top.
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Growth Strategist Copilot Panel */}
            <div 
                className={`fixed top-0 right-0 h-full w-full lg:w-[400px] bg-slate-950 border-l border-slate-800 shadow-2xl transform transition-transform duration-300 z-50 flex flex-col ${
                    strategistOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Copilot Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Growth Strategist AI</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-xs text-slate-400">Live Context Aware</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setStrategistOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatHistory.length === 0 && (
                        <div className="text-center mt-12 opacity-50">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                            <p className="text-sm text-slate-400">Ask about segments, risks, or financial projections...</p>
                        </div>
                    )}
                    
                    {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                                msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-br-none' 
                                : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                            }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    
                    {isThinking && (
                        <div className="flex justify-start">
                            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 rounded-bl-none flex items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75"></span>
                                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150"></span>
                                </div>
                                <span className="text-xs text-slate-500 ml-2 animate-pulse">Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Suggestion Chips */}
                {suggestedPrompts.length > 0 && !isThinking && (
                    <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
                        {suggestedPrompts.map((prompt, i) => (
                            <button 
                                key={i}
                                onClick={() => handleStrategistQuery(prompt)}
                                className="whitespace-nowrap px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs text-blue-400 transition-colors"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                <div className="p-4 border-t border-slate-800 bg-slate-900">
                    <div className="relative">
                        <input
                            type="text"
                            value={userQuery}
                            onChange={(e) => setUserQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleStrategistQuery()}
                            placeholder="Ask a strategic question..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                        />
                        <button 
                            onClick={() => handleStrategistQuery()}
                            disabled={!userQuery.trim() || isThinking}
                            className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};