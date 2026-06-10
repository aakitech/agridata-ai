# AgriData Technologies: Multi-Tenancy & Data Isolation Specification
**Version:** 1.0.0
**Context:** Specification for role-based access control and organization-level data isolation.

## 1. Overview
The Multi-Tenancy feature enables strict data isolation between organizations (Tenants) while providing a comprehensive "Super Admin" view for the platform owner. This prepares the system for organization-specific reporting and metrics.

### Key Goals
- **Data Isolation:** Organization Admins can ONLY see data belonging to their organization.
- **Platform Oversight:** Super Admins can see ALL data, with the ability to filter by organization.
- **Branding:** UI elements display organization attribution.

## 2. User Roles & Permissions

We introduced a new role hierarchy:

| Role | Scope | Permissions |
| :--- | :--- | :--- |
| **`super_admin`** | **Global** | View reports from ALL organizations.<br>Filter dashboard by Organization.<br>Access all system settings. |
| **`admin`** | **Organization** | View reports ONLY from their own `orgId`.<br>Manage users within their organization. |
| **`officer`** | **Organization** | Submit reports.<br>View own submissions (if applicable). |

## 3. Database Schema

### Table: `users` (or `app_users`)
Updated `user_role` enum to include `super_admin`.

```sql
create type user_role as enum ('super_admin', 'admin', 'officer');
```

## 4. Backend Implementation

### Service Layer (`TriageService`)
The service now enforces isolation based on the user's role and organization ID.

- **Constructor**: Accepts `userRole` and `orgId`.
- **Query Logic**:
    - If `userRole == 'super_admin'`:
        - Fetch ALL reports by default.
        - If `filterOrgId` is provided, filter by that ID.
    - If `userRole != 'super_admin'`:
        - **Mandatory Filter**: `WHERE org_id = $user_org_id`
        - Ignores `filterOrgId` input.

### RPC API (`reportsRouter`)
- Updated `getAll` and `getById` to pass the `ctx.appUser.role` to the service.
- Updated Input Schema for `getAll` to accept an optional `filterOrgId`.

## 5. UI Implementation

### Triage Dashboard
- **Organization Filter**: A dropdown menu allowing Super Admins to filter reports by Organization.
    - *Visibility Condition:* User is Super Admin AND multiple organizations exist.

### Report List & Details
- **Branding**: Displays the Organization Name on report cards and in the report detail header.
- **Reporter Info**: Displays the name or phone number of the user who submitted the report.

## 6. Future Considerations
- **Org-Specific Reporting**: Generate PDFs/CSVs filtered by Org.
- **Metrics Dashboard**: Aggregated stats per Org.
