class AccountingEngine {
    constructor() {
        this.reset();

        // Enterprise-Grade Account Classification Database
        this.accountTypes = {
            // ASSETS (Real/Personal)
            'Cash': 'Asset', 'Bank': 'Asset', 'Furniture': 'Asset', 'Machinery': 'Asset',
            'Buildings': 'Asset', 'Land': 'Asset', 'Computer': 'Asset', 'Vehicles': 'Asset',
            'Stock': 'Asset', 'Inventory': 'Asset', 'Debtors': 'Asset', 'Closing Stock': 'Asset',
            'Patents': 'Asset', 'Goodwill': 'Asset', 'Investments': 'Asset', 'Prepaid Exp': 'Asset',

            // LIABILITIES (Personal)
            'Creditors': 'Liability', 'Bank Loan': 'Liability', 'Mortgage': 'Liability',
            'Bills Payable': 'Liability', 'Outstanding Salary': 'Liability', 'GST Payable': 'Liability',
            'Capital': 'Equity',

            // EQUITY CONTRA
            'Drawings': 'Equity_Contra',

            // REVENUE (Nominal)
            'Sales': 'Revenue', 'Commission Received': 'Revenue', 'Discount Received': 'Revenue',
            'Interest Received': 'Revenue', 'Rent Received': 'Revenue', 'Dividend Received': 'Revenue',

            // DIRECT EXPENSES (Trading Account - Nominal)
            'Purchases': 'Direct_Expense', 'Wages': 'Direct_Expense', 'Carriage Inward': 'Direct_Expense',
            'Freight': 'Direct_Expense', 'Manufacturing Exp': 'Direct_Expense', 'Factory Rent': 'Direct_Expense',
            'Opening Stock': 'Direct_Expense', 'Power & Fuel': 'Direct_Expense',

            // INDIRECT EXPENSES (P&L Account - Nominal)
            'Salary': 'Indirect_Expense', 'Rent': 'Indirect_Expense', 'Electricity': 'Indirect_Expense',
            'Postage': 'Indirect_Expense', 'Insurance': 'Indirect_Expense', 'Office Exp': 'Indirect_Expense',
            'Depreciation': 'Indirect_Expense', 'Bad Debts': 'Indirect_Expense', 'Discount Allowed': 'Indirect_Expense',
            'Carriage Outward': 'Indirect_Expense', 'Printing & Stationery': 'Indirect_Expense',
            'Audit Fees': 'Indirect_Expense', 'Interest Paid': 'Indirect_Expense', 'Bank Charges': 'Indirect_Expense'
        };
    }

    reset() {
        this.journal = [];
        this.ledgers = {};
        this.trialBalance = [];
        this.tradingAccount = { debit: [], credit: [], grossProfit: 0 };
        this.plAccount = { debit: [], credit: [], netProfit: 0 };
        this.balanceSheet = { assets: [], liabilities: [], equity_summary: [] };
    }

    getAccountType(name) {
        const n = name.trim();
        if (this.accountTypes[n]) return this.accountTypes[n];

        const lower = n.toLowerCase();
        if (lower.includes('loan') || lower.includes('payable')) return 'Liability';
        if (lower.includes('receivable') || lower.includes('furniture') || lower.includes('machinery')) return 'Asset';
        if (lower.includes('expense') || lower.includes('paid')) return 'Indirect_Expense';
        if (lower.includes('income') || lower.includes('received')) return 'Revenue';

        return 'Asset'; // Default fallback
    }

