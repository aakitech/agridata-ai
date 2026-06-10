# AgriData Technologies: Product Overview & Features

Welcome to AgriData Technologies. This document provides a high-level overview of our platform's capabilities, user roles, and how we manage data across different organizations.

## 1. The Core Mission
AgriData Technologies is designed to bridge the gap between field-level pest/disease reporting and strategic agricultural management. We provide a seamless flow of information from the field (via WhatsApp) to a centralized analytics dashboard for decision-makers.

---

## 2. Key Features

### 📡 Data Ingestion (WhatsApp Bot)
The primary way data enters our system. Field team members (Scouts/Officers) use a conversational WhatsApp interface to:
- **Report Sightings**: Submit photos and details of pests or diseases.
- **GPS Tagging**: Automatically capture the geographic location of the sighting.
- **Simplicity**: No app to install; works on low-bandwidth connections.

### 📊 Analytics Dashboard
A visual command center for managers and researchers.
- **Interactive Map**: View a geographic spread of sightings across Zimbabwe. Markers are color-coded by risk level.
- **Statistical Scorecards**: Real-time counts of total reports, weekly trends, and active field members.
- **Pest Distribution**: Bar charts showing which pests are currently the most prevalent based on verified data.
- **Recent Activity Feed**: A live list of incoming reports with quick links to details.

### 🛡️ Triage System
An operational tool for internal experts to verify incoming data.
- **Review Workflow**: Experts examine photos and descriptions to confirm or reject reports.
- **Risk Assessment**: Assign risk levels (Low, Medium, High) to sightings to trigger appropriate responses.

---

## 3. User Roles & Access Control
Access to information is strictly controlled to ensure data privacy and operational focus. Our system uses "Multi-Tenancy," meaning multiple organizations use the same platform but cannot see each other's data.

### 👤 User Types

| Role | Who is it for? | Primary Interface | Access Level |
| :--- | :--- | :--- | :--- |
| **Super Admin** | Platform Owner / Internal Team | Web Dashboard | **Global**: Can manage all organizations, switch between them, and perform system-wide triage. |
| **Org Admin** | Client Managers | Web Dashboard | **Organization-only**: Manage their own users and view analytics for their specific group. |
| **Officer (Scout)** | Field Staff | WhatsApp Bot | **Field-only**: Submit sightings via WhatsApp. No dashboard access. |

### 📈 User Status Lifecycle
Every dashboard user (Super Admin or Org Admin) follows a lifecycle to ensure account security:

- **PENDING**: The user has been invited but has not yet set their password. They appear in the User Management list but cannot access the dashboard.
- **ACTIVE**: Setup is complete. The user has set their own password and can log in normally.
- **SUSPENDED**: Access has been manually revoked. The user profile remains in the database for historical reporting but cannot log in.

### 🔐 How Access is Protected
- **Organization Isolation**: When an Admin or Officer belongs to an organization (e.g., "MPBC"), they are technologically "fenced" into that organization. They cannot see sightings, reports, or users from any other group.
- **Feature Gating**: 
    - Only **Super Admins** can see the "Triage" menu.
    - Only **Super Admins** can use the "Organization Switcher" on the dashboard to view data from different groups.
- **Identity Verification**: All users must sign up and complete an onboarding profile before accessing any dashboard features.

---

## 4. Onboarding Workflow
AgriData Technologies uses an **invite-only** system to maintain security and multi-tenant isolation. There is no public registration.

### 🏁 Initial Setup (Bootstrap)
The very first **Super Admin** is created via the command line:
```bash
pnpm run bootstrap-admin <email> <password>
```
This ensures the core platform owner has the necessary permissions to start setting up organizations.

### ✉️ Standard Onboarding
1. **Invite**: A Super Admin or Org Admin sends an invite via the Dashboard.
2. **Verify**: The new user receives an email or a manual link to confirm their identity.
3. **Set Password**: Users land on the `/accept-invite` page to set their credentials.
4. **Access**: Once setup is complete, they are granted access to their dashboard.

---
*AgriData Technologies — Empowering agriculture through data-driven insights.*
