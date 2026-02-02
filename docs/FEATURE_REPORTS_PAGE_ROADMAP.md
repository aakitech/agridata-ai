# Feature Roadmap - Reports Page Evolution

**Version:** v0.1 - Planning Phase  
**Last Updated:** February 2, 2026  
**Status:** 🚧 Planned / In Progress

---

## Overview

This document tracks the planned evolution of the "Recent Activity" feature into a comprehensive **Reports Page**. The goal is to provide users with full visibility into all trap observations, not just the most recent 5, while maintaining the operational focus of the dashboard.

**Primary User Question:** *"Show me everything that's been reported and let me find specific information quickly."*

---

## Current State

### Recent Activity Panel (Dashboard)

**What Exists Today:**
- Shows **5 most recent reports** only
- Card-based list view with avatar, officer, time, count, pest type, severity
- Click to open detail dialog with full report information
- Reverse geocoding shows location names
- Organized chronologically (newest first)

**Limitations:**
- Limited to 5 reports - users can't see full history
- No filtering or search capabilities
- No way to view reports by location/trap
- No bulk operations or exports (deferred)
- Truncated view forces users to guess "what else happened?"

---

## Proposed Solution: Dedicated Reports Page

### Goal
Create a new `/dashboard/reports` route that provides comprehensive report visibility with dual view modes, advanced filtering, and location-based grouping.

---

## Planned Features

### 1. Dual View Modes

#### A. Grouped View (Default)
**Purpose:** See "what's happening at each trap/location"

**Layout:**
- Left sidebar: List of all unique locations with summary cards
- Right panel: Detailed view of selected location's history

**Location Card Shows:**
- Reverse geocoded location name (suburb, city, state)
- GPS coordinates (lat, lon to 4dp)
- Total report count
- Current status (severity badge)
- Last reported time ("2 days ago")
- Trend indicator (↑ ↓ →)

**Selected Location Panel Shows:**
- Location header with coordinates
- Current status summary:
  - Current severity (HIGH/WARNING/NORMAL)
  - "Last reported X days ago"
  - Trend (increasing/decreasing/stable)
  - Latest count and pest type
- Expandable history list:
  - All reports at this location (newest first)
  - Each report: date, officer, count, pest, severity
  - Click for full report details

**Why This View:**
- Matches map behavior (locations grouped by ~25m)
- Answers "Which traps need attention?" at a glance
- Shows full history per location (not just recent)
- Identifies trends over time per trap

#### B. List View (Chronological)
**Purpose:** See "everything that happened recently across all sites"

**Layout:**
- Flat table with all reports
- Sortable columns
- Pagination (25 reports per page)

**Table Columns:**
- Date (sortable)
- Officer (with avatar)
- Count
- Pest type
- Severity (badge)
- Location (reverse geocoded name + coordinates)

**Features:**
- Sort by any column
- Row click opens report detail dialog
- Page numbers (not infinite scroll)
- Shows 25 reports per page

**Why This View:**
- Traditional audit trail view
- Good for finding specific reports by date/officer
- Chronological flow helps identify reporting patterns
- Paginated for performance with large datasets

---

### 2. Advanced Filtering

**Time Range Selector:**
- Options: Last 7 days, Last 30 days, Last 90 days, All time
- Default: Last 30 days
- Updates both views simultaneously

**Severity Filter:**
- Quick toggle buttons: All, High, Warning, Normal
- Multi-select capability (future)

**Organization Filter:**
- Dropdown for super_admin users
- Shows "All Organizations" or specific org
- Officers see only their org (no filter)

**Officer Filter (Future):**
- Dropdown of active officers
- Filter to see specific scout's reports

---

### 3. View Persistence

**User Preference Storage:**
- Remember last used view mode (Grouped vs List)
- Persist in localStorage
- Default: Grouped view
- Applies per user/browser

**Why:** Users typically prefer one view for their workflow. Reduces clicks.

---

### 4. Navigation & Integration

**From Dashboard:**
- "View All Reports →" button in Recent Activity panel
- Click navigates to `/dashboard/reports`

**Sidebar:**
- "Reports" icon in left navigation (FileText icon)
- Active state highlighting

**Breadcrumb:**
- Dashboard → Reports

---

## Technical Implementation Plan

### New Files to Create

**Pages:**
- `src/app/dashboard/reports/page.tsx` - Main reports page container

