# 🚀 AgriData AI: Updated Product Roadmap (Pivot Phase)

**Strategic Goal:** Move from generic "pest reporting" to specific "Workflow Digitization" for ZSAES and MPBC.

### **Phase 1: The Multi-Tenant Foundation (Weeks 1-2)**

*Focus: Identity & Routing. Ensuring the right user sees the right bot flow.*

* **[BE]** **Schema Update:** Add `org_type` or `data_mode` to organizations table to define which flow they use (`STALK_SAMPLE` vs `TRAP_COUNT`).
* **[BE]** **Auth System:** Implement "Invite-Only" logic (White Glove onboarding).
* **[Bot]** **The Router:** Build logic to check `user.org_id` on startup and route to "Survey Flow" (ZSAES) or "Trap Flow" (MPBC).

### **Phase 2: Distinct Data Visualization (Weeks 3-4)**

*Focus: Showing value on the map.*

* **[FE]** **Dynamic Map Layers:**
* **MPBC View:** "Trap Stations" (Fixed points). Color changes if `moth_count > threshold`.
* **ZSAES View:** "Field Scans" (Dynamic points). Color changes based on `% infestation`.


* **[BE]** **Reporting Engine:** Generate the "Thursday Trap Report" PDF for Organisations(MPBC and ZSAES) .

### **Phase 3: Intelligence & Refinement (Month 2)**

*Focus: Feedback loops.*

* **[Internal]** **Triage:** Enable "Expert Review" for ZSAES photos.
* **[External]** **Threshold Alerts:** Automated WhatsApp messages to Organisation Officers eg MPBC officers if a neighbor's trap hits "Red Alert" status. [No Urgent]

---

# 🛠️ Feature Breakdown & Technical Specifications

## Feature 1: "White Glove" Authentication & Onboarding

**Context:** No public sign-ups. Strict security for Government/Research partners.

### **Functional Specs**

* **Super Admin Invite:** You invite a specific email (e.g., `officer@mpbc.co.zw`) and pre-assign their Organization (`MPBC`) and Role (`Officer`).
* **Magic Link:** User receives an email, clicks link, sets password.
* **Org Locking:** Once set, a user *cannot* change their organization or see data from others.

### **Technical Specs**

* **BE (Backend):**
* **Service:** `AuthService.inviteUser(email, orgId, role)` using Supabase Auth Admin API.
* **RLS Policy:** `users` table policy: `auth.uid() = id`.


* **FE (Frontend):**
* **Page:** `/admin/users` (Visible only to Super Admin).
* **Component:** `InviteUserModal` (Form with Email input & Org Dropdown).
* **Component:** `AcceptInvitePage` (Simple "Set Password" form).



---

## Feature 2: The WhatsApp Router (The Split Brain)

**Context:** The bot behaves differently depending on who is talking to it.

### **Functional Specs**

* **Identity Check:** When a user types "Hi", Bot checks DB: "Who is this?"
* **Branch A (ZSAES - Field Scouts):**
* **Trigger:** User belongs to `ZSAES`.
* **Flow:** "Survey Mode" (The 100 Stalk Protocol).
* **Data:** Sector, Crop Stage, Stalks Checked (100), Infested Count (x), Photo.


* **Branch B (MPBC - Trap Officers):**
* **Trigger:** User belongs to `MPBC`.
* **Flow:** "Trap Check Mode".
* **Data:** Trap ID/Location, Pheromone Type, **Moth Count** (Integer), Rain (mm).
* **Logic:** If `Count > 10` (Dynamic Threshold), Bot replies: "⚠️ High Alert! This exceeds the outbreak threshold."



### **Technical Specs**

* **BE (Backend):**
* **Schema:** Update `reports` table to handle polymorphic data (or use a JSONB `data_payload` column for flexibility).
```typescript
// Drizzle Schema Concept
dataPayload: jsonb("data_payload"), // Stores { moth_count: 15 } OR { stalks_checked: 100, infested: 10 }
reportType: text("report_type"), // 'TRAP' | 'SURVEY'

```


* **Service:** `BotService.handleMessage()` -> switches on `user.org.type`.


* **FE (WhatsApp):**
* No "Frontend" per se, but requires different **Message Templates** approved in Twilio/Meta for each flow.



---

## Feature 3: Dynamic Visualization Dashboard

**Context:** MPBC needs "Station Monitoring" (Time series). ZSAES needs "Spatial Intensity" (Heatmap).

### **Functional Specs**

#### **View A: MPBC (The Trap Network)**

* **Visual Metaphor:** **"Fixed Stations"**.
* **Map Logic:**
* Markers are fixed "Trap Locations."
* **Green Dot:** Count < 5 (Safe).
* **Orange Dot:** Count 5-10 (Warning).
* **Red Pulse:** Count > 10 (Outbreak Imminent).


* **Chart:** "Moth Flight Curve" (Line chart: Date vs. Count). *Crucial for predicting egg laying.*

#### **View B: ZSAES (The Field Scout)**

* **Visual Metaphor:** **"Wandering Scouts"**.
* **Map Logic:**
* Markers are where scouts stood that day.
* **Heatmap Layer:** Interpolate infestation % between points.


* **Chart:** "Infestation Rate" (Bar chart: % of farm infested).

### **Technical Specs**

* **FE (Frontend):**
* **Lib:** `react-leaflet`.
* **Component:** `MapContainer`.
* `TrapMarker` (Custom SVG Icon for MPBC).
* `FieldMarker` (Circle Marker for ZSAES).


* **Logic:** `DashboardPage` fetches `currentOrg`.
* If `MPBC` -> Render `<TrapDashboard />`.
* If `ZSAES` -> Render `<SurveyDashboard />`.




* **BE (Backend):**
* **API:** `analytics.getTrapData` (Group by Trap ID, Order by Date).
* **API:** `analytics.getSurveyData` (Filter by Date Range, Calculate %).



---

## Feature 4: Reporting & Alerts (The "Thursday Reporter")

**Context:** MPBC currently manually compiles trap data. We automate this.

### **Functional Specs**

* **The Trigger:** Scheduled Job (Thursday 8:00 AM) OR "Generate Report" Button.
* **The Output:** PDF Document.
* **Content (MPBC):**
* Table: List of all Trap Locations.
* Column: Current Week Count vs Last Week Count.
* **Highlight:** Bold Red text for any trap > Threshold.


* **Content (ZSAES):**
* Summary of Sectors visited.
* Average Infestation % per Sector.



### **Technical Specs**

* **BE (Backend):**
* **Lib:** `jspdf` or `react-pdf` (render on server).
* **Job:** Simple Cron (e.g., Vercel Cron) to hit an endpoint `/api/cron/generate-report`.
* **Email:** Send via `Resend` API to the Org Admin.