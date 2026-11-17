# Resume RAG with Node.js, Gemini & PostgreSQL

An AI-powered resume assistant built using **Retrieval-Augmented Generation (RAG)**. The application processes a resume PDF, stores its embeddings in PostgreSQL with pgvector, retrieves relevant information, and generates answers using Google's Gemini models.

The project is designed for learning and educational purposes, with a focus on RAG, embeddings, vector search, backend development, and AI application reliability.

## Features

### RAG pipeline
- Extracts text from a resume PDF.
- Identifies meaningful resume sections and splits content into chunks.
- Generates embeddings using Gemini.
- Stores resume chunks and embeddings in PostgreSQL with pgvector.
- Retrieves relevant chunks using vector similarity search.
- Uses retrieved context to generate answers with Gemini.
- Supports query rewriting to improve retrieval.
- Applies a similarity threshold to filter weak matches.
- Maintains short conversation history in memory.
- Supports incremental ingestion using content hashes.
- Uses stable chunk IDs to identify resume chunks.

### Backend API
- Express.js REST API.
- Resume question-answering endpoint.
- Request validation and request-body size limit.
- Liveness and database-readiness health checks.
- Request logging with response status and duration.
- Centralized error handling.
- AI timeout handling.
- Graceful shutdown of the HTTP server and PostgreSQL connection pool.
- Rate limiting.

### Frontend
- React application built with Vite.
- Chat interface for asking questions about the resume.
- Markdown rendering for generated answers.
- Displays retrieved source information.
- Provides suggested questions and retry functionality.

### Evaluation
- Recall@3 retrieval evaluation.
- Predefined questions for checking retrieval quality.
- Relevance evaluation of retrieved resume chunks.
- Retrieval testing utility.

## Architecture

```text
                         Resume PDF
                             |
                             v
                      PDF text extraction
                             |
                             v
                    Section identification
                             |
                             v
                        Text chunking
                             |
                             v
                      Gemini embeddings
                             |
                             v
                     PostgreSQL + pgvector
                             |
                             |
User question                |
      |                      |
      v                      |
 React frontend              |
      |                      |
      v                      |
 Express API                 |
      |                      |
      v                      |
 Query rewriting             |
      |                      |
      v                      |
 Gemini query embedding      |
      |                      |
      v                      |
 Vector similarity search <--
      |
      v
 Relevant resume chunks
      |
      v
 Similarity threshold
      |
      v
 Gemini answer generation
      |
      v
 API response
      |
      v
 React chat interface
```

## Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | Backend REST API |
| React | Frontend user interface |
| Vite | Frontend development server and build tool |
| Google Gemini | Embeddings and answer generation |
| PostgreSQL | Database |
| pgvector | Vector similarity search |
| LangChain | LLM and chain integration |
| pdf-parse | Resume PDF text extraction |
| pg | PostgreSQL client |
| dotenv | Environment variable management |
| Jest | Backend automated tests |
| Supertest | HTTP API testing |

## Project Structure

```text
ai-learning/
│
├── client/                         # React + Vite frontend
│   ├── src/
│   │   ├── components/              # Chat UI components
│   │   ├── services/                # API communication
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── scripts/
│   ├── ingest.js                    # Resume ingestion
│   ├── query.js                     # RAG question-answering CLI
│   ├── evaluate-retrieval.js        # Recall@3 evaluation
│   ├── evaluate-relevance.js        # Retrieval relevance evaluation
│   └── test-retrieval.js            # Retrieval testing
│
├── experiments/
│   ├── langchain-rag.js             # LangChain RAG experiment
│   ├── langchain-test.js            # LangChain testing
│   └── tool-calling.js              # Gemini tool-calling experiment
│
├── tests/
│   ├── server.test.js               # API and server tests
│   └── rag-service.test.js          # RAG service tests
│
├── rag.js                           # PostgreSQL vector retrieval
├── rag-service.js                   # RAG answer generation service
├── server.js                        # Express REST API
├── mastercv.pdf                     # Resume PDF used for ingestion
├── package.json
├── package-lock.json
├── .env                             # Local environment variables
└── README.md
```

The main application is implemented in `server.js`, `rag-service.js`, and `rag.js`. The `client/` directory contains the frontend. The `scripts/` directory contains ingestion, CLI, and evaluation utilities. The `experiments/` directory contains standalone learning experiments.

## How the RAG Pipeline Works

### 1. Resume ingestion

The ingestion pipeline reads the resume PDF and extracts its text.

The extracted content is organized into sections and divided into smaller chunks. Each chunk is processed to generate an embedding using Gemini. The embedding and corresponding resume content are stored in PostgreSQL.

### 2. Embeddings

Embeddings represent text as numerical vectors.

The project uses Gemini embeddings to convert resume chunks and user questions into vectors. These vectors allow the application to retrieve semantically relevant resume content rather than relying only on exact keyword matching.

### 3. Vector database

PostgreSQL stores the resume chunks and their embeddings. The pgvector extension enables vector similarity search.

The stored information includes:
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

The current retrieval pipeline uses up to three results.

### 5. Answer generation

The retrieved resume chunks are provided as context to Gemini. Gemini generates an answer based on the available resume information.

