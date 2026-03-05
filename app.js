/* =========================================
   SpendSense AI — app.js
   ========================================= */

const SUPABASE_URL = 'https://xtjqsuvqtmehnxdbjvqo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CQL7t2wmESnwhT8Mj_3Ytg_ox4sxW9I';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let transactions = [];
let apiKey = localStorage.getItem('ss_apikey') || '';
let editingId = null;
let deleteId = null;
let currentPage = 1;
const PAGE_SIZE = 8;
// Chart instances
let donutChart = null, barChart = null, lineChart = null, catBarChart = null, hbarChart = null;

// ─── CATEGORY COLOURS ─────────────────────────────────────
const CAT_COLORS = {
  Food: { bg: 'rgba(249,115,22,0.7)', border: '#f97316' },
  Rent: { bg: 'rgba(59,130,246,0.7)', border: '#3b82f6' },
  Salary: { bg: 'rgba(16,185,129,0.7)', border: '#10b981' },
  Investment: { bg: 'rgba(124,58,237,0.7)', border: '#7c3aed' },
  Transport: { bg: 'rgba(107,114,128,0.7)', border: '#6b7280' },
  Entertainment: { bg: 'rgba(236,72,153,0.7)', border: '#ec4899' },
  Healthcare: { bg: 'rgba(20,184,166,0.7)', border: '#14b8a6' },
  Other: { bg: 'rgba(148,163,184,0.7)', border: '#94a3b8' },
};

Chart.defaults.color = '#7d8590';
Chart.defaults.font.family = 'Inter, sans-serif';

// ─── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setDate();
  if (apiKey) document.getElementById('apiKeyInput').value = '•'.repeat(20);
  await loadTransactionsFromDB();
  navigateTo('dashboard');
});

async function loadTransactionsFromDB() {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error loading transactions:', error);
    showToast('Failed to load data from database.');
    return;
  }
  transactions = data || [];
}

function setDate() {
  const d = new Date();
  document.getElementById('topbarDate').textContent =
    d.toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── NAVIGATION ───────────────────────────────────────────
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

  const titles = { dashboard: 'Dashboard', transactions: 'Transactions', analytics: 'Analytics', ai: 'AI Insights' };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  if (page === 'dashboard') renderDashboard();
  if (page === 'transactions') renderTransactions();
  if (page === 'analytics') renderAnalytics();

}

// Removed local saveTxns -- handled by Supabase

