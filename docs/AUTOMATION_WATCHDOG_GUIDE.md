# 🛡️ Market Breadth Pipeline: Multi-Tier Automation Architecture

This document describes the multi-tiered automation and redundancy system implemented to guarantee that the Market Breadth Dashboard updates every market day without fail.

---

## 1. Dual Independent GitHub Actions Workflows

GitHub treats distinct workflow files as independent queue tokens with separate scheduling clocks. By running two independent workflows with offset intervals, queue starvation on one workflow does not impact the other.

| Workflow | File | Schedule (IST) | Schedule (UTC) | Cadence |
| :--- | :--- | :--- | :--- | :--- |
| **Primary** | `.github/workflows/daily_update.yml` | 16:44 – 23:24 IST | 11:14 – 17:54 UTC | Runs at `:14`, `:34`, `:54` |
| **Fallback** | `.github/workflows/daily_update_fallback.yml` | 16:34 – 23:14 IST | 11:04 – 17:44 UTC | Runs at `:04`, `:24`, `:44` |

* **Combined Frequency**: Every **10 minutes** throughout the entire 16:30 – 23:30 IST window.
* **Concurrency Protection**: Both workflows share the `concurrency.group = data-pipeline-execution` so only one runner executes at a time, preventing race conditions or merge conflicts.
* **Failsafe Check**: If data for today is already ingested and committed, any subsequent run automatically detects `git status -s` is clean and exits within 5 seconds without burning runner minutes.

---

## 2. External Webhook Trigger (Zero-Lag Redundancy)

Both workflows support GitHub's `repository_dispatch` trigger. This allows any external service (e.g. [cron-job.org](https://cron-job.org), Cloudflare Worker, or uptime monitor) to trigger the pipeline **instantly within seconds**, bypassing GitHub's internal cron timer entirely.

### How to Set Up a Free External Ping (Optional, 2 Minutes Setup):

1. **Generate a Fine-Grained GitHub Personal Access Token**:
   * Go to GitHub: **Settings** → **Developer Settings** → **Personal Access Tokens** → **Fine-grained tokens**.
   * Select Repository: `sumeet0077/market-breadth`.
   * Permissions: `Contents: Read and Write` (or `Actions: Read and Write`).
2. **Configure on [cron-job.org](https://cron-job.org) (Free)**:
   * **URL**: `https://api.github.com/repos/sumeet0077/market-breadth/dispatches`
   * **Method**: `POST`
   * **Headers**:
     * `Accept: application/vnd.github.v3+json`
     * `Authorization: Bearer YOUR_GITHUB_TOKEN`
     * `User-Agent: MarketBreadth-Watchdog`
   * **Request Body**:
     ```json
     {
       "event_type": "daily_data_update"
     }
     ```
   * **Schedule**: Weekdays at 18:30 IST, 19:30 IST, 20:30 IST.

---

## 3. Manual 1-Click Trigger

You can trigger the pipeline manually anytime with a single click:
1. Go to repository on GitHub → **Actions** tab.
2. Select **Daily Data Update (Primary)** or **Daily Data Update (Fallback Watchdog)**.
3. Click **Run workflow** → Select `main` branch → Click **Run workflow**.
