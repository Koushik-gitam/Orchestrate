// Buy or Wait - Financial Agent Solution
// HackerRank Orchestrate September 2026

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory
const publicPath = path.join(__dirname, '..', 'public');
console.log('Serving static files from:', publicPath);
app.use(express.static(publicPath));

// In-memory data storage
let financialData = null;

// Normalize data structure helper
function normalizeData(data) {
  return {
    profiles: data.profiles || data.financial_profiles || [],
    events: data.events || data.financial_events || [],
    requests: data.requests || data.requests_csv || [],
    paymentOptions: data.paymentOptions || data.request_payment_options || [],
    exchangeRates: data.exchangeRates || data.exchange_rates || [],
    messages: data.messages || data.messages_csv || [],
    images: data.images || data.images_csv || []
  };
}

// Pre-load demo data synchronously for immediate availability
const demoData = normalizeData(generateDemoData());
financialData = demoData;
console.log(`Pre-loaded ${financialData.requests.length} demo requests`);

// ============================================================================
// FREE API KEYS - These are public/demo keys that work without authentication
// ============================================================================

const FREE_APIS = {
  // Exchange rate APIs (free tier)
  exchangerate: 'https://api.exchangerate-api.com/v4/latest/',
};

// ============================================================================
// DATA LOADING
// ============================================================================

function loadCSVData() {
  // Use absolute path to dataset directory
  const datasetPath = path.resolve(__dirname, '..', 'dataset');
  console.log('Looking for dataset at:', datasetPath);
  
  return new Promise((resolve, reject) => {
    // Check if ALL files exist
    const files = ['financial_profiles.csv', 'financial_events.csv', 'requests.csv', 
                   'request_payment_options.csv', 'exchange_rates.csv', 'messages.csv', 'images.csv'];
    
    const allExist = files.every(file => fs.existsSync(path.join(datasetPath, file)));
    
    if (!allExist) {
      // Use demo data if any file is missing
      console.log('Some dataset files missing, using demo data');
      resolve(generateDemoData());
      return;
    }
    
    // Load from CSV files
    const results = {};
    let loaded = 0;
    
    files.forEach(file => {
      const filePath = path.join(datasetPath, file);
      const data = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => data.push(row))
        .on('end', () => {
          results[file.replace('.csv', '')] = data;
          loaded++;
          if (loaded === files.length) resolve(results);
        });
    });
  });
}

