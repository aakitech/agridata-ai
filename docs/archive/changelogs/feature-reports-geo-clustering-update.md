# Feature Changelog - Reports & Map Location Collation

**Version:** MVP Pilot - v1.0.1  
**Last Updated:** February 3, 2026  
**Status:** ✅ Implemented & Verified

---

## Overview

This update aligns location handling across the Reports and Map experiences, reduces duplicate-looking locations, and adds lightweight guidance for first‑time users. The goal is consistent, predictable location grouping and clearer interpretation of grouped data.

---

## Changes Implemented

### 1) Shared Geo Utilities (Single Source of Truth)

**What Changed:**
- Introduced `src/lib/geo.ts` to centralize:
  - `parseLocation()` for WKT/JSON parsing
  - `parseLocationBucket()` for ~25m location bucketing
  - `haversineDistanceMeters()` for distance comparisons
  - `LOCATION_CLUSTER_RADIUS_METERS` as a single configurable constant

**Why:**
- Prevents “scattered” location logic across components
- Ensures consistent behavior between map clustering and grouped report views
- Makes tuning the 25m rule easy in one place

---

### 2) Reports Grouped View – True Location Collation

**What Changed:**
- Reports grouped view now clusters reports within ~25m using shared geo logic
- Improved location name display to reduce duplicate‑looking labels:
  - Uses more granular reverse‑geocode fields (road, neighborhood, town, village, county)
  - Shows coordinates when geocoding is coarse
- Adds a small helper message in grouped mode:
  - “Grouped view shows the latest status per location…”
  - Dismissible and remembered via localStorage

**Why:**
- Prevent GPS jitter from creating multiple “locations”
- Reduce first‑time cognitive load with simple micro‑guidance

---

---

## Files Modified / Added

### Added
- `src/lib/geo.ts` — shared geo parsing + bucketing

### Modified
- `src/server/modules/analytics/analytics-service.ts` — map bucketing + grouped report clustering
- `src/server/api/routers/analytics.ts` — map filtering support
- `src/app/dashboard/reports/page.tsx` — grouped helper message
- `src/app/dashboard/reports/_components/grouped-view.tsx` — improved location display
- `src/app/dashboard/reports/_components/location-detail.tsx` — improved location display
- `src/app/dashboard/_components/dashboard-map.tsx` — richer map popups + marker behavior
- `src/lib/map-utils.ts` — recency styling

---

## Behavioral Summary

- **Reports (Grouped):** clusters within ~25m, shows latest state per location with clearer naming.
- **Reports (List):** unchanged core behavior; complements grouped view.