    /**
     * ADVANCED TRANSACTION PARSING
     * Uses pattern recognition to map natural language to Double Entry Bookkeeping
     */
    parseTransaction(text) {
        const line = text.trim();
        if (!line) return null;

        const amountMatch = line.match(/[\d,]+(\.\d+)?/);
        if (!amountMatch) return null;
        const amount = parseFloat(amountMatch[0].replace(/,/g, ''));

        const lower = line.toLowerCase();
        let dr = '', cr = '', narration = line;

        // 1. CAPITAL & COMMENCEMENT
        if (lower.includes('started business') || lower.includes('introduced capital')) {
            dr = 'Cash'; cr = 'Capital';
        }
        // 2. CASH DISBURSEMENTS (EXPENSES)
        else if (lower.includes('paid')) {
            cr = lower.includes('cheque') || lower.includes('bank') ? 'Bank' : 'Cash';
            if (lower.includes('wages')) dr = 'Wages';
            else if (lower.includes('salary')) dr = 'Salary';
            else if (lower.includes('rent')) dr = 'Rent';
            else if (lower.includes('insurance')) dr = 'Insurance';
            else if (lower.includes('carriage inward')) dr = 'Carriage Inward';
            else if (lower.includes('carriage outward')) dr = 'Carriage Outward';
            else if (lower.includes('electricity')) dr = 'Electricity';
            else if (lower.includes('to')) { // Paid to Creditor
                const match = line.match(/to\s+([A-Za-z\s]+)\b/i);
                dr = match ? match[1].trim() : 'Creditors';
            }
            else dr = 'Office Exp';
        }
        // 3. PURCHASES (GOODS)
        else if (lower.includes('purchased goods') || lower.includes('bought goods')) {
            dr = 'Purchases';
            if (lower.includes('cash')) cr = 'Cash';
            else if (lower.includes('from')) {
                const match = line.match(/from\s+([A-Za-z\s]+)\b/i);
                cr = match ? match[1].trim() : 'Creditors';
                if (!this.accountTypes[cr]) this.accountTypes[cr] = 'Liability';
            } else {
                cr = 'Creditors';
            }
        }
        // 4. SALES (GOODS)
        else if (lower.includes('sold goods')) {
            cr = 'Sales';
            if (lower.includes('cash')) dr = 'Cash';
            else if (lower.includes('to')) {
                const match = line.match(/to\s+([A-Za-z\s]+)\b/i);
                dr = match ? match[1].trim() : 'Debtors';
                if (!this.accountTypes[dr]) this.accountTypes[dr] = 'Asset';
            } else {
                dr = 'Debtors';
            }
        }
        // 5. ASSET ACQUISITION
        else if (lower.includes('purchased') || lower.includes('bought')) {
            if (lower.includes('furniture')) dr = 'Furniture';
            else if (lower.includes('machinery')) dr = 'Machinery';
            else if (lower.includes('computer')) dr = 'Computer';
            else if (lower.includes('building')) dr = 'Buildings';
            else if (lower.includes('land')) dr = 'Land';

            if (dr) {
                cr = lower.includes('cash') ? 'Cash' : 'Bank';
            }
        }
        // 6. DRAWINGS
        else if (lower.includes('withdrew') || lower.includes('for personal') || lower.includes('drawings')) {
            dr = 'Drawings';
            cr = lower.includes('bank') ? 'Bank' : 'Cash';
        }
        // 7. INCOMES
        else if (lower.includes('received')) {
            dr = lower.includes('cheque') || lower.includes('bank') ? 'Bank' : 'Cash';
            if (lower.includes('interest')) cr = 'Interest Received';
            else if (lower.includes('commission')) cr = 'Commission Received';
            else if (lower.includes('rent')) cr = 'Rent Received';
            else if (lower.includes('from')) { // Received from Debtor
                const match = line.match(/from\s+([A-Za-z\s]+)\b/i);
                cr = match ? match[1].trim() : 'Debtors';
            }
            else cr = 'Commission Received';
        }
        // 8. DEPRECIATION (Adjusting Entry)
        else if (lower.includes('depreciation')) {
            dr = 'Depreciation';
            const match = line.match(/on\s+([A-Za-z\s]+)\b/i);
            cr = match ? match[1].trim() : 'Furniture';
        }

        if (dr && cr) {
            return {
                date: new Date().toLocaleDateString('en-GB'),
                debit: dr,
                credit: cr,
                amount: amount,
                narration: `(Being ${narration})`
            };
        }
        return null;
    }

    process(input) {
        const lines = input.split('\n');
        lines.forEach(line => {
            const entry = this.parseTransaction(line);
            if (entry) {
                this.journal.push(entry);
                this.postToLedger(entry);
            }
        });
        this.sync();
    }

    postToLedger(entry) {
        if (!this.ledgers[entry.debit]) this.ledgers[entry.debit] = { dr: [], cr: [] };
        if (!this.ledgers[entry.credit]) this.ledgers[entry.credit] = { dr: [], cr: [] };

        this.ledgers[entry.debit].dr.push({ particulars: `To ${entry.credit} A/c`, amount: entry.amount });
        this.ledgers[entry.credit].cr.push({ particulars: `By ${entry.debit} A/c`, amount: entry.amount });
    }

