document.addEventListener('DOMContentLoaded', async () => {
    const engine = new AccountingEngine();

    // Initialize Enterprise Storage
    await StorageHub.init();

    // UI Phase Selectors
    const userAuthOverlay = document.getElementById('userAuthOverlay');
    const companyOverlay = document.getElementById('companyOverlay');
    const mainApp = document.getElementById('mainApp');

    // Auth Form Selectors
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const toSignup = document.getElementById('toSignup');
    const toLogin = document.getElementById('toLogin');

    // Company Selectors
    const companyList = document.getElementById('companyList');
    const showCreateBtn = document.getElementById('showCreateBtn');
    const createCompanyForm = document.getElementById('createCompanyForm');
    const backToSelectBtn = document.getElementById('backToSelectBtn');

    // Navigation
    const tabs = document.querySelectorAll('.nav-item');
    const panes = document.querySelectorAll('.tab-pane');
    const subTabBtns = document.querySelectorAll('.sub-tab-btn');
    const subTabPanes = document.querySelectorAll('.sub-tab-pane');

    // Global State
    let currentUser = null;
    let currentCompanyId = null;
    let charts = { performance: null, allocation: null };

    // --- 1. USER AUTHENTICATION ---

    toSignup.onclick = (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        document.getElementById('authTitle').textContent = 'Create Master Account';
    };

    toLogin.onclick = (e) => {
        e.preventDefault();
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        document.getElementById('authTitle').textContent = 'Enterprise Hub Login';
    };

    signupForm.onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value.trim();
        const username = document.getElementById('signupUsername').value.trim();
        const password = document.getElementById('signupPassword').value;

        let users = getUsers();
        if (users.find(u => u.username === username)) {
            return alert('Username already taken');
        }

        users.push({ name, username, password, companies: [] });
        saveUsers(users);
        showNotification('Profile Registered!', 'success');
        toLogin.click();
    };

    loginForm.onsubmit = (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        const user = getUsers().find(u => u.username === username && u.password === password);
        if (!user) {
            return alert('Identification failed. Check credentials.');
        }

        loginUser(user);
    };

    function loginUser(user) {
        currentUser = user;
        sessionStorage.setItem('current_user', JSON.stringify(user));

        userAuthOverlay.style.display = 'none';
        companyOverlay.style.display = 'flex';

        document.getElementById('loggedInUserDisplay').textContent = user.name;
        document.getElementById('sidebarUserName').textContent = user.name;
        document.getElementById('userAvatar').textContent = user.name.substring(0, 2).toUpperCase();

        renderCompanyList();
    }

    document.getElementById('logoutUserBtn').onclick = () => {
        sessionStorage.clear();
        location.reload();
    };

    function getUsers() {
        const raw = localStorage.getItem('accu_users');
        return raw ? JSON.parse(raw) : [];
    }

    function saveUsers(list) {
        localStorage.setItem('accu_users', JSON.stringify(list));
    }

    // --- 2. COMPANY MANAGEMENT ---

    function renderCompanyList() {
        companyList.innerHTML = '';
        const users = getUsers();
        const user = users.find(u => u.username === currentUser.username);

        if (!user || user.companies.length === 0) {
            companyList.innerHTML = '<div class="card" style="padding: 2rem; opacity: 0.5; color: var(--text-muted);">No active enterprises found in your vault.</div>';
        } else {
            user.companies.forEach(c => {
                const item = document.createElement('div');
                item.className = 'account-list-item';
                item.style.padding = '1.5rem';
                item.style.marginBottom = '12px';
                item.style.background = 'white';
                item.style.boxShadow = 'var(--shadow-sm)';
                item.innerHTML = `
                    <div style="text-align: left;">
                        <b style="color: var(--bg-dark); font-size: 1.1rem; display: block;">${c.name}</b>
                        <div style="font-size: 0.8rem; color: var(--primary); font-weight: 700;">FY ${c.fy}</div>
                    </div>
                    <button class="btn-primary" onclick="openCompany('${c.id}')">Initialize Hub <i class="fas fa-chevron-right"></i></button>
                `;
                companyList.appendChild(item);
            });
        }
    }

    window.openCompany = async (id) => {
        const user = getUsers().find(u => u.username === currentUser.username);
        const comp = user.companies.find(c => c.id === id);

        if (comp) {
            currentCompanyId = id;
            sessionStorage.setItem('current_company_id', id);

            companyOverlay.style.display = 'none';
            mainApp.style.display = 'grid';

            document.getElementById('currentCompany').textContent = comp.name;
            document.getElementById('currentFY').textContent = `Financial Year: ${comp.fy}`;
            document.getElementById('settingsCompanyName').value = comp.name;

            await loadCompanyData(id);
        }
    };

    showCreateBtn.onclick = () => {
        document.getElementById('companySelectionView').classList.add('hidden');
        createCompanyForm.classList.remove('hidden');
    };

    backToSelectBtn.onclick = () => {
        createCompanyForm.classList.add('hidden');
        document.getElementById('companySelectionView').classList.remove('hidden');
    };

    createCompanyForm.onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('newCompanyName').value.trim();
        const fy = document.getElementById('newCompanyFY').value;
        const id = 'ent_' + Date.now();

        let users = getUsers();
        let uIndex = users.findIndex(u => u.username === currentUser.username);
        users[uIndex].companies.push({ id, name, fy });

        saveUsers(users);
        openCompany(id);
    };

    document.getElementById('companyDisplayTrigger').onclick = () => {
        if (confirm('Switch back to Enterprise Manager (Voucher Stack remains safe)?')) {
            sessionStorage.removeItem('current_company_id');
            location.reload();
        }
    };

    // --- 3. SESSION RESTORE ---
    const savedUser = sessionStorage.getItem('current_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        const savedComp = sessionStorage.getItem('current_company_id');
        if (savedComp) {
            loginUser(currentUser);
            openCompany(savedComp);
        } else {
            loginUser(currentUser);
        }
    }

    // --- 4. ENTERPRISE DATA LOAD/SAVE (Optimized for Hard Traffic) ---

    async function loadCompanyData(id) {
        engine.reset();
        try {
            const data = await StorageHub.getData(currentUser.username, id);
            if (data) {
                engine.journal = data.journal || [];
                engine.ledgers = data.ledgers || {};
                engine.accountTypes = { ...engine.accountTypes, ...(data.accountTypes || {}) };
                engine.sync();
            }
        } catch (err) {
            console.error('Storage link broken:', err);
            showNotification('Recovery Mode: Local link error', 'info');
        }
        updateUI();
        initDashboard();
    }

    async function saveCompanyData() {
        if (!currentCompanyId) return;
        const pack = {
            journal: engine.journal,
            ledgers: engine.ledgers,
            accountTypes: engine.accountTypes
        };
        await StorageHub.saveData(currentUser.username, currentCompanyId, pack);
    }

    // --- 5. CORE UI ENGINE ---

    window.switchTab = (tabId) => {
        const tab = Array.from(tabs).find(t => t.getAttribute('data-tab') === tabId);
        if (tab) tab.click();
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-tab') + '-tab';
            document.getElementById(target).classList.add('active');
            document.getElementById('pageTitle').textContent = tab.textContent.trim();
        });
    });

    subTabBtns.forEach(btn => {
        btn.onclick = () => {
            subTabBtns.forEach(b => b.classList.remove('active'));
            subTabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-subtab') + '-view').classList.add('active');
        };
    });

    document.getElementById('processBtn').onclick = async () => {
        const val = transactionInput.value.trim();
        if (!val) return;
        engineLogs.innerHTML = '<p class="text-accent" style="font-weight:900;"><i class="fas fa-microchip fa-spin"></i> CALCULATING DOUBLE-ENTRY POSITIONS...</p>';

        // Non-blocking processing for Hard Traffic
        setTimeout(async () => {
            engine.process(val);
            await saveCompanyData();
            updateUI();
            transactionInput.value = '';
            engineLogs.innerHTML = '<p class="text-accent" style="font-weight:900;"><i class="fas fa-check-circle"></i> VOUCHERS INTEGRATED INTO LEDGERS</p>';
            showNotification('Accounting Books Balanced', 'success');
        }, 300);
    };

    function updateUI() {
        // Run intensive renders in requestAnimationFrame for smooth UI
        requestAnimationFrame(() => {
            renderJournal();
            renderLedgers();
            renderTrial();
            renderTrading();
            renderPL();
            renderBS();
            updateDashboard();
        });
    }

    function renderJournal() {
        const body = document.getElementById('journalBody');
        body.innerHTML = engine.journal.slice().reverse().map(e => `
            <tr class="animate-fade">
                <td style="font-weight:800; color: var(--text-muted);">${e.date}</td>
                <td>
                    <div style="font-weight:800; color:var(--bg-dark); font-size:1rem;">${e.debit} A/c <span style="float:right; opacity:0.6;">Dr.</span></div>
                    <div style="padding-left:3rem; margin:4px 0; font-weight:600;">To ${e.credit} A/c</div>
                    <div style="padding-left:3rem; font-size:0.8rem; color:var(--primary); font-weight:700; text-transform:uppercase;">${e.narration}</div>
                </td>
                <td class="text-right" style="vertical-align:top; font-weight:900; color: var(--bg-dark);">₹ ${e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td class="text-right" style="vertical-align:bottom; font-weight:900; color: var(--bg-dark);">₹ ${e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center; padding:5rem; opacity:0.3;">BOOKS ARE EMPTY. ENTER VOUCHERS TO BEGIN.</td></tr>';
    }

    function renderLedgers() {
        const curr = ledgerSelect.value;
        ledgerSelect.innerHTML = '<option value="">Search Ledger Portfolios...</option>';
        const accs = Object.keys(engine.ledgers).sort();
        accs.forEach(a => {
            const o = document.createElement('option'); o.value = a; o.textContent = a;
            ledgerSelect.appendChild(o);
        });
        if (curr && engine.ledgers[curr]) ledgerSelect.value = curr;

        document.getElementById('ledgerAccountList').innerHTML = accs.map(a => {
            const dr = engine.ledgers[a].dr.reduce((s, i) => s + i.amount, 0);
            const cr = engine.ledgers[a].cr.reduce((s, i) => s + i.amount, 0);
            const bal = dr - cr;
            return `<div class="account-list-item ${curr === a ? 'active' : ''}" onclick="selectLedger('${a}')">
                <span>${a}</span><span style="font-size:0.75rem; font-weight:900;">₹ ${Math.abs(bal).toLocaleString('en-IN')} ${bal >= 0 ? 'Dr' : 'Cr'}</span>
            </div>`;
        }).join('') || '<div style="padding:1.5rem; text-align:center; opacity:0.3;">LIST EMPTY</div>';
    }

    window.selectLedger = (n) => { ledgerSelect.value = n; renderLedgerDetails(n); renderLedgers(); };
    ledgerSelect.onchange = (e) => selectLedger(e.target.value);

    function renderLedgerDetails(n) {
        const d = engine.ledgers[n]; if (!d) return;
        const drTotal = d.dr.reduce((s, i) => s + i.amount, 0);
        const crTotal = d.cr.reduce((s, i) => s + i.amount, 0);
        const bal = drTotal - crTotal;
        const max = Math.max(drTotal + (bal < 0 ? Math.abs(bal) : 0), crTotal + (bal > 0 ? bal : 0));

        ledgerDetails.innerHTML = `
            <div class="card animate-fade">
                <h3 style="margin-bottom:2rem; border-bottom:2.5px solid var(--bg-dark); padding-bottom:1rem; color:var(--bg-dark);">${n} Portfolio Account</h3>
                <div class="statement-grid" style="border-width:2px;">
                    <div class="statement-side">
                        <h4>Debit (Sources)</h4>
                        <table class="statement-table">
                            ${d.dr.map(x => `<tr><td>${x.particulars}</td><td class="text-right" style="font-weight:800;">${x.amount.toLocaleString('en-IN')}</td></tr>`).join('')}
                            ${bal < 0 ? `<tr style="color:var(--primary); font-weight:900; font-style:italic;"><td>To Balance c/d (Balancing Figure)</td><td class="text-right">${Math.abs(bal).toLocaleString('en-IN')}</td></tr>` : ''}
                            <tr class="total-row"><td>Consolidated Total</td><td class="text-right">₹ ${max.toLocaleString('en-IN')}</td></tr>
                        </table>
                    </div>
                    <div class="statement-side">
                        <h4>Credit (Applications)</h4>
                        <table class="statement-table">
                            ${d.cr.map(x => `<tr><td>${x.particulars}</td><td class="text-right" style="font-weight:800;">${x.amount.toLocaleString('en-IN')}</td></tr>`).join('')}
                            ${bal > 0 ? `<tr style="color:var(--primary); font-weight:900; font-style:italic;"><td>By Balance c/d (Balancing Figure)</td><td class="text-right">${Math.abs(bal).toLocaleString('en-IN')}</td></tr>` : ''}
                            <tr class="total-row"><td>Consolidated Total</td><td class="text-right">₹ ${max.toLocaleString('en-IN')}</td></tr>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    function renderTrial() {
        let dr = 0, cr = 0;
        trialBalanceBody.innerHTML = engine.trialBalance.map(i => {
            dr += i.debit; cr += i.credit;
            return `<tr><td style="font-weight:800; color:var(--bg-dark);">${i.name}</td><td class="text-right" style="font-weight:700;">${i.debit > 0 ? i.debit.toLocaleString('en-IN') : '-'}</td><td class="text-right" style="font-weight:700;">${i.credit > 0 ? i.credit.toLocaleString('en-IN') : '-'}</td></tr>`;
        }).join('') || '<tr><td colspan="3" style="text-align:center; padding:5rem; opacity:0.3;">DATA NOT GENERATED</td></tr>';

        document.getElementById('trialDebitTotal').textContent = dr.toLocaleString('en-IN', { minimumFractionDigits: 2 });
        document.getElementById('trialCreditTotal').textContent = cr.toLocaleString('en-IN', { minimumFractionDigits: 2 });

        const status = document.getElementById('trialStatus');
        if (Math.abs(dr - cr) < 0.1 && dr > 0) {
            status.innerHTML = '<span class="profit-positive" style="padding:8px 25px; border-radius:10px; font-size:0.85rem; font-weight:900; border:2px solid #059669; box-shadow: var(--shadow-sm);"><i class="fas fa-check-double"></i> ARITHMETICALLY ACCURATE</span>';
        } else if (dr > 0) {
            status.innerHTML = '<span class="profit-negative" style="padding:8px 25px; border-radius:10px; font-size:0.85rem; font-weight:900; border:2px solid #be123c; box-shadow: var(--shadow-sm);"><i class="fas fa-exclamation-triangle"></i> VARIANCE DETECTED</span>';
        }
    }

    function renderTrading() {
        const gp = engine.tradingAccount.grossProfit;
        const drRows = engine.tradingAccount.debit.map(i => `<tr><td>To ${i.name}</td><td class="text-right" style="font-weight:800;">${i.amount.toLocaleString('en-IN')}</td></tr>`).join('');
        const crRows = engine.tradingAccount.credit.map(i => `<tr><td>By ${i.name}</td><td class="text-right" style="font-weight:800;">${i.amount.toLocaleString('en-IN')}</td></tr>`).join('');

        let drFinal = drRows;
        let crFinal = crRows;

        const total = Math.max(
            engine.tradingAccount.debit.reduce((s, i) => s + i.amount, 0) + (gp > 0 ? gp : 0),
            engine.tradingAccount.credit.reduce((s, i) => s + i.amount, 0) + (gp < 0 ? Math.abs(gp) : 0)
        );

        if (gp >= 0) drFinal += `<tr style="color:var(--primary); font-weight:900;"><td>To Gross Profit c/d</td><td class="text-right">${gp.toLocaleString('en-IN')}</td></tr>`;
        else crFinal += `<tr style="color:var(--danger); font-weight:900;"><td>By Gross Loss c/d</td><td class="text-right">${Math.abs(gp).toLocaleString('en-IN')}</td></tr>`;

        drFinal += `<tr class="total-row"><td style="font-size:1.1rem;">Total</td><td class="text-right">₹ ${total.toLocaleString('en-IN')}</td></tr>`;
        crFinal += `<tr class="total-row"><td style="font-size:1.1rem;">Total</td><td class="text-right">₹ ${total.toLocaleString('en-IN')}</td></tr>`;

        document.getElementById('tradingDebitTable').innerHTML = drFinal;
        document.getElementById('tradingCreditTable').innerHTML = crFinal;
        document.getElementById('tradingSummary').className = `report-summary ${gp >= 0 ? 'profit-positive' : 'profit-negative'}`;
        document.getElementById('tradingSummary').innerHTML = `Trading Status: <b style="font-size:1.2rem;">₹ ${Math.abs(gp).toLocaleString('en-IN')} ${gp >= 0 ? 'Gross Profit' : 'Gross Loss'}</b>`;
    }

    function renderPL() {
        const np = engine.plAccount.netProfit;
        const drRows = engine.plAccount.debit.map(i => `<tr><td>To ${i.name}</td><td class="text-right" style="font-weight:800;">${i.amount.toLocaleString('en-IN')}</td></tr>`).join('');
        const crRows = engine.plAccount.credit.map(i => `<tr><td>By ${i.name}</td><td class="text-right" style="font-weight:800;">${i.amount.toLocaleString('en-IN')}</td></tr>`).join('');

        let drFinal = drRows;
        let crFinal = crRows;

        const total = Math.max(
            engine.plAccount.debit.reduce((s, i) => s + i.amount, 0) + (np > 0 ? np : 0),
            engine.plAccount.credit.reduce((s, i) => s + i.amount, 0) + (np < 0 ? Math.abs(np) : 0)
        );

        if (np >= 0) drFinal += `<tr style="color:var(--primary); font-weight:900;"><td>To Net Profit (Transferred to Capital)</td><td class="text-right">${np.toLocaleString('en-IN')}</td></tr>`;
        else crFinal += `<tr style="color:var(--danger); font-weight:900;"><td>By Net Loss (Transferred to Capital)</td><td class="text-right">${Math.abs(np).toLocaleString('en-IN')}</td></tr>`;

        drFinal += `<tr class="total-row"><td style="font-size:1.1rem;">Total</td><td class="text-right">₹ ${total.toLocaleString('en-IN')}</td></tr>`;
        crFinal += `<tr class="total-row"><td style="font-size:1.1rem;">Total</td><td class="text-right">₹ ${total.toLocaleString('en-IN')}</td></tr>`;

        document.getElementById('plDebitTable').innerHTML = drFinal;
        document.getElementById('plCreditTable').innerHTML = crFinal;
        document.getElementById('netProfitMsg').className = `report-summary ${np >= 0 ? 'profit-positive' : 'profit-negative'}`;
        document.getElementById('netProfitMsg').innerHTML = `Net Performance Result: <b style="font-size:1.2rem;">₹ ${Math.abs(np).toLocaleString('en-IN')} ${np >= 0 ? 'Net Profit' : 'Net Loss'}</b>`;
    }

    function renderBS() {
        // LIABILITIES / EQUITY
        let lHtml = '<tr class="sub-heading"><td>Master Equity & Capital</td><td></td></tr>';
        engine.balanceSheet.equity_summary.forEach(r => {
            lHtml += `<tr class="${r.isTotal ? 'total-row' : 'indent-1'}" style="${r.isTotal ? 'background:#f1f5f9; border-top:2px solid var(--bg-dark);' : ''}">
                <td style="${r.isTotal ? 'font-weight:900; color:var(--bg-dark);' : ''}">${r.label}</td>
                <td class="text-right" style="${r.isDeduction ? 'color:var(--danger);' : (r.isTotal ? 'font-weight:900; color:var(--primary);' : '')}">${r.isDeduction ? '-' : ''}₹ ${r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>`;
        });
        lHtml += '<tr class="sub-heading"><td>External Debt & Obligations</td><td></td></tr>';
        if (engine.balanceSheet.liabilities.length === 0) {
            lHtml += '<tr><td class="indent-1" style="opacity:0.4;">Clean Debt Ledger - No Obligations.</td><td class="text-right">0.00</td></tr>';
        }
        engine.balanceSheet.liabilities.forEach(l => {
            lHtml += `<tr><td class="indent-1" style="font-weight:700;">${l.name}</td><td class="text-right" style="font-weight:900;">₹ ${l.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`;
        });

        // ASSETS
        let aHtml = '<tr class="sub-heading"><td>Fixed & Current Resources</td><td></td></tr>';
        let assetRows = engine.balanceSheet.assets.map(a => `<tr><td style="font-weight:800; color:var(--bg-dark);">${a.name}</td><td class="text-right" style="font-weight:900;">₹ ${a.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`).join('');
        if (!assetRows) assetRows = '<tr><td colspan="2" style="text-align:center; padding:3rem; opacity:0.3;">NO TANGIBLE ASSETS RECORDED</td></tr>';
        aHtml += assetRows;

        document.getElementById('liabilitiesTable').innerHTML = lHtml;
        document.getElementById('assetsTable').innerHTML = aHtml;

        const tl = (engine.balanceSheet.equity_summary.find(e => e.isTotal)?.amount || 0) + engine.balanceSheet.liabilities.reduce((s, i) => s + i.amount, 0);
        const ta = engine.balanceSheet.assets.reduce((s, i) => s + i.amount, 0);

        document.getElementById('liabilitiesTable').innerHTML += `<tr class="total-row" style="background:var(--bg-dark); color:white; font-size:1.1rem; border:none;"><td>TOTAL SOURCES OF FUNDS</td><td class="text-right" style="font-weight:900;">₹ ${tl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`;
        document.getElementById('assetsTable').innerHTML += `<tr class="total-row" style="background:var(--bg-dark); color:white; font-size:1.1rem; border:none;"><td>TOTAL ASSET RESOURCES</td><td class="text-right" style="font-weight:900;">₹ ${ta.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`;

        const st = document.getElementById('bsStatus');
        if (Math.abs(tl - ta) < 0.1 && ta > 0) {
            st.className = 'report-summary profit-positive animate-fade';
            st.style.border = '2px solid #059669';
            st.innerHTML = '<i class="fas fa-check-double"></i> POSITION STATEMENT RECONCILED & VERIFIED';
        } else if (ta > 0) {
            st.className = 'report-summary profit-negative animate-fade';
            st.style.border = '2px solid #be123c';
            st.innerHTML = `<i class="fas fa-exclamation-triangle"></i> AUDIT ALERT: BALANCE SHEET VARIANCE OF ₹ ${Math.abs(tl - ta).toLocaleString('en-IN')}`;
        }
    }

    function updateDashboard() {
        const rev = engine.tradingAccount.credit.reduce((s, i) => s + i.amount, 0);
        const exp = engine.tradingAccount.debit.reduce((s, i) => s + i.amount, 0) + engine.plAccount.debit.reduce((s, i) => s + i.amount, 0);
        const np = engine.plAccount.netProfit;
        const ta = engine.balanceSheet.assets.reduce((s, i) => s + i.amount, 0);
        const cash = engine.trialBalance.find(i => i.name === 'Cash' || i.name === 'Bank')?.debit || 0;

        document.getElementById('statRevenue').textContent = `₹ ${rev.toLocaleString('en-IN')}`;
        document.getElementById('statExpenses').textContent = `₹ ${exp.toLocaleString('en-IN')}`;
        document.getElementById('statProfit').textContent = `₹ ${Math.abs(np).toLocaleString('en-IN')}`;
        document.getElementById('statProfitMeta').textContent = np >= 0 ? 'Surplus Generation' : 'Operating Deficit';
        document.getElementById('statCash').textContent = `₹ ${cash.toLocaleString('en-IN')}`;

        if (charts.performance) {
            charts.performance.data.datasets[0].data = [rev, exp];
            charts.performance.update();
        }
        if (charts.allocation) {
            const tl = engine.balanceSheet.liabilities.reduce((s, i) => s + i.amount, 0);
            const eq = engine.balanceSheet.equity_summary.find(e => e.isTotal)?.amount || 0;
            charts.allocation.data.datasets[0].data = [ta, tl, eq];
            charts.allocation.update();
        }
    }

    function initDashboard() {
        if (charts.performance) charts.performance.destroy();
        if (charts.allocation) charts.allocation.destroy();

        const ctx1 = document.getElementById('incomeExpChart').getContext('2d');
        charts.performance = new Chart(ctx1, {
            type: 'bar',
            data: { labels: ['Enterprise Inflow', 'Production Outflow'], datasets: [{ data: [0, 0], backgroundColor: ['#10b981', '#ef4444'], borderRadius: 12, barThickness: 60 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { weight: '700' } } } } }
        });

        const ctx2 = document.getElementById('assetLiabChart').getContext('2d');
        charts.allocation = new Chart(ctx2, {
            type: 'doughnut',
            data: { labels: ['Total Assets', 'Current Debt', 'Net Equity'], datasets: [{ data: [1, 1, 1], backgroundColor: ['#059669', '#f59e0b', '#3b82f6'], borderWeight: 0, hoverOffset: 15 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '80%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { weight: '800', size: 12 } } } } }
        });
        updateDashboard();
    }

    function showNotification(m, t) {
        const container = document.getElementById('notificationContainer');
        const n = document.createElement('div'); n.className = `notification ${t}`;
        n.style.borderLeftWidth = '8px';
        n.innerHTML = `<i class="fas ${t === 'success' ? 'fa-check-circle' : 'fa-database'}"></i> <div style="display:flex; flex-direction:column;"><b>${t === 'success' ? 'SUCCESS' : 'SYSTEM'}</b><span>${m}</span></div>`;
        container.appendChild(n);
        setTimeout(() => { n.style.transform = 'translateX(120%)'; setTimeout(() => n.remove(), 500); }, 4000);
    }

    window.exportToExcel = (id) => {
        const table = document.getElementById(id);
        const rows = Array.from(table.querySelectorAll('tr')).map(tr => Array.from(tr.querySelectorAll('td,th')).map(td => td.innerText.replace(/,/g, '')).join(','));
        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Enterprise_Audit_Report_${Date.now()}.csv`; a.click();
    };

    document.getElementById('resetData').onclick = async () => { if (confirm('WIPE ALL VOUCHERS PERMANENTLY? This cannot be undone.')) { engine.reset(); await saveCompanyData(); updateUI(); showNotification('Data Vault Purged', 'info'); } };

    document.getElementById('delCurrentCompanyBtn').onclick = async () => {
        if (confirm('CRITICAL ACTION: Delete this specific Enterprise Profile?')) {
            let users = getUsers();
            let uIdx = users.findIndex(u => u.username === currentUser.username);
            users[uIdx].companies = users[uIdx].companies.filter(c => c.id !== currentCompanyId);
            saveUsers(users);
            await StorageHub.deleteData(currentUser.username, currentCompanyId);
            sessionStorage.removeItem('current_company_id');
            location.reload();
        }
    };

});