**Components:**
- `src/app/dashboard/reports/_components/view-toggle.tsx` - Grouped/List switch
- `src/app/dashboard/reports/_components/time-range-selector.tsx` - Date range dropdown
- `src/app/dashboard/reports/_components/filter-bar.tsx` - Severity/org filters
- `src/app/dashboard/reports/_components/grouped-view.tsx` - Location-based layout
- `src/app/dashboard/reports/_components/location-sidebar.tsx` - Location list
- `src/app/dashboard/reports/_components/location-card.tsx` - Individual location summary
- `src/app/dashboard/reports/_components/location-detail.tsx` - Selected location panel
- `src/app/dashboard/reports/_components/report-history-list.tsx` - History table
- `src/app/dashboard/reports/_components/list-view.tsx` - Flat table container
- `src/app/dashboard/reports/_components/report-table.tsx` - Paginated table

**API:**
- Extend `src/server/api/routers/analytics.ts`
  - `getAllReports()` - Paginated flat list
  - `getReportsByLocation()` - Grouped by location bucket
- Extend `src/server/modules/analytics/analytics-service.ts`
  - Query optimization for large datasets
  - Efficient grouping algorithm

### Files to Modify

**Navigation:**
- `src/app/dashboard/_components/sidebar-nav.tsx` - Add Reports link
- `src/app/dashboard/_components/recent-activity.tsx` - Add "View All" button

---

## User Experience Flow

### Scenario 1: Checking Trap Status
1. User navigates to Reports page
2. Grouped view loads (default)
3. Sees list of all trap locations in sidebar
4. Locations sorted by most recent activity
5. Red/amber badges indicate which need attention
6. Clicks location with HIGH severity
7. Right panel shows full history
8. Identifies trend (e.g., "increasing from 5 to 20 over 3 days")
9. Takes action based on trend

### Scenario 2: Finding Specific Report
1. User switches to List view
2. Sorts by date (newest first)
3. Or sorts by officer to find specific scout's reports
4. Uses severity filter to narrow down
5. Finds report in table
6. Clicks row for full details

### Scenario 3: Weekly Review
1. User sets time range to "Last 7 days"
2. Views Grouped mode to see which traps were active
3. Checks List mode to see chronological activity
4. Reviews trends to identify problem areas

---

## Design Decisions

### Why Grouped View Default?
- Matches map mental model (locations grouped by GPS)
- Operational focus: "Which traps need attention?"
- Reduces cognitive load vs scanning long chronological list

### Why 25 Reports Per Page?
- Balance between performance and usability
- Typical user review: 25 reports is manageable
- Pagination easier to navigate than infinite scroll

### Why LocalStorage for View Preference?
- Simple, no backend storage needed
- Persists across sessions
- User-specific (different users prefer different views)

### Why No Search (Yet)?
- MVP scope control
- Filters (time, severity, org) cover 80% of use cases
- Search adds complexity (officer names, locations, pest types)
- Can be added in v1.1

### Why No Export (Yet)?
- Deferred to post-pilot
- Current PDF report generation covers export needs
- CSV/Excel export adds complexity (formatting, data selection)
- Can be added when bulk operations implemented

---

## Testing Considerations

### Edge Cases
- **No reports in time range:** Show empty state with "No reports found" message
- **No location data:** Show coordinates instead of "Unknown Location"
- **Single report at location:** Show "No prior data" in trend section
- **Large dataset (1000+ reports):** Test pagination performance
- **Mobile view:** Stack sidebar above detail panel (responsive)

### Performance Targets
- Page load: < 2 seconds
- Filter change: < 1 second
- View toggle: < 500ms
- Pagination: < 500ms

---

## Deferred to Future Versions

### v1.1 - Search & Filter Enhancements
- Search by officer name
- Search by location name
- Search by pest type
- Date range picker (custom dates)
- Multi-select severity filter

### v1.2 - Bulk Operations
- Select multiple reports
- Bulk status update
- Export to CSV/Excel
- Bulk delete (admin only)

### v1.3 - Advanced Analytics
- Report statistics per location
- Officer performance metrics
- Pest trend analysis
- Automated anomaly detection

---

## Related Documents

- `FEATURE_MAP_MVP.md` - Map behavior changes (complementary)
- `MAP_SPECIFICATION_MVP.md` - Original map requirements
- `PRODUCTION_READINESS.md` - Deployment checklist

---

## Changelog

### v0.1 (2026-02-02) - Planning Phase
- Documented requirements and rationale
- Defined dual view approach
- Specified technical implementation
- Deferred search/export to future versions

### Next Steps
1. Implement core page structure
2. Build Grouped view components
3. Build List view components
4. Add filtering capabilities
5. Test with real data
6. Deploy to staging

---

**Document Owner:** AgriData AI Product Team  
**Status:** In Development  
**Priority:** High (user-requested feature)

---

## Open Questions

1. Should we add a "Map View" button on location cards to center map on that trap?
2. Should reports be editable from this page (for correcting mistakes)?
3. Do we need a "Mark as Reviewed" feature for audit trails?
4. Should we show photo thumbnails in the list view?

**Decision:** Defer these to post-pilot feedback. Focus on core view/filter functionality for MVP.
