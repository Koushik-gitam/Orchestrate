// Buy or Wait - Frontend JavaScript

class BuyOrWaitApp {
  constructor() {
    this.currentPage = 'dashboard';
    this.requests = [];
    this.analysis = [];
    this.stats = null;
    this.charts = {};
    this.sortConfig = { key: null, direction: 'asc' };
    this.filterConfig = { status: 'all', method: 'all', search: '' };
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.loadData();
    this.setupCharts();
  }
  
  // Event Listeners
  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        this.navigateTo(page);
      });
    });
    
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.loadData();
      this.showToast('Data refreshed successfully', 'success');
    });
    
    // Search and filters
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.filterConfig.search = e.target.value;
      this.renderRequestsTable();
    });
    
    document.getElementById('filterStatus').addEventListener('change', (e) => {
      this.filterConfig.status = e.target.value;
      this.renderRequestsTable();
    });
    
    document.getElementById('filterMethod').addEventListener('change', (e) => {
      this.filterConfig.method = e.target.value;
      this.renderRequestsTable();
    });
    
    document.getElementById('analysisSearch').addEventListener('input', (e) => {
      this.renderAnalysis(e.target.value);
    });
    
    // Download button
    document.getElementById('downloadBtn').addEventListener('click', () => {
      this.downloadCSV();
    });
    
    // Modal controls
    document.getElementById('modalClose').addEventListener('click', () => {
      this.closeModal();
    });
    
    document.getElementById('detailModal').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeModal();
      }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
    
    // Nav toggle for mobile
    document.getElementById('navToggle').addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('open');
    });
  }
  
  // Navigation
  navigateTo(page) {
    this.currentPage = page;
    
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Update pages
    document.querySelectorAll('.page').forEach(pageEl => {
      pageEl.classList.toggle('active', pageEl.id === `page-${page}`);
    });
    
    // Refresh data on page change
    if (this.requests.length > 0) {
      this.renderCurrentPage();
    }
  }
  
  renderCurrentPage() {
    switch (this.currentPage) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'requests':
        this.renderRequestsTable();
        break;
      case 'analysis':
        this.renderAnalysis('');
        break;
      case 'export':
        this.renderExportPreview();
        break;
    }
  }
  
  // Data Loading
  async loadData() {
    try {
      // Wait a moment for server to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to load from API
      const response = await fetch('/api/load-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Wait for data to be processed
        await new Promise(resolve => setTimeout(resolve, 300));
        this.fetchRequests();
        this.fetchStats();
        this.updateStatus('online', 'Connected');
        this.showToast('Data loaded successfully', 'success');
      } else {
        throw new Error('Failed to load data');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Load from API directly
      await new Promise(resolve => setTimeout(resolve, 300));
      this.fetchRequests();
      this.fetchStats();
      this.updateStatus('online', 'Using API');
    }
  }
  
  async fetchRequests() {
    try {
      const response = await fetch('/api/requests');
      const data = await response.json();
      this.requests = data.requests || [];
      this.analysis = data.analysis || [];
      document.getElementById('requestCount').textContent = this.requests.length;
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  }
  
  async fetchStats() {
    try {
      const response = await fetch('/api/dashboard');
      const data = await response.json();
      this.stats = data.stats;
      this.userBreakdown = data.userBreakdown;
      this.currencyStats = data.currencyStats;
      this.currencies = data.currencies;
      this.renderDashboard();
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }
  
  updateStatus(status, text) {
    const dot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    dot.className = `status-dot ${status}`;
    statusText.textContent = text;
  }
  
  // Toast Notifications
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconHtml = {
      success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    
    toast.innerHTML = `
      ${iconHtml[type]}
      <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }
  
  // Dashboard Rendering
  renderDashboard() {
    if (!this.stats) return;
    
    const statsGrid = document.getElementById('statsGrid');
    
    const statCards = [
      {
        title: 'Total Requests',
        value: this.stats.totalRequests,
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        iconClass: 'primary',
        cardClass: 'primary-bg'
      },
      {
        title: 'Affordable Now',
        value: this.stats.affordableNow,
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
        iconClass: 'success',
        cardClass: 'affordable',
        trend: `+${this.stats.affordableNow * 100 / this.stats.totalRequests || 0}% of total`
      },
      {
        title: 'With Plan',
        value: this.stats.affordableWithPlan,
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
        iconClass: 'warning',
        cardClass: 'with-plan',
        trend: 'Requires planning'
      },
      {
        title: 'Affordable Later',
        value: this.stats.affordableLater,
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
        iconClass: 'info',
        cardClass: 'later',
        trend: 'Can wait'
      },
      {
        title: 'Not Affordable',
        value: this.stats.notAffordable,
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        iconClass: 'danger',
        cardClass: 'not-affordable',
        trend: 'Needs review'
      },
      {
        title: 'Total Safe Amount',
        value: `$${this.formatNumber(this.stats.totalAmountSafe)}`,
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
        iconClass: 'primary',
        cardClass: 'full',
        trend: `Avg: $${this.formatNumber(this.stats.avgSafeAmount)}`
      }
    ];
    
    statsGrid.innerHTML = statCards.map(card => `
      <div class="stat-card ${card.cardClass}">
        <div class="stat-icon ${card.iconClass}">
          ${card.icon}
        </div>
        <div class="stat-value">${card.value}</div>
        <div class="stat-label">${card.title}</div>
        ${card.trend ? `<div class="stat-trend" style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">${card.trend}</div>` : ''}
      </div>
    `).join('');
    
    // Update charts
    this.updateCharts();
  }
  
  // Charts Setup
  setupCharts() {
    // These will be initialized when data is available
  }
  
  updateCharts() {
    if (!this.stats || !this.charts.affordability) {
      this.initCharts();
      return;
    }
    
    // Update affordability chart
    this.charts.affordability.data.datasets[0].data = [
      this.stats.affordableNow,
      this.stats.affordableWithPlan,
      this.stats.affordableLater,
      this.stats.notAffordable
    ];
    this.charts.affordability.update();
    
    // Update payment method chart
    this.charts.paymentMethod.data.datasets[0].data = [
      this.stats.fullPayment,
      this.stats.partialPayment,
      this.stats.installments,
      this.stats.wait,
      this.stats.notRecommended
    ];
    this.charts.paymentMethod.update();
    
    // Update currency chart
    const currencyData = this.currencies.map(curr => ({
      label: curr,
      value: this.currencyStats[curr]?.totalSafe || 0
    }));
    
    this.charts.currency.data.labels = currencyData.map(d => d.label);
    this.charts.currency.data.datasets[0].data = currencyData.map(d => d.value);
    this.charts.currency.update();
    
    // Update user chart
    const userData = Object.entries(this.userBreakdown || {}).map(([userId, data]) => ({
      label: userId,
      affordableNow: data.affordableNow,
      affordableWithPlan: data.affordableWithPlan,
      affordableLater: data.affordableLater,
      notAffordable: data.notAffordable
    }));
    
    this.charts.user.data.datasets[0].data = userData.map(d => d.affordableNow);
    this.charts.user.data.datasets[1].data = userData.map(d => d.affordableWithPlan);
    this.charts.user.data.datasets[2].data = userData.map(d => d.affordableLater);
    this.charts.user.data.datasets[3].data = userData.map(d => d.notAffordable);
    this.charts.user.data.labels = userData.map(d => d.label);
    this.charts.user.update();
  }
  
  initCharts() {
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#cbd5e1',
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(100, 116, 139, 0.2)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const value = context.parsed;
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${context.label}: ${value} (${percentage}%)`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        duration: 1000
      }
    };
    
    // Destroy existing charts
    Object.values(this.charts).forEach(chart => {
      if (chart) chart.destroy();
    });
    
    const colors = {
      affordableNow: '#10b981',
      affordableWithPlan: '#f59e0b',
      affordableLater: '#3b82f6',
      notAffordable: '#ef4444',
      fullPayment: '#10b981',
      partialPayment: '#6366f1',
      installments: '#3b82f6',
      wait: '#f59e0b',
      notRecommended: '#ef4444'
    };
    
    // Affordability Donut Chart
    const ctx1 = document.getElementById('affordabilityChart').getContext('2d');
    this.charts.affordability = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: ['Affordable Now', 'With Plan', 'Affordable Later', 'Not Affordable'],
        datasets: [{
          data: [this.stats?.affordableNow || 0, this.stats?.affordableWithPlan || 0, 
                 this.stats?.affordableLater || 0, this.stats?.notAffordable || 0],
          backgroundColor: [
            colors.affordableNow,
            colors.affordableWithPlan,
            colors.affordableLater,
            colors.notAffordable
          ],
          borderColor: '#1e293b',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        ...chartOptions,
        cutout: '65%',
        plugins: {
          ...chartOptions.plugins,
          legend: {
            ...chartOptions.plugins.legend,
            labels: {
              ...chartOptions.plugins.legend.labels,
              padding: 20
            }
          }
        }
      }
    });
    
    // Payment Method Bar Chart
    const ctx2 = document.getElementById('paymentMethodChart').getContext('2d');
    this.charts.paymentMethod = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: ['Full Payment', 'Partial', 'Installments', 'Wait', 'Not Recommended'],
        datasets: [{
          data: [this.stats?.fullPayment || 0, this.stats?.partialPayment || 0,
                 this.stats?.installments || 0, this.stats?.wait || 0, this.stats?.notRecommended || 0],
          backgroundColor: [
            colors.fullPayment,
            colors.partialPayment,
            colors.installments,
            colors.wait,
            colors.notRecommended
          ],
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 40
        }]
      },
      options: {
        ...chartOptions,
        plugins: {
          ...chartOptions.plugins,
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#94a3b8',
              stepSize: 1
            },
            grid: {
              color: 'rgba(100, 116, 139, 0.1)'
            }
          },
          x: {
            ticks: {
              color: '#cbd5e1'
            },
            grid: { display: false }
          }
        }
      }
    });
    
    // Currency Chart
    const ctx3 = document.getElementById('currencyChart').getContext('2d');
    this.charts.currency = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: this.currencies || [],
        datasets: [{
          data: this.currencies.map(curr => this.currencyStats[curr]?.totalSafe || 0),
          backgroundColor: '#6366f1',
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 40
        }]
      },
      options: {
        ...chartOptions,
        plugins: {
          ...chartOptions.plugins,
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#94a3b8',
              callback: (value) => this.formatNumber(value)
            },
            grid: {
              color: 'rgba(100, 116, 139, 0.1)'
            }
          },
          x: {
            ticks: {
              color: '#cbd5e1'
            },
            grid: { display: false }
          }
        }
      }
    });
    
    // User Chart
    const ctx4 = document.getElementById('userChart').getContext('2d');
    this.charts.user = new Chart(ctx4, {
      type: 'bar',
      data: {
        labels: Object.keys(this.userBreakdown || {}),
        datasets: [
          {
            label: 'Affordable Now',
            data: [],
            backgroundColor: colors.affordableNow,
            borderRadius: 3
          },
          {
            label: 'With Plan',
            data: [],
            backgroundColor: colors.affordableWithPlan,
            borderRadius: 3
          },
          {
            label: 'Later',
            data: [],
            backgroundColor: colors.affordableLater,
            borderRadius: 3
          },
          {
            label: 'Not Affordable',
            data: [],
            backgroundColor: colors.notAffordable,
            borderRadius: 3
          }
        ]
      },
      options: {
        ...chartOptions,
        indexAxis: 'y',
        plugins: {
          ...chartOptions.plugins,
          legend: {
            ...chartOptions.plugins.legend,
            position: 'top'
          }
        },
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              color: '#94a3b8',
              stepSize: 1
            },
            grid: {
              color: 'rgba(100, 116, 139, 0.1)'
            }
          },
          y: {
            stacked: true,
            ticks: {
              color: '#cbd5e1'
            },
            grid: { display: false }
          }
        }
      }
    });
  }
  
  // Requests Table
  renderRequestsTable() {
    const tbody = document.getElementById('requestsTableBody');
    
    let filteredRequests = this.requests;
    let filteredAnalysis = this.analysis;
    
    // Apply filters
    if (this.filterConfig.status !== 'all') {
      filteredRequests = filteredRequests.filter((r, i) => 
        filteredAnalysis[i]?.affordability_status === this.filterConfig.status
      );
      filteredAnalysis = filteredAnalysis.filter(a => 
        a.affordability_status === this.filterConfig.status
      );
    }
    
    if (this.filterConfig.method !== 'all') {
      filteredRequests = filteredRequests.filter((r, i) => 
        filteredAnalysis[i]?.recommended_payment_method === this.filterConfig.method
      );
      filteredAnalysis = filteredAnalysis.filter(a => 
        a.recommended_payment_method === this.filterConfig.method
      );
    }
    
    if (this.filterConfig.search) {
      const search = this.filterConfig.search.toLowerCase();
      filteredRequests = filteredRequests.filter((r, i) => 
        r.request_id.toLowerCase().includes(search) ||
        r.item?.toLowerCase().includes(search) ||
        r.user_id.toLowerCase().includes(search) ||
        r.category?.toLowerCase().includes(search)
      );
      // Re-align analysis
      filteredAnalysis = filteredAnalysis.filter((a, i) => 
        i < filteredRequests.length
      );
    }
    
    if (filteredRequests.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <h3>No requests found</h3>
              <p>Try adjusting your search or filters</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = filteredRequests.map((request, idx) => {
      const analysis = filteredAnalysis[idx] || {};
      const isSorted = this.sortConfig.key === `request-${idx}`;
      
      return `
        <tr class="${isSorted ? 'sorted-row' : ''}" data-index="${idx}">
          <td>
            <span class="request-id" style="font-family: monospace; font-weight: 600;">${request.request_id}</span>
          </td>
          <td>${request.user_id}</td>
          <td>
            <div class="item-cell">
              <span class="item-name">${request.item || 'N/A'}</span>
              ${request.category ? `<span class="category-badge">${request.category}</span>` : ''}
            </div>
          </td>
          <td>
            <div class="amount-cell">
              <span class="amount-value">${this.formatNumber(request.amount)}</span>
              <span class="currency-label">${request.currency || 'USD'}</span>
            </div>
          </td>
          <td>
            <span class="status-badge ${analysis.affordability_status || 'not_affordable'}">
              ${this.formatStatus(analysis.affordability_status)}
            </span>
          </td>
          <td>
            <span class="method-badge ${analysis.recommended_payment_method || 'not_recommended'}">
              ${this.formatMethod(analysis.recommended_payment_method)}
            </span>
          </td>
          <td>
            <div class="safe-amount">
              <span class="safe-value" style="color: var(--primary); font-weight: 600;">
                ${this.formatNumber(analysis.amount_safe_to_pay || 0)}
              </span>
              <span class="safe-label">safe to pay</span>
            </div>
          </td>
          <td>
            <button class="action-btn" onclick="app.showDetail('${request.request_id}')">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
  
  formatStatus(status) {
    const labels = {
      affordable_now: 'Affordable Now',
      affordable_with_plan: 'With Plan',
      affordable_later: 'Later',
      not_affordable: 'Not Affordable'
    };
    return labels[status] || status;
  }
  
  formatMethod(method) {
    const labels = {
      full_payment: 'Full Payment',
      partial_payment: 'Partial',
      installments: 'Installments',
      wait: 'Wait',
      not_recommended: 'Not Recommended'
    };
    return labels[method] || method;
  }
  
  // Analysis Page
  renderAnalysis(searchTerm = '') {
    const container = document.getElementById('analysisContainer');
    
    let analysisList = this.analysis;
    let requestsList = this.requests;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const indices = [];
      
      requestsList.forEach((r, i) => {
        if (r.request_id.toLowerCase().includes(term)) {
          indices.push(i);
        }
      });
      
      analysisList = indices.map(i => this.analysis[i]);
      requestsList = indices.map(i => this.requests[i]);
    }
    
    if (analysisList.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          <h3>No analysis to show</h3>
          <p>Analysis will appear here once data is loaded</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = analysisList.map((analysis, idx) => {
      const request = requestsList[idx] || {};
      
      return `
        <div class="analysis-card" id="analysis-${analysis.request_id}">
          <div class="analysis-card-header" onclick="app.toggleAnalysis('${analysis.request_id}')">
            <div class="analysis-card-title">
              <svg class="analysis-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              <h3>${request.request_id} - ${request.item || 'Unknown Item'}</h3>
            </div>
            <div class="analysis-card-meta">
              <span class="status-badge ${analysis.affordability_status}">
                ${this.formatStatus(analysis.affordability_status)}
              </span>
              <span class="method-badge ${analysis.recommended_payment_method}">
                ${this.formatMethod(analysis.recommended_payment_method)}
              </span>
              <span class="chevron">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
            </div>
          </div>
          <div class="analysis-card-body">
            <div class="analysis-metrics">
              <div class="analysis-metric">
                <span class="analysis-metric-label">Requested Amount</span>
                <span class="analysis-metric-value">${this.formatNumber(request.amount)}</span>
              </div>
              <div class="analysis-metric">
                <span class="analysis-metric-label">Safe to Pay</span>
                <span class="analysis-metric-value highlight">${this.formatNumber(analysis.amount_safe_to_pay)}</span>
              </div>
              <div class="analysis-metric">
                <span class="analysis-metric-label">Payment Plan</span>
                <span class="analysis-metric-value" style="font-size: 0.85rem; word-break: break-all;">${analysis.payment_plan || 'none'}</span>
              </div>
              <div class="analysis-metric">
                <span class="analysis-metric-label">Earliest Full Payment</span>
                <span class="analysis-metric-value">${analysis.earliest_date_for_full_payment || 'N/A'}</span>
              </div>
              ${analysis.spending_changes_needed && analysis.spending_changes_needed !== 'none' ? `
                <div class="analysis-metric">
                  <span class="analysis-metric-label">Spending Changes</span>
                  <span class="analysis-metric-value" style="font-size: 0.85rem;">${analysis.spending_changes_needed}</span>
                </div>
              ` : ''}
            </div>
            
            <div class="analysis-explanation">
              <strong>Decision Reasoning:</strong>
              <p>${analysis.decision_explanation}</p>
            </div>
            
            ${analysis.payment_plan && analysis.payment_plan !== 'none' ? `
              <div class="analysis-plan">
                <span class="plan-label">Payment Schedule:</span>
                ${analysis.payment_plan.split('|').map(step => {
                  const [date, amount] = step.split(':');
                  return `
                    <div class="plan-step">
                      <span class="plan-step-date">${date}</span>
                      <span class="plan-step-amount">${this.formatNumber(parseFloat(amount))}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }
  
  toggleAnalysis(requestId) {
    const card = document.getElementById(`analysis-${requestId}`);
    if (card) {
      card.classList.toggle('expanded');
      
      const chevron = card.querySelector('.analysis-chevron');
      if (chevron) {
        chevron.style.transform = card.classList.contains('expanded') ? 'rotate(90deg)' : 'rotate(0deg)';
      }
    }
  }
  
  // Modal
  showDetail(requestId) {
    const request = this.requests.find(r => r.request_id === requestId);
    const analysis = this.analysis.find(a => a.request_id === requestId);
    const profile = this.getProfileForRequest(request);
    
    if (!request || !analysis) {
      this.showToast('Request not found', 'error');
      return;
    }
    
    document.getElementById('modalTitle').textContent = `${requestId} - ${request.item || 'Unknown'}`;
    
    document.getElementById('modalBody').innerHTML = `
      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-item-label">User</div>
          <div class="stat-item-value">${request.user_id}</div>
        </div>
        <div class="stat-item">
          <div class="stat-item-label">Category</div>
          <div class="stat-item-value">${request.category || 'N/A'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-item-label">Desired Completion</div>
          <div class="stat-item-value">${request.desired_completion_date || 'N/A'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-item-label">Currency</div>
          <div class="stat-item-value">${request.currency || profile?.home_currency || 'USD'}</div>
        </div>
      </div>
      
      <div class="stat-item" style="background: var(--bg-secondary); padding: 1rem; border-radius: 10px; margin-bottom: 1rem;">
        <div class="stat-item-label">Affordability Status</div>
        <span class="status-badge ${analysis.affordability_status}" style="font-size: 1rem; padding: 0.5rem 1rem;">
          ${this.formatStatus(analysis.affordability_status)}
        </span>
      </div>
      
      <div class="stat-item" style="background: var(--bg-secondary); padding: 1rem; border-radius: 10px; margin-bottom: 1rem;">
        <div class="stat-item-label">Recommended Method</div>
        <span class="method-badge ${analysis.recommended_payment_method}" style="font-size: 1rem; padding: 0.5rem 1rem;">
          ${this.formatMethod(analysis.recommended_payment_method)}
        </span>
      </div>
      
      ${profile ? `
        <div class="stat-grid" style="margin-bottom: 1.5rem;">
          <div class="stat-item">
            <div class="stat-item-label">Current Balance</div>
            <div class="stat-item-value">${this.formatNumber(parseFloat(profile.balance))}</div>
          </div>
          <div class="stat-item">
            <div class="stat-item-label">Minimum Balance</div>
            <div class="stat-item-value">${this.formatNumber(parseFloat(profile.minimum_balance))}</div>
          </div>
        </div>
      ` : ''}
      
      <div class="stat-item" style="background: var(--bg-secondary); padding: 1rem; border-radius: 10px;">
        <div class="stat-item-label">Amount Safe to Pay</div>
        <div class="stat-item-value highlight" style="color: var(--primary);">
          ${this.formatNumber(analysis.amount_safe_to_pay)}
        </div>
      </div>
      
      ${analysis.payment_plan && analysis.payment_plan !== 'none' ? `
        <div style="margin-top: 1.5rem;">
          <div class="stat-item-label" style="margin-bottom: 0.75rem;">Payment Plan</div>
          <div class="analysis-plan">
            ${analysis.payment_plan.split('|').map(step => {
              const [date, amount] = step.split(':');
              return `
                <div class="plan-step">
                  <span class="plan-step-date">${date}</span>
                  <span class="plan-step-amount">${this.formatNumber(parseFloat(amount))}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
      
      <div style="margin-top: 1.5rem;">
        <div class="stat-item-label" style="margin-bottom: 0.75rem;">Decision Explanation</div>
        <div class="analysis-explanation">
          ${analysis.decision_explanation}
        </div>
      </div>
    `;
    
    document.getElementById('detailModal').classList.add('active');
  }
  
  closeModal() {
    document.getElementById('detailModal').classList.remove('active');
  }
  
  getProfileForRequest(request) {
    // This would be fetched from the API in a real scenario
    // For now, we'll get it from the analysis data
    return null;
  }
  
  // Export
  async renderExportPreview() {
    document.getElementById('exportCount').textContent = this.analysis.length || 0;
    
    // Show preview of first 5 rows
    const previewData = this.analysis.slice(0, 5);
    
    document.getElementById('previewTable').innerHTML = `
      <table>
        <thead>
          <tr>
            <th>request_id</th>
            <th>amount_safe_to_pay</th>
            <th>affordability_status</th>
            <th>recommended_payment_method</th>
            <th>payment_plan</th>
            <th>earliest_date</th>
            <th>spending_changes</th>
            <th>explanation</th>
          </tr>
        </thead>
        <tbody>
          ${previewData.map(a => `
            <tr>
              <td><code>${a.request_id}</code></td>
              <td>${a.amount_safe_to_pay}</td>
              <td>${a.affordability_status}</td>
              <td>${a.recommended_payment_method}</td>
              <td style="max-width: 150px;">${a.payment_plan || '-'}</td>
              <td>${a.earliest_date_for_full_payment || '-'}</td>
              <td style="max-width: 100px;">${a.spending_changes_needed || '-'}</td>
              <td style="max-width: 200px; color: var(--text-secondary);">${a.decision_explanation?.substring(0, 50)}...</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
  
  async downloadCSV() {
    try {
      const response = await fetch('/api/export-csv');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'output.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      this.showToast('CSV downloaded successfully', 'success');
    } catch (error) {
      console.error('Error downloading CSV:', error);
      this.showToast('Failed to download CSV', 'error');
    }
  }
  
  // Utilities
  formatNumber(num) {
    if (typeof num !== 'number') {
      num = parseFloat(num) || 0;
    }
    
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    } else if (Number.isInteger(num)) {
      return num.toLocaleString();
    } else {
      return num.toFixed(2);
    }
  }
}

// Initialize app
const app = new BuyOrWaitApp();
