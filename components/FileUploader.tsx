import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertCircle, Database, ShieldCheck, PlayCircle, BarChart3, Lock } from 'lucide-react';

interface FileUploaderProps {
    onUpload: (files: Record<string, File>) => void;
    onDemoLoad: () => void;
}

const REQUIRED_FILES = [
    { id: 'sales', label: 'Sales_Pipeline.xlsx', desc: 'Deal history, company profiles, win/loss' },
    { id: 'marketing', label: 'Marketing_Performance.xlsx', desc: 'Spend, conversions, attribution' },
    { id: 'prospect', label: 'Prospect_Engagement.xlsx', desc: 'Demos, calls, trial usage' },
    { id: 'customer', label: 'Customer_Patterns.xlsx', desc: 'Revenue, satisfaction, churn risk' }
];

export const FileUploader: React.FC<FileUploaderProps> = ({ onUpload, onDemoLoad }) => {
    const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [isDragging, setIsDragging] = useState<string | null>(null);

    const handleFileChange = (id: string, file: File) => {
        setUploadedFiles(prev => ({ ...prev, [id]: file }));
    };

    const triggerFileSelect = (id: string) => {
        fileInputRefs.current[id]?.click();
    };

    const handleDrop = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(null);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChange(id, e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(id);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(null);
    };

    const isReady = REQUIRED_FILES.every(f => uploadedFiles[f.id]);

    const handleSubmit = () => {
        if (isReady) {
            onUpload(uploadedFiles);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 lg:p-12 font-sans text-slate-100">
            <div className="max-w-6xl w-full bg-slate-950 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col lg:flex-row min-h-[600px]">
                
                {/* Left Panel: Hero & Context */}
                <div className="lg:w-2/5 p-10 bg-gradient-to-br from-blue-900/40 via-slate-900 to-slate-950 flex flex-col justify-between border-r border-slate-800 relative overflow-hidden">
                    {/* Background Decorative Elements */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-10 right-10 w-48 h-48 bg-emerald-500 rounded-full blur-3xl"></div>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                                <BarChart3 className="w-6 h-6 text-blue-400" />
                            </div>
                            <span className="font-bold tracking-wide text-blue-100">NOVATECH INTELLIGENCE</span>
                        </div>
                        
                        <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
                            Turn Raw Data into <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Revenue Strategy</span>
                        </h1>
                        
                        <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                            Upload your unrefined Excel datasets. Our AI engine normalizes the schema, computes complex growth metrics, and builds an investor-ready financial model in seconds.
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-sm text-slate-300">
                                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                <span>Local Processing & Enterprise Security</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-300">
                                <Database className="w-5 h-5 text-blue-500" />
                                <span>Auto-Schema Normalization</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-300">
                                <Lock className="w-5 h-5 text-amber-500" />
                                <span>Zero-Data Retention Policy</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 relative z-10">
                        <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-semibold">Quick Start</p>
                        <button 
                            onClick={onDemoLoad}
                            className="w-full group bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 text-white p-4 rounded-xl flex items-center justify-between transition-all"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 transition-colors">
                                    <PlayCircle className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="text-left">
                                    <div className="font-semibold">Load Sample Dataset</div>
                                    <div className="text-xs text-slate-400">Try with 50k generated records</div>
                                </div>
                            </div>
                            <span className="text-slate-500 group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                    </div>
                </div>

                {/* Right Panel: Upload Grid */}
                <div className="lg:w-3/5 p-10 flex flex-col justify-center bg-slate-950">
                    <div className="mb-6 flex justify-between items-end">
                        <div>
                            <h2 className="text-xl font-bold text-white">Data Ingestion</h2>
                            <p className="text-slate-400 text-sm">Upload the 4 required .xlsx files</p>
                        </div>
                        <div className="text-xs font-mono text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                            {Object.keys(uploadedFiles).length} / 4 FILES READY
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        {REQUIRED_FILES.map((req) => {
                            const file = uploadedFiles[req.id];
                            const active = isDragging === req.id;
                            
                            return (
                                <div 
                                    key={req.id}
                                    className={`
                                        relative border-2 border-dashed rounded-xl p-5 transition-all cursor-pointer flex flex-col gap-3 group
                                        ${file 
                                            ? 'bg-emerald-950/10 border-emerald-500/50' 
                                            : active
                                                ? 'bg-blue-900/20 border-blue-500 scale-[1.02]'
                                                : 'bg-slate-900/50 border-slate-800 hover:border-slate-600 hover:bg-slate-900'}
                                    `}
                                    onClick={() => triggerFileSelect(req.id)}
                                    onDrop={(e) => handleDrop(e, req.id)}
                                    onDragOver={(e) => handleDragOver(e, req.id)}
                                    onDragLeave={handleDragLeave}
                                >
                                    <input 
                                        type="file" 
                                        accept=".xlsx,.xls" 
                                        className="hidden" 
                                        ref={(el) => { if (el) fileInputRefs.current[req.id] = el; }}
                                        onChange={(e) => e.target.files?.[0] && handleFileChange(req.id, e.target.files[0])}
                                    />
                                    
                                    <div className="flex justify-between items-start">
                                        <div className={`p-2 rounded-lg ${file ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'}`}>
                                            {file ? <CheckCircle className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
                                        </div>
                                        {file && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newFiles = {...uploadedFiles};
                                                    delete newFiles[req.id];
                                                    setUploadedFiles(newFiles);
                                                }}
                                                className="text-slate-500 hover:text-rose-400 transition-colors"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <h3 className={`font-semibold text-sm ${file ? 'text-emerald-100' : 'text-slate-200'}`}>
                                            {req.label}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                                            {file ? `${(file.size / 1024).toFixed(1)} KB • Ready` : req.desc}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button 
                        onClick={handleSubmit}
                        disabled={!isReady}
                        className={`
                            w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all
                            ${isReady 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-900/30 hover:-translate-y-0.5' 
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}
                        `}
                    >
                        {isReady ? (
                            <>
                                <UploadCloud className="w-5 h-5" />
                                Initialize Growth Engine
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-5 h-5" />
                                Waiting for Data Ingestion...
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};