// ─── DASHBOARD ────────────────────────────────────────────
function renderDashboard() {
  const now = new Date();
  const month = now.getMonth(), year = now.getFullYear();

  // Change logic to calculate all-time totals instead of just this month
  // to prevent confusion where charts show more history than the stat cards
  const income = transactions.filter(t => t.type === 'Income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + Number(t.amount), 0);
  const invest = transactions.filter(t => t.type === 'Investment').reduce((s, t) => s + Number(t.amount), 0);
  const savings = income - expense;

  document.getElementById('statIncome').textContent = fmt(income);
  document.getElementById('statExpense').textContent = fmt(expense);
  document.getElementById('statSavings').textContent = fmt(savings);

  const storedScore = localStorage.getItem('ss_score');
  if (storedScore) {
    document.getElementById('statScore').textContent = storedScore + '/10';
  }

  // Recent transactions (last 5)
  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const tbody = document.getElementById('recentTbody');
  const empty = document.getElementById('recentEmpty');

  if (recent.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = recent.map(t => txRow(t, false)).join('');
  }

  renderDonut(transactions);
  renderBar();
}

function renderDonut(txnsToChart) {
  const expense = txnsToChart.filter(t => t.type === 'Expense');
  const grouped = {};
  expense.forEach(t => { grouped[t.category] = (grouped[t.category] || 0) + t.amount; });

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);
  const total = data.reduce((s, v) => s + v, 0);

  document.getElementById('donutTotal').textContent = fmt(total);

  const bgColors = labels.map(l => (CAT_COLORS[l] || CAT_COLORS.Other).bg);
  const borderColors = labels.map(l => (CAT_COLORS[l] || CAT_COLORS.Other).border);

  const legend = document.getElementById('donutLegend');
  legend.innerHTML = labels.map((l, i) =>
    `<div class="legend-item">
      <div class="legend-dot" style="background:${borderColors[i]}"></div>
      <span>${l}</span>
    </div>`).join('');

  const ctx = document.getElementById('donutChart').getContext('2d');
  if (donutChart) donutChart.destroy();

  if (labels.length === 0) {
    donutChart = null;
    ctx.clearRect(0, 0, 300, 300);
    return;
  }

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: bgColors, borderColor: borderColors, borderWidth: 2, hoverOffset: 6 }],
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: { display: false }, tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)} (${((ctx.raw / total) * 100).toFixed(1)}%)`
          }
        }
      },
    },
  });
}

function renderBar() {
  const months = getLast6Months();
  const incomeData = months.map(m => sumByMonth(m, 'Income'));
  const expenseData = months.map(m => sumByMonth(m, 'Expense'));

  const ctx = document.getElementById('barChart').getContext('2d');
  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Income', data: incomeData, backgroundColor: 'rgba(16,185,129,0.6)', borderRadius: 6 },
        { label: 'Expense', data: expenseData, backgroundColor: 'rgba(239,68,68,0.6)', borderRadius: 6 },
      ],
    },
    options: {
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => fmtShort(v) } },
      },
    },
  });
}

// ─── TRANSACTIONS TABLE ───────────────────────────────────
function renderTransactions() {
  const search = (document.getElementById('txSearch')?.value || '').toLowerCase();
  const catF = document.getElementById('txCatFilter')?.value || '';
  const typeF = document.getElementById('txTypeFilter')?.value || '';

  let filtered = transactions.filter(t => {
    const matchSearch = t.description.toLowerCase().includes(search) ||
      t.category.toLowerCase().includes(search);
    const matchCat = !catF || t.category === catF;
    const matchType = !typeF || t.type === typeF;
    return matchSearch && matchCat && matchType;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const tbody = document.getElementById('txTbody');
  const empty = document.getElementById('txEmpty');

  if (paginated.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = paginated.map(t => txRow(t, true)).join('');
  }

  renderPagination(totalPages);
}

function txRow(t, actions) {
  const amtClass = t.type === 'Income' ? 'amount-pos' : 'amount-neg';
  const amtSign = t.type === 'Income' ? '+' : '-';
  const catKey = t.category.toLowerCase().replace(/\s/g, '');

  return `<tr>
    <td>${fmtDate(t.date)}</td>
    <td>
      <div style="font-weight:500">${esc(t.description)}</div>
      ${t.notes ? `<div style="font-size:0.75rem;color:var(--text-muted)">${esc(t.notes)}</div>` : ''}
    </td>
    <td><span class="cat-badge cat-${catKey}">${esc(t.category)}</span></td>
    <td class="${amtClass}">${amtSign}${fmt(t.amount)}</td>
    <td><span class="type-badge type-${t.type.toLowerCase()}">${t.type}</span></td>
    ${actions ? `<td>
      <button class="action-btn" onclick="openEditModal('${t.id}')" title="Edit">✏️</button>
      <button class="action-btn del" onclick="openDeleteModal('${t.id}')" title="Delete">🗑️</button>
    </td>` : ''}
  </tr>`;
}

function renderPagination(totalPages) {
  const pg = document.getElementById('pagination');
  if (totalPages <= 1) { pg.innerHTML = ''; return; }

  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  pg.innerHTML = html;
}

function goPage(n) { currentPage = n; renderTransactions(); }

// ─── ANALYTICS ────────────────────────────────────────────
function renderAnalytics() {
  const months = getLast6Months();

  // Line chart
  const incomeData = months.map(m => sumByMonth(m, 'Income'));
  const expenseData = months.map(m => sumByMonth(m, 'Expense'));

  const lCtx = document.getElementById('lineChart').getContext('2d');
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(lCtx, {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Income', data: incomeData,
          borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)',
          tension: 0.4, fill: true, pointBackgroundColor: '#10b981',
        },
        {
          label: 'Expenses', data: expenseData,
          borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)',
          tension: 0.4, fill: true, pointBackgroundColor: '#ef4444',
        },
      ],
    },
    options: {
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => fmtShort(v) } },
      },
    },
  });

  // Category bar
  const cats = Object.keys(CAT_COLORS);
  const catData = cats.map(c =>
    transactions.filter(t => t.category === c && t.type === 'Expense').reduce((s, t) => s + t.amount, 0)
  );

  const cbCtx = document.getElementById('catBarChart').getContext('2d');
  if (catBarChart) catBarChart.destroy();
  catBarChart = new Chart(cbCtx, {
    type: 'bar',
    data: {
      labels: cats,
      datasets: [{
        label: 'Total Spent',
        data: catData,
        backgroundColor: cats.map(c => (CAT_COLORS[c] || CAT_COLORS.Other).bg),
        borderColor: cats.map(c => (CAT_COLORS[c] || CAT_COLORS.Other).border),
        borderWidth: 1.5, borderRadius: 6,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => fmtShort(v) } },
      },
    },
  });

  // Horizontal bar — top categories
  const sorted = cats.map((c, i) => ({ cat: c, val: catData[i] }))
    .filter(x => x.val > 0)
    .sort((a, b) => b.val - a.val)
    .slice(0, 6);

  const hCtx = document.getElementById('hbarChart').getContext('2d');
  if (hbarChart) hbarChart.destroy();
  hbarChart = new Chart(hCtx, {
    type: 'bar',
    data: {
      labels: sorted.map(s => s.cat),
      datasets: [{
        label: 'Amount',
        data: sorted.map(s => s.val),
        backgroundColor: sorted.map(s => (CAT_COLORS[s.cat] || CAT_COLORS.Other).bg),
        borderColor: sorted.map(s => (CAT_COLORS[s.cat] || CAT_COLORS.Other).border),
        borderWidth: 1.5, borderRadius: 6,
      }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => fmtShort(v) } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });
}

// ─── ADD / EDIT MODAL ─────────────────────────────────────
function openAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add Transaction';
  document.getElementById('modalSubmitBtn').textContent = 'Save Transaction';
  document.getElementById('txForm').reset();
  document.getElementById('fDate').value = new Date().toISOString().split('T')[0];
  openOverlay('modalOverlay');
}

function openEditModal(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'Edit Transaction';
  document.getElementById('modalSubmitBtn').textContent = 'Update Transaction';
  document.getElementById('fDesc').value = t.description;
  document.getElementById('fAmount').value = t.amount;
  document.getElementById('fDate').value = t.date;
  document.getElementById('fCat').value = t.category;
  document.getElementById('fType').value = t.type;
  document.getElementById('fNotes').value = t.notes || '';
  openOverlay('modalOverlay');
}

async function saveTransaction(e) {
  e.preventDefault();
  const txData = {
    description: document.getElementById('fDesc').value.trim(),
    amount: parseFloat(document.getElementById('fAmount').value),
    date: document.getElementById('fDate').value,
    category: document.getElementById('fCat').value,
    type: document.getElementById('fType').value,
    notes: document.getElementById('fNotes').value.trim(),
  };

  const btn = document.getElementById('modalSubmitBtn');
  const ogText = btn.textContent;
  btn.textContent = 'Saving...';
  btn.disabled = true;

  if (editingId) {
    const { error } = await supabase.from('transactions').update(txData).eq('id', editingId);
    if (error) { console.error(error); showToast('Error updating'); }
  } else {
    const { error } = await supabase.from('transactions').insert([txData]);
    if (error) { console.error(error); showToast('Error saving'); }
  }

  await loadTransactionsFromDB();
  btn.textContent = ogText;
  btn.disabled = false;

  closeModal();
  renderTransactions();
  renderDashboard();
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay')) return;
  closeOverlay('modalOverlay');
  editingId = null;
}

// ─── DELETE MODAL ─────────────────────────────────────────
function openDeleteModal(id) { deleteId = id; openOverlay('deleteOverlay'); }
function closeDeleteModal(e) {
  if (e && e.target !== document.getElementById('deleteOverlay')) return;
  closeOverlay('deleteOverlay');
  deleteId = null;
}
async function confirmDelete() {
  if (!deleteId) return;
  const { error } = await supabase.from('transactions').delete().eq('id', deleteId);
  if (error) {
    console.error(error);
    showToast('Error deleting transaction.');
  } else {
    await loadTransactionsFromDB();
    closeDeleteModal();
    renderTransactions();
    renderDashboard();
  }
}

// ─── OVERLAY HELPERS ──────────────────────────────────────
function openOverlay(id) { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

// ─── AI KEY ───────────────────────────────────────────────
function saveApiKey() {
  const val = document.getElementById('apiKeyInput').value.trim();
  if (!val || val.startsWith('•')) return;
  apiKey = val;
  localStorage.setItem('ss_apikey', apiKey);
  document.getElementById('apiKeyInput').value = '•'.repeat(20);
  showToast('API key saved!');
}

function loadApiKeyDisplay() {
  if (apiKey) document.getElementById('apiKeyInput').value = '•'.repeat(20);
}

// ─── AI ANALYSIS ──────────────────────────────────────────
async function runAIAnalysis() {
  if (!apiKey) {
    showError('Please enter and save your OpenRouter API key first.');
    return;
  }
  if (transactions.length === 0) {
    showError('Please add some transactions first before analyzing.');
    return;
  }

  document.getElementById('aiResults').style.display = 'none';
  document.getElementById('aiError').style.display = 'none';
  document.getElementById('aiLoading').style.display = 'block';
  document.getElementById('analyzeBtn').disabled = true;

  const summary = buildAISummary();

  const prompt = `You are a personal finance AI advisor. Analyze the following expense and income data and return a JSON response only (no markdown, no extra text).

