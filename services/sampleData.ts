import { CompanyProfile, DealHistory, WinLossOutcome, SpendData, CallInsight } from '../types';

// Helper to generate random date within range
const randomDate = (start: Date, end: Date) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
};

export const generateSampleData = () => {
    const industries = ['FinTech', 'Healthcare', 'Manufacturing', 'Retail', 'SaaS'];
    const regions = ['NA', 'EMEA', 'APAC'];
    const tiers = ['SMB', 'Mid-Market', 'Enterprise'];
    const channels = ['LinkedIn', 'Google Ads', 'Email', 'Events', 'Organic'];
    
    // 1. Company Profiles (Internal Type - mapper bypass)
    // Note: Since demo mode bypasses parseExcelFiles, we return the Internal Types directly here.
    // However, to ensure consistency if we ever simulated Excel parsing, these should match the internal interface structure.
    
    const companies: CompanyProfile[] = [];
    for (let i = 1; i <= 200; i++) {
        companies.push({
            AccountID: `ACC-${i}`,
            Company: `Company ${i}`,
            Industry: industries[Math.floor(Math.random() * industries.length)],
            EmployeeCount: Math.floor(Math.random() * 5000) + 50,
            Region: regions[Math.floor(Math.random() * regions.length)],
            Tier: tiers[Math.floor(Math.random() * tiers.length)],
        });
    }

    // 2. Deals & Outcomes
    const deals: DealHistory[] = [];
    const outcomes: WinLossOutcome[] = [];
    
    companies.forEach(comp => {
        const numDeals = Math.floor(Math.random() * 3) + 1;
        for (let j = 0; j < numDeals; j++) {
            const dealId = `DEAL-${comp.AccountID}-${j}`;
            const createDate = new Date(2023, 0, 1);
            const closeDateRaw = new Date(2023 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 12), 1);
            
            const isClosed = Math.random() > 0.3;
            const isWon = isClosed && Math.random() > 0.6; // 40% win rate baseline
            
            let amount = 15000;
            if (comp.Tier === 'Mid-Market') amount = 45000;
            if (comp.Tier === 'Enterprise') amount = 120000;
            amount = amount * (0.8 + Math.random() * 0.4); // Variance

            deals.push({
                DealID: dealId,
                AccountID: comp.AccountID,
                Stage: isClosed ? (isWon ? 'Closed Won' : 'Closed Lost') : 'Proposal',
                Amount: Math.floor(amount),
                CreateDate: randomDate(createDate, closeDateRaw),
                CloseDate: isClosed ? closeDateRaw.toISOString().split('T')[0] : undefined,
                RepID: `REP-${Math.floor(Math.random() * 10)}`
            });

            if (isClosed) {
                outcomes.push({
                    DealID: dealId,
                    Outcome: isWon ? 'Won' : 'Lost',
                    LossReason: isWon ? undefined : ['Price', 'Features', 'Competitor', 'Timing'][Math.floor(Math.random() * 4)],
                    Competitor: isWon ? undefined : ['CyberCorp', 'SecurIT', 'FireWallz'][Math.floor(Math.random() * 3)],
                    ActualAmount: Math.floor(amount), // Assuming booked revenue matches expected
                    CloseDate: closeDateRaw.toISOString().split('T')[0]
                });
            }
        }
    });

    // 3. Marketing Spend
    const spend: SpendData[] = [];
    const months = ['2023-01', '2023-02', '2023-03', '2023-04', '2023-05', '2023-06', '2023-07', '2023-08', '2023-09', '2023-10', '2023-11', '2023-12', '2024-01', '2024-02'];
    
    months.forEach(month => {
        channels.forEach((channel, idx) => {
            spend.push({
                CampaignID: `CMP-${month}-${channel}`,
                Channel: channel,
                Platform: channel === 'LinkedIn' ? 'LinkedIn' : channel === 'Google Ads' ? 'Google' : 'Direct',
                Cost: 5000 + Math.random() * 10000,
                Date: `${month}-01`
            });
        });
    });

    // 4. Sales Call Insights (Correlated to Deal Outcome)
    const calls: CallInsight[] = [];
    deals.forEach(deal => {
        const numCalls = Math.floor(Math.random() * 4) + 1; // 1-4 calls per deal
        const outcome = outcomes.find(o => o.DealID === deal.DealID);
        const isWon = outcome?.Outcome === 'Won';
        
        for (let k = 0; k < numCalls; k++) {
            let sentiment: 'Positive' | 'Neutral' | 'Negative' = 'Neutral';
            const rand = Math.random();
            
            // Bias sentiment based on outcome
            if (isWon) {
                if (rand > 0.3) sentiment = 'Positive';
                else if (rand > 0.1) sentiment = 'Neutral';
                else sentiment = 'Negative';
            } else {
                if (rand > 0.6) sentiment = 'Negative';
                else if (rand > 0.3) sentiment = 'Neutral';
                else sentiment = 'Positive';
            }
            
            // Random date between create and close
            const callDate = deal.CloseDate 
                ? randomDate(new Date(deal.CreateDate), new Date(deal.CloseDate)) 
                : randomDate(new Date(deal.CreateDate), new Date());

            calls.push({
                CallID: `CALL-${deal.DealID}-${k}`,
                DealID: deal.DealID,
                Sentiment: sentiment,
                Date: callDate
            });
        }
    });

    return { companies, deals, outcomes, spend, calls };
};