# Resume RAG with Node.js, Gemini & PostgreSQL

An AI-powered resume assistant built using **Retrieval-Augmented Generation (RAG)**. The project processes a resume PDF, stores its embeddings in PostgreSQL using pgvector, retrieves relevant information, and generates answers using Google's Gemini models.

This project is designed for learning and educational purposes, with a focus on understanding RAG, embeddings, vector search, backend development, and AI application reliability.

---

## Features

### RAG Pipeline
- Extracts text from a resume PDF.
- Splits resume content into meaningful sections and chunks.
- Generates embeddings using Gemini.
- Stores embeddings in PostgreSQL using pgvector.
- Retrieves relevant resume chunks using vector similarity search.
- Uses retrieved context to generate answers with Gemini.
- Supports query rewriting to improve retrieval.
- Uses a similarity threshold to filter irrelevant results.
- Maintains short conversation history in memory.
- Supports incremental ingestion using content hashes.
- Uses stable chunk IDs to identify resume chunks.

### Backend API
- Express.js REST API.
- Resume question-answering endpoint.
- Request validation.
- Request body size limit.
- Health check endpoints.
- Database readiness check.
- Request logging with response status and duration.
- Centralized error handling.
- AI timeout handling.
- Graceful shutdown of the HTTP server and PostgreSQL connection pool.

### Evaluation
- Recall@3 evaluation.
- Basic retrieval evaluation using predefined questions.
- Evaluation of whether relevant resume chunks are retrieved.

---

## Architecture

```text
                 Resume PDF
                     |
                     v
              PDF Text Extraction
                     |
                     v
              Section Identification
                     |
                     v
                Text Chunking
                     |
                     v
              Gemini Embeddings
                     |
                     v
             PostgreSQL + pgvector
                     |
                     |
                     v
User Question ---> Express API / Query Pipeline
                     |
                     v
              Query Rewriting
                     |
                     v
              Gemini Embeddings
                     |
                     v
             Vector Similarity Search
                     |
                     v
              Relevant Resume Chunks
                     |
                     v
              Similarity Threshold
                     |
                     v
              Gemini Answer Generation
                     |
                     v
                API Response
```

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | Backend REST API |
| Google Gemini | Embeddings and answer generation |
| PostgreSQL | Database |
| pgvector | Vector similarity search |
| LangChain | LLM and chain integration |
| pdf-parse | Resume PDF text extraction |
| pg | PostgreSQL client |
| dotenv | Environment variable management |

---

## Project Structure

```text
ai-learning/
│
├── client/                 # Client application
│
├── index.js                # Resume ingestion pipeline
├── query.js                # RAG question-answering CLI
├── rag.js                  # PostgreSQL vector retrieval
├── rag-service.js           # RAG answer generation service
├── server.js               # Express REST API
│
├── evaluate.js              # Retrieval evaluation
├── evaluation.js            # Additional evaluation experiments
│
├── langchain-rag.js         # LangChain RAG experiments
├── langchain-test.js        # LangChain testing
├── tool-calling.js          # Tool-calling experiments
├── test-retrieval.js        # Retrieval testing
│
├── mastercv.pdf             # Resume PDF
│
├── package.json
├── package-lock.json
├── .env                    # Environment variables
└── README.md
```

> Some files are experiments and learning utilities. The main backend API is implemented in `server.js`, `rag-service.js`, and `rag.js`.

---

## How the RAG Pipeline Works

### 1. Resume Ingestion

The ingestion pipeline reads the resume PDF and extracts its text.

The extracted content is organized into sections and divided into smaller chunks.

Each chunk is processed to generate an embedding using Gemini.

The embedding and corresponding resume content are stored in PostgreSQL.

### 2. Embeddings

Embeddings represent text as numerical vectors.

The project uses Gemini embeddings to convert resume chunks and user questions into vectors.

These vectors allow the application to retrieve semantically relevant resume content rather than relying only on exact keyword matching.

### 3. Vector Database

PostgreSQL stores the resume chunks and their embeddings.

The pgvector extension enables vector similarity search.

The database stores information such as:

- Resume chunk text
- Resume section
- Embedding
- Content hash
- Stable chunk ID

### 4. Retrieval

When a user asks a question:

1. The question is processed.
2. Query rewriting may improve the question.
3. Gemini generates an embedding for the query.
4. PostgreSQL searches for similar resume chunks.
5. The most relevant chunks are selected.
6. The similarity threshold filters weak matches.

