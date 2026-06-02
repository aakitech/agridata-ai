# AgriData AI: Roles & Permissions Implementation Plan

**Version:** 2.1 (Roles & Permissions Only)
**Status:** Ready for Implementation  
**Timeline:** 1-2 days for permissions enforcement
**Scope:** ✅ Invite flow complete - implement roles/permissions only

---

## 🎯 Executive Summary

This plan implements **role-based access control** where:
- **Super Admins**: Full system control and training-impacting decisions
- **Org Admins**: Organization data viewing and soft triage annotations
- **Officers**: WhatsApp bot access only (no dashboard)

**Key Principles:**
1. **Minimal, opinionated roles** - only super_admin and org_admin for now
2. **Permission enforcement server-side**, not UI-only
3. **Triage separation**: soft annotations (org_admin) vs hard decisions (super_admin)
4. **Future-ready foundation** without premature abstractions

---

## 👥 Roles Model (Minimal & Intentional)

### **Two Roles Only (v1)**

1. **super_admin** (internal team)
2. **org_admin** (organization users)

> No other roles needed at this stage. Invite system already handles user creation.

---

## 🔐 Permission Model (Intentional & Conservative)

### **super_admin**
- ✅ Invite users to any organization
- ✅ Assign users to organizations  
- ✅ View all organizations data
- ✅ Perform **hard triage actions** (accept/reject data for training)
- ✅ Manage system-wide settings

### **org_admin** (Default for invited users)
- ✅ View own organization data
- ✅ View dashboards and analytics
- ✅ View triage status (accepted/rejected/flagged)
- ✅ Add **non-destructive annotations** (notes, flags, comments)
- ❌ Cannot accept or reject data for training
- ❌ Cannot override system triage decisions
- ❌ Cannot invite users
- ❌ Cannot access other organizations' data
- ❌ Cannot manage organization settings

---

## 🔍 Triage Clarification (Critical Separation)

### **Soft Triage** (org_admin allowed)
- 📝 Notes and comments
- 🚩 Quality flags ("blurry photo", "needs better GPS")
- 💬 Context information ("field conditions: moderate rain")
- ❓ Status feedback ("looks correct", "questionable quality")
- **Does NOT affect training pipeline**

### **Hard Triage** (super_admin only)
- ✅ **Accept / reject for ML training**
- ✅ Final diagnosis labeling
- ✅ Risk level assignment
- ✅ Any action that directly impacts training data

### **Purpose**
This separation protects **data quality** while allowing org admins to be **operationally effective**.

---

## 🏗️ Implementation Expectations

### **Backend Requirements**
- ✅ Enforce permissions **server-side** in all mutation procedures
- ✅ Role checks for training-impacting data changes
- ✅ Default role on user creation = `org_admin`
- ✅ Database constraints prevent unauthorized state changes

### **Frontend Requirements**  
- ✅ Hide/disable restricted actions for org_admins
- ✅ Org admins can still view all data and add annotations
- ✅ No triage accept/reject buttons for org_admins
- ✅ Clear messaging about why actions are restricted

---

## 🎭 Design Intent (Avoid Over-Engineering)

**This is NOT** a full RBAC system yet.

**Build for:**
- ✅ Current business needs (minimal roles)
- ✅ Future permission expansion when needed
- ✅ Simple promotion of trusted org_admins later

**Avoid:**
- ❌ Premature abstractions
- ❌ Complex permission hierarchies  
- ❌ Over-engineered role management

---

## 🔐 Permission System (Minimal & Opinionated)

### **Role-Based Permissions**
```typescript
export const PERMISSIONS = {
  // Super Admin exclusive
  INVITE_USERS: 'invite:users',
  MANAGE_ALL_ORGS: 'manage:all_orgs',
  VIEW_ALL_ORGS: 'view:all_orgs',
  HARD_TRIAGE: 'triage:hard',         // Accept/reject for training
  
  // Org Admin capabilities
  READ_ORG_DATA: 'read:org_data',
  VIEW_DASHBOARDS: 'view:dashboards',
  SOFT_TRIAGE: 'triage:soft',       // Annotations, flags, comments
} as const;

export const ROLE_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS),  // All permissions
  org_admin: [
    PERMISSIONS.READ_ORG_DATA,
    PERMISSIONS.VIEW_DASHBOARDS,
    PERMISSIONS.SOFT_TRIAGE
  ]
} as const;
```

### **Implementation Principle**
> **Simple, explicit, server-enforced**

- Roles are intentionally limited to current business needs
- Permissions map directly to UI capabilities
- Future expansion possible without breaking existing code

---

## 📝 Soft Triage System (Org Admin Annotations)

