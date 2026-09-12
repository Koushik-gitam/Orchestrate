# Buy or Wait - Financial Agent Solution

AI-powered financial decision agent for HackerRank Orchestrate September 2026 Challenge.

## Problem Statement

Build an AI-powered financial agent that decides whether a user can safely afford a requested expense. The agent must account for:
- Recurring expenses and pending payments
- Essential spending requirements
- Confirmed income and available payment options
- Personalized recommendations based on user priorities

### Decision Categories
- **affordable_now**: Can pay immediately
- **affordable_with_plan**: Can pay with a partial/installment plan
- **affordable_later**: Can pay after waiting
- **not_affordable**: Cannot safely afford

### Payment Methods
- **full_payment**: Pay in full immediately
- **partial_payment**: Pay partially now, rest later
- **installments**: Use installment plan
- **wait**: Delay the purchase
- **not_recommended**: Don't proceed

## Features

### Rich Dashboard
- Real-time statistics visualization
- Interactive charts (Chart.js)
- Affordability distribution donut chart
- Payment method breakdown bar chart
- Currency-wise analysis

### Request Analysis
- Detailed view of each request
- Payment plan visualization
- Decision reasoning display
- Spending change recommendations

### Modern UI
- Dark theme with gradient accents
- Responsive sidebar navigation
- Interactive data tables with sorting
- Modal-based detail views
- Toast notifications

### Free API Integration
- Exchange rate API (exchangerate-api.com - free tier)
- Fallback to hardcoded rates when API unavailable
- Currency conversion support

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: vanilla JavaScript + CSS
- **Charts**: Chart.js
- **API**: Free exchange rate APIs

## Installation & Running

```bash
# Navigate to project directory
cd buy-or-wait-solution

# Install dependencies
npm install

# Start the server
npm start
```

The app will be available at `http://localhost:3000`

## Access Points

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/` or `/dashboard` | Main analytics overview |
| Requests | `/requests` | All requests table |
| Analysis | `/analysis` | Individual request details |
| Export | `/export` | CSV export download |

## API Endpoints

### GET /api/health
Health check endpoint

### GET /api/requests
Get all requests with analysis

### GET /api/requests/:id
Get single request analysis

### GET /api/dashboard
Get dashboard statistics

### GET /api/export-csv
Download output.csv

### POST /api/load-data
Load dataset files (triggered automatically)

### GET /api/exchange-rates
Get current exchange rates

## Output CSV Format

The solution generates `output.csv` with these columns:

| Column | Description |
|--------|-------------|
| request_id | The request being answered |
| amount_safe_to_pay | Largest safe amount to pay (0 <= x <= requested) |
| affordability_status | One of 4 status values |
| recommended_payment_method | One of 5 payment methods |
| payment_plan | Chronological date:amount entries joined by `|` |
| earliest_date_for_full_payment | Earliest date full amount is safe |
| spending_changes_needed | Up to 3 stop:/reduce_to: changes |
| decision_explanation | Financial reasoning |

## Data Flow

1. Load CSV files from `dataset/` directory
2. Build financial profiles, events, requests, payment options
3. Process each request through financial agent
4. Generate analysis for all 250 requests
5. Serve via REST API to frontend

## Financial Agent Logic

The agent considers:
- Current balance and minimum balance requirements
- Pending and confirmed transactions
- Recurring expense flexibility
- Payment option availability
- User priorities and preferences
- Message and image context

### Decision Tree
1. Can afford immediately? → full_payment
2. Can afford with partial plan? → partial_payment
3. Installment plan available and affordable? → installments
4. Can afford later? → wait
5. Spending changes can help? → partial_with_changes
6. None of above? → not_affordable

## Free APIs Used

| API | Purpose | Cost |
|-----|---------|------|
| exchangerate-api.com | Currency exchange rates | Free tier |
| Fallback rates | Offline currency conversion | Free |

### Adding Your Own API Keys

Create `.env` file:
```env
EXCHANGE_RATE_API=https://api.exchangerate-api.com/v4/latest/
# Add other API keys as needed
```

## Demo Data

If dataset files are not present, the system uses realistic demo data with 5 users and 5 requests across different currencies (USD, EUR, INR, ZAR, IDR).

## Project Structure

```
buy-or-wait-solution/
├── server/
│   └── index.js          # Main server & financial agent
├── public/
│   ├── index.html        # Main HTML
│   ├── styles.css        # Rich UI styles
│   └── script.js         # Frontend logic
├── dataset/              # Input data (from HackerRank)
│   ├── requests.csv
│   ├── financial_profiles.csv
│   ├── financial_events.csv
│   └── ...
├── .env                  # Environment config
├── package.json
└── README.md
```

## Challenge Submission

For HackerRank submission, you need:
1. `code.zip` - Complete solution
2. `output.csv` - Predictions for all requests
3. `chat_transcript` - Development log

The `/api/export-csv` endpoint generates the required CSV format.
