Feature: Database Schema & Persistence Layer
  As a System
  I want to persist documents, extractions, and categorizations reliably
  So that data is never lost and querying is fast

  Background:
    Given PostgreSQL is running
    And Drizzle ORM is configured

  Scenario: AC-001 Schema Creation (Happy Path)
    Given PostgreSQL is running
    When Drizzle migration runs
    Then All tables are created with correct types and constraints
    And Indexes are created for query optimization
    And pgvector extension is installed
    And Foreign keys maintain referential integrity

  Scenario: AC-002 Document Tracking
    Given User uploads a document
    When Document is saved
    Then Document record includes:
      | filename | file_path | file_size | mime_type |
      | upload_status | processing_status |
      | uploaded_at | processed_at timestamps |
    And Document tracks all related extractions and categorizations

  Scenario: AC-003 Movement Extraction Storage
    Given OCR and parsing complete
    When Extraction is stored
    Then All extracted fields are persisted:
      | date | amount | currency | vendor | type | description |
      | confidence scores (per field + overall) |
    And Raw OCR text is stored for debugging
    And Extraction is linked to source document

  Scenario: AC-004 Categorization Persistence
    Given Movement is categorized
    When Category is assigned
    Then System records:
      | category_id (FK to categories table) |
      | confidence_score |
      | categorization_method (rule/rag/ai/manual) |
      | is_manual_correction flag |
    And User corrections are timestamped
    And History is preserved for audit

  Scenario: AC-005 RAG Embedding Storage
    Given Movement is categorized
    When RAG embedding is generated
    Then Vector is stored:
      | movement_id (FK) |
      | vendor_name (for retrieval) |
      | category_id |
      | embedding vector (pgvector) |
    And Vectors are indexed for efficient similarity search

  Scenario: AC-006 Migration History (Edge Case: Rollbacks)
    Given Schema changes are needed
    When Drizzle migration is created
    Then Migration file is generated in ./drizzle/migrations/
    And Migration can be applied and rolled back
    And Migration history is tracked in _drizzle_journal table

  Scenario: AC-007 Seed Data
    Given Fresh database is initialized
    When Seed script runs
    Then Default categories are created
    And Sample movements can be optionally loaded
    And System is ready for operation

  Scenario: Security - SQL Injection Prevention (Security Scenario)
    Given the application executes a query
    When data is read or written to the database
    Then Drizzle ORM uses parameterized queries
    And no raw SQL is executed

  Scenario: Security - JSONB Field Validation (Security Scenario)
    Given the system stores extraction errors or confidence scores
    When the JSONB structure is saved
    Then the application validates the JSONB structure against a schema before storage