The current retrieval pipeline uses the top 3 results.

### 5. Answer Generation

The retrieved resume chunks are provided as context to Gemini.

Gemini generates an answer based on the available resume information.

The RAG service returns the generated answer along with relevant source chunks.

---

## Database

The application uses PostgreSQL with the pgvector extension.

### Create Database

```sql
CREATE DATABASE ai_learning;
```

Connect to the database:

```bash
psql -d ai_learning
```

### Enable pgvector

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Documents Table

The ingestion pipeline stores resume chunks in the `documents` table.

The table includes the following fields:

| Column | Purpose |
|---|---|
| `id` | Database record identifier |
| `text` | Resume chunk content |
| `embedding` | Vector representation of the chunk |
| `section` | Resume section |
| `content_hash` | Hash used for content change detection |
| `chunk_id` | Stable identifier for the chunk |

The embedding column uses:

```sql
VECTOR(3072)
```

The exact schema is defined by the ingestion implementation.

---

## Vector Similarity Search

The retrieval pipeline uses PostgreSQL and pgvector to search for relevant resume chunks.

Conceptually, the query follows this structure:

```sql
SELECT
    section,
    text,
    embedding <=> $1 AS distance
FROM documents
WHERE embedding <=> $1 < 0.32
ORDER BY embedding <=> $1
LIMIT 3;
```

Here:

- `$1` represents the query embedding.
- `<=>` represents cosine distance in pgvector.
- Lower distance means greater similarity.
- The query retrieves up to 3 chunks.
- The similarity threshold filters chunks with insufficient similarity.

**Important:** The threshold is a project-specific retrieval setting. It should be evaluated and adjusted based on retrieval results rather than treated as a universal value.

---

## Query Rewriting

The application can rewrite a user question to improve retrieval.

For example:

```text
Original question:
What is my highest rating?
```

A rewritten query might be:

```text
What is my highest Codeforces rating?
```

The goal is to make the query more specific and improve the chance of retrieving the relevant resume section.

Query rewriting is part of the retrieval pipeline and does not guarantee that the correct information will be retrieved.

---

## Incremental Ingestion

The ingestion pipeline uses content hashes to identify changes in resume content.

The process:

1. Extract resume text.
2. Create chunks.
3. Generate content hashes.
4. Compare hashes with existing records.
5. Identify new or changed content.
6. Process the required chunks.

This helps avoid unnecessarily reprocessing unchanged content.

Stable chunk IDs are used to identify chunks across ingestion operations.

---

# Backend API

The project provides a REST API using Express.js.

The backend connects the RAG service to HTTP clients.

## Start the Server

Install dependencies:

```bash
npm install
```

Start the backend:

```bash
npm start
```

The server starts using the configured port.

If no port is configured, the application uses:

```text
3000
```

The startup logs indicate when the HTTP server is listening.