The RAG service returns the generated answer along with relevant source chunks.

## Database Setup

The application uses PostgreSQL with the pgvector extension.

### Create the database

```sql
CREATE DATABASE ai_learning;
```

Connect to the database:

```bash
psql -d ai_learning
```

Enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Documents table

The ingestion pipeline stores resume chunks in the `documents` table.

The table includes fields for:

| Column | Purpose |
|---|---|
| `id` | Database record identifier |
| `text` | Resume chunk content |
| `embedding` | Vector representation of the chunk |
| `section` | Resume section |
| `content_hash` | Hash used for content change detection |
| `chunk_id` | Stable identifier for the chunk |

The embedding column is configured for:

```sql
VECTOR(3072)
```

The exact table definition and ingestion behavior are implemented in the ingestion script.

## Vector Similarity Search

The retrieval pipeline uses PostgreSQL and pgvector to search for relevant resume chunks.

A simplified representation of the query is:

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
- The query retrieves up to three chunks.
- The similarity threshold filters chunks with insufficient similarity.

**Note:** The threshold is a project-specific retrieval setting. It should be evaluated and adjusted based on retrieval results rather than treated as a universal value.

## Query Rewriting

The application can rewrite a user question to improve retrieval.

For example:

**Original question:**

```text
What is my highest rating?
```

**Possible rewritten query:**

```text
What is my highest Codeforces rating?
```

The goal is to make the query more specific and improve the chance of retrieving the relevant resume section. Query rewriting does not guarantee that the correct information will be retrieved.

## Incremental Ingestion

The ingestion pipeline uses content hashes to identify changes in resume content.

The process is:

1. Extract resume text.
2. Create chunks.
3. Generate content hashes.
4. Compare hashes with existing records.
5. Identify new or changed content.
6. Process the required chunks.

This helps avoid unnecessarily reprocessing unchanged content. Stable chunk IDs are used to identify chunks across ingestion operations.

## Backend API

The project provides a REST API using Express.js. The backend connects the RAG service to HTTP clients.

### Start the backend

Install the root dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

For development with Node.js watch mode:

```bash
npm run dev
```

The server uses the configured port. If no port is configured, it defaults to `3000`.

### API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health/live` | Checks whether the server is running |
| `GET` | `/health/ready` | Checks whether the application and database are ready |
| `POST` | `/api/chat` | Answers questions using the resume RAG pipeline |

### 1. Liveness check

**Endpoint:**

```http
GET /health/live
```

Example:

```bash
curl -i http://localhost:3000/health/live
```

Successful response:

```json
{
  "status": "alive"
}
```

Status: `200 OK`

This endpoint does not perform a database check.

### 2. Readiness check

**Endpoint:**

```http
GET /health/ready
```

Example:

```bash
curl -i http://localhost:3000/health/ready
```

Successful response:

```json
{
  "status": "ready",
  "database": "connected"
}
```

Status: `200 OK`

If the database is unavailable, the endpoint returns a not-ready response with status `503 Service Unavailable`.

### 3. Resume question answering

**Endpoint:**

```http
POST /api/chat
```

Request headers:

```http
Content-Type: application/json
```

Request body:

```json
{
  "question": "What projects are listed on my resume?"
}
```

Example request:

```bash
curl -i -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"What projects are listed on my resume?"}'
```

The response contains the generated answer and relevant source chunks. Its structure is:

```json
{
  "answer": "Generated answer based on the resume context.",
  "sources": [
    {
      "section": "Projects",
      "text": "Relevant resume content..."
    }
  ]
}
```

The actual answer and source content depend on the resume and retrieval results.

## Request Validation

The chat endpoint validates the incoming question. The question must:

- Be provided in the request body.
- Be a string.
- Contain non-whitespace characters.
- Not exceed 1000 characters.

The endpoint trims whitespace before processing the question.

Invalid or missing questions return `400 Bad Request`. Questions exceeding the configured length are also rejected.

## Error Handling

The backend uses centralized error handling.

The API handles cases including:

- Malformed JSON: `400 Bad Request`
- Request body exceeding the configured 10 KB limit: `413 Payload Too Large`
- Unknown endpoint: `404 Not Found`
- AI request timeout: `504 Gateway Timeout`
- Identified service or database unavailability: `503 Service Unavailable`
- Unexpected internal errors: `500 Internal Server Error`

Internal error details are logged on the server rather than exposed in the API response.

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

## Database Connection Pool

The PostgreSQL backend uses a connection pool instead of creating a new database connection for every request.

The pool configuration includes:

- Maximum pool size: 10 connections
- Idle connection timeout: 30 seconds
- Connection timeout: 5 seconds
- PostgreSQL statement timeout: 10 seconds

The retrieval query also uses a client-side query timeout. These settings help manage database connections and prevent some database operations from running indefinitely. They do not limit the duration of the entire RAG request.

## Graceful Shutdown

The backend handles the following shutdown signals:

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

## Frontend

The frontend is a React application built with Vite and is located in the `client/` directory.

Install frontend dependencies:

```bash
npm install --prefix client
```

Start the frontend development server:

```bash
npm run dev --prefix client
```

Build the frontend for production:

```bash
npm run build --prefix client
```

The Vite development configuration proxies API requests to the backend at `http://localhost:3000`. Start the backend separately when using the frontend locally.

## Environment Variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key

PGUSER=your_postgres_username
PGPASSWORD=your_postgres_password
PGDATABASE=ai_learning
PGHOST=localhost
PGPORT=5432

PORT=3000
```

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

## Installation and Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd ai-learning
```

### 2. Install backend dependencies

```bash
npm install
```

### 3. Install frontend dependencies

```bash
npm install --prefix client
```

### 4. Configure environment variables

Create the `.env` file in the project root and add the Gemini API key and PostgreSQL configuration shown above.

### 5. Configure PostgreSQL

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

Create the `documents` table according to the schema used by the ingestion implementation.

### 6. Ingest the resume

Place the resume PDF at the expected project location. The current project structure uses `mastercv.pdf` in the repository root.

Run:

```bash
npm run ingest
```

This executes `scripts/ingest.js`, which extracts resume text, creates chunks, generates embeddings, and stores them in PostgreSQL.

### 7. Start the backend

```bash
npm start
```

### 8. Start the frontend

In a separate terminal:

```bash
npm run dev --prefix client
```

Open the local URL printed by Vite.

### 9. Ask a resume question

Use the chat interface or call the API directly:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"What projects are listed on my resume?"}'
```

## NPM Scripts

The root project defines the following scripts:

| Command | Description |
|---|---|
| `npm start` | Starts the Express backend |
| `npm run dev` | Starts the backend in watch mode |
| `npm run ingest` | Runs resume ingestion |
| `npm run query` | Runs the RAG query CLI |
| `npm run evaluate` | Runs retrieval evaluation |
| `npm run evaluate:relevance` | Runs retrieval relevance evaluation |
| `npm run test:retrieval` | Runs retrieval testing |
| `npm test` | Runs automated Jest tests |

Frontend scripts are run from the root using the `--prefix client` option:

| Command | Description |
|---|---|
| `npm run dev --prefix client` | Starts the Vite development server |
| `npm run build --prefix client` | Builds the frontend for production |

## CLI Usage

The project also supports command-line experimentation independently of the HTTP API.

### Query

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

### Ingestion

```bash
npm run ingest
```

Runs the resume ingestion pipeline.

### Retrieval evaluation

```bash
npm run evaluate
```

Runs the Recall@3 retrieval evaluation.

### Relevance evaluation

```bash
npm run evaluate:relevance
```

Runs the relevance evaluation utility.

### Retrieval testing

```bash
npm run test:retrieval
```

Runs the retrieval testing script.

## Testing

Run the automated backend test suite:

```bash
npm test
```

The test suite uses Jest and Supertest to test server behavior and the RAG service.

## Evaluation

The project includes a basic retrieval evaluation pipeline.

The retrieval evaluation uses predefined questions and checks whether relevant resume content appears in the top three retrieved chunks.

### Recall@3

Recall@3 measures whether relevant information is retrieved within the first three results.

The evaluation includes questions related to resume information, such as:
- Competitive programming ratings.
- Technical skills.
- Project experience.

The evaluation is intended to measure retrieval behavior. It does not fully evaluate:
- Answer correctness.
- Hallucination rate.
- Answer completeness.
- Response quality.
- Production reliability.

The evaluation dataset is small, so its results should not be treated as a comprehensive benchmark.

## Current Limitations

This project is primarily a learning implementation.

### RAG
- Retrieval quality depends on chunking and embedding quality.
- The similarity threshold is manually configured.
- Query rewriting may not always improve retrieval.
- The evaluation dataset is small.
- Answer quality is not comprehensively evaluated.

### Backend
- No authentication or authorization.
- No multi-user support.
- No persistent conversation history.
- No streaming responses in the current chat interface.
- No complete production deployment configuration.
- Rate limiting is basic and may need further tuning for production.
- AI timeout handling does not cancel the underlying provider operation.
- Database timeouts do not cover the complete AI request lifecycle.

### Frontend
- The frontend currently provides a basic chat experience.
- Additional accessibility, responsive-design, and user-experience improvements may be needed.

## Future Improvements

Possible future improvements include:

- Add authentication and authorization.
- Support multiple users and resumes.
- Add persistent conversation history.
- Improve retrieval evaluation.
- Evaluate answer correctness and hallucinations.
- Improve chunking strategies.
- Experiment with embedding models.
- Improve rate limiting.
- Add request tracing.
- Add streaming responses.
- Improve AI retry and timeout behavior.
- Expand automated test coverage.
- Add production deployment configuration.
- Improve frontend accessibility and user experience.

## Learning Goals

This project explores:

- Retrieval-Augmented Generation.
- Embeddings and semantic search.
- PostgreSQL and pgvector.
- Gemini API integration.
- LangChain.
- Express.js backend development.
- React frontend development.
- REST API design.
- Request validation.
- Error handling.
- Database connection pooling.
- AI timeout handling.
- Graceful shutdown.
- Retrieval evaluation.

## License

This project is for learning and educational purposes.