function generateDemoData() {
  // Generate realistic demo data for demonstration
  const profiles = [
    { user_id: 'U001', home_currency: 'USD', balance: 5000.00, minimum_balance: 1000.00, 
      priorities: 'essential,flexible', payment_preference: 'full_payment' },
    { user_id: 'U002', home_currency: 'EUR', balance: 3500.00, minimum_balance: 800.00,
      priorities: 'essential', payment_preference: 'installments' },
    { user_id: 'U003', home_currency: 'INR', balance: 80000.00, minimum_balance: 15000.00,
      priorities: 'essential,flexible', payment_preference: 'partial_payment' },
    { user_id: 'U004', home_currency: 'ZAR', balance: 15000.00, minimum_balance: 3000.00,
      priorities: 'essential', payment_preference: 'wait' },
    { user_id: 'U005', home_currency: 'IDR', balance: 25000000.00, minimum_balance: 5000000.00,
      priorities: 'essential,flexible', payment_preference: 'full_payment' }
  ];

  const today = new Date();
  const events = [
    { event_id: 'E001', user_id: 'U001', type: 'salary', amount: 4500.00, date: formatDate(new Date(today.getTime() + 86400000 * 5)), status: 'confirmed' },
    { event_id: 'E002', user_id: 'U001', type: 'rent', amount: 1200.00, date: formatDate(new Date(today.getTime() + 86400000 * 1)), status: 'pending' },
    { event_id: 'E003', user_id: 'U001', type: 'utilities', amount: 200.00, date: formatDate(new Date(today.getTime() + 86400000 * 2)), status: 'recurring', flexible: false },
    { event_id: 'E004', user_id: 'U002', type: 'salary', amount: 3200.00, date: formatDate(new Date(today.getTime() + 86400000 * 10)), status: 'confirmed' },
    { event_id: 'E005', user_id: 'U002', type: 'groceries', amount: 400.00, date: formatDate(new Date(today.getTime() + 86400000 * 3)), status: 'recurring', flexible: true },
    { event_id: 'E006', user_id: 'U003', type: 'salary', amount: 65000.00, date: formatDate(new Date(today.getTime() + 86400000 * 7)), status: 'confirmed' },
    { event_id: 'E007', user_id: 'U003', type: 'loan EMI', amount: 8000.00, date: formatDate(new Date(today.getTime() + 86400000 * 1)), status: 'pending' }
  ];

  const requests = [
    { request_id: 'RQ001', user_id: 'U001', amount: 2500.00, desired_completion_date: formatDate(new Date(today.getTime() + 86400000 * 14)), 
      item: 'Laptop', category: 'electronics' },
    { request_id: 'RQ002', user_id: 'U002', amount: 1800.00, desired_completion_date: formatDate(new Date(today.getTime() + 86400000 * 20)),
      item: 'Kitchen Appliances', category: 'home' },
    { request_id: 'RQ003', user_id: 'U003', amount: 35000.00, desired_completion_date: formatDate(new Date(today.getTime() + 86400000 * 30)),
      item: 'Smartphone', category: 'electronics' },
    { request_id: 'RQ004', user_id: 'U004', amount: 8000.00, desired_completion_date: formatDate(new Date(today.getTime() + 86400000 * 15)),
      item: 'Travel Package', category: 'leisure' },
    { request_id: 'RQ005', user_id: 'U005', amount: 8500000.00, desired_completion_date: formatDate(new Date(today.getTime() + 86400000 * 45)),
      item: 'Gaming Setup', category: 'electronics' }
  ];

  const paymentOptions = [
    { request_id: 'RQ001', option_id: 'PO001', plan: '3_months', monthly_amount: 833.33, total_interest: 50.00 },
    { request_id: 'RQ002', option_id: 'PO002', plan: '6_months', monthly_amount: 300.00, total_interest: 100.00 },
    { request_id: 'RQ003', option_id: 'PO003', plan: '12_months', monthly_amount: 2916.67, total_interest: 2000.00 }
  ];

  const exchangeRates = [
    { currency_pair: 'USD/EUR', rate: 0.92, date: '2026-09-12' },
    { currency_pair: 'USD/INR', rate: 83.50, date: '2026-09-12' },
    { currency_pair: 'USD/ZAR', rate: 18.75, date: '2026-09-12' },
    { currency_pair: 'USD/IDR', rate: 15800.00, date: '2026-09-12' }
  ];

  const messages = [
    { message_id: 'M001', related_type: 'user', related_id: 'U001', content: 'User prefers to maintain high savings buffer' },
    { message_id: 'M002', related_type: 'request', related_id: 'RQ001', content: 'Laptop needed for work-from-home setup' },
    { message_id: 'M003', related_type: 'event', related_id: 'E002', content: 'Rent payment is due next week' }
  ];

  const images = [
    { image_id: 'IM001', related_event_id: 'E007', amount: 8000.00, type: 'loan_statement' }
  ];

  return {
    financial_profiles: profiles,
    financial_events: events,
    requests: requests,
    request_payment_options: paymentOptions,
    exchange_rates: exchangeRates,
    messages: messages,
    images: images
  };
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// ============================================================================
// FINANCIAL AGENT - Core Logic
// ============================================================================

class FinancialAgent {
  constructor(data) {
    // Data comes in with keys like financial_profiles, financial_events, etc.
    // Normalize to simpler keys
    this.profiles = data.profiles || data.financial_profiles || [];
    this.events = data.events || data.financial_events || [];
    this.requests = data.requests || data.requests_csv || [];
    this.paymentOptions = data.paymentOptions || data.request_payment_options || [];
    this.exchangeRates = data.exchangeRates || data.exchange_rates || [];
    this.messages = data.messages || data.messages_csv || [];
    this.images = data.images || data.images_csv || [];
    
    // Build lookup maps
    this.profileMap = new Map(this.profiles.map(p => [p.user_id, p]));
    this.eventMap = new Map(this.events.map(e => [e.event_id, e]));
    this.requestMap = new Map(this.requests.map(r => [r.request_id, r]));
    this.paymentOptionMap = new Map(this.paymentOptions.map(po => [po.request_id, po]));
    this.messageMap = new Map(this.messages.map(m => [m.message_id, m]));
    this.imageMap = new Map(this.images.map(img => [img.image_id, img]));
    
    // Exchange rate cache
    this.exchangeCache = new Map();
    this.exchangeRates.forEach(er => {
      this.exchangeCache.set(er.currency_pair, { rate: parseFloat(er.rate), date: er.date });
    });
  }

  // Convert amount between currencies
  convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    
    const pair = `${fromCurrency}/${toCurrency}`;
    const reversePair = `${toCurrency}/${fromCurrency}`;
    
    if (this.exchangeCache.has(pair)) {
      return amount * this.exchangeCache.get(pair).rate;
    }
    
    // Try reverse rate
    if (this.exchangeCache.has(reversePair)) {
      return amount / this.exchangeCache.get(reversePair).rate;
    }
    
    // Fallback: use approximate rates or API
    return this.fetchExchangeRate(fromCurrency, toCurrency) * amount;
  }

  async fetchExchangeRate(from, to) {
    // Try free API first
    try {
      const response = await axios.get(`${FREE_APIS.exchangerate}${from}`);
      const data = response.data;
      if (data.rates && data.rates[to]) {
        return data.rates[to];
      }
    } catch (error) {
      // Fallback to approximate rates
      console.log('Exchange API failed, using fallback rates');
    }
    
    // Fallback rates (approximate)
    const fallbackRates = {
      'USD/EUR': 0.92,
      'USD/GBP': 0.79,
      'USD/INR': 83.50,
      'USD/ZAR': 18.75,
      'USD/IDR': 15800,
      'USD/JPY': 149.50,
      'USD/CAD': 1.36,
      'USD/AUD': 1.53
    };
    
    const pair = `${from}/${to}`;
    if (fallbackRates[pair]) return fallbackRates[pair];
    
    // Cross-rate calculation
    if (from !== 'USD' && to !== 'USD') {
      const usdRates = fallbackRates[`USD/${to}`] || 1;
      const reverseUsd = fallbackRates[`USD/${from}`] || 1;
      return usdRates / reverseUsd;
    }
    
    return 1;
  }

  // Get user's financial profile
  getUserProfile(userId) {
    return this.profileMap.get(userId);
  }

  // Get events for a user, filtered by date range
  getUserEvents(userId, startDate, endDate) {
    return this.events
      .filter(e => e.user_id === userId)
      .filter(e => {
        const eventDate = new Date(e.date);
        return eventDate >= new Date(startDate) && eventDate <= new Date(endDate);
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  // Calculate available balance considering pending and confirmed events
  calculateAvailableBalance(profile, targetDate) {
    const balance = parseFloat(profile.balance);
    const minBalance = parseFloat(profile.minimum_balance);
    const target = new Date(targetDate);
    
    // Get all future events
    const futureEvents = this.getUserEvents(profile.user_id, formatDate(new Date()), targetDate);
    
    let totalPending = 0;
    let confirmedIncome = 0;
    
    futureEvents.forEach(event => {
      const amount = this.resolveEventAmount(event);
      const eventDate = new Date(event.date);
      
      if (eventDate <= target) {
        if (event.status === 'pending' || event.status === 'recurring') {
          // Check if flexible
          if (event.flexible === true || event.flexible === 'true') {
            // Can potentially change this
          } else {
            totalPending += amount;
          }
        } else if (event.status === 'confirmed') {
          if (event.type === 'salary' || event.type === 'income' || event.type === 'refund') {
            confirmedIncome += amount;
          } else {
            totalPending += amount;
          }
        }
      }
    });
    
    // Calculate safe balance
    const projectedBalance = balance + confirmedIncome - totalPending;
    const safeBalance = Math.max(0, projectedBalance - minBalance);
    
    return {
      currentBalance: balance,
      minimumBalance: minBalance,
      projectedBalance: projectedBalance,
      safeBalance: safeBalance,
      pendingExpenses: totalPending,
      confirmedIncome: confirmedIncome,
      events: futureEvents
    };
  }

  // Resolve event amount (check images for blank amounts)
  resolveEventAmount(event) {
    // Handle both string and number amounts
    if (event.amount !== undefined && event.amount !== null && event.amount !== '') {
      return parseFloat(event.amount);
    }
    
    // Check linked image for amount
    const linkedImages = this.images.filter(img => img.related_event_id === event.event_id);
    if (linkedImages.length > 0 && linkedImages[0].amount) {
      return parseFloat(linkedImages[0].amount);
    }
    
    return 0;
  }

  // Analyze a single request
  analyzeRequest(request) {
    const profile = this.getUserProfile(request.user_id);
    if (!profile) {
      return this.createErrorResult(request, 'User profile not found');
    }

    const requestAmount = parseFloat(request.amount);
    const desiredDate = new Date(request.desired_completion_date);
    const requestDate = new Date();
    
    // Calculate available balance at request date
    const requestDateBalance = this.calculateAvailableBalance(profile, formatDate(requestDate));
    
    // Calculate available balance at desired completion date
    const desiredDateBalance = this.calculateAvailableBalance(profile, request.desired_completion_date);
    
    // Get payment options for this request
    const options = this.paymentOptionMap.get(request.request_id);
    const paymentPlans = Array.isArray(options) ? options : options ? [options] : [];
    
    // Analyze spending flexibility
    const flexibleExpenses = requestDateBalance.events.filter(e => 
      e.flexible === true || e.flexible === 'true'
    );
    
    // Decision logic
    let result = {
      request_id: request.request_id,
      amount_safe_to_pay: 0,
      affordability_status: 'not_affordable',
      recommended_payment_method: 'not_recommended',
      payment_plan: 'none',
      earliest_date_for_full_payment: '',
      spending_changes_needed: 'none',
      decision_explanation: ''
    };
    
    // Scenario 1: Can afford immediately
    if (requestAmount <= requestDateBalance.safeBalance) {
      result.amount_safe_to_pay = requestAmount;
      result.affordability_status = 'affordable_now';
      result.recommended_payment_method = 'full_payment';
      result.payment_plan = formatDate(requestDate) + ':' + requestAmount;
      result.earliest_date_for_full_payment = formatDate(requestDate);
      result.decision_explanation = this.generateExplanation(request, profile, 'full_payment', requestDateBalance);
      return result;
    }
    
    // Scenario 2: Can afford with partial payment
    if (requestAmount <= requestDateBalance.safeBalance + desiredDateBalance.safeBalance &&
        requestDateBalance.safeBalance > 0) {
      const safeNow = Math.min(requestAmount, requestDateBalance.safeBalance);
      const remaining = requestAmount - safeNow;
      
      const earliestFullDate = this.findEarliestFullPaymentDate(
        profile, remaining, desiredDate
      );
      
      if (earliestFullDate && new Date(earliestFullDate) <= desiredDate) {
        result.amount_safe_to_pay = safeNow;
        result.affordability_status = 'affordable_with_plan';
        result.recommended_payment_method = 'partial_payment';
        result.payment_plan = `${formatDate(requestDate)}:${safeNow}|${formatDate(earliestFullDate)}:${remaining}`;
        result.earliest_date_for_full_payment = formatDate(earliestFullDate);
        result.decision_explanation = this.generateExplanation(request, profile, 'partial_payment', requestDateBalance, desiredDateBalance);
        return result;
      }
    }
    
    // Scenario 3: Can afford with installments
    if (paymentPlans.length > 0) {
      for (const plan of paymentPlans) {
        const monthly = parseFloat(plan.monthly_amount);
        const months = parseInt(plan.plan.replace('_months', ''));
        
        let canAffordInstallments = true;
        let totalCost = monthly * months + (parseFloat(plan.total_interest) || 0);
        
        for (let i = 1; i <= months; i++) {
          const paymentDate = new Date(requestDate.getTime() + i * 30 * 24 * 60 * 60 * 1000);
          const balance = this.calculateAvailableBalance(profile, formatDate(paymentDate));
          if (monthly > balance.safeBalance + balance.projectedBalance * 0.2) {
            canAffordInstallments = false;
            break;
          }
        }
        
        if (canAffordInstallments && totalCost <= desiredDateBalance.projectedBalance) {
          const planStr = paymentPlans.map((p, idx) => {
            const monthlyAmt = parseFloat(p.monthly_amount);
            return `${formatDate(new Date(requestDate.getTime() + (idx + 1) * 30 * 24 * 60 * 60 * 1000))}:${monthlyAmt}`;
          }).join('|');
          
          result.amount_safe_to_pay = requestAmount;
          result.affordability_status = 'affordable_with_plan';
          result.recommended_payment_method = 'installments';
          result.payment_plan = planStr;
          result.earliest_date_for_full_payment = formatDate(new Date(requestDate.getTime() + months * 30 * 24 * 60 * 60 * 1000));
          result.decision_explanation = this.generateExplanation(request, profile, 'installments', requestDateBalance, desiredDateBalance, plan);
          return result;
        }
      }
    }
    
    // Scenario 4: Can afford later
    const futureDate = this.findEarliestFullPaymentDate(profile, requestAmount, new Date(desiredDate.getTime() + 90 * 24 * 60 * 60 * 1000));
    
    if (futureDate && new Date(futureDate) <= new Date(desiredDate.getTime() + 90 * 24 * 60 * 60 * 1000)) {
      result.amount_safe_to_pay = requestAmount;
      result.affordability_status = 'affordable_later';
      result.recommended_payment_method = 'wait';
      result.earliest_date_for_full_payment = formatDate(futureDate);
      result.decision_explanation = this.generateExplanation(request, profile, 'wait', requestDateBalance, null, null, futureDate);
      return result;
    }
    
    // Scenario 5: Not affordable - check spending changes
    if (flexibleExpenses.length > 0) {
      let potentialSavings = 0;
      const changes = [];
      
      flexibleExpenses.forEach(exp => {
        const amount = this.resolveEventAmount(exp);
        potentialSavings += amount;
        changes.push(`reduce_to:${exp.event_id}:${amount * 0.5}`);
        if (changes.length >= 3) return false;
      });
      
      if (potentialSavings > 0) {
        const newSafeBalance = requestDateBalance.safeBalance + potentialSavings;
        if (newSafeBalance >= requestAmount) {
          result.amount_safe_to_pay = requestAmount;
          result.affordability_status = 'affordable_with_plan';
          result.recommended_payment_method = 'partial_payment';
          result.spending_changes_needed = changes.join('|');
          result.decision_explanation = this.generateExplanation(request, profile, 'partial_with_changes', requestDateBalance, null, null, null, changes);
          return result;
        }
      }
    }
    
    // Final fallback: not affordable
    result.amount_safe_to_pay = Math.max(0, requestDateBalance.safeBalance);
    result.affordability_status = 'not_affordable';
    result.recommended_payment_method = 'not_recommended';
    result.decision_explanation = this.generateExplanation(request, profile, 'not_affordable', requestDateBalance);
    
    return result;
  }

  findEarliestFullPaymentDate(profile, amount, maxDate) {
    const max = new Date(maxDate);
    let currentDate = new Date();
    
    for (let i = 0; i < 180 && currentDate <= max; i++) {
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      const balance = this.calculateAvailableBalance(profile, formatDate(currentDate));
      
      if (balance.safeBalance >= amount) {
        return formatDate(currentDate);
      }
    }
    
    return null;
  }

  generateExplanation(request, profile, method, balanceInfo, futureBalance = null, plan = null, futureDate = null, changes = null) {
    const explanations = [];
    
    switch (method) {
      case 'full_payment':
        explanations.push(`User has $${balanceInfo.safeBalance.toFixed(2)} safe balance, enough to pay $${request.amount} now.`);
        if (balanceInfo.pendingExpenses > 0) {
          explanations.push(`After accounting for $${balanceInfo.pendingExpenses.toFixed(2)} in pending expenses, user remains in good financial position.`);
        }
        break;
        
      case 'partial_payment':
        explanations.push(`User can pay $${balanceInfo.safeBalance.toFixed(2)} now and remaining $${(parseFloat(request.amount) - balanceInfo.safeBalance).toFixed(2)} by ${futureDate || 'later'}.`);
        explanations.push(`Minimum balance of $${balanceInfo.minimumBalance.toFixed(2)} will be maintained throughout the plan.`);
        if (balanceInfo.confirmedIncome > 0) {
          explanations.push(`Expected income of $${balanceInfo.confirmedIncome.toFixed(2)} supports this plan.`);
        }
        break;
        
      case 'installments':
        explanations.push(`Using ${plan.plan} installment plan at $${plan.monthly_amount}/month.`);
        explanations.push(`Total cost with interest: $${(parseFloat(plan.monthly_amount) * parseInt(plan.plan.replace('_months', '')) + parseFloat(plan.total_interest)).toFixed(2)}.`);
        break;
        
      case 'wait':
        explanations.push(`Cannot afford now but can by ${futureDate}.`);
        explanations.push(`Waiting allows pending income of $${balanceInfo.confirmedIncome.toFixed(2)} to clear.`);
        break;
        
      case 'partial_with_changes':
        explanations.push(`With spending adjustments of $${changes ? changes.reduce((s, c) => s + parseFloat(c.split(':')[2]), 0) : 0}.00, user can afford.`);
        explanations.push(`Recommended reducing flexible expenses temporarily.`);
        break;
        
      case 'not_affordable':
        explanations.push(`User's safe balance of $${balanceInfo.safeBalance.toFixed(2)} is insufficient for $${request.amount}.`);
        explanations.push(`Minimum balance requirement of $${balanceInfo.minimumBalance.toFixed(2)} limits available funds.`);
        if (balanceInfo.pendingExpenses > 0) {
          explanations.push(`Pending expenses of $${balanceInfo.pendingExpenses.toFixed(2)} further constrain budget.`);
        }
        break;
    }
    
    if (profile.priorities && profile.priorities.includes('essential')) {
      explanations.push('Priority: Essential expenses maintained.');
    }
    
    const requestMessages = this.messages.filter(m => 
      m.related_type === 'request' && m.related_id === request.request_id
    );
    requestMessages.forEach(msg => {
      explanations.push(`Context: ${msg.content}`);
    });
    
    return explanations.join(' ');
  }

  createErrorResult(request, error) {
    return {
      request_id: request.request_id,
      amount_safe_to_pay: 0,
      affordability_status: 'not_affordable',
      recommended_payment_method: 'not_recommended',
      payment_plan: 'none',
      earliest_date_for_full_payment: '',
      spending_changes_needed: 'none',
      decision_explanation: `Error: ${error}`
    };
  }

  processAllRequests() {
    return this.requests.map(request => this.analyzeRequest(request));
  }
}

// ============================================================================
// API ROUTES
// ============================================================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), dataLoaded: financialData !== null });
});

app.get('/api/data-status', (req, res) => {
  if (!financialData) {
    return res.status(503).json({ status: 'loading', message: 'Data not yet loaded' });
  }
  res.json({ status: 'ready', requestCount: financialData.requests?.length || 0 });
});

app.get('/api/requests', async (req, res) => {
  try {
    if (!financialData || !financialData.requests || financialData.requests.length === 0) {
      return res.status(503).json({ error: 'Data not loaded yet', requests: [], analysis: [], currencies: [] });
    }
    
    const agent = new FinancialAgent(financialData);
    const results = agent.processAllRequests();
    
    res.json({
      requests: financialData.requests,
      analysis: results,
      currencies: [...new Set(financialData.profiles.map(p => p.home_currency))]
    });
  } catch (error) {
    console.error('Error processing requests:', error);
    res.status(500).json({ error: error.message, requests: [], analysis: [], currencies: [] });
  }
});

app.get('/api/requests/:id', async (req, res) => {
  try {
    const request = financialData.requests.find(r => r.request_id === req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const agent = new FinancialAgent(financialData);
    const analysis = agent.analyzeRequest(request);
    
    res.json({
      request: request,
      analysis: analysis,
      profile: financialData.profiles.find(p => p.user_id === request.user_id),
      events: financialData.events.filter(e => e.user_id === request.user_id),
      messages: financialData.messages.filter(m => m.related_id === req.params.id)
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    if (!financialData || !financialData.requests || financialData.requests.length === 0) {
      return res.status(503).json({ stats: null, userBreakdown: {}, currencyStats: {}, currencies: [] });
    }
    
    const agent = new FinancialAgent(financialData);
    const results = agent.processAllRequests();
    
    const stats = {
      totalRequests: results.length,
      affordableNow: results.filter(r => r.affordability_status === 'affordable_now').length,
      affordableWithPlan: results.filter(r => r.affordability_status === 'affordable_with_plan').length,
      affordableLater: results.filter(r => r.affordability_status === 'affordable_later').length,
      notAffordable: results.filter(r => r.affordability_status === 'not_affordable').length,
      fullPayment: results.filter(r => r.recommended_payment_method === 'full_payment').length,
      partialPayment: results.filter(r => r.recommended_payment_method === 'partial_payment').length,
      installments: results.filter(r => r.recommended_payment_method === 'installments').length,
      wait: results.filter(r => r.recommended_payment_method === 'wait').length,
      notRecommended: results.filter(r => r.recommended_payment_method === 'not_recommended').length,
      totalAmountSafe: results.reduce((sum, r) => sum + r.amount_safe_to_pay, 0),
      avgSafeAmount: results.length > 0 ? results.reduce((sum, r) => sum + r.amount_safe_to_pay, 0) / results.length : 0
    };
    
    const userBreakdown = {};
    results.forEach((result, idx) => {
      const request = financialData.requests[idx];
      if (!userBreakdown[request.user_id]) {
        userBreakdown[request.user_id] = {
          affordableNow: 0,
          affordableWithPlan: 0,
          affordableLater: 0,
          notAffordable: 0,
          totalSafe: 0
        };
      }
      userBreakdown[request.user_id][result.affordability_status]++;
      userBreakdown[request.user_id].totalSafe += result.amount_safe_to_pay;
    });
    
    const currencyStats = {};
    financialData.profiles.forEach(profile => {
      const userResults = results.filter((r, idx) => financialData.requests[idx].user_id === profile.user_id);
      if (userResults.length > 0) {
        currencyStats[profile.home_currency] = {
          count: userResults.length,
          totalSafe: userResults.reduce((sum, r) => sum + r.amount_safe_to_pay, 0)
        };
      }
    });
    
    res.json({
      stats,
      userBreakdown,
      currencyStats,
      currencies: Object.keys(currencyStats)
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export-csv', async (req, res) => {
  try {
    if (!financialData || !financialData.requests || financialData.requests.length === 0) {
      return res.status(503).json({ error: 'Data not loaded yet' });
    }
    
    const agent = new FinancialAgent(financialData);
    const results = agent.processAllRequests();
    
    const csvContent = [
      'request_id,amount_safe_to_pay,affordability_status,recommended_payment_method,payment_plan,earliest_date_for_full_payment,spending_changes_needed,decision_explanation'
    ].concat(
      results.map(r => 
        `${r.request_id},${r.amount_safe_to_pay},${r.affordability_status},${r.recommended_payment_method},"${r.payment_plan}",${r.earliest_date_for_full_payment || ""},"${r.spending_changes_needed}","${r.decision_explanation}"`
      )
    ).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=output.csv');
    res.send(csvContent);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/load-data', async (req, res) => {
  try {
    const data = await loadCSVData();
    financialData = normalizeData(data);
    res.json({ success: true, message: 'Data loaded successfully', count: financialData.requests.length });
  } catch (error) {
    console.error('Error loading data:', error);
    const demoData = normalizeData(generateDemoData());
    financialData = demoData;
    res.json({ success: true, message: 'Using demo data', count: financialData.requests.length });
  }
});

app.get('/api/exchange-rates', async (req, res) => {
  try {
    const rates = {};
    
    try {
      const response = await axios.get(`${FREE_APIS.exchangerate}USD`);
      if (response.data && response.data.rates) {
        rates['USD'] = response.data.rates;
      }
    } catch (e) {
      rates['USD'] = {
        EUR: 0.92,
        GBP: 0.79,
        INR: 83.50,
        ZAR: 18.75,
        IDR: 15800,
        JPY: 149.50,
        CAD: 1.36,
        AUD: 1.53
      };
    }
    
    res.json({ rates, base: 'USD', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

let serverStarted = false;

async function startServer() {
  if (serverStarted) {
    return;
  }
  serverStarted = true;
  
  try {
    const data = await loadCSVData();
    financialData = normalizeData(data);
    console.log(`Loaded ${financialData.requests.length} requests`);
  } catch (error) {
    console.log('Using demo data:', error.message);
    const demoData = normalizeData(generateDemoData());
    financialData = demoData;
  }
  
  if (!module.parent) {
    app.listen(PORT, () => {
      console.log(`\n🚀 Buy or Wait Solution running on http://localhost:${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
      console.log(`📈 Dashboard: http://localhost:${PORT}/dashboard`);
      console.log(`📋 Requests: http://localhost:${PORT}/requests`);
      console.log(`📄 Export CSV: http://localhost:${PORT}/api/export-csv`);
      console.log(`\n💡 Free API keys being used:`);
      console.log(`   - Exchange rates: exchangerate-api.com (free tier)`);
      console.log(`   - Fallback: hardcoded rates for offline use`);
    });
  }
}

startServer();

module.exports = app;
