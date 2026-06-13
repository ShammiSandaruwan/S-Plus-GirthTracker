# SaaS Subscription and Multi-Company Architecture

This document outlines the architectural roadmap and design philosophy for evolving GirthTracker from a single-company, self-hosted solution into a multi-tenant SaaS platform.

## 1. Why One Codebase Should Serve Multiple Companies
Managing a single, unified codebase ensures that all companies (tenants) receive bug fixes, performance improvements, and new features simultaneously. It reduces maintenance overhead, simplifies the release process, and ensures consistent quality across all clients. Divergent codebases quickly become unmanageable and lead to technical debt.

## 2. Why Duplicating GitHub/Vercel Per Company is Not Recommended
Creating separate GitHub repositories and Vercel deployments for each new client does not scale. It requires manual intervention for every new customer, multiplies CI/CD pipeline costs, and makes deploying universal updates a highly error-prone, manual task across dozens or hundreds of projects.

## 3. Recommended Multi-Tenant SaaS Architecture
The recommended approach is a **Single-Application, Multi-Tenant Architecture** where a centralized backend handles routing, data partitioning, and access control based on a tenant identifier.
- **Frontend (PWA):** One deployed React/Vite instance serving all users.
- **Backend/API:** A centralized Node.js/Python backend that identifies the company via authentication tokens or domain logic.
- **Database:** A multi-tenant database using row-level security (e.g., Supabase/PostgreSQL) where every record contains a `company_id`, ensuring strict data isolation.

## 4. Company -> Estates -> Operators -> Measurements Model
The data hierarchy must evolve to support multi-tenancy natively:
- **Company (Tenant):** The top-level billing entity.
- **Estates:** Groupings of fields/land under a specific Company.
- **Operators:** The field workers assigned to specific Estates or Companies.
- **Measurements:** The individual tree readings, strictly tied to an Operator and an Estate (and implicitly the Company).

## 5. Why `VITE_ESTATES` is Fine for Single-Company but Not SaaS
The current approach using `.env` variables (like `VITE_ESTATES`) hardcodes configuration at build time. For a multi-tenant SaaS, this is impossible because the frontend build cannot contain the configuration of every possible company, and new companies should not require a code deployment to be onboarded.

## 6. Future Backend-Based Estate Configuration
Instead of environment variables, estate configurations must be fetched dynamically from the backend upon user login. When an Operator logs in, the backend responds with the specific Estates, Divisions, and Fields they are authorized to access, ensuring a fully dynamic and secure configuration.

## 7. Monthly Subscription Model
The primary monetization strategy will be a recurring monthly subscription tailored to the company's size or specific feature access (e.g., advanced analytics, custom reporting). This provides predictable recurring revenue.

## 8. Per-Tree / Tree-Credit Model
A secondary, usage-based billing tier allows companies to purchase "tree credits." Each measurement submitted consumes a credit. This aligns the cost of the platform directly with the value and volume of data being tracked, ideal for smaller or highly seasonal operations.

## 9. Usage Ledger Concept
To support the billing models, a centralized "Usage Ledger" must be implemented. This immutable ledger tracks every measurement sync, login, and data export. It serves as the single source of truth for generating invoices and tracking tree-credit depletion.

## 10. Device Approval Per Company
To prevent unauthorized access and data leakage, each company will have a device management portal. When an Operator logs in from a new device, it must be explicitly approved by a company admin before it can sync data to the central database.

## 11. Google Sheets Sync as Optional Export, Not Primary Database
Currently, Google Sheets serves as a primary data sink. In a SaaS model, a robust SQL database (e.g., PostgreSQL) must be the primary storage. Google Sheets synchronization will be downgraded to an optional, scheduled export feature for companies that rely on legacy reporting tools.

## 12. Recommended Migration Path
Transitioning to the SaaS model will occur in phases:
1. **Current Self-Hosted Version:** Stable, `.env`-driven single-tenant mode.
2. **Phase 1: GPS Map (Current Phase):** Adding field-level GPS visualization and offline capabilities using IndexedDB.
3. **Phase 2: Company Code / Tenant Config:** Introducing a "Company Code" login step to dynamically fetch basic config without a full backend migration.
4. **Phase 3: Central Backend:** Deploying the multi-tenant database and API, transitioning away from Google Apps Script.
5. **Phase 4: Billing / Tree Credits:** Implementing the usage ledger, subscription tiers, and payment gateways.
6. **Phase 5: Admin Dashboard:** Launching the central portal for companies to manage devices, operators, and billing.

---
*Note: Phase 1 (GPS Map) is currently underway. Payment gateways, full billing enforcement, and the multi-company backend are slated for future phases.*
