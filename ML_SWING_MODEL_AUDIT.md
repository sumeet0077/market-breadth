# Quantitative Audit & Architectural Specification: ML Swing Trade Follow-Through Pipeline

**Document Version:** 1.0  
**Target Asset Class:** Indian Equities (NSE Universe, ~2,400 Stocks)  
**Dataset Scope:** 2014 – 2026 (6.43M Daily Stock Records, 2,836 Trading Days)  
**Primary Objective:** Predict empirical forward swing breakout follow-through probabilities (\(t+1 \dots t+5\)) using daily market breadth signatures.

---

## 1. Executive Summary & Audit Scope

This audit evaluates the proposed Machine Learning pipeline designed to classify the daily **Swing Trade Follow-Through Environment**. It provides mathematical formulations, validation guardrails against overfitting, feature engineering rules, and verification criteria for independent agent review.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               PIPELINE ARCHITECTURE OVERVIEW                           │
├─────────────────────────┬──────────────────────────────┬───────────────────────────────┤
│ 1. DATA & TARGET        │ 2. FEATURE ENGINEERING       │ 3. ML MODEL & VALIDATION      │
│ • NSE Master Parquet    │ • Breadth Spread (20 vs 50)  │ • Purged Walk-Forward Split   │
│ • Min ₹1 Cr Liquidity   │ • Log Momentum Skew          │ • Monotonic LightGBM / Ridge  │
│ • MFE ≥ +5% / MAE ≤ -3% │ • 5D Rocket Pool Rate        │ • Platt Probability Calib     │
│ • Daily Aggregate Y_t   │ • Net New Highs Derivative   │ • Blind Test (2024–2026)      │
└─────────────────────────┴──────────────────────────────┴───────────────────────────────┘
```

---

## 2. Target Formulation Audit (Ground Truth Labeling)

### 2.1 Swing Setup Identification on Day \(t\)
To prevent illiquid penny stock distortions, candidate setups on Day \(t\) must satisfy:
1. **Liquidity Filter**: \(\text{Turnover}_t = \text{Close}_t \times \text{Volume}_t \ge ₹1.0\text{ Crore}\) (\(10^7\) INR).
2. **Setup Trigger**:
   $$\text{IsSetup}_{i,t} = \big(\text{Pct1D}_{i,t} \ge +4.0\%\big) \;\lor\; \big(\text{High}_{i,t} \ge \text{High52W}_{i,t}\big) \;\lor\; \big(\text{Close}_{i,t} > \text{SMA20}_{i,t} > \text{SMA50}_{i,t}\big)$$

### 2.2 Forward Outcome Classification (\(t+1 \dots t+5\))
For every identified setup stock \(i\) on day \(t\), evaluate its forward 5-day path:
* **Maximum Favorable Excursion (MFE)**:
  $$\text{MFE}_{i,t} = \max_{k=1..5}\left(\frac{\text{High}_{i,t+k} - \text{Close}_{i,t}}{\text{Close}_{i,t}}\right)$$
* **Maximum Adverse Excursion (MAE)**:
  $$\text{MAE}_{i,t} = \min_{k=1..5}\left(\frac{\text{Low}_{i,t+k} - \text{Close}_{i,t}}{\text{Close}_{i,t}}\right)$$
* **Binary Stock Follow-Through Label (\(y_{i,t}\))**:
  $$y_{i,t} = \begin{cases} 
  1 & \text{if } \text{MFE}_{i,t} \ge +5.0\% \text{ and } \text{MAE}_{i,t} > -3.5\% \\
  0 & \text{otherwise (failed breakout / stop-out)}
  \end{cases}$$

### 2.3 Daily Market Follow-Through Rate (\(Y_t\))
The target label for day \(t\) is the market-wide breakout success proportion:
$$Y_t = \frac{\sum_{i \in \text{Setups}_t} y_{i,t}}{|\text{Setups}_t|} \in [0.0, 1.0]$$

---

## 3. Complete Feature Engineering Matrix (12 Breadth + 4 Microstructure Alpha Factors)

### A. Core 12 Breadth Metrics (Scale-Invariant Ratios)
| # | Dashboard Metric | ML Feature Formulation | Quantitative Signal Meaning |
| :-: | :--- | :--- | :--- |
| **1** | `No. of stocks up 4.5%+` | `Pct_Up_4.5 = Up4.5 / TotalTraded` | Daily aggressive buying force / momentum ignition. |
| **2** | `No. of stocks down 4.5%+`| `Pct_Down_4.5 = Down4.5 / TotalTraded` | Daily aggressive selling force / distribution liquidation. |
| **3** | `No. of stocks up 20% in 5D` | `Rocket_Rate_5D = Up20_5D / TotalTraded` | Speculative high-beta risk appetite (leaders multi-day runs). |
| **4** | `No. of stocks down 20% in 5D`| `Dump_Rate_5D = Down20_5D / TotalTraded` | Extreme multi-day capital destruction / breakdown pressure. |
| **5** | `No of stocks above 20 SMA` | `Fast_Breadth_20 = Above20 / TotalTraded` | Short-term tactical trend participation (4-week trend). |
| **6** | `No of stocks above 50 SMA` | `Medium_Breadth_50 = Above50 / TotalTraded`| Intermediate swing trend participation (10-week trend). |
| **7** | `No of stocks above 200 SMA`| `Macro_Breadth_200 = Above200 / TotalTraded`| Long-term structural macro trend (1-year trend permission). |
| **8** | `No of stocks above All 3 SMAs`| `Triple_Alignment = AboveAll3 / TotalTraded` | Purest measure of multi-timeframe leadership density. |
| **9** | `Stocks which are positive` | `Advancers_Rate = Advancers / TotalTraded` | Overall market-wide advance participation. |
| **10**| `Stocks which are negative` | `Decliners_Rate = Decliners / TotalTraded` | Overall market-wide decline participation. |
| **11**| `Advance/Decline Ratio` | `Log_AD_Ratio = ln(max(AD_Ratio, 0.01))` | Normalized symmetry ratio & 5-day velocity (`AD_Velocity`). |
| **12**| `Net New Highs (52W)` | `NNH_Rate = (Highs52W - Lows52W) / Total` | Expansion velocity of 1-year leaders vs laggards. |

### B. High-Alpha Market Microstructure & Flow Features
| # | Alpha Factor | Mathematical Formulation | Signal Hypothesis |
| :-: | :--- | :--- | :--- |
| **13**| **Intraday Conviction Breadth (CLV)** | \(\text{Strong\_Closes\_Pct} = \frac{|\{i : \text{CLV}_i \ge 0.75\}|}{\text{TotalTraded}}\) where \(\text{CLV} = \frac{\text{Close}-\text{Low}}{\text{High}-\text{Low}}\) | High percentage of stocks closing on daily highs confirms institutional conviction vs intraday rejection traps. |
| **14**| **Rupee Volume Flow Breadth** | \(\text{Up\_Turnover\_Ratio} = \frac{\text{Turnover}(\text{Advancers})}{\text{Turnover}(\text{Advancers}) + \text{Turnover}(\text{Decliners})}\) | Measures where actual institutional capital is deploying, eliminating small-cap low-volume distortions. |
| **15**| **Thrust Age / Exhaustion Counter** | \(\text{Thrust\_Age} = \text{Consecutive days since } \text{Log\_AD\_Velocity} > 0 \text{ \& } \text{Fast\_Breadth} > 0.50\) | Distinguishes fresh high-conviction ignition (Days 1–4) from late-stage overextended exhaustion (Days 15+). |
| **16**| **Volatility Compression (VCP) Breadth** | \(\text{VCP\_Compression\_Rate} = \frac{|\{i : \text{ATR}_{5,i} < \text{ATR}_{20,i}\}|}{\text{TotalTraded}}\) | Measures market-wide energy coiling before large multi-week directional expansion moves. |

---

## 4. Anti-Overfitting & Validation Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                           PURGED WALK-FORWARD CROSS VALIDATION                           │
├───────────────────────────────┬───────────────────────────────┬──────────────────────────┤
│ FOLD 1: Train 2015-2018       │ [5D Embargo]                  │ Test: 2019 (Out-of-Sample)│
│ FOLD 2: Train 2015-2019       │ [5D Embargo]                  │ Test: 2020 (Out-of-Sample)│
│ FOLD 3: Train 2015-2020       │ [5D Embargo]                  │ Test: 2021 (Out-of-Sample)│
│ FOLD 4: Train 2015-2021       │ [5D Embargo]                  │ Test: 2022 (Out-of-Sample)│
│ FOLD 5: Train 2015-2022       │ [5D Embargo]                  │ Test: 2023 (Out-of-Sample)│
├───────────────────────────────┴───────────────────────────────┴──────────────────────────┤
│ 🔒 BLIND FINAL TEST: 2024 – 2026 (Held-out untouched until final verification)           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Strict Leakage Prevention Rules
1. **Zero Lookahead**: Features on day \(t\) use only information known at or before \(t\) (3:30 PM IST close). Target outcome uses \(t+1 \dots t+5\).
2. **Purging & 5-Day Embargo**: A 5-day gap is enforced between training folds and test folds to eliminate label overlap contamination.
3. **Monotonicity Constraints**: In tree-based models (e.g. LightGBM), enforce monotonic constraints: higher `Breadth_Spread`, `Log_Momentum_Skew`, and `Rocket_Ratio` must non-decrease the predicted follow-through probability.

---

## 5. Model Architecture & Calibration

### 5.1 Ensemble Selection
* **Model 1: Calibrated Regularized Ridge / Logistic Regression** (High stability, linear interpretability).
* **Model 2: Monotonic Gradient Boosted Trees** (Captures non-linear regime interactions without overfitting).
* **Meta-Model**: Isotonic / Platt Probability Calibrator.

### 5.2 Calibrated Output Regimes & Action Plan

| Output Score | Calibrated Win Rate | Regime Designation | Trader Execution Protocol |
| :---: | :---: | :--- | :--- |
| **75 – 100** | **\(\mathbf{\ge 70\%}\)** | 🟢 **High Follow-Through** | **Full Aggressive Size (100% Equity)**. Buy breakouts & flags, hold for multi-day runners. |
| **45 – 74** | **\(45\% - 70\%\)** | 🟡 **Selective Momentum** | **Fast Swings (50% Equity / 50% Cash)**. Take 5–8% partial profits quickly, tighten stops. |
| **0 – 44** | **\(\mathbf{< 45\%}\)** | 🔴 **High Failure Risk** | **Defensive (80–100% Cash)**. High probability of false breakouts and trap reversals. |

---

## 6. Audit Checklist for Reviewing Agent

- [x] **Target Definition**: Evaluates forward 5-day MFE vs MAE on liquid stocks (\(\ge\) ₹1 Cr).
- [x] **Scale Invariance**: All features normalized by universe size to eliminate 2015–2026 universe growth bias.
- [x] **No Lookahead Bias**: Exact separation between \(t\) features and \(t+1 \dots t+5\) labels.
- [x] **Purged Cross-Validation**: 5-day embargo between walk-forward folds.
- [x] **Probabilistic Calibration**: Output scores (0–100) map directly to empirical breakout success percentages.
- [x] **Compatibility**: Non-breaking integration with existing dashboard schema.
