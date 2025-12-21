# AgriData AI: Analytics Dashboard Specification
**Version:** 1.0.0
**Context:** A high-level internal dashboard for Organization Admins and Super Admins to visualize field data.

## 1. Overview
The Analytics Dashboard complements the operational Triage tool by providing strategic insights. It aggregates data collected via the WhatsApp bot to show trends, distributions, and geographic spread.

### Target Audience
- **Super Admins**: View platform-wide statistics and filter by Organization.
- **Organization Admins (e.g., MPBC)**: View statistics specific to their own organization's data.

## 2. Core Features

### 2.1 High-Level Metrics (The "Scorecard")
A row of key metric cards at the top of the dashboard.
- **Total Reports**: Volume of data coming in.
- **Reports this Week**: Trend indicator (up/down).
- **Active Scouts**: Number of unique users submitting data.
- **Risk Overview**: Percentage of High vs Low risk reports.

### 2.2 Geographic Visualization (The Map)
A visual representation of *where* data is coming from in Zimbabwe.
- **Component**: Leaflet Map (reusing existing map infrastructure).
- **Features**:
    - **Clustering**: Group nearby reports to avoid clutter.
    - **Heatmap Layer**: Optional view to show density of outbreaks.
    - **Filters**: By Date Range, Pest Type.

### 2.3 Charts & Trends
- **Reports Over Time**: Line/Area chart showing submission volume (Daily/Weekly).
- **Pest Distribution**: Pie/Bar chart showing most common pests/diseases.
- **Status Breakdown**: Verified vs Rejected vs Pending.

### 2.4 Data Table (Recent Activity)
A condensed list of the most recent valid reports, similar to the "Documents" section in the inspiration image, but focusing on rapid insight (e.g., "New Fall Armyworm report from Mutare").

## 3. UI/UX Design

### Inspiration
- **Style**: Modern, clean, "Shadcn UI" aesthetic.
- **Layout**: 
    - **Sidebar Navigation**: Dashboard, Triage, Settings.
    - **Main Content**: Grid layout.
        - Top: Metrics Cards (4 columns).
        - Middle: Main Chart (Reports over Time) + Pest Distribution.
        - Bottom: Large Map View + Recent Activity List.

### Navigation Structure
- `/dashboard` (New Landing Page for Admins)
- `/triage` (Existing Triage Tool)
- `/settings` (Org Management)

## 4. Technical Stack

- **Charts**: `recharts` (Standard for React/Next.js).
- **Maps**: `react-leaflet` (Already in use).
- **UI Components**: `shadcn/ui` (Cards, Selects, Tables).
- **Data Fetching**: `tRPC` (New router: `analytics`).

## 5. Security & Multi-Tenancy
- **Authentication**: Reuse existing session logic.
- **Authorization**:
    - **Super Admin**: Endpoint returns aggregated data for ALL orgs. Supports `filterOrgId` param.
    - **Org Admin**: Endpoint strictly filters by `ctx.appUser.orgId`.

## 6. Implementation Plan
1.  **Backend**: Create `analyticsRouter` with aggregation queries (count, group by date, group by category).
2.  **UI Shell**: Create `/dashboard` layout with Sidebar.
3.  **Components**: Implement Metric Cards, Chart wrappers, and Map widget.
4.  **Integration**: Connect UI to tRPC endpoints.