### **Purpose & Philosophy**
Org admins can add **contextual annotations** to help experts make better decisions:
- **Provide local field knowledge** (weather, crop conditions)
- **Flag quality issues** (photo clarity, GPS accuracy)
- **Request follow-ups** from scouts for better data
- **Add internal coordination** notes

**Critical:** Annotations are **non-authoritative** and **never affect training data directly**.

### **Annotation Types**
```typescript
type AnnotationType = 
  | "quality"      // 📸 Photo issues: blurry, poor lighting, bad angle
  | "context"      // 🌱 Field conditions: weather, crop stage, growth
  | "follow_up"    // 📞 Scout follow-up: need better photo, verification required
  | "internal"      // 🔒 Internal coordination only
```

### **Annotation Form**
```typescript
const annotationOptions = [
  { value: 'quality', label: '📸 Quality Issue', placeholder: 'Photo is blurry, needs better lighting' },
  { value: 'context', label: '🌱 Context Info', placeholder: 'Field: moderate rain, 2-week growth stage' },
  { value: 'follow_up', label: '📞 Follow Up', placeholder: 'Contact scout for clearer photo of damage' },
  { value: 'internal', label: '🔒 Internal Note', placeholder: 'Discuss with field supervisor on next visit' }
];
```

### **Business Rules**
- **Org Admins**: Can add all annotation types
- **Super Admins**: Can add all annotation types  
- **Internal Notes**: Visible only to same org + super admins

---

## 👁️ Annotation Visibility Rules

### **Visibility Matrix**
| User Type | Internal Notes Visible | Cross-Org Visibility |
|------------|----------------------|---------------------|
| **Super Admin** | ✅ Yes (all orgs) | ✅ Yes (system oversight) |
| **Org Admin** | ✅ Yes (same org only) | ❌ No (org isolation) |
| **Officers** | ❌ No (no dashboard access) | ❌ No |

### **Rationale**
- **Preserves org trust** - Internal coordination stays internal
- **Enables oversight** - Super admins can see all for system health
- **Avoids over-restriction** - Org admins can still coordinate internally
- **Scales well** - Clear rules for future org additions

### **Database Implementation**
```sql
-- Annotation visibility via query logic
SELECT 
  te.*,
  tu.full_name as added_by_name,
  tu.role as added_by_role,
  -- Internal notes filtering
  CASE 
    WHEN te.is_internal = true AND 
         (current_user_role = 'org_admin' AND current_user_org_id != te.org_id) 
    THEN false
    ELSE true
  END as visible_to_user
FROM triage_annotations te
JOIN agridata_app_users tu ON te.added_by = tu.id
WHERE te.report_id = $report_id
  AND (
    te.is_internal = false 
    OR (current_user_role = 'super_admin')
    OR (current_user_role = 'org_admin' AND current_user_org_id = te.org_id)
  );
```

---

## 📊 5️⃣ Analytics (Minimal & Future-Ready)

### **Implement Now (Cheap & Valuable)**
```sql
-- Add to reports table
ALTER TABLE agridata_reports 
ADD COLUMN enhancement_count integer DEFAULT 0,
ADD COLUMN last_enhancement_at timestamp with time zone;
```

### **Do NOT Implement Yet**
- ❌ Enhancement analytics dashboards
- ❌ Enhancement notifications system
- ❌ Scout performance scoring
- ❌ Enhancement effectiveness metrics

### **Future Analytics Readiness**
The foundation enables future insights without building them now:
- **Enhancement frequency** by report type
- **Quality improvement** metrics
- **Expert decision speed** analysis

---

## 🎭 6️⃣ Product Positioning & Communication

### **Official Stance for Org Admins**

> "Org admins can review and annotate reports, but final verification is centralized to ensure consistent model training and data quality."

### **Communication Strategy**
- **Intentional messaging**: Explain why verification is expert-only
- **Quality focus**: Emphasize data consistency for ML training
- **Scalable logic**: Position current system as enabling future expansion

### **Product Benefits**
- **For Org Admins**: Better field oversight, scout training insights
- **For Super Admins**: Consistent data quality, expert workflow
- **For Platform**: Maintain high-quality training dataset

---

## 🗄️ 7️⃣ Database Schema

### **New Tables & Columns**
```sql
-- Enhancement tracking
CREATE TABLE triage_enhancements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES agridata_reports(id) ON DELETE CASCADE,
  added_by uuid REFERENCES agridata_app_users(id) ON DELETE CASCADE,
  enhancement_type text NOT NULL CHECK (enhancement_type IN ('quality', 'context', 'follow_up', 'internal')),
  enhancement_text text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Add enhancement tracking to reports
ALTER TABLE agridata_reports 
ADD COLUMN enhancement_count integer DEFAULT 0,
ADD COLUMN last_enhancement_at timestamp with time zone;

-- Indexes for performance
CREATE INDEX idx_triage_enhancements_report_id ON triage_enhancements(report_id);
CREATE INDEX idx_triage_enhancements_added_by ON triage_enhancements(added_by);
```

