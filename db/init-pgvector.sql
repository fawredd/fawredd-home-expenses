-- Initialize pgvector extension in fawredd_local database
CREATE EXTENSION IF NOT EXISTS vector;

-- Create vector index templates for RAG embeddings table
-- This can be referenced when creating indexes on vector columns
COMMENT ON EXTENSION vector IS 'PostgreSQL vector extension for embeddings support';
