CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS code_chunks (
    repo text NOT NULL, revision text NOT NULL, path text NOT NULL,
    first_line integer NOT NULL, last_line integer NOT NULL,
    body text NOT NULL, embedding vector(1536) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (repo, revision, path, first_line)
);
CREATE INDEX IF NOT EXISTS code_chunks_age ON code_chunks(created_at);

