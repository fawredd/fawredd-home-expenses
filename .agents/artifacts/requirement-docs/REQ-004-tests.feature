Feature: Financial Dashboard & Analytics
  As a User
  I want to see all my categorized financial movements in a sortable table
  So that I can quickly find specific transactions and understand spending

  Background:
    Given the dashboard is active
    And financial movements data is available

  Scenario: AC-001 Movement Table Display (Happy Path)
    Given User loads the dashboard
    When Page renders
    Then Table displays all movements (or empty state if none)
    And Columns are: Date | Vendor | Amount | Category | Status
    And Each row is clickable to view details
    And Table supports sorting by any column (ASC/DESC)
    And Table displays 50 movements per page with pagination

  Scenario: AC-002 Date Range Filtering
    Given User wants to filter by date range
    When User selects start date and end date
    Then Table filters to show only movements in that range
    And Filter is applied immediately (no refresh button)
    And Filter can be cleared with one click

  Scenario: AC-003 Category Filtering (Edge Case: Multiple Categories)
    Given Multiple categories exist
    When User selects one or more categories
    Then Table filters to show only movements in selected categories
    And Multiple selections work as OR (show movements in any selected category)
    And Category list shows count of movements per category

  Scenario: AC-004 Monthly Summary
    Given Dashboard is displayed
    When User views the "Monthly" tab
    Then Table shows monthly aggregation:
      | Month | Total Income | Total Expenses | Balance | Trend |
    And Months are sortable and filterable by year
    And Negative balance is shown in red, positive in green

  Scenario: AC-005 Annual Summary
    Given Dashboard displays multiple years of data
    When User views the "Annual" tab
    Then Table shows yearly aggregation:
      | Year | Total Income | Total Expenses | Balance |
    And Allows comparison year-over-year

  Scenario: AC-006 Category Breakdown
    Given Dashboard is displayed
    When User views the "By Category" tab
    Then Table shows:
      | Category | Subcategory | Total Amount | % of Total | Trend |
    And Sorted by amount descending
    And Percentages sum to 100%
    And Visual bar chart/indicator shows proportional spending

  Scenario: AC-007 Dark/Light Mode Toggle
    Given User is on the dashboard
    When User clicks theme toggle button
    Then App switches to dark/light mode
    And Selection is persisted in localStorage
    And All components (table, charts, text) respect theme
    And Contrast ratios meet WCAG AA standards

  Scenario: AC-008 Responsive Design (Edge Case)
    Given Dashboard is displayed on mobile (< 768px)
    When User views the page
    Then Table collapses to card view
    And Columns are stacked vertically
    And Sorting and filtering remain functional
    And Touch-friendly controls (larger buttons/tap targets)

  Scenario: AC-009 Uncategorized Movements Alert (Error/Attention Scenario)
    Given Dashboard loads
    When Uncategorized movements exist
    Then Alert banner is shown: "X movimientos sin categorizar"
    And Banner includes link to review uncategorized items
    And Badge on "Uncategorized" category shows count

  Scenario: Security - Insecure Direct Object References (Security Scenario)
    Given User loads the dashboard
    When the system fetches movements
    Then all dashboard queries filter by the current user_id

  Scenario: Security - XSS Prevention (Security Scenario)
    Given a movement has a vendor name containing "<script>alert(1)</script>"
    When the movement is rendered in the table
    Then the vendor name is escaped/sanitized
    And the script does not execute
