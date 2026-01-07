import React from 'react';
import { ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string;
    trend?: string;
    trendUp?: boolean;
    sourceInfo: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, trend, trendUp, sourceInfo }) => {
    return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
                <div className="group relative">
                    <Info className="w-4 h-4 text-slate-500 cursor-help" />
                    <div className="absolute right-0 w-48 p-2 bg-slate-900 text-xs text-slate-300 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-700">
                        Source: {sourceInfo}
                    </div>
                </div>
            </div>
            <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-white">{value}</span>
                {trend && (
                    <span className={`flex items-center text-sm font-medium ${trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trendUp ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                        {trend}
                    </span>
                )}
            </div>
        </div>
    );
};