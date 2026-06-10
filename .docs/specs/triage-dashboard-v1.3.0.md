# AgriData Technologies: Expert Triage Dashboard Specification
**Version:** 1.3.0 (Renamed Severity to Risk Level)
**Context:** The "Command Center" for Agronomists to validate incoming WhatsApp reports.

## 1. Overview
The Triage Dashboard is a web interface allowing authorized Experts (Agronomists) to view raw reports from the WhatsApp bot. Their goal is to filter out noise (spam/blur/errors) and confirm valid outbreaks to populate the public heat map.

**User Journey:**
1. Expert logs in (Email/Password).
2. Sees a list of `PENDING_TRIAGE` reports.
3. Opens a report (Split screen: Image + Map).
4. Listens to the voice note (if any).
5. **Action:** Verifies (adds details) OR Rejects.

## 2. Database Schema (Target)
The application must interact with the existing `agridata_reports` table.

### Table: `public.agridata_reports`
- `id` (uuid)
- `user_id` (uuid)
- `status` (enum: DRAFT, PENDING_TRIAGE, VERIFIED, REJECTED)
- `media_url` (text)
- `audio_url` (text)
- `location` (text) - Format: "lat,long" OR PostGIS Geography.
- `description` (text)
- `created_at` (timestamp)

### New Expert Columns (To be added/used):
- `diagnosis` (text) - The Expert's label for the pest/disease.
- `risk_level` (text/enum) - 'LOW', 'MEDIUM', 'HIGH'
- `rejection_reason` (text)
- `verified_by` (uuid)

## 3. UI Layout (The "Split View")
To make triage fast, we avoid opening new pages. We use a Master-Detail view.

### Left Sidebar (30% width):
Scrollable list of incoming reports.
- **Filter:** Show only status = 'PENDING_TRIAGE' by default.
- **Sort:** Oldest first (FIFO).
- **Card Info:**
  - Thumbnail of the crop image.
  - Relative Time ("2 hours ago").
  - Category Badge (if available).

### Main Canvas (70% width):
The "Work Area" for the selected report.

#### Evidence Section:
- **Large Image:** Click to zoom/pan.
- **Audio Player:** Standard HTML5 `<audio controls src={report.audio_url} />`.
- **Farmer Description:** Display the text description.

#### Context Section:
- **Mini Map:** Leaflet map showing the report pin. (Parse location string "lat,long" to [lat, long] array).

#### Action Form (The Decision):
- **Status Toggle:** Verify vs Reject.
- **If Verify Selected:**
  - **Diagnosis Input (Required):** Text input (e.g., "Fall Armyworm"). This acts as the AI Label.
  - **Risk Level (Required):** Dropdown (Low/Med/High).
  - *UI Tip:* Add a Tooltip: "High = Quarantine Pests (e.g., Armyworm) or Swarming behavior. Low = Common/Manageable."
- **If Reject Selected:**
  - **Reason (Required):** Dropdown ("Blurry", "Not a Crop", "Duplicate").
- **Submit Button:** "Confirm Decision".

## 4. Data Workflow Logic

### Scenario A: Verifying a Report
When the Expert clicks "Verify":

**Update DB:**
```sql
UPDATE agridata_reports 
SET status = 'VERIFIED',
    diagnosis = $input_diagnosis,
    risk_level = $input_risk_level,
    verified_at = NOW(),
    verified_by = $auth_user_id
WHERE id = $report_id;
```
- **UI Feedback:** Toast notification "Report Verified".
- **Navigation:** Auto-select the next report in the list.

### Scenario B: Rejecting a Report
When the Expert clicks "Reject":

**Update DB:**
```sql
UPDATE agridata_reports 
SET status = 'REJECTED',
    rejection_reason = $input_reason,
    verified_at = NOW(),
    verified_by = $auth_user_id
WHERE id = $report_id;
```
- **Navigation:** Auto-select next report.

## 5. Technical Implementation Specs

### Dependencies
- **Maps:** `react-leaflet` (Leaflet CSS must be imported in layout).
- **Icons:** `lucide-react`.
- **Components:** `shadcn/ui` (Card, Button, Badge, ScrollArea, Form, Select, Tooltip).
- **Data Fetching:** `tanstack-query` (aka React Query).

### Database Schema Additions
Run this SQL to update the reports table for the dashboard features:

```sql
alter table agridata_reports 
add column risk_level text check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
add column diagnosis text, -- The expert's official name for the pest
add column rejection_reason text,
add column verified_at timestamp with time zone,
add column verified_by uuid references auth.users(id);

-- RLS Policy for Experts (Allow viewing everything)
create policy "Experts can manage all reports"
on agridata_reports
for all
using (
  auth.uid() in (
    select id from profiles where role = 'expert'
  )
);
```

## 6. Triage Guidelines (Logic for the Expert)
- **Low Risk:** Common, localized pests (e.g., Aphids, Red Spider Mite). Requires farmer action but not national intervention.
- **Medium Risk:** Significant crop damage potential (e.g., Maize Stalk Borer).
- **High Risk:** Rapid spread risk, Quarantine pests, or "Swarm" descriptions (e.g., Fall Armyworm, Locusts, Tuta Absoluta). Triggers Red Alert on Map.