---

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health/live` | Checks whether the server is running |
| GET | `/health/ready` | Checks whether the application and database are ready |
| POST | `/api/chat` | Answers questions using the resume RAG pipeline |

---

## 1. Liveness Check

### Endpoint

```http
GET /health/live
```

Checks whether the HTTP server is running.

### Example

```bash
curl -i http://localhost:3000/health/live
```

### Successful Response

```json
{
  "status": "alive"
}
```

Status:

```http
200 OK
```

This endpoint does not perform a database check.

---

## 2. Readiness Check

### Endpoint

```http
GET /health/ready
```

Checks whether the application can communicate with PostgreSQL.

### Example

```bash
curl -i http://localhost:3000/health/ready
```

### Successful Response

```json
{
  "status": "ready",
  "database": "connected"
}
```

Status:

```http
200 OK
```

If the database is unavailable, the endpoint returns:

```json
{
  "status": "not ready",
  "database": "unavailable"
}
```

Status:

```http
503 Service Unavailable
```

---

## 3. Resume Question Answering

### Endpoint

```http
POST /api/chat
```

Accepts a question and generates an answer using the resume RAG pipeline.

### Request Headers

```http
Content-Type: application/json
```

### Request Body

```json
{
  "question": "What is my highest Codeforces rating?"
}
```

### Example Request

```bash
curl -i -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"What is my highest Codeforces rating?"}'
```

### Successful Response

The response contains the generated answer and relevant source chunks.

Example response structure:

```json
{
  "answer": "Your highest Codeforces rating is 1587.",
  "sources": [
    {
      "section": "Achievements",
      "text": "Relevant resume content..."
    }
  ]
}
```

The actual answer and source content depend on the resume and retrieval results.

Status:

```http
200 OK
```

---

## Request Validation

The chat endpoint validates the incoming question.

The question must:

- Be provided in the request body.
- Be a string.
- Contain non-whitespace characters.
- Not exceed 1000 characters.

The endpoint trims whitespace before processing the question.

### Empty Question

Request:

```json
{
  "question": ""
}
```

Response:

```json
{
  "error": "Please provide a non-empty question."
}
```

Status:

```http
400 Bad Request
```

### Missing Question

Request:

```json
{}
```

Response:

```json
{
  "error": "Please provide a non-empty question."
}
```

Status:

```http
400 Bad Request
```

### Invalid Question Type

Request:

```json
{
  "question": 123
}
```

Response:

```json
{
  "error": "Please provide a non-empty question."
}
```

Status:

```http
400 Bad Request
```

### Question Too Long

Questions exceeding 1000 characters are rejected.

Status:

```http
400 Bad Request
```

---

## Error Handling

The backend uses centralized error handling.

### Invalid JSON

If the request body contains malformed JSON:

```json
{
  "error": "Invalid JSON in request body."
}
```

Status:

```http
400 Bad Request
```

### Request Body Too Large

The JSON request body is limited to 10 KB.

If the request exceeds this limit:

```json
{
  "error": "Request body is too large. Maximum allowed size is 10 KB."
}
```

Status:

```http
413 Payload Too Large
```

### Unknown Endpoint

Request:

```http
GET /unknown
```

Response:

```json
{
  "error": "Endpoint not found"
}
```

Status:

```http
404 Not Found
```

### AI Timeout

The RAG service uses timeout handling for AI operations.

If an AI operation exceeds its configured timeout:

```json
{
  "error": "AI request timed out. Please try again."
}
```

Status:

```http
504 Gateway Timeout
```

### Service or Database Unavailable

If a service-related error is identified as unavailable:

```json
{
  "error": "Service temporarily unavailable. Please try again later."
}
```

Status:

```http
503 Service Unavailable
```

### Internal Server Error

Unexpected errors return a generic response:

```json
{
  "error": "Internal server error."
}
```

Status:

```http
500 Internal Server Error
```

Internal error details are logged on the server rather than exposed in the API response.

---

## Request Logging

The Express backend logs incoming requests and their completion details.

The log includes:

- HTTP method
- Request URL
- Response status
- Request duration

Example:

```text
POST /api/chat 200 - 4523ms
```

This helps observe backend behavior and identify slow requests.

---

## Database Connection Pool

The PostgreSQL backend uses a connection pool instead of creating a new database connection for every request.

The pool configuration includes:

- Maximum pool size: 10 connections
- Idle connection timeout: 30 seconds
- Connection timeout: 5 seconds
- PostgreSQL statement timeout: 10 seconds

The retrieval query also uses a client-side query timeout.

These settings help manage database connections and prevent some database operations from running indefinitely.

They do not limit the duration of the entire RAG request.

---

## Graceful Shutdown

The backend handles shutdown signals:

```text
SIGINT
SIGTERM
```

During shutdown:

1. The HTTP server stops accepting new connections.
2. Existing HTTP connections are allowed to close.
3. The PostgreSQL connection pool is closed.
4. A force-shutdown timer handles cases where shutdown takes too long.

This helps avoid leaving database connections open when the backend exits.

---

# Environment Variables

Create a `.env` file in the project root.

```env
GEMINI_API_KEY=your_gemini_api_key

PGUSER=your_postgres_username
PGPASSWORD=your_postgres_password
PGDATABASE=ai_learning
PGHOST=localhost
PGPORT=5432

PORT=3000
```

### Environment Variable Description

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Gemini API key |
| `PGUSER` | PostgreSQL username |
| `PGPASSWORD` | PostgreSQL password |
| `PGDATABASE` | PostgreSQL database name |
| `PGHOST` | PostgreSQL host |
| `PGPORT` | PostgreSQL port |
| `PORT` | Express server port |

The application loads environment variables using dotenv.

**Never commit `.env` or expose API keys and database credentials.**

---

# Installation and Setup

## 1. Clone the Repository

```bash
git clone <repository-url>
```

Navigate into the project:

```bash
cd ai-learning
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure Environment Variables