### **Updated Relations**
```typescript
// src/server/db/schema.ts
export const triageEnhancements = createTable("triage_enhancements", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id").references(() => reports.id, { onDelete: "cascade" }).notNull(),
  addedBy: uuid("added_by").references(() => appUsers.id, { onDelete: "cascade" }).notNull(),
  enhancementType: text("enhancement_type").notNull(),
  enhancementText: text("enhancement_text").notNull(),
  isInternal: boolean("is_internal").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Add to reports relations
export const reportsRelations = relations(reports, ({ one, many }) => ({
  // ... existing relations
  enhancements: many(triageEnhancements),
}));
```

---

## 🚀 8️⃣ Implementation Timeline

### **Day 1: Foundation**
- [ ] Database migration (enhancement table + report columns)
- [ ] Permission service and ROLE_PERMISSIONS
- [ ] Update existing routers with permission checks
- [ ] Basic enhancement tRPC procedures

### **Day 2: UI Implementation**
- [ ] Create `/dashboard/review` route and components
- [ ] Build role-adaptive review dashboard
- [ ] Implement enhancement form with 4 types
- [ ] Add internal note visibility logic
- [ ] Update navigation sidebar

### **Day 3: Integration & Testing**
- [ ] End-to-end testing with both user types
- [ ] Verify enhancement visibility rules
- [ ] Test permission-based API access
- [ ] Update documentation
- [ ] Deploy and monitor

### **Future Additions (When Business Ready)**
- [ ] Enable `PERMISSIONS.TRIAGE_OWN_ORG` for org admin verification
- [ ] Add enhancement analytics dashboards
- [ ] Implement enhancement notifications
- [ ] Scout quality scoring based on enhancement feedback

---

## 📋 9️⃣ Success Metrics & KPIs

### **Immediate Success Indicators**
- **Enhancement Rate**: > 80% of pending reports get enhancements from org admins
- **Expert Triage Speed**: 30% reduction in triage time (due to better context)
- **Org Admin Engagement**: Weekly review dashboard usage > 3 sessions per org

### **Quality Metrics**
- **Data Consistency**: Maintained expert-only verification standard
- **Multi-Tenant Security**: Zero cross-org data exposure
- **User Experience**: Clear understanding of role capabilities

### **Future Readiness**
- **Scalability**: System ready for 10+ organizations
- **Permission Flexibility**: Can enable org admin triage without code changes
- **Analytics Foundation**: Data collection in place for future insights

---

## 🔮 10️⃣ Strategic Future Readiness

### **When to Enable Org Admin Triage**
Consider enabling `PERMISSIONS.TRIAGE_OWN_ORG` when:

1. **Business Need**: Specific org requests verification capabilities
2. **Quality Process**: Established review protocols for org-admin decisions
3. **ML Stability**: Model performance stable with expert-triaged data
4. **Scale**: Platform ready for 5+ active organizations

### **Enabling Process**
```typescript
// Simple permission toggle
await db.update(appUsers)
  .set({ 
    permissions: sql`array_append(permissions, 'triage:own_org')`
  })
  .where(and(
    eq(appUsers.id, orgAdminId),
    eq(appUsers.orgId, targetOrgId)
  ));
```

---

## 📝 11️⃣ Summary of What We're Building

### **Keep (Core Features)**
- ✅ Hybrid review model (expert verification + org admin enhancements)
- ✅ Single review route with role-based capabilities
- ✅ Enhancement system for contextual information
- ✅ Centralized permission system
- ✅ Internal note visibility rules
- ✅ Foundation for future org admin triage

### **Explicitly Not Building (Yet)**
- ❌ Separate routes for different roles
- ❌ Per-user permission overrides
- ❌ Enhancement analytics dashboards  
- ❌ Notification systems
- ❌ Org admin verification capabilities
- ❌ Complex workflow automation

### **Guiding Principles**
1. **Build once, evolve safely** - Foundation enables future features
2. **Clarity over complexity** - Simple, understandable permission model
3. **Quality over quantity** - Maintain data integrity while adding capabilities
4. **Future-ready but present-focused** - Enable scale when needed, not before

---

## 🎯 Final Note

This implementation provides a **solid foundation** that:

- **Solves immediate needs**: Org admin visibility and enhancement capabilities
- **Maintains data quality**: Expert-only verification for training data
- **Scales gracefully**: Can evolve as business requirements change
- **Avoids over-engineering**: Only builds what's needed now

The system respects AgriData AI's invite-only, quality-focused approach while enabling org admins to be more effective in their field oversight and scout training responsibilities.

---

**Document Version:** 2.0  
**Created:** December 29, 2025  
**Ready for Implementation:** ✅