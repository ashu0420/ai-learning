# Resume RAG with Node.js, Gemini & PostgreSQL

A learning-focused Retrieval-Augmented Generation (RAG) application built with Node.js.

The project takes information from a resume PDF, converts resume sections into embeddings, stores them in PostgreSQL using pgvector, retrieves relevant sections for a user's question, and uses a Gemini LLM to generate an answer from the retrieved context.

It also supports conversational questions through LLM-based query rewriting.

## Features

- PDF resume parsing
- Section-based resume chunking
- Gemini embeddings
- PostgreSQL with pgvector
- Cosine-similarity retrieval
- Top-K semantic search
- Similarity threshold for unrelated questions
- LLM-generated answers using retrieved context
- Conversational query rewriting
- Short-term in-memory conversation history
- Incremental ingestion using content hashes
- Stable chunk IDs
- Retrieval evaluation using Recall@3
- Basic retry handling for LLM failures

## Architecture

```text
                    Resume PDF
                        |
                        v
                 PDF Text Extraction
                        |
                        v
                Section-based Chunks
                        |
                        v
              Gemini Embedding Model
                        |
                        v
              PostgreSQL + pgvector
                        |
                        |
User Question ---------+
        |
        v
Query Rewriting
(if conversational context is needed)
        |
        v
Gemini Embedding Model
        |
        v
Vector Similarity Search
        |
        v
       Top-K
        |
        v
Similarity Threshold
        |
        v
Relevant Resume Context
        |
        v
Gemini LLM
        |
        v
      Answer
```

## Tech Stack

- Node.js
- JavaScript
- Google Gemini API
- PostgreSQL
- pgvector
- pdf-parse
- node-postgres (`pg`)
- dotenv

## Project Structure

```text
ai-learning/
├── index.js
├── query.js
├── evaluate.js
├── package.json
├── package-lock.json
├── .gitignore
├── .env
└── mastercv.pdf
```

`node_modules/` is present locally but is ignored by Git.

### `index.js`

Handles resume ingestion.

It:

1. Reads the resume PDF.
2. Extracts its text.
3. Splits the resume into sections.
4. Creates stable IDs for chunks.
5. Adds resume and section information to the text.
6. Generates embeddings.
7. Stores chunks and embeddings in PostgreSQL.
8. Uses content hashes to skip unchanged chunks.

### `query.js`

Handles user questions.

It:

1. Accepts questions interactively.
2. Maintains short-term conversation history.
3. Detects questions that may require conversational rewriting.
4. Uses Gemini to rewrite ambiguous questions.
5. Generates an embedding for the retrieval query.
6. Searches PostgreSQL using vector similarity.
7. Applies a similarity threshold.
8. Sends retrieved context to the Gemini LLM.
9. Generates the final answer.

### `evaluate.js`

Tests the retrieval system.

It checks whether the expected resume section appears in the top 3 retrieved results and reports Recall@3.

## Database

The project uses PostgreSQL with the `pgvector` extension.

The main table is:

```sql
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    embedding VECTOR(3072),
    section TEXT,
    content_hash TEXT UNIQUE,
    chunk_id TEXT UNIQUE
);
```

### Important fields

- `text` — the original/enriched resume chunk
- `embedding` — vector representation of the chunk
- `section` — resume section such as `Education`, `Projects`, or `Achievements`
- `content_hash` — detects whether the chunk has changed
- `chunk_id` — stable identifier for the chunk

## How Retrieval Works

The question is converted into an embedding.

PostgreSQL then compares the question embedding against stored document embeddings using pgvector's cosine distance operator:

```sql
embedding <=> $1
```

Lower distance means greater similarity.

The query retrieves the most similar chunks:

```sql
SELECT text, section,
       embedding <=> $1 AS distance
FROM documents
WHERE embedding <=> $1 < 0.32
ORDER BY embedding <=> $1
LIMIT 3;
```

The project currently uses:

- Top-K = 3
- Similarity threshold = 0.32