Create the `.env` file:

```bash
touch .env
```

Add your Gemini API key and PostgreSQL configuration.

## 4. Configure PostgreSQL

Create the database:

```sql
CREATE DATABASE ai_learning;
```

Connect to it:

```bash
psql -d ai_learning
```

Enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Create the documents table according to the schema used by the ingestion pipeline.

## 5. Ingest the Resume

Place the resume PDF at the expected project location.

Run:

```bash
npm run ingest
```

This executes:

```bash
node index.js
```

The ingestion pipeline extracts resume text, creates chunks, generates embeddings, and stores them in PostgreSQL.

## 6. Start the Backend

```bash
npm start
```

The Express server starts on the configured port.

## 7. Ask a Resume Question

Use the API:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"What is my highest Codeforces rating?"}'
```

---

# NPM Scripts

The project defines the following scripts:

| Command | Description |
|---|---|
| `npm start` | Starts the Express backend |
| `npm run ingest` | Runs resume ingestion |
| `npm run query` | Runs the RAG query CLI |
| `npm run evaluate` | Runs retrieval evaluation |

Equivalent commands:

```bash
npm start
```

```bash
npm run ingest
```

```bash
npm run query
```

```bash
npm run evaluate
```

---

# CLI Usage

The project also supports command-line experimentation independently of the HTTP API.

## Query

```bash
npm run query
```

The query pipeline supports:

- Asking questions about the resume.
- Query rewriting.
- Vector retrieval.
- Similarity threshold filtering.
- Answer generation.
- Short conversation history.

## Ingestion

```bash
npm run ingest
```

Runs the resume ingestion pipeline.

## Evaluation

```bash
npm run evaluate
```

Runs the retrieval evaluation.

---

# Evaluation

The project includes a basic retrieval evaluation pipeline.

The evaluation uses predefined questions and checks whether relevant resume content appears in the top 3 retrieved chunks.

### Recall@3

Recall@3 measures whether relevant information is retrieved within the first 3 results.

The evaluation includes questions related to resume information, such as:

- Highest Codeforces rating.
- Technical skills.
- Project experience.

The evaluation is intended to measure retrieval behavior.

It does not fully evaluate:

- Answer correctness.
- Hallucination rate.
- Answer completeness.
- Response quality.
- Production reliability.

The evaluation dataset is small, so its results should not be treated as a comprehensive benchmark.

---

# Example

Question:

```text
What is my highest Codeforces rating?
```

The RAG pipeline:

1. Processes the question.
2. Generates a query embedding.
3. Searches resume chunks in PostgreSQL.
4. Retrieves relevant achievement information.
5. Provides the retrieved context to Gemini.
6. Generates the answer.

Example answer:

```text
Your highest Codeforces rating is 1587.
```

The actual answer depends on the stored resume content and retrieval results.

---

# Current Limitations

This project is primarily a learning implementation.

### RAG
- Retrieval quality depends on chunking and embedding quality.
- The similarity threshold is manually configured.
- Query rewriting may not always improve retrieval.
- The evaluation dataset is small.
- Answer quality is not comprehensively evaluated.

### Backend
- No authentication.
- No authorization.
- No multi-user support.
- No persistent conversation history.
- No streaming responses.
- No production deployment configuration.
- No comprehensive rate limiting.
- AI timeout handling does not cancel the underlying provider operation.
- Database timeouts do not cover the complete AI request lifecycle.

### Frontend
- The backend API is available independently.
- Frontend integration and user experience are separate development tasks.

---

# Future Improvements

Possible future improvements include:

- Add authentication and authorization.
- Support multiple users and resumes.
- Add persistent conversation history.
- Improve retrieval evaluation.
- Evaluate answer correctness and hallucinations.
- Improve chunking strategies.
- Experiment with embedding models.
- Add rate limiting.
- Add request tracing.
- Add streaming responses.
- Improve AI retry and timeout behavior.
- Add automated backend tests.
- Deploy the backend.
- Integrate the frontend with the API.

---

# Learning Goals

This project helps explore:

- Retrieval-Augmented Generation.
- Embeddings and semantic search.
- PostgreSQL and pgvector.
- Gemini API integration.
- LangChain.
- Express.js backend development.
- REST API design.
- Request validation.
- Error handling.
- Database connection pooling.
- AI timeout handling.
- Graceful shutdown.
- Retrieval evaluation.

---

## License

This project is for learning and educational purposes.