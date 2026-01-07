# 📲 MPBC WhatsApp Bot – Trap Monitoring Flow (v1 Spec)

## 1. Purpose & Scope

**Purpose**  
Digitise MPBC's current **Fall Armyworm trap monitoring workflow** via WhatsApp, providing:

* Simple, low-friction data capture
* Immediate severity feedback to officers
* Clean, structured data for dashboards and reporting

**Scope (v1 / MVP)**

* Single pest focus: **Fall Armyworm**
* Trap location inferred from **GPS location sent via WhatsApp**
* Severity calculated using **org-configured thresholds**
* No task assignment, escalation workflows, or AI guidance (future)

---

## 2. Design Principles

* **Minimal friction:** No trap IDs, no unnecessary fields
* **Guided input:** Reduce ambiguity in free-text fields
* **Backend-derived truth:** Severity & alerts computed server-side
* **Org-aware:** Flow only applies to users belonging to MPBC
* **Future-proof:** Generic data model (not hardcoded to "moth")

---

## 3. High-Level Flow Overview

```text
User sends "Hi"
        ↓
Bot identifies user → MPBC org
        ↓
Welcome message
        ↓
Ask pest (guided)
        ↓
Ask observed count
        ↓
Optional photo upload
        ↓
Ask for GPS location
        ↓
Backend computes severity
        ↓
Severity-aware confirmation message
        ↓
Session reset
```

---

## 4. Step-by-Step WhatsApp Interaction

### 4.1 Entry / Welcome

**Trigger:**  
User sends any message (e.g. "Hi", image, or count)

**Bot Response:**

```text
👋 Hello {{officer_name}}

This is the MPBC Trap Monitoring system.
We'll record your latest Fall Armyworm trap observation.

Let's begin.
```

---

### 4.2 Pest Identification (Guided, not hardcoded)

**Why:**  
Avoid confusion like "moth / Moths / moths" while keeping flexibility.

**Bot Prompt:**

```text
🐛 Which pest are you observing?

For this season, this is usually:
• Fall Armyworm

You may type the pest name or reply:
1️⃣ Fall Armyworm
```

**Accepted Inputs:**

* `1`
* `Fall Armyworm`
* `fall armyworm`
* (Free text allowed, normalized server-side)

**Backend Handling:**

* Normalize to `pest_key = "Fall Armyworm"`
* Store original text if needed for audit

---

### 4.3 Observed Count (Required)

**Bot Prompt:**

```text
🔢 How many insects were caught in the trap?

Please enter a number only.
Example: 3
```

**Validation:**

* Must be an integer ≥ 0
* Reject text or decimals with retry prompt

---

### 4.4 Optional Photo Upload

**Bot Prompt:**

```text
📸 Optional:
You may upload a photo of what was caught in the trap.

Or reply SKIP to continue.
```

**Notes:**

* Photo is **optional**
* Photo represents the **catch**, not "the trap"
* Stored via existing media pipeline

---

### 4.5 Location Capture (Required)

**Bot Prompt:**

```text
📍 Please share your GPS location for this trap.
```

**Expected Input:**

* WhatsApp location pin (lat / long)

**Notes:**

* This location is treated as the **trap location**
* No fixed trap registry in v1

---

## 5. Severity Calculation & Feedback

### 5. 1 Backend Severity Rules

* Severity computed **at ingestion time**
* Uses:
  * `org_alert_thresholds`
  * `pest_key`
  * `observed_count`
* Severity values:
  * `NORMAL`
  * `WARNING`
  * `HIGH`
* Stored on the report (`reports.severity`)
* No retroactive recalculation (v1)

---

### 5.2 Severity-Aware WhatsApp Confirmation

#### 🟢 NORMAL

```text
✅ Report received.

Fall Armyworm count: {{count}}
Status: Low risk 🟢

No immediate action needed.
Continue routine monitoring.
```

---

#### 🟠 WARNING

```text
⚠️ Report received.

Fall Armyworm count: {{count}}
Status: Warning 🟠

Please monitor traps closely and watch for increasing activity.
```

---

#### 🔴 HIGH

```text
🚨 HIGH ALERT

Fall Armyworm count: {{count}}
Status: High risk 🔴

This exceeds the outbreak threshold.
Please notify your supervisor and begin field scouting in surrounding areas.
```

---

## 6. Data Persisted (MPBC Report)

Each completed flow creates a report with:

```ts
{
  orgId: MPBC,
  reportType: "TRAP_MONITORING",
  pestKey: "Fall Armyworm",
  observedCount: number,
  severity: "NORMAL" | "WARNING" | "HIGH",
  dataPayload: {
    pest_name: string,
    count: number,
    photo?: string,
  },
  location: Point(lat, long),
  userId: officer_id,
  createdAt: timestamp
}
```

---

## 7. Implementation Details

### Files Modified

1. **`scripts/whatsapp-bot-seed-workflows.ts`**
   - Updated MPBC workflow configuration
   - Improved question copy with guided hints
   - Added "1️⃣ Fall Armyworm" shortcut option

2. **`src/server/modules/whatsapp-bot/workflow-processor.ts`**
   - Added pest normalization logic in `validateInput()`
   - Handles "1" → "Fall Armyworm" conversion
   - Auto-capitalizes pest names
   - Added `getSeverityConfirmation()` method for severity-aware messages

### Pest Normalization Logic

- "1" → "Fall Armyworm"
- "fall armyworm" → "Fall Armyworm"
- Unknown pest names → Capitalized (e.g., "bollworm" → "Bollworm")

---

## 8. Explicit Non-Goals (v1)

The following are **intentionally excluded**:

* Trap IDs or trap registry
* Male vs female differentiation
* Trap type / pheromone type
* Condition (fresh vs decomposing)
* Officer task assignment  
* Supervisor escalation flows
* AI recommendations or diagnosis

These are **future enhancements**, not MVP blockers.

---

## 9. Success Criteria (Pilot Readiness)

* Officers can submit a report in **< 2 minutes**
* No confusion around pest naming
* Officers immediately understand:
  * Whether the count is normal or dangerous
  * What action is expected of them
* Dashboard "High Alert Reports" matches WhatsApp severity feedback

---

## 10. Future Extensions (Not Implemented Now)

* Auto-notify admins on HIGH severity
* Supervisor assignment & follow-ups
* Trend-based alerts (week-over-week)
* Multi-pest support per org
* AI-assisted image verification
