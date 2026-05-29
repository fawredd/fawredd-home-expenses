Feature: Document Extraction Pipeline
  As a User
  I want documents to be automatically analyzed for financial data
  So that I don't manually type amounts, dates, vendors

  Background:
    Given the extraction pipeline is configured
    And pg-boss queue is running

  Scenario: AC-001 OCR Processing (Happy Path)
    Given A PDF or image document is queued for extraction
    When OCR job starts via pg-boss
    Then Tesseract processes the image
    And Text is extracted with language detection (Spanish/English)
    And Processing time is logged
    
  Scenario: AC-001 OCR Processing Failure (Error Scenario)
    Given A PDF or image document is queued for extraction
    When OCR job starts via pg-boss
    And OCR fails
    Then error is recorded with message

  Scenario: AC-002 Structured Data Extraction
    Given OCR text is available
    When Parser processes the text
    Then System attempts to extract:
      | Field | Type |
      | Transaction date | DATE |
      | Amount | DECIMAL |
      | Currency | VARCHAR |
      | Vendor/Merchant name | VARCHAR |
      | Document type | ENUM |
      | Description | TEXT |
    And Each field has NULL if not found
    And Extraction is logged for audit

  Scenario: AC-003 Data Normalization
    Given Raw extracted fields exist
    When Normalization runs
    Then Date is converted to ISO 8601 format
    And Amount has currency symbol removed, decimals standardized
    And Vendor name is trimmed, case-normalized
    And All NULL fields remain NULL

  Scenario: AC-004 Confidence Scoring - High Confidence
    Given Extraction is complete
    When Scoring algorithm runs
    Then Each field gets a confidence score (0.0 - 1.0)
    And Document gets overall confidence (avg of field scores)
    And Score stored in database

  Scenario: AC-004 Confidence Scoring - Low Confidence (Edge Case)
    Given Extraction is complete
    When Scoring algorithm runs
    And Score < 0.7
    Then flags document as "requires review"
    And Score stored in database

  Scenario: AC-005 Extraction Errors (Error Scenario)
    Given OCR or parsing fails
    When Error occurs
    Then Error message is captured
    And Document status becomes "failed"
    And Error is shown to user: "No se pudo procesar el documento"
    And User can re-upload or view error details

  Scenario: Security - Sensitive Data Exposure (Security Scenario)
    Given OCR text is extracted
    When the extraction is logged
    Then raw OCR text is NOT logged to application logs
    And database backups containing raw OCR text must be encrypted

  Scenario: Security - Input Validation (Security Scenario)
    Given OCR text contains malformed data like amount = "hello"
    When the system stores the extracted fields
    Then the system validates the fields against Zod schema
    And rejects obviously malformed data

  Scenario: Security - Injection Prevention (Security Scenario)
    Given OCR text contains adversarial inputs in vendor name
    When the parser heuristics run
    Then regex patterns safely handle the input without causing DoS or injection