Financial Data:
${summary}

Return this exact JSON structure:
{
  "overallScore": <number 1-10>,
  "scoreLabel": "<Excellent|Good|Needs Work|Poor>",
  "scoreSummary": "<2-3 sentence overall assessment>",
  "categoryRatings": [
    { "category": "<name>", "emoji": "<emoji>", "rating": "<Excellent|Good|Needs Work|Poor>", "comment": "<one sentence>" }
  ],
  "investmentRating": "<Excellent|Good|Needs Work|Poor>",
  "investmentComment": "<1-2 sentences about investment habits>",
  "tips": [
    { "title": "<short tip title>", "body": "<2-3 sentence advice>" }
  ]
}

Rules:
- Only include categories that actually appear in the data
- Provide exactly 3 tips
- Be specific based on actual amounts
- The scoreSummary should reference actual spending patterns`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://spendsense.ai',
        'X-Title': 'SpendSense AI',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    let raw = data.choices?.[0]?.message?.content || '';

    // Strip markdown if present
    raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const result = JSON.parse(raw);
    renderAIResults(result);

  } catch (err) {
    document.getElementById('aiLoading').style.display = 'none';
    document.getElementById('aiError').style.display = 'block';
    document.getElementById('aiErrorMsg').textContent = `Error: ${err.message}. Please check your API key and try again.`;
  }

  document.getElementById('analyzeBtn').disabled = false;
}

function buildAISummary() {
  const totalIncome = transactions.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
  const totalInvest = transactions.filter(t => t.type === 'Investment').reduce((s, t) => s + t.amount, 0);

  const catBreakdown = {};
  transactions.filter(t => t.type === 'Expense').forEach(t => {
    catBreakdown[t.category] = (catBreakdown[t.category] || 0) + t.amount;
  });

  const lines = [
    `Total Income:    ₨${totalIncome.toLocaleString()}`,
    `Total Expenses:  ₨${totalExpense.toLocaleString()}`,
    `Total Invested:  ₨${totalInvest.toLocaleString()}`,
    `Net Savings:     ₨${(totalIncome - totalExpense).toLocaleString()}`,
    `Savings Rate:    ${totalIncome > 0 ? (((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1) : 0}%`,
    `Investment Rate: ${totalIncome > 0 ? ((totalInvest / totalIncome) * 100).toFixed(1) : 0}%`,
    '',
    'Expense Breakdown by Category:',
    ...Object.entries(catBreakdown).map(([k, v]) => `  ${k}: ₨${v.toLocaleString()}`),
  ];
  return lines.join('\n');
}

function renderAIResults(r) {
  document.getElementById('aiLoading').style.display = 'none';
  document.getElementById('aiResults').style.display = 'block';

  // Score ring
  const score = Math.max(0, Math.min(10, r.overallScore || 0));
  const pct = score / 10;
  const circumference = 2 * Math.PI * 52;
  document.getElementById('scoreRing').style.strokeDashoffset = circumference * (1 - pct);
  document.getElementById('scoreNum').textContent = score.toFixed(1);
  document.getElementById('scoreTitle').textContent = 'Overall Spending Score';

  const label = r.scoreLabel || 'Good';
  document.getElementById('scoreBadge').textContent = label;
  document.getElementById('scoreBadge').className = `score-badge ${badgeClass(label)}`;
  document.getElementById('scoreSummary').textContent = r.scoreSummary || '';

  localStorage.setItem('ss_score', score.toFixed(1));

  // Category ratings
  const ratings = document.getElementById('categoryRatings');
  ratings.innerHTML = (r.categoryRatings || []).map(c => `
    <div class="rating-card">
      <div class="rating-emoji">${c.emoji || '📂'}</div>
      <div class="rating-cat">${esc(c.category)}</div>
      <span class="score-badge ${badgeClass(c.rating)}" style="font-size:0.75rem;padding:2px 10px">${esc(c.rating)}</span>
      <div class="rating-comment" style="margin-top:6px">${esc(c.comment)}</div>
    </div>
  `).join('');

  // Investment
  const iBadge = r.investmentRating || 'Good';
  document.getElementById('investText').textContent = r.investmentComment || '';
  document.getElementById('investBadge').textContent = iBadge;
  document.getElementById('investBadge').className = `invest-badge score-badge ${badgeClass(iBadge)}`;

  // Tips
  document.getElementById('tipsGrid').innerHTML = (r.tips || []).map((tip, i) => `
    <div class="tip-card">
      <div class="tip-num">Tip ${i + 1}</div>
      <div class="tip-title">💡 ${esc(tip.title)}</div>
      <div class="tip-body">${esc(tip.body)}</div>
    </div>
  `).join('');
}

function badgeClass(label) {
  const map = { Excellent: 'badge-excellent', Good: 'badge-good', 'Needs Work': 'badge-needswork', Poor: 'badge-poor' };
  return map[label] || 'badge-good';
}

function showError(msg) {
  document.getElementById('aiError').style.display = 'block';
  document.getElementById('aiErrorMsg').textContent = msg;
}

// ─── HELPERS ──────────────────────────────────────────────
function fmt(n) { return '₨' + Math.abs(n).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmtShort(n) {
  if (n >= 1000000) return '₨' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '₨' + (n / 1000).toFixed(0) + 'K';
  return '₨' + n;
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function getLast6Months() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(), month: d.getMonth(),
      label: d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' }),
    });
  }
  return months;
}
function sumByMonth(m, type) {
  return transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === type && d.getMonth() === m.month && d.getFullYear() === m.year;
    })
    .reduce((s, t) => s + t.amount, 0);
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', bottom: '24px', right: '24px',
    background: '#10b981', color: '#fff', padding: '10px 20px',
    borderRadius: '10px', fontSize: '0.88rem', fontWeight: '600',
    zIndex: '9999', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    animation: 'fadeIn 0.2s ease',
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
