# Feature Changelog - Map Behavior & Clutter Reduction

**Version:** MVP Pilot - v1.0.0  
**Last Updated:** February 2, 2026  
**Status:** ✅ Implemented & Tested

---

## Overview

This document tracks the evolution of the AgriData AI map functionality from a raw data dump to an operational decision-making tool. The goal was to reduce visual clutter, prioritize recent and actionable information, and support institutional users (e.g. MPBC) in identifying where attention or intervention is needed *now*.

**Primary User Question:** *"Where do we need to pay attention right now?"*

---

## Changes Implemented

### 1. GPS Location Bucketing - Precision Adjustment

**What Changed:**
- Increased location bucketing radius from ~11m (4 decimal places) to ~25m (0.0002° steps)
- Reports within ~25m now collapse into a single marker

**Why:**
- GPS jitter was creating multiple markers for the same physical trap/location
- Field officers submitting from slightly different positions around the same trap caused visual clutter
- ~25m provides better coverage for trap locations while still distinguishing separate farms

**Technical Details:**
- Modified: `src/server/modules/analytics/analytics-service.ts`
- Function: `roundTo25m()` replaces `roundTo4dp()`
- Implementation: `Math.round(n * 5000) / 5000` creates ~0.0002° buckets

**Impact:**
- Single marker per trap location (within 25m radius)
- Cleaner map visualization
- Reduced marker overlap

---

### 2. Severity Calculation Bug Fix

**What Changed:**
- Fixed fallback severity logic for organizations without custom thresholds
- Count = 0 now correctly shows NORMAL (green) instead of WARNING (amber)

**Previous Behavior (Bug):**
```
if (observedCount < 10) return WARNING  // Even 0 was WARNING!
```

**New Behavior:**
```
if (observedCount === 0) return NORMAL
if (observedCount <= 20) return WARNING
else return HIGH
```

**Why:**
- Zero-count reports indicate "no pests found" - this is good news (NORMAL)
- Previous logic was overly conservative and misleading
- Field officers were confused seeing WARNING for zero counts

**Technical Details:**
- Modified: `src/server/modules/alerts/alerts-service.ts`
- Method: `computeSeverity()` fallback logic
- Applies to: Organizations without custom alert thresholds

---

### 3. Location-Level Collapsing

**What Changed:**
- Map now displays ONE marker per unique location (GPS bucket)
- Marker reflects the **latest report** within the selected time window
- Historical reports hidden from map but preserved in popup history

**Implementation:**
- Backend groups reports by bucketed GPS coordinates
- Sorts by date descending, takes most recent as marker state
- Returns `recentHistory` array (last 3-5 reports) for popup display

**Why:**
- "Current Situation Over History" - map represents current state, not full history
- "One Location = One State" principle
- Eliminates radiating/overlapping markers from GPS jitter

**Technical Details:**
- Modified: `src/server/modules/analytics/analytics-service.ts`
- Method: `getMapPoints()` - now groups by location bucket
- Returns: `MapPoint` with `locationKey`, `recentHistory`, `recency`

---

### 4. Active Alerts Filter (Latest-State Semantics)

**What Changed:**
- Added toggle: "Show Active Alerts Only"
- Filter applies **after** location collapsing
- Only shows locations where **latest** report is HIGH or WARNING

**Why:**
- Prevents false positives: if a trap had a HIGH alert yesterday but NORMAL today, it's cleared
- Previous behavior showed any location with ANY high/warning report in window
- Critical for operational decision-making - shows only current threats

**Technical Details:**
- Modified: `src/server/modules/analytics/analytics-service.ts`
- Method: `getMapPoints()` - post-collapse filtering
- UI: Added to dashboard header with Switch component

**Behavior:**
- OFF: Show all active locations (NORMAL, WARNING, HIGH)
- ON: Show only WARNING and HIGH locations
- Correctly hides cleared locations (latest=NORMAL even if historical HIGH)

---

### 5. Enhanced Marker Popups

**What Changed:**
- Popup now shows:
  - Latest report summary (pest, count, severity, date)
  - Previous 3-5 reports from same location (collapsed)
  - Trend indicator (↑ ↓ →) based on count/severity progression
  - Human-readable recency ("Today", "Yesterday", "3 days ago")
  - Officer avatar and name

**Why:**
- Progressive disclosure: high-level view on map, details on interaction
- Context for decision-making: see trend without leaving map
- Accountability: shows which officer reported what and when

**Technical Details:**
- Modified: `src/app/dashboard/_components/dashboard-map.tsx`
- Components: `HistorySection`, `getTrend()`, `getRecencyLabel()`
- Uses: `differenceInDays` for recency calculation

