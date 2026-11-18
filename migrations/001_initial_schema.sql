-- Enable pgvector for resume embeddings.
CREATE EXTENSION IF NOT EXISTS vector;

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expires_idx
ON sessions(expires_at);


-- Resume document chunks and embeddings
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    embedding VECTOR(3072),
    section TEXT,
    content_hash TEXT,
    chunk_id TEXT,
    session_id UUID NOT NULL,

    CONSTRAINT documents_session_fk
        FOREIGN KEY (session_id)
        REFERENCES sessions(id)
        ON DELETE CASCADE,

    CONSTRAINT documents_session_chunk_unique
        UNIQUE (session_id, chunk_id),

    CONSTRAINT documents_session_hash_unique
        UNIQUE (session_id, content_hash)
);

CREATE INDEX IF NOT EXISTS documents_session_idx
ON documents(session_id);


-- Conversation history
CREATE TABLE IF NOT EXISTS messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT messages_session_id_fkey
        FOREIGN KEY (session_id)
        REFERENCES sessions(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS messages_session_created_idx
ON messages(session_id, created_at);
