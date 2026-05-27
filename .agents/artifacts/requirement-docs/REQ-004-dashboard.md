# Requirement Doc — REQ-004: Financial Dashboard & Analytics

**Status:** APPROVED
**Author:** technical-ba
**Date:** 2026-05-26
**Security Review:** APPROVED_WITH_NOTES (2026-05-26)
**Phase:** MVP Phase 1 (Local Development)

---

## Business Context

The primary user interface is a financial dashboard showing all transactions with filtering, sorting, and aggregation. This is where users derive value from the automation—seeing their spending trends at a glance.

**Problem:** Users currently scan Excel sheets manually to understand spending patterns.

**Solution:** Build a clean, responsive table-based dashboard with:

- Movement list (sortable, filterable)
- Monthly/annual aggregation
- Category breakdown
- Balance metrics
- Visual indicators (income vs. expense)

---

## User Stories

1. **As a User**, I want to **see all my categorized financial movements in a sortable table**, so that **I can quickly find specific transactions.**

2. **As a User**, I want to **filter movements by category, date range, vendor, and amount**, so that **I can analyze spending by different criteria.**

3. **As a User**, I want to **see monthly and annual summaries**, so that **I understand my spending trends over time.**

4. **As a User**, I want to **see category breakdowns with percentages**, so that **I can identify where my money goes.**

5. **As a User**, I want to **see income vs. expense balance**, so that **I can track my financial health.**

6. **As a User**, I want to **toggle between dark and light modes**, so that **I can use the app comfortably in any lighting condition.**

---

## Acceptance Criteria

### AC-001: Movement Table Display

```gherkin
Given: User loads the dashboard
When: Page renders
Then: Table displays all movements (or empty state if none)
And: Columns are: Date | Vendor | Amount | Category | Status
And: Each row is clickable to view details
And: Table supports sorting by any column (ASC/DESC)
And: Table displays 50 movements per page with pagination
```

### AC-002: Date Range Filtering

```gherkin
Given: User wants to filter by date range
When: User selects start date and end date
Then: Table filters to show only movements in that range
And: Filter is applied immediately (no refresh button)
And: Filter can be cleared with one click
```

### AC-003: Category Filtering

```gherkin
Given: Multiple categories exist
When: User selects one or more categories
Then: Table filters to show only movements in selected categories
And: Multiple selections work as OR (show movements in any selected category)
And: Category list shows count of movements per category
```

### AC-004: Monthly Summary

```gherkin
Given: Dashboard is displayed
When: User views the "Monthly" tab
Then: Table shows monthly aggregation:
  - Month | Total Income | Total Expenses | Balance | Trend
And: Months are sortable and filterable by year
And: Negative balance is shown in red, positive in green
```

### AC-005: Annual Summary

```gherkin
Given: Dashboard displays multiple years of data
When: User views the "Annual" tab
Then: Table shows yearly aggregation:
  - Year | Total Income | Total Expenses | Balance
And: Allows comparison year-over-year
```

### AC-006: Category Breakdown

```gherkin
Given: Dashboard is displayed
When: User views the "By Category" tab
Then: Table shows:
  - Category | Subcategory | Total Amount | % of Total | Trend
And: Sorted by amount descending
And: Percentages sum to 100%
And: Visual bar chart/indicator shows proportional spending
```

### AC-007: Dark/Light Mode Toggle

```gherkin
Given: User is on the dashboard
When: User clicks theme toggle button
Then: App switches to dark/light mode
And: Selection is persisted in localStorage
And: All components (table, charts, text) respect theme
And: Contrast ratios meet WCAG AA standards
```

### AC-008: Responsive Design

```gherkin
Given: Dashboard is displayed on mobile (< 768px)
When: User views the page
Then: Table collapses to card view
And: Columns are stacked vertically
And: Sorting and filtering remain functional
And: Touch-friendly controls (larger buttons/tap targets)
```

### AC-009: Uncategorized Movements Alert

```gherkin
Given: Dashboard loads
When: Uncategorized movements exist
Then: Alert banner is shown: "X movimientos sin categorizar"
And: Banner includes link to review uncategorized items
And: Badge on "Uncategorized" category shows count
```

