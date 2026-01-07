import React, { useState } from 'react';
import { FileUploader } from './components/FileUploader';
import { Dashboard } from './components/Dashboard';
import { parseExcelFiles, processUploadedFiles } from './services/processing';
import { DashboardState } from './types';

const App: React.FC = () => {
    const [dashboardData, setDashboardData] = useState<DashboardState | null>(null);
    const [loading, setLoading] = useState(false);

    // Updated handler to accept the dictionary of files
    const handleUpload = async (files: Record<string, File>) => {
        setLoading(true);
        try {
            const data = await parseExcelFiles(files);
            setDashboardData(data);
        } catch (error) {
            console.error("Error parsing files", error);
            alert("Failed to parse files. Please ensure the Excel files contain the required columns (AccountID, DealID, Amount, etc).");
        } finally {
            setLoading(false);
        }
    };

    const handleLoadDemo = async () => {
        setLoading(true);
        setTimeout(async () => {
            const data = await processUploadedFiles([]);
            setDashboardData(data);
            setLoading(false);
        }, 1500); // Slightly longer for "processing" feel
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center p-8 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl max-w-md mx-4">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                    <h2 className="text-white text-xl font-bold mb-2">Analyzing Growth Data...</h2>
                    <div className="space-y-2 text-sm text-slate-400">
                        <p>Ingesting Excel Datasets...</p>
                        <p>Normalizing Schema & Calculating Metrics...</p>
                        <p className="text-blue-400 font-medium animate-pulse">Consulting Gemini AI (Max 12s)...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!dashboardData) {
        return <FileUploader onUpload={handleUpload} onDemoLoad={handleLoadDemo} />;
    }

    return <Dashboard data={dashboardData} />;
};

export default App;