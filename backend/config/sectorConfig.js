/**
 * Consolidated Sector Classification & Metric Mapping Configuration
 */

export const classifySector = (symbol = '', name = '') => {
  const sym = symbol.toUpperCase();
  const nm = name.toLowerCase();

  // Renewable Energy
  if (sym === 'SUZLON' || sym === 'ADANIGREEN' || sym === 'IREDA' || nm.includes('green energy') || nm.includes('solar') || nm.includes('renewable') || nm.includes('wind power')) {
    return 'Renewable Energy';
  }
  // Banking
  if (sym.endsWith('BANK') || nm.includes(' bank ') || nm.includes(' bank') || nm.includes('banking') || nm.includes('cooperative bank')) {
    return 'Banking';
  }
  // IT Services
  if (sym === 'TCS' || sym === 'INFY' || sym === 'HCLTECH' || sym === 'WIPRO' || sym === 'COFORGE' || sym === 'LTIM' || sym === 'TECHM' || nm.includes('technology') || nm.includes('technologies') || nm.includes('software') || nm.includes('infotech') || nm.includes('consultancy services') || nm.includes('digital solutions')) {
    return 'IT Services';
  }
  // Pharma
  if (sym === 'SUNPHARMA' || sym === 'CIPLA' || sym === 'DRREDDY' || nm.includes('pharma') || nm.includes('pharmaceutical') || nm.includes('healthcare') || nm.includes('drugs') || nm.includes('laboratories') || nm.includes('hospitals') || nm.includes('lifesciences')) {
    return 'Pharma';
  }
  // FMCG
  if (sym === 'ITC' || sym === 'HINDUNILVR' || sym === 'NESTLEIND' || sym === 'BRITANNIA' || nm.includes('consumer') || nm.includes('foods') || nm.includes('breweries') || nm.includes('beverage') || nm.includes('agro') || nm.includes('sugar') || nm.includes('dairy') || nm.includes('distillers') || nm.includes('spices')) {
    return 'FMCG';
  }
  // Automobile
  if (sym === 'TATAMOTORS' || sym === 'M&M' || sym === 'MARUTI' || sym === 'ASHOKLEY' || nm.includes('motors') || nm.includes('automotive') || nm.includes('auto ') || nm.includes('tyre') || nm.includes('bearing') || nm.includes('gears') || nm.includes('forgings')) {
    return 'Automobile';
  }
  // Energy
  if (sym === 'RELIANCE' || sym === 'ONGC' || sym === 'NTPC' || sym === 'POWERGRID' || nm.includes('power') || nm.includes('energy') || nm.includes('petroleum') || nm.includes('refining') || nm.includes('oil & gas') || nm.includes('coal')) {
    return 'Energy';
  }
  // Metals
  if (sym === 'TATASTEEL' || sym === 'JSWSTEEL' || sym === 'HINDALCO' || sym === 'VEDL' || nm.includes('steel') || nm.includes('metal') || nm.includes('iron') || nm.includes('aluminum') || nm.includes('zinc') || nm.includes('copper') || nm.includes('alloys')) {
    return 'Metals';
  }
  // Infrastructure
  if (sym === 'LT' || sym === 'DLF' || nm.includes('infrastructure') || nm.includes('construction') || nm.includes('developers') || nm.includes('realty') || nm.includes('estates') || nm.includes('cement') || nm.includes('housing') || nm.includes('infra')) {
    return 'Infrastructure';
  }
  // PSU
  if (sym === 'HAL' || sym === 'BEL' || sym === 'BHEL' || nm.includes('bharat electronics') || nm.includes('hindustan aeronautics') || nm.includes('corporation of india')) {
    return 'PSU';
  }

  return 'General';
};