---

## Data Model

### Movement Summary View (Virtual/Materialized)

| Field              | Type          | Notes                     |
| ------------------ | ------------- | ------------------------- |
| `id`               | UUID          | Primary key               |
| `document_id`      | UUID          | Source document           |
| `transaction_date` | DATE          | When transaction occurred |
| `vendor_name`      | VARCHAR(255)  | Merchant/vendor           |
| `amount`           | DECIMAL(15,2) | Absolute value            |
| `currency`         | VARCHAR(3)    | ISO 4217                  |
| `category_id`      | UUID          | Assigned category         |
| `category_name`    | VARCHAR(100)  | Denormalized for display  |
| `movement_type`    | ENUM          | income, expense           |
| `confidence_score` | DECIMAL(3,2)  | Categorization confidence |
| `is_reviewed`      | BOOLEAN       | User has reviewed         |
| `created_at`       | TIMESTAMP     | ISO 8601                  |

### Monthly Aggregation (Materialized View)

| Field            | Type          | Notes                    |
| ---------------- | ------------- | ------------------------ |
| `year_month`     | DATE          | First day of month       |
| `total_income`   | DECIMAL(15,2) | Sum of income movements  |
| `total_expenses` | DECIMAL(15,2) | Sum of expense movements |
| `balance`        | DECIMAL(15,2) | Income - Expenses        |
| `movement_count` | INTEGER       | Number of movements      |

### Category Aggregation (Materialized View)

| Field                 | Type          | Notes              |
| --------------------- | ------------- | ------------------ |
| `category_id`         | UUID          | Category FK        |
| `category_name`       | VARCHAR(100)  | Display name       |
| `total_amount`        | DECIMAL(15,2) | Sum for period     |
| `percentage_of_total` | DECIMAL(5,2)  | % of all expenses  |
| `movement_count`      | INTEGER       | Count of movements |

---

## API Contract Reference

See: `.agents/artifacts/api-docs/dashboard-api.yaml`

**Key Endpoints:**

- `GET /api/dashboard/movements` — Filtered movement list
- `GET /api/dashboard/monthly-summary` — Monthly aggregation
- `GET /api/dashboard/annual-summary` — Annual aggregation
- `GET /api/dashboard/category-breakdown` — Category aggregation
- `GET /api/dashboard/metrics` — KPIs (total income/expense, balance)
- `GET /api/dashboard/uncategorized-count` — Count of unreviewed items

---

## UI Layout

### Dashboard Main View

