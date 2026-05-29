Feature: Document Upload Pipeline
  As a User
  I want to upload financial documents
  So that they can be automatically processed

  Background:
    Given the system is running
    And the file storage directory is accessible

  Scenario: AC-001 Drag-and-Drop Upload
    Given User is on the dashboard
    When User drags a PDF/JPG/PNG file onto the designated drop zone
    Then File is accepted and upload begins immediately
    And User sees a progress indicator
    And File is not uploaded if the drop zone is not focused

  Scenario: AC-002 File Type Validation - Allowed Types
    Given User selects or drags a file
    When File extension is checked
    Then Allowed types (PDF, JPG, JPEG, PNG) are accepted

  Scenario: AC-002 File Type Validation - Disallowed Types (Error Scenario)
    Given User selects or drags a file
    When File extension is checked
    Then Other file types show an error message: "Solo se aceptan PDF, JPG, PNG"

  Scenario: AC-002 File Type Validation - File Size (Edge Case)
    Given User selects or drags a file
    When File extension is checked
    And File size is greater than 5MB
    Then File size must be ≤ 5MB, else: "Archivo demasiado grande (máx 5MB)"

  Scenario: AC-003 Multiple File Upload
    Given User drags 5 PDF files onto the drop zone
    When Files are validated
    Then All 5 files are queued for upload in parallel
    And Progress is shown per file
    And User can cancel individual uploads

  Scenario: AC-004 Upload Success Feedback (Happy Path)
    Given A file has been successfully uploaded
    When Upload completes
    Then File is removed from the upload queue
    And User sees a success message: "Documento subido correctamente"
    And Document appears in the "Processing" state on the dashboard

  Scenario: AC-005 Upload Error Handling (Error Scenario)
    Given Upload fails (network, file system, virus scan)
    When Error is received
    Then User sees error message in Spanish (e.g., "Error al subir archivo")
    And File remains in upload queue for retry
    And User can attempt upload again

  Scenario: AC-006 Asynchronous Processing Queue
    Given File has been successfully uploaded
    When Upload completes
    Then Document is automatically queued to the processing pipeline
    And Processing job is created in pg-boss
    And User can see "En procesamiento..." status without waiting

  Scenario: Security - File Upload Abuse (Security Scenario)
    Given User uploads a file with a .pdf extension
    When the system validates the file
    Then the system checks the magic byte validation (file signature)
    And rejects the file if the content does not match the extension

  Scenario: Security - Path Traversal Prevention (Security Scenario)
    Given User uploads a file named "../../../etc/passwd"
    When the file is stored
    Then the system sanitizes the filename or uses UUID-based naming
    And the file is saved securely without path traversal