export const SECTORS_METRIC_MAP = {
  'Banking': {
    name: 'Banking Stocks',
    params: {
      nim_growth: 'Net Interest Margin (NIM) Growth (%)',
      gross_npa: 'Gross NPA (%)',
      net_npa: 'Net NPA (%)',
      credit_growth: 'Credit Growth (%)',
      deposit_growth: 'Deposit Growth (%)',
      repo_rate: 'RBI Repo Rate (%)',
      banking_sentiment: 'Banking Sector Sentiment (Positive/Neutral/Negative)',
      fii_activity: 'FII Activity in Financials (Net Buy/Sell)'
    }
  },
  'IT Services': {
    name: 'IT Stocks',
    params: {
      usd_inr: 'USD/INR Currency Impact',
      deal_wins: 'New Deal Wins ($ Value/Pipeline)',
      attrition_rate: 'Employee Attrition Rate (%)',
      us_recession_probability: 'US Recession Probability (%)',
      nasdaq_trend: 'NASDAQ Trend / Tech Index Movement',
      ai_adoption_score: 'AI Adoption Score (1-10)',
      quarterly_growth: 'Quarterly Revenue Growth (%)'
    }
  },
  'Pharma': {
    name: 'Pharma Stocks',
    params: {
      usfda_status: 'USFDA Plant Audit Status (Clear/Warning Letter/OAI)',
      anda_approvals: 'ANDA Approvals Count',
      r_and_d_spend: 'R&D Spend as % of Revenue',
      export_growth: 'Export Market Growth (%)',
      currency_strength: 'USD Strength Impact',
      plant_inspection_risk: 'Plant Inspection Risk Level (Low/Medium/High)'
    }
  },
  'FMCG': {
    name: 'FMCG Stocks',
    params: {
      rural_demand_index: 'Rural Demand Index (Strong/Moderate/Weak)',
      urban_consumption: 'Urban Consumption Growth (%)',
      raw_material_inflation: 'Raw Material Inflation (High/Moderate/Low)',
      brand_strength: 'Brand Pricing Power / Strength (1-10)',
      monsoon_quality: 'Monsoon Impact Quality (Normal/Deficit/Excess)',
      consumer_sentiment: 'Consumer Sentiment Score (1-10)'
    }
  },
  'Automobile': {
    name: 'Automobile Stocks',
    params: {
      monthly_sales_growth: 'Monthly Sales Volume Growth YoY (%)',
      ev_penetration: 'EV Sales Penetration Rate (%)',
      steel_price: 'Steel / Commodity Price Impact',
      fuel_price: 'Fuel Price Level (Petrol/Diesel/CNG)',
      consumer_financing_rate: 'Consumer Vehicle Financing Rate (%)',
      vehicle_waiting_period: 'Average Vehicle Waiting Period (Days/Months)'
    }
  },
  'Energy': {
    name: 'Energy / Oil & Gas',
    params: {
      crude_price: 'Crude Oil Price ($ per Barrel)',
      opec_decision: 'OPEC Supply Decisions Impact',
      refining_margin: 'Gross Refining Margin (GRM) ($/bbl)',
      subsidy_risk: 'Government Subsidy / Windfall Tax Risk',
      gas_price: 'Domestic / Global Natural Gas Prices'
    }
  },
  'Metals': {
    name: 'Metal Stocks',
    params: {
      iron_ore_price: 'Iron Ore / Coking Coal Prices ($/ton)',
      china_demand: 'China Industrial Steel Demand Outlook',
      commodity_cycle_phase: 'Commodity Cycle Phase (Upcycle/Downcycle)',
      infra_spending: 'Domestic Infrastructure Spending Growth',
      export_duty: 'Government Export/Import Duty Impact'
    }
  },
  'Infrastructure': {
    name: 'Real Estate / Infrastructure Stocks',
    params: {
      home_loan_rate: 'Home Loan Interest Rates (%)',
      housing_demand: 'Residential/Commercial Housing Demand',
      inventory_level: 'Unsold Real Estate Inventory (Months)',
      cement_price: 'Cement & Construction Material Cost Trend',
      premium_housing_sales: 'Premium Housing Sales Share (%)'
    }
  },
  'PSU': {
    name: 'PSU (Public Sector Undertakings) Stocks',
    params: {
      government_policy_score: 'Government Policy Support Score (1-10)',
      budget_allocations: 'Union Budget Capital Outlay & Allocations',
      disinvestment_probability: 'Disinvestment/Privatization News Probability',
      election_cycle: 'Election Cycle Spending Impact',
      dividend_yield: 'Dividend Yield (%)'
    }
  },
  'Renewable Energy': {
    name: 'Renewable Energy Stocks',
    params: {
      green_energy_policy: 'Government Subsidies & Carbon Policy Support',
      solar_module_price: 'Solar Module & Component Prices ($/watt)',
      project_pipeline: 'Active Project Pipeline (GW Capacity)',
      power_demand_growth: 'Green Power Grid Demand Growth (%)',
      carbon_credit_market: 'Carbon Credit Market Activity & Realization'
    }
  }
};