These values are project-level heuristics rather than universal values.

## Query Rewriting

The system does not rewrite every question.

It checks for contextual expressions such as:

- `it`
- `this`
- `that`
- `which one`
- `previous`
- `above`

For example:

```text
User:
What projects did Asheesh build?

User:
Which one uses Next.js?
```

The second question can be rewritten into a self-contained retrieval query such as:

```text
Which of Asheesh's projects uses Next.js?
```

The rewritten query is used only for retrieval.

The original question is preserved for answer generation so that the final answer remains faithful to the user's actual question.

## Incremental Ingestion

The ingestion pipeline uses SHA-256 hashes.

For every chunk:

```text
Chunk
  |
  v
SHA-256 hash
  |
  v
Compare with database
  |
  +---- unchanged ---> skip embedding
  |
  +---- changed -----> generate embedding
                         |
                         v
                    update database
```

This prevents unnecessary embedding API calls when the resume has not changed.

## Evaluation

The project includes three basic retrieval test cases:

```text
What is Asheesh's degree?
What is Asheesh's Codeforces rating?
What projects has Asheesh built?
```

The evaluator checks whether the expected section appears in the top 3 retrieved chunks.

Example:

```text
Recall@3: 3/3
```

This means the expected section was retrieved within the top 3 results for all three test cases.

It does not mean the complete RAG system has 100% accuracy.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file:

```env
GEMINI_API_KEY=your_api_key

PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=ai_learning
PGHOST=localhost
PGPORT=5432
```

Do not commit `.env` to Git.

### 3. Prepare PostgreSQL

Create the database:

```sql
CREATE DATABASE ai_learning;
```

Enable pgvector:

```sql
CREATE EXTENSION vector;
```

Create the documents table:

```sql
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    embedding VECTOR(3072),
    section TEXT,
    content_hash TEXT UNIQUE,
    chunk_id TEXT UNIQUE
);
```

## Running the Project

### Ingest the resume

```bash
npm run ingest
```

This extracts the resume and stores its embeddings in PostgreSQL.

Because ingestion is incremental, unchanged chunks are skipped.

### Ask questions

```bash
npm run query
```

Example:

```text
Ask a question: What is Asheesh's Codeforces rating?
```

The application retrieves relevant resume information and generates an answer.

Exit with:

```text
exit
```

### Run retrieval evaluation

```bash
npm run evaluate
```

This runs the predefined retrieval test cases and reports Recall@3.

## Example

### Question

```text
What is Asheesh's Codeforces rating?
```

### Retrieval

```text
Section: Achievements
Distance: 0.2185
```

### Answer

```text
Asheesh's maximum Codeforces rating is 1587.
```

### Conversational Query

```text
What projects did Asheesh build?

Which one uses Next.js?
```

The second question can use the previous conversation to produce a self-contained retrieval query.

## What I Learned

This project was built to understand the core concepts behind RAG rather than relying on a framework.

Key concepts implemented:

- LLM APIs
- Embeddings
- Vector similarity
- Cosine distance
- Vector databases
- PostgreSQL + pgvector
- Chunking
- Metadata
- Incremental ingestion
- Retrieval
- Top-K retrieval
- Similarity thresholds
- Context construction
- Prompting
- Query rewriting
- Conversation history
- Retrieval evaluation
- API quota/error handling

## Limitations

This is a learning project and intentionally keeps the architecture simple.

Current limitations include:

- Conversation history exists only in memory.
- No authentication.
- No multi-user support.
- No production deployment.
- No streaming responses.
- Evaluation dataset is small.
- Retrieval threshold is manually selected.
- No automated answer-quality evaluation.
- No frontend.

## Future Learning

Possible next AI engineering topics:

1. Tool / Function Calling
2. AI Agents
3. Evaluation and Reliability
4. Production AI APIs
5. Security and prompt-injection protection
6. AI application deployment

The project intentionally stops here rather than adding unnecessary complexity.

## License

This project is for learning and educational purposes.