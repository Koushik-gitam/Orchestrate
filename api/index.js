// Buy or Wait - Financial Agent Solution
// HackerRank Orchestrate September 2026
// Official Dataset Integration

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');

const app = express();

// Vercel serverless configuration
const isVercel = process.env.VERCEL === '1';
const PORT = process.env.PORT || (isVercel ? 3000 : 3000);
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory (for non-Vercel deployments)
const publicPath = path.join(__dirname, '..', 'public');
if (!isVercel && fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// In-memory data storage
let financialData = null;

// ============================================================================
// DATA LOADING
// ============================================================================

function loadCSVData() {
  const datasetPath = path.resolve(__dirname, '..', 'dataset');
  
  return new Promise((resolve, reject) => {
    const files = ['financial_profiles.csv', 'financial_events.csv', 'requests.csv', 
                   'request_payment_options.csv', 'exchange_rates.csv', 'messages.csv', 'images.csv'];
    
    const allExist = files.every(file => fs.existsSync(path.join(datasetPath, file)));
    
    if (!allExist) {
      console.log('Some dataset files missing');
      reject(new Error('Missing dataset files'));
      return;
    }
    
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

// ============================================================================
// FINANCIAL AGENT - Core Logic for Official Dataset
// ============================================================================

class FinancialAgent {
  constructor(data) {
    this.profiles = data.financial_profiles || [];
    this.events = data.financial_events || [];
    this.requests = data.requests || [];
    this.paymentOptions = data.request_payment_options || [];
    this.exchangeRates = data.exchange_rates || [];
    this.messages = data.messages || [];
    this.images = data.images || [];
    
    // Build lookup maps
    this.profileMap = new Map(this.profiles.map(p => [p.user_id, p]));
    this.eventMap = new Map(this.events.map(e => [e.event_id, e]));
    this.requestMap = new Map(this.requests.map(r => [r.request_id, r]));
    this.paymentOptionMap = new Map();
    this.paymentOptions.forEach(po => {
      if (!this.paymentOptionMap.has(po.request_id)) {
        this.paymentOptionMap.set(po.request_id, []);
      }
      this.paymentOptionMap.get(po.request_id).push(po);
    });
    this.messageMap = new Map();
    this.messages.forEach(m => {
      if (!this.messageMap.has(m.request_id)) {
        this.messageMap.set(m.request_id, []);
      }
      this.messageMap.get(m.request_id).push(m);
    });
    this.imageMap = new Map();
    this.images.forEach(img => {
      if (!this.imageMap.has(img.request_id)) {
        this.imageMap.set(img.request_id, []);
      }
      this.imageMap.get(img.request_id).push(img);
    });
    
    // Exchange rate cache - organized by date
    this.exchangeCache = new Map();
    this.exchangeRates.forEach(er => {
      const key = `${er.rate_date}|${er.from_currency}|${er.to_currency}`;
      this.exchangeCache.set(key, { rate: parseFloat(er.rate), date: er.rate_date });
    });
  }

  // Get exchange rate for a specific date (or closest available)
  getExchangeRate(fromCurrency, toCurrency, date) {
    if (fromCurrency === toCurrency) return 1;
    
    // Try exact date first
    const exactKey = `${date}|${fromCurrency}|${toCurrency}`;
    if (this.exchangeCache.has(exactKey)) {
      return this.exchangeCache.get(exactKey).rate;
    }
    
    // Try reverse
    const reverseKey = `${date}|${toCurrency}|${fromCurrency}`;
    if (this.exchangeCache.has(reverseKey)) {
      return 1 / this.exchangeCache.get(reverseKey).rate;
    }
    
    // Find closest date
    const dates = [...this.exchangeCache.keys()]
      .filter(k => k.endsWith(`|${fromCurrency}|${toCurrency}`))
      .map(k => k.split('|')[0])
      .sort();
    
    if (dates.length === 0) return 1;
    
    // Use most recent rate
    const mostRecent = dates[dates.length - 1];
    const recentKey = `${mostRecent}|${fromCurrency}|${toCurrency}`;
    if (this.exchangeCache.has(recentKey)) {
      return this.exchangeCache.get(recentKey).rate;
    }
    
    // Fallback rates
    const fallbackRates = {
      'USD/EUR': 0.92,
      'USD/INR': 83.33,
      'USD/IDR': 15833.33,
      'USD/ZAR': 18.5,
      'EUR/USD': 1.09,
      'EUR/INR': 90.5,
      'EUR/IDR': 17200,
      'EUR/ZAR': 20,
      'USD/GBP': 0.79,
      'USD/JPY': 149.5
    };
    
    const pair = `${fromCurrency}/${toCurrency}`;
    if (fallbackRates[pair]) return fallbackRates[pair];
    
    // Cross rate via USD
    if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
      const usdToTarget = fallbackRates[`USD/${toCurrency}`] || 1;
      const usdFromSource = fallbackRates[`USD/${fromCurrency}`] || 1;
      return usdToTarget / usdFromSource;
    }
    
    return 1;
  }

  // Convert amount between currencies using date-specific rate
  convertCurrency(amount, fromCurrency, toCurrency, date) {
    const rate = this.getExchangeRate(fromCurrency, toCurrency, date);
    return amount * rate;
  }

  // Get user's financial profile
  getUserProfile(userId) {
    return this.profileMap.get(userId);
  }

  // Get events for a user within a date range
  getUserEvents(userId, startDate, endDate) {
    return this.events
      .filter(e => e.user_id === userId)
      .filter(e => {
        const eventDate = e.settlement_date || e.event_date;
        return eventDate >= startDate && eventDate <= endDate;
      })
      .sort((a, b) => (a.settlement_date || a.event_date) - (b.settlement_date || b.event_date));
  }

  // Get future events from a given date
  getFutureEvents(userId, fromDate) {
    const today = new Date(fromDate);
    const future = this.events
      .filter(e => e.user_id === userId)
      .filter(e => {
        const eventDate = e.settlement_date || e.event_date;
        return eventDate >= fromDate;
      })
      .sort((a, b) => (a.settlement_date || a.event_date) - (b.settlement_date || b.event_date));
    return future;
  }

  // Calculate available balance considering pending and confirmed events
  calculateAvailableBalance(profile, targetDate) {
    const balance = parseFloat(profile.current_available_balance);
    const minBalance = parseFloat(profile.minimum_balance_to_keep);
    const userId = profile.user_id;
    
    // Get all events up to target date
    const relevantEvents = this.getFutureEvents(userId, '2020-01-01');
    const target = new Date(targetDate);
    
    let totalPendingDebits = 0;
    let confirmedCredits = 0;
    let flexibleSavingsPotential = 0;
    const eventsList = [];
    
    relevantEvents.forEach(event => {
      const eventDate = event.settlement_date || event.event_date;
      const eventDateObj = new Date(eventDate);
      
      if (eventDateObj > target) return;
      
      const amount = parseFloat(event.amount) || 0;
      const status = event.status;
      const direction = event.direction;
      const flexibility = event.flexibility;
      
      eventsList.push({
        event_id: event.event_id,
        type: event.event_type,
        category: event.category,
        amount: amount,
        date: eventDate,
        status: status,
        flexibility: flexibility,
        direction: direction
      });
      
      // Only consider future/pending events for balance calculation
      if (eventDateObj >= new Date()) {
        if (direction === 'debit') {
          if (status === 'pending' || status === 'scheduled') {
            if (flexibility === 'flexible' || flexibility === 'can_reduce') {
              flexibleSavingsPotential += amount;
            } else if (flexibility === 'fixed' || !flexibility) {
              totalPendingDebits += amount;
            }
          } else if (status === 'confirmed') {
            totalPendingDebits += amount;
          }
        } else if (direction === 'credit' || direction === 'income') {
          if (status === 'confirmed' || status === 'settled') {
            confirmedCredits += amount;
          }
        }
      }
    });
    
    // Calculate safe balance
    const projectedBalance = balance + confirmedCredits - totalPendingDebits;
    const safeBalance = Math.max(0, projectedBalance - minBalance);
    
    return {
      currentBalance: balance,
      minimumBalance: minBalance,
      projectedBalance: projectedBalance,
      safeBalance: safeBalance,
      pendingExpenses: totalPendingDebits,
      confirmedIncome: confirmedCredits,
      flexibleSavingsPotential: flexibleSavingsPotential,
      events: eventsList
    };
  }

  // Analyze a single request
  analyzeRequest(request) {
    const profile = this.getUserProfile(request.user_id);
    if (!profile) {
      return this.createErrorResult(request, 'User profile not found');
    }

    const requestAmount = parseFloat(request.requested_amount);
    const desiredDate = request.desired_completion_date;
    const requestDate = request.request_date || new Date().toISOString().split('T')[0];
    const allowsPartial = request.allows_partial_payment === 'true' || request.allows_partial_payment === true;
    
    // Convert to home currency if needed
    const homeCurrency = profile.home_currency;
    const requestCurrency = request.currency || homeCurrency;
    
    // Get payment options for this request
    const options = this.paymentOptionMap.get(request.request_id) || [];
    
    // Get user messages
    const userMessages = this.messageMap.get(request.request_id) || [];
    
    // Get user images
    const userImages = this.imageMap.get(request.request_id) || [];
    
    // Calculate balances
    const requestDateBalance = this.calculateAvailableBalance(profile, requestDate);
    const desiredDateBalance = this.calculateAvailableBalance(profile, desiredDate);
    
    // Analyze flexibility
    const flexibleExpenses = requestDateBalance.events.filter(e => 
      (e.flexibility === 'flexible' || e.flexibility === 'can_reduce') && e.direction === 'debit'
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
    
    // Scenario 1: Can afford immediately with full payment
    if (requestAmount <= requestDateBalance.safeBalance && allowsPartial) {
      result.amount_safe_to_pay = requestAmount;
      result.affordability_status = 'affordable_now';
      result.recommended_payment_method = 'full_payment';
      result.payment_plan = `${requestDate}:${requestAmount}`;
      result.earliest_date_for_full_payment = requestDate;
      result.decision_explanation = this.generateExplanation(request, profile, 'full_payment', requestDateBalance, desiredDateBalance, options);
      return result;
    }
    
    // Scenario 2: Can afford with installments
    if (options.length > 0) {
      for (const option of options) {
        if (option.payment_method === 'installments') {
          const monthlyAmount = parseFloat(option.payment_amount);
          const numPayments = parseInt(option.number_of_payments);
          const firstPaymentDate = option.first_payment_date;
          const frequencyDays = parseInt(option.payment_frequency_days) || 30;
          const totalCost = parseFloat(option.total_payable_amount);
          
          // Check if installments are affordable
          let canAfford = true;
          let paymentPlanSteps = [];
          
          for (let i = 0; i < numPayments; i++) {
            const paymentDate = new Date(new Date(firstPaymentDate).getTime() + i * frequencyDays * 24 * 60 * 60 * 1000);
            const paymentDateStr = paymentDate.toISOString().split('T')[0];
            const balance = this.calculateAvailableBalance(profile, paymentDateStr);
            
            if (monthlyAmount > balance.safeBalance + balance.projectedBalance * 0.3) {
              canAfford = false;
              break;
            }
            
            paymentPlanSteps.push({
              date: paymentDateStr,
              amount: monthlyAmount
            });
          }
          
          if (canAfford && totalCost <= desiredDateBalance.projectedBalance + requestAmount * 0.2) {
            result.amount_safe_to_pay = requestAmount;
            result.affordability_status = 'affordable_with_plan';
            result.recommended_payment_method = 'installments';
            result.payment_plan = paymentPlanSteps.map(p => `${p.date}:${p.amount}`).join('|');
            result.earliest_date_for_full_payment = paymentPlanSteps[paymentPlanSteps.length - 1].date;
            result.decision_explanation = this.generateExplanation(request, profile, 'installments', requestDateBalance, desiredDateBalance, options, null, paymentPlanSteps);
            return result;
          }
        }
      }
    }
    
    // Scenario 3: Can afford with partial payment now + rest later
    if (allowsPartial && requestDateBalance.safeBalance > 0) {
      const amountNow = Math.min(requestAmount, requestDateBalance.safeBalance);
      const remaining = requestAmount - amountNow;
      
      // Find when remaining can be paid
      const earliestFullDate = this.findEarliestFullPaymentDate(profile, remaining, desiredDate);
      
      if (earliestFullDate && new Date(earliestFullDate) <= new Date(desiredDate)) {
        result.amount_safe_to_pay = requestAmount;
        result.affordability_status = 'affordable_with_plan';
        result.recommended_payment_method = 'partial_payment';
        result.payment_plan = `${requestDate}:${amountNow}|${earliestFullDate}:${remaining}`;
        result.earliest_date_for_full_payment = earliestFullDate;
        result.decision_explanation = this.generateExplanation(request, profile, 'partial_payment', requestDateBalance, desiredDateBalance, options, null, null, earliestFullDate);
        return result;
      }
    }
    
    // Scenario 4: Can afford later (wait)
    const futureDate = this.findEarliestFullPaymentDate(profile, requestAmount, addDays(desiredDate, 90));
    
    if (futureDate && new Date(futureDate) <= new Date(addDays(desiredDate, 90))) {
      result.amount_safe_to_pay = requestAmount;
      result.affordability_status = 'affordable_later';
      result.recommended_payment_method = 'wait';
      result.earliest_date_for_full_payment = futureDate;
      result.decision_explanation = this.generateExplanation(request, profile, 'wait', requestDateBalance, desiredDateBalance, options, null, null, futureDate);
      return result;
    }
    
    // Scenario 5: Can afford with spending changes
    if (flexibleExpenses.length > 0) {
      let potentialSavings = 0;
      const changes = [];
      
      flexibleExpenses.forEach(exp => {
        const amount = exp.amount;
        potentialSavings += amount * 0.5; // Assume 50% reduction possible
        changes.push({
          event_id: exp.event_id,
          reduction: Math.round(amount * 0.5 * 100) / 100
        });
        if (changes.length >= 3) return;
      });
      
      if (potentialSavings > 0) {
        const newSafeBalance = requestDateBalance.safeBalance + potentialSavings;
        if (newSafeBalance >= requestAmount) {
          result.amount_safe_to_pay = requestAmount;
          result.affordability_status = 'affordable_with_plan';
          result.recommended_payment_method = 'partial_payment';
          result.spending_changes_needed = changes.map(c => `reduce_to:${c.event_id}:${c.reduction}`).join('|');
          result.decision_explanation = this.generateExplanation(request, profile, 'partial_with_changes', requestDateBalance, desiredDateBalance, options, changes);
          return result;
        }
      }
    }
    
    // Final fallback: Not affordable
    result.amount_safe_to_pay = Math.max(0, requestDateBalance.safeBalance);
    result.affordability_status = 'not_affordable';
    result.recommended_payment_method = 'not_recommended';
    result.decision_explanation = this.generateExplanation(request, profile, 'not_affordable', requestDateBalance, desiredDateBalance, options);
    
    return result;
  }

  findEarliestFullPaymentDate(profile, amount, maxDate) {
    const max = new Date(maxDate);
    let currentDate = new Date();
    
    for (let i = 0; i < 365 && currentDate <= max; i++) {
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      const balance = this.calculateAvailableBalance(profile, currentDate.toISOString().split('T')[0]);
      
      if (balance.safeBalance >= amount) {
        return currentDate.toISOString().split('T')[0];
      }
    }
    
    return null;
  }

  generateExplanation(request, profile, method, balanceInfo, futureBalance, options, changes, paymentPlanSteps, futureDate) {
    const explanations = [];
    const requestAmount = parseFloat(request.requested_amount);
    const homeCurrency = profile.home_currency;
    
    // Add request context
    if (request.request_text) {
      const text = request.request_text.substring(0, 100);
      explanations.push(`Request: ${text}...`);
    }
    
    switch (method) {
      case 'full_payment':
        explanations.push(`User has ${homeCurrency} ${balanceInfo.safeBalance.toFixed(2)} safe balance, sufficient for ${homeCurrency} ${requestAmount.toFixed(2)}.`);
        if (balanceInfo.pendingExpenses > 0) {
          explanations.push(`After ${homeCurrency} ${balanceInfo.pendingExpenses.toFixed(2)} in pending expenses, minimum balance of ${homeCurrency} ${balanceInfo.minimumBalance.toFixed(2)} maintained.`);
        }
        break;
        
      case 'installments':
        const selectedOption = options.find(o => o.payment_method === 'installments') || options[0];
        if (selectedOption) {
          explanations.push(`Using ${selectedOption.number_of_payments}-month installment plan at ${homeCurrency} ${parseFloat(selectedOption.payment_amount).toFixed(2)}/month.`);
          explanations.push(`Total cost: ${homeCurrency} ${parseFloat(selectedOption.total_payable_amount).toFixed(2)} (fee: ${homeCurrency} ${parseFloat(selectedOption.financing_fee).toFixed(2)}).`);
        }
        break;
        
      case 'partial_payment':
        explanations.push(`Pay ${homeCurrency} ${balanceInfo.safeBalance.toFixed(2)} now, remaining ${homeCurrency} ${(requestAmount - balanceInfo.safeBalance).toFixed(2)} by ${futureDate || desiredBalanceDate}.`);
        if (balanceInfo.confirmedIncome > 0) {
          explanations.push(`Expected income of ${homeCurrency} ${balanceInfo.confirmedIncome.toFixed(2)} supports this plan.`);
        }
        break;
        
      case 'wait':
        explanations.push(`Cannot afford now but can by ${futureDate}.`);
        if (balanceInfo.confirmedIncome > 0) {
          explanations.push(`Pending income of ${homeCurrency} ${balanceInfo.confirmedIncome.toFixed(2)} will improve position.`);
        }
        break;
        
      case 'partial_with_changes':
        const totalReduction = changes ? changes.reduce((s, c) => s + c.reduction, 0) : 0;
        explanations.push(`With ${homeCurrency} ${totalReduction.toFixed(2)} reduction in flexible expenses, user can afford.`);
        explanations.push(`Recommended reducing: ${changes ? changes.map(c => `${c.event_id} by ${c.reduction}`).join(', ') : 'N/A'}.`);
        break;
        
      case 'not_affordable':
        explanations.push(`Safe balance of ${homeCurrency} ${balanceInfo.safeBalance.toFixed(2)} insufficient for ${homeCurrency} ${requestAmount.toFixed(2)}.`);
        explanations.push(`Minimum balance requirement: ${homeCurrency} ${balanceInfo.minimumBalance.toFixed(2)}.`);
        if (balanceInfo.pendingExpenses > 0) {
          explanations.push(`Pending expenses: ${homeCurrency} ${balanceInfo.pendingExpenses.toFixed(2)}.`);
        }
        break;
    }
    
    // Add financial priorities context
    if (profile.financial_priorities) {
      explanations.push(`Priorities: ${profile.financial_priorities.replace(/\|/g, ', ')}.`);
    }
    
    // Add message context
    const msgs = this.messageMap.get(request.request_id) || [];
    msgs.forEach(msg => {
      if (msg.message_text) {
        explanations.push(`Note: ${msg.message_text.substring(0, 80)}...`);
      }
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

// Helper function to add days to a date
function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// ============================================================================
// API ROUTES
// ============================================================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(), 
    dataLoaded: financialData !== null,
    requestCount: financialData?.requests?.length || 0
  });
});

app.get('/api/data-status', (req, res) => {
  if (!financialData) {
    return res.status(503).json({ status: 'loading', message: 'Data not yet loaded' });
  }
  res.json({ 
    status: 'ready', 
    requestCount: financialData.requests?.length || 0,
    profileCount: financialData.profiles?.length || 0,
    eventCount: financialData.events?.length || 0
  });
});

app.get('/api/requests', async (req, res) => {
  try {
    if (!financialData || !financialData.requests || financialData.requests.length === 0) {
      return res.status(503).json({ error: 'Data not loaded yet', requests: [], analysis: [], currencies: [] });
    }
    
    const agent = new FinancialAgent(financialData);
    const results = agent.processAllRequests();
    
    const currencies = [...new Set(financialData.profiles.map(p => p.home_currency))];
    
    res.json({
      requests: financialData.requests,
      analysis: results,
      currencies: currencies
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
      events: financialData.events.filter(e => e.user_id === request.user_id).slice(0, 50),
      messages: financialData.messages.filter(m => m.request_id === req.params.id),
      images: financialData.images.filter(i => i.request_id === req.params.id)
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    if (!financialData || !financialData.requests || financialData.requests.length === 0) {
      return res.status(503).json({ stats: null, userBreakdown: {}, currencyStats: {}, categoryStats: {}, currencies: [] });
    }
    
    const agent = new FinancialAgent(financialData);
    const results = agent.processAllRequests();
    
    // Overall stats
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
    
    // User breakdown
    const userBreakdown = {};
    const profilesMap = new Map((financialData?.profiles || []).map(p => [p.user_id, p]));
    results.forEach((result, idx) => {
      const request = (financialData?.requests || [])[idx];
      if (!request) return;
      if (!userBreakdown[request.user_id]) {
        const profile = profilesMap.get(request.user_id);
        userBreakdown[request.user_id] = {
          affordableNow: 0,
          affordableWithPlan: 0,
          affordableLater: 0,
          notAffordable: 0,
          totalSafe: 0,
          currency: profile?.home_currency || 'Unknown'
        };
      }
      userBreakdown[request.user_id][result.affordability_status]++;
      userBreakdown[request.user_id].totalSafe += result.amount_safe_to_pay;
    });
    
    // Currency stats
    const currencyStats = {};
    (financialData?.profiles || []).forEach(profile => {
      const profileRequestIds = new Set((financialData?.requests || []).filter(r => r.user_id === profile.user_id).map(r => r.request_id));
      const profileResults = results.filter(r => profileRequestIds.has(r.request_id));
      if (profileResults.length > 0) {
        currencyStats[profile.home_currency] = {
          count: profileResults.length,
          totalSafe: profileResults.reduce((sum, r) => sum + r.amount_safe_to_pay, 0),
          affordableNow: profileResults.filter(r => r.affordability_status === 'affordable_now').length,
          affordableWithPlan: profileResults.filter(r => r.affordability_status === 'affordable_with_plan').length,
          affordableLater: profileResults.filter(r => r.affordability_status === 'affordable_later').length,
          notAffordable: profileResults.filter(r => r.affordability_status === 'not_affordable').length
        };
      }
    });
    
    // Category stats
    const categoryStats = {};
    (financialData?.requests || []).forEach((request, idx) => {
      if (!request || !results[idx]) return;
      const category = request.request_type || 'unknown';
      if (!categoryStats[category]) {
        categoryStats[category] = {
          count: 0,
          totalAmount: 0,
          totalSafe: 0,
          affordableNow: 0,
          affordableWithPlan: 0,
          affordableLater: 0,
          notAffordable: 0
        };
      }
      categoryStats[category].count++;
      categoryStats[category].totalAmount += parseFloat(request.requested_amount);
      categoryStats[category].totalSafe += results[idx].amount_safe_to_pay;
      categoryStats[category][results[idx].affordability_status]++;
    });
    
    res.json({
      stats,
      userBreakdown,
      currencyStats,
      categoryStats,
      currencies: Object.keys(currencyStats)
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/category-analysis', async (req, res) => {
  try {
    if (!financialData) {
      return res.status(503).json({ categories: [] });
    }
    
    const agent = new FinancialAgent(financialData);
    const results = agent.processAllRequests();
    
    const categories = {};
    financialData.requests.forEach((request, idx) => {
      const category = request.request_type || 'unknown';
      if (!categories[category]) {
        categories[category] = {
          count: 0,
          totalAmount: 0,
          totalSafe: 0,
          avgSafePercent: 0,
          statuses: { affordable_now: 0, affordable_with_plan: 0, affordable_later: 0, not_affordable: 0 },
          methods: { full_payment: 0, partial_payment: 0, installments: 0, wait: 0, not_recommended: 0 }
        };
      }
      categories[category].count++;
      categories[category].totalAmount += parseFloat(request.requested_amount);
      categories[category].totalSafe += results[idx].amount_safe_to_pay;
      categories[category].statuses[results[idx].affordability_status]++;
      categories[category].methods[results[idx].recommended_payment_method]++;
    });
    
    // Calculate averages
    Object.keys(categories).forEach(cat => {
      categories[cat].avgSafePercent = categories[cat].count > 0 
        ? (categories[cat].totalSafe / categories[cat].totalAmount * 100) 
        : 0;
    });
    
    res.json({ categories });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/user-analysis/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const profile = financialData.profiles.find(p => p.user_id === userId);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userRequests = financialData.requests.filter(r => r.user_id === userId);
    const agent = new FinancialAgent(financialData);
    const results = userRequests.map(r => agent.analyzeRequest(r));
    
    const userEvents = financialData.events.filter(e => e.user_id === userId);
    const userMessages = financialData.messages.filter(m => m.user_id === userId);
    
    res.json({
      profile: profile,
      requests: userRequests,
      analysis: results,
      events: userEvents.slice(0, 100),
      messages: userMessages.slice(0, 20)
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
    financialData = data;
    res.json({ 
      success: true, 
      message: 'Data loaded successfully', 
      count: financialData.requests.length,
      profiles: financialData.financial_profiles.length,
      events: financialData.financial_events.length
    });
  } catch (error) {
    console.error('Error loading data:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/exchange-rates', async (req, res) => {
  try {
    const rates = {};
    const currentDate = new Date().toISOString().split('T')[0];
    
    try {
      const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/USD`);
      if (response.data && response.data.rates) {
        rates['USD'] = response.data.rates;
      }
    } catch (e) {
      // Use dataset rates
      const datasetRates = financialData?.exchange_rates || [];
      const latestRates = datasetRates.filter(r => r.rate_date === '2026-09-15');
      if (latestRates.length > 0) {
        latestRates.forEach(r => {
          if (r.from_currency === 'USD') {
            if (!rates['USD']) rates['USD'] = {};
            rates['USD'][r.to_currency] = parseFloat(r.rate);
          }
        });
      }
    }
    
    res.json({ rates, base: 'USD', timestamp: currentDate });
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
    financialData = data;
    console.log(`📊 Loaded ${financialData.requests.length} requests`);
    console.log(`👤 Loaded ${financialData.financial_profiles.length} profiles`);
    console.log(`📅 Loaded ${financialData.financial_events.length} events`);
    console.log(`💳 Loaded ${financialData.request_payment_options.length} payment options`);
    console.log(`💬 Loaded ${financialData.messages.length} messages`);
    console.log(`🖼️ Loaded ${financialData.images.length} images`);
  } catch (error) {
    console.error('Failed to load data:', error.message);
  }
  
  if (!module.parent) {
    app.listen(PORT, HOST, () => {
      console.log(`\n🚀 Buy or Wait Solution running on http://${HOST || 'localhost'}:${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
      console.log(`📈 Dashboard: http://localhost:${PORT}/dashboard`);
      console.log(`📋 Requests: http://localhost:${PORT}/requests`);
      console.log(`📄 Export CSV: http://localhost:${PORT}/api/export-csv`);
      console.log(`\n💡 Using official HackerRank Orchestrate September 2026 dataset`);
    });
  }
}

startServer();

// Export for Vercel serverless
module.exports = app;

// Vercel serverless handler
module.exports.handler = async function(req, res) {
  // Ensure data is loaded before handling request
  if (!serverStarted) {
    await startServer();
  }
  
  // Set Vercel-specific headers
  res.setHeader('X-Vercel-Edge', 'true');
  
  return new Promise((resolve, reject) => {
    app(req, res, (result) => {
      if (result instanceof Error) {
        reject(result);
      } else {
        resolve(result);
      }
    });
  });
};