    sync() {
        this.calculateBalances();
        this.generateFinancials();
    }

    calculateBalances() {
        this.trialBalance = [];
        for (const [acc, data] of Object.entries(this.ledgers)) {
            const drTotal = data.dr.reduce((s, i) => s + i.amount, 0);
            const crTotal = data.cr.reduce((s, i) => s + i.amount, 0);
            const balance = drTotal - crTotal;

            if (balance !== 0) {
                this.trialBalance.push({
                    name: acc,
                    debit: balance > 0 ? balance : 0,
                    credit: balance < 0 ? Math.abs(balance) : 0,
                    type: this.getAccountType(acc)
                });
            }
        }
    }

    /**
     * ACCOUNTING STANDARDS IMPLEMENTATION
     * Generates Final Accounts following the Golden Rules
     */
    generateFinancials() {
        this.tradingAccount = { debit: [], credit: [], grossProfit: 0 };
        this.plAccount = { debit: [], credit: [], netProfit: 0 };
        this.balanceSheet = { assets: [], liabilities: [], equity_summary: [] };

        let sales = 0, purchases = 0, directExp = 0, openingStock = 0;

        // 1. Trading Account Logic
        this.trialBalance.forEach(item => {
            if (item.name === 'Sales') sales = item.credit;
            else if (item.name === 'Purchases') purchases = item.debit;
            else if (item.name === 'Opening Stock') openingStock = item.debit;
            else if (item.type === 'Direct_Expense') {
                this.tradingAccount.debit.push({ name: item.name, amount: item.debit });
                directExp += item.debit;
            }
        });

        if (openingStock > 0) this.tradingAccount.debit.unshift({ name: 'Opening Stock', amount: openingStock });
        this.tradingAccount.debit.push({ name: 'Purchases', amount: purchases });
        this.tradingAccount.credit.push({ name: 'Sales', amount: sales });

        // Gross Profit Calculation
        this.tradingAccount.grossProfit = sales - (purchases + directExp + openingStock);

        // 2. Profit & Loss Account Logic
        if (this.tradingAccount.grossProfit >= 0) {
            this.plAccount.credit.push({ name: 'Gross Profit b/d', amount: this.tradingAccount.grossProfit });
        } else {
            this.plAccount.debit.push({ name: 'Gross Loss b/d', amount: Math.abs(this.tradingAccount.grossProfit) });
        }

        let totalPLCr = (this.tradingAccount.grossProfit > 0 ? this.tradingAccount.grossProfit : 0);
        let totalPLDr = (this.tradingAccount.grossProfit < 0 ? Math.abs(this.tradingAccount.grossProfit) : 0);

        this.trialBalance.forEach(item => {
            if (item.type === 'Indirect_Expense') {
                this.plAccount.debit.push({ name: item.name, amount: item.debit });
                totalPLDr += item.debit;
            } else if (item.type === 'Revenue' && item.name !== 'Sales') {
                this.plAccount.credit.push({ name: item.name, amount: item.credit });
                totalPLCr += item.credit;
            }
        });

        this.plAccount.netProfit = totalPLCr - totalPLDr;

        // 3. Balance Sheet Logic (Position Statement)
        let capital = 0, drawings = 0;
        this.trialBalance.forEach(item => {
            if (item.name === 'Capital') capital = item.credit;
            else if (item.name === 'Drawings') drawings = item.debit;
            else if (item.type === 'Asset' && item.name !== 'Drawings' && item.name !== 'Opening Stock') {
                this.balanceSheet.assets.push({ name: item.name, amount: item.debit });
            } else if (item.type === 'Liability' && item.name !== 'Capital') {
                this.balanceSheet.liabilities.push({ name: item.name, amount: item.credit });
            }
        });

        const finalCapital = capital + this.plAccount.netProfit - drawings;
        this.balanceSheet.equity_summary = [
            { label: 'Opening Capital Balance', amount: capital },
            { label: this.plAccount.netProfit >= 0 ? 'Add: Net Profit per P&L' : 'Less: Net Loss per P&L', amount: Math.abs(this.plAccount.netProfit), isDeduction: this.plAccount.netProfit < 0 },
            { label: 'Less: Drawings during the year', amount: drawings, isDeduction: true },
            { label: 'Closing Net Worth', amount: finalCapital, isTotal: true }
        ];
    }
}

window.AccountingEngine = AccountingEngine;