**Trend Logic:**
- Prefers count-based comparison (latest vs previous)
- Falls back to severity rank if counts unavailable
- Shows: "Increasing" (red ↑), "Decreasing" (green ↓), "Stable" (grey →)

---

### 6. Recency-Based Visual Weight

**What Changed:**
- Marker opacity fades based on report age within time window:
  - **Fresh** (0-2 days): 100% opacity (fully opaque)
  - **Recent** (3-5 days): 80% opacity (slightly faded)
  - **Stale** (6+ days): 60% opacity (more faded, still visible)

**Why:**
- "Recency > Volume" principle
- Recent reports are more important than many older reports
- Visual cue for which locations need immediate attention

**Technical Details:**
- Modified: `src/lib/map-utils.ts`
- Function: `createCustomMarkerIcon()` now accepts `recency` option
- Styles: Inline opacity CSS on marker div

---

### 7. Navigation & UI Improvements

**What Changed:**
- Added "Reports" link to sidebar navigation (`FileText` icon)
- Added "View All Reports →" button to Recent Activity panel

**Why:**
- Bridge between dashboard summary and detailed reports view
- Consistent navigation pattern
- Prepares users for dedicated Reports page (future feature)

**Technical Details:**
- Modified: `src/app/dashboard/_components/sidebar-nav.tsx`
- Modified: `src/app/dashboard/_components/recent-activity.tsx`
- Added: `src/components/ui/switch.tsx` (shadcn component)

---

## Time Window Filtering

**Default:** Last 7 days  
**Options:** 7d, 30d, 90d, All time  
**Behavior:** Strictly respects selected date range, hides reports outside window

**Note:** Historical reports remain available via popups, charts, and exports even when hidden from map.

---

## Zero-Count Report Handling

**Behavior:**
- Zero-count reports update the location's *state* (severity downgrades to NORMAL)
- They do NOT create new markers (no visual clutter)
- If previous state was non-zero, marker downgrades accordingly
- If previous state was also zero, no visible change occurs

**Rationale:** We track state changes, not scout activity volume.

---

## Files Modified

### Backend
- `src/server/modules/analytics/analytics-service.ts` - Core bucketing & collapsing logic
- `src/server/modules/alerts/alerts-service.ts` - Severity calculation fix
- `src/server/api/routers/analytics.ts` - API endpoints

### Frontend
- `src/lib/map-utils.ts` - Recency-based marker styling
- `src/app/dashboard/_components/dashboard-map.tsx` - Enhanced popups
- `src/app/dashboard/_components/sidebar-nav.tsx` - Reports link
- `src/app/dashboard/_components/recent-activity.tsx` - View All button
- `src/app/dashboard/page.tsx` - Active alerts toggle
- `src/components/ui/switch.tsx` - NEW: shadcn Switch component

---

## Testing Checklist

- [ ] Map loads with markers grouped by ~25m radius
- [ ] Count=0 reports show NORMAL (green), not WARNING
- [ ] Active Alerts ON: only HIGH/WARNING locations visible
- [ ] Active Alerts OFF: all locations visible
- [ ] Click marker: shows latest + 3-5 previous reports
- [ ] Trend indicators accurate (compare counts/severity)
- [ ] Recency fading works (older = more transparent)
- [ ] "View All Reports" button navigates correctly
- [ ] Time range filtering works (7d/30d/90d/All)

---

## Future Considerations

- **Manual acknowledgement:** Allow users to mark reports as reviewed (deferred post-pilot)
- **Resolution workflows:** Formal process for clearing alerts (deferred post-pilot)
- **Heatmaps:** Alternative visualization for density analysis (deferred post-pilot)
- **Temporal playback:** Animation of pest spread over time (deferred post-pilot)

---

## Related Documents

- `MAP_SPECIFICATION_MVP.md` - Original requirements spec
- `docs/architecture/deployment-and-release/production-readiness.md` - Deployment checklist
- `REPORTS_PAGE_ROADMAP.md` - Planned Reports page evolution (see below)

---

## Changelog

### v1.0.0 (2026-02-02)
- Initial MVP implementation
- GPS bucketing: 11m → 25m
- Severity fix: zero-count = NORMAL
- Location collapsing: one marker per location
- Active alerts: latest-state filtering
- Enhanced popups: history + trends
- Recency indicators: opacity fading
- Navigation: Reports link + View All button

---

**Document Owner:** AgriData AI Product Team  
**Status:** Active - MVP Pilot Phase