```
┌─────────────────────────────────────────────────────────────┐
│  FAWREDD HOME EXPENSES          🌙 [ES] [Menu]             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📊 RESUMEN FINANCIERO                                      │
│  ├─ Total Ingresos:    $50,000                              │
│  ├─ Total Egresos:    -$35,000                              │
│  └─ Balance:           $15,000 ✓                            │
│                                                              │
│  ⚠️  3 movimientos sin categorizar [Revisar]               │
│                                                              │
│  [Movimientos] [Mensual] [Anual] [Por Categoría]           │
│                                                              │
│  Filtros:  📅 [Rango de fechas] 🏷️ [Categoría]            │
│            💰 [Monto] 🔍 [Buscar...]                       │
│                                                              │
│  Movimientos (Mostrando 1-50 de 250)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Fecha      │ Vendedor    │ Monto    │ Categoría│ ⋯    │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ 26/05/2026 │ Carrefour   │ $1,500   │ Groceries│ ✓    │ │
│  │ 25/05/2026 │ YPF Quilmes │ $2,340   │ Transport│ ⚠    │ │
│  │ 24/05/2026 │ Netflix     │ $249     │ Entertain│ ✓    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Page: [1] [2] [3] ... [26]  Next >                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Monthly Summary Tab

```
┌──────────────────────────────────────────────────────────┐
│ RESUMEN MENSUAL                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Mes        │ Ingresos   │ Egresos    │ Balance   │ %Cambio
├──────────────────────────────────────────────────────────┤
│ Mayo 2026  │ $50,000    │ -$35,000   │ $15,000   │ +5%
│ Abril 2026 │ $48,000    │ -$38,000   │ $10,000   │ -8%
│ Marzo 2026 │ $52,000    │ -$41,000   │ $11,000   │ +3%
│
└──────────────────────────────────────────────────────────┘
```

### Category Breakdown Tab

```
┌──────────────────────────────────────────────────────────┐
│ POR CATEGORÍA                                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Categoría        │ Total      │ % Total │ Gráfico
├──────────────────────────────────────────────────────────┤
│ Groceries        │ $12,000    │ 34%    │ ████████░░
│ Utilities        │ $5,800     │ 16%    │ ████░░░░░░
│ Transportation   │ $8,200     │ 23%    │ ██████░░░░
│ Healthcare       │ $4,500     │ 13%    │ ███░░░░░░░
│ Entertainment    │ $2,800     │ 8%     │ ██░░░░░░░░
│ Other            │ $1,700     │ 6%     │ █░░░░░░░░░
│
│ Total Egresos: $35,000
│
└──────────────────────────────────────────────────────────┘
```

---

## Technical Specifications

### Performance Targets

- Dashboard load: < 2 seconds
- Filter/sort: < 500ms
- Monthly summary calculation: < 1 second
- Category breakdown calculation: < 1 second

### Database Indexing Strategy

```sql
CREATE INDEX idx_movements_transaction_date ON movements(transaction_date);
CREATE INDEX idx_movements_category_id ON movements(category_id);
CREATE INDEX idx_movements_year_month ON movements((DATE_TRUNC('month', transaction_date)));
CREATE INDEX idx_movements_vendor ON movements(vendor_name);
```

### Materialized Views (Optional)

For better performance, create materialized views:

- `monthly_summary_mv` — Refreshed daily or on-demand
- `category_breakdown_mv` — Refreshed daily or on-demand
- Invalidate on document processing completion

### Responsive Breakpoints

- **Desktop (≥ 1024px):** Full table layout
- **Tablet (768px - 1023px):** 2-column layout, compact table
- **Mobile (< 768px):** Card view, single column

---

## Open Questions

- [ ] Export to CSV/PDF feature in MVP? (Recommendation: Phase 2)
- [ ] Real-time dashboard updates? (Recommendation: Poll every 30s Phase 1, WebSocket Phase 2)
- [ ] Advanced charting (graphs, sparklines)? (Recommendation: Simple bar chart Phase 1, advanced Phase 2)

---

## Dependencies

- **REQ-001:** Documents must be uploaded
- **REQ-002:** Movements must be extracted
- **REQ-003:** Movements must be categorized

---

## Effort Estimate

- Table component: 4 hours
- Filtering logic: 3 hours
- Monthly/annual summary: 2 hours
- Category breakdown: 2 hours
- Responsive design: 2 hours
- Dark mode toggle: 1 hour
- Testing: 2 hours
- **Total: ~16 hours**

---

## Approval Checklist

- [ ] Security review passed
- [ ] Technical BA approves
- [ ] PM approves scope

---

[SECURITY_REVIEW]
Reviewer: security-engineer
Date: 2026-05-26
Status: [APPROVED_WITH_NOTES]

Findings:

1. [Severity: High] — Insecure Direct Object References: Dashboard data not scoped to user
   Recommendation: Implement user_id FK in documents table (already in schema). Verify all dashboard queries filter by current user. Phase 2: Add row-level security (RLS) policies.

2. [Severity: Medium] — XSS Prevention: Vendor names and descriptions displayed in table
   Recommendation: Ensure all user-controlled data is escaped/sanitized before rendering (React handles this by default, but verify with security testing).

3. [Severity: Medium] — Information Leakage: Balance and income data visible in plaintext
   Recommendation: Acceptable for single-user MVP. Phase 2: Add encryption at rest and field-level security for multi-user scenarios.

4. [Severity: Low] — Export/Download Feature: Not in MVP
   Recommendation: Phase 2 feature requires CSRF protection and download tracking.

Notes:

- Filtering logic properly implemented server-side (not client-side)
- Pagination prevents data enumeration attacks
- Dark/light mode is UI-only, no security impact
- Responsive design has no CORS concerns

Conditional Approval: Add user_id filtering to all dashboard queries. MVP may proceed.
