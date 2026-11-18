# Resume RAG Assistant

An AI-powered resume assistant built with **Retrieval-Augmented Generation (RAG)**. Upload a PDF resume and ask questions about the candidate's skills, projects, education, experience, and achievements.

The application uses **Google Gemini** for embeddings and answer generation, **PostgreSQL with pgvector** for vector storage and similarity search, **Node.js and Express** for the backend, and **React with Vite** for the frontend.

Each uploaded resume creates an independent session. Resume chunks and conversation messages are associated with that session, and sessions automatically expire after **24 hours**.

## Features

### Resume processing and RAG
- Upload PDF resumes (maximum file size: 5 MB).
- Extract text from uploaded PDFs.
- Identify resume sections and split content into smaller chunks.
- Generate embeddings using Google Gemini.
- Store resume chunks and embeddings in PostgreSQL with pgvector.
- Retrieve session-specific resume content using vector similarity search.
- Generate answers using the retrieved resume context.
- Return relevant source chunks with answers.

### Session management
- Create a separate session for each resume upload.
- Isolate resume documents and conversation history by session ID.
- Persist conversation messages in PostgreSQL.
- Restore an active session after refreshing or reopening the browser.
- Replace a resume by creating a new session.
- Delete a session and its associated documents and messages.
- Automatically expire sessions after 24 hours.

### Backend
- Express.js API.
- PDF upload handling and validation with Multer.
- Request validation and rate limiting.
- Liveness and database-readiness health checks.
- PostgreSQL connection pooling.
- AI timeout and error handling.
- Request logging with response status and duration.
- Graceful shutdown of the HTTP server and database connection pool.
- Server-Sent Events (SSE) endpoint for streamed answers.

### Frontend
- React application built with Vite.
- Resume upload interface and chat experience.
- Session restoration using browser `localStorage`.
- Resume replacement and session deletion.
- Markdown rendering for generated answers.
- Retrieved source display.
- Suggested questions and error handling.

### Testing and evaluation
- Automated backend tests using Jest and Supertest.
- API and upload validation tests.
- Resume processing and session management tests.
- RAG service tests.
- Retrieval evaluation utilities.

## Architecture

The application has two primary flows: resume ingestion and question answering.

### 1. Resume ingestion

```text
User selects a PDF
       |
       v
React frontend
       |
       v
Express upload endpoint
       |
       v
Multer validation (PDF, size limit)
       |
       v
PDF text extraction
       |
       v
Section identification and chunking
       |
       v
Gemini embedding generation
       |
       v
Create session and store chunks
       |
       v
PostgreSQL + pgvector
   |              |
   v              v
Sessions       Documents
```

### 2. Question answering

```text
User question
     |
     v
React frontend
     |
     v
Express chat endpoint
     |
     v
Validate question and active session
     |
     v
Load conversation history
     |
     v
Generate query embedding
     |
     v
Session-filtered vector search
     |
     v
Relevant resume chunks
     |
     v
Gemini answer generation
     |
     v
Save conversation and return answer + sources
     |
     v
React chat interface
```

### 3. Session and data lifecycle

- Each upload creates a UUID session.
- Every resume chunk and conversation message references its session.
- Retrieval queries filter documents by the active session ID.
- Conversation history is persisted in PostgreSQL.
- Sessions expire after 24 hours.
- Deleting a session cascades to its associated documents and messages.
- The frontend stores the active session ID in `localStorage` to restore it on a later visit.

**Security note:** The application currently has no user authentication or authorization. A session ID is used to identify a session, but it is not a substitute for a full user identity and access-control system. Do not treat the current implementation as suitable for storing sensitive resumes in a public production service without additional security controls.

## Tech stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | Backend API |
| React | Frontend user interface |
| Vite | Frontend development and build tooling |
| Google Gemini | Embeddings and answer generation |
| PostgreSQL | Relational database |
| pgvector | Vector storage and similarity search |
| LangChain | LLM and prompt integration |
| `pdf-parse` | PDF text extraction |
| `pg` | PostgreSQL client |
| Multer | Multipart file upload handling |
| dotenv | Environment variable management |
| Jest | Automated testing |
| Supertest | HTTP API testing |

## Project structure

```text
ai-learning/
├── client/                         # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInput.jsx
│   │   │   ├── Message.jsx
│   │   │   └── Welcome.jsx
│   │   ├── services/
│   │   │   └── chatService.js
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── scripts/                        # Ingestion and evaluation utilities
│   ├── ingest.js
│   ├── query.js
│   ├── evaluate-retrieval.js
│   ├── evaluate-relevance.js
│   └── test-retrieval.js
├── experiments/                    # Standalone learning experiments
│   ├── langchain-rag.js
│   ├── langchain-test.js
│   └── tool-calling.js
├── tests/                           # Automated backend tests
│   ├── server.test.js
│   ├── upload.test.js
│   ├── rag-service.test.js
│   ├── resume-service.test.js
│   └── session-service.test.js
├── db.js                            # PostgreSQL connection pool
├── rag.js                           # Embeddings and vector retrieval
├── rag-service.js                   # RAG answer generation
├── resume-service.js                # PDF processing and session creation
├── session-service.js               # Session and conversation management
├── server.js                        # Express API and server lifecycle
├── package.json
├── package-lock.json
├── README.md
└── .gitignore
```

### Core backend modules

| Module | Responsibility |
|---|---|
| `server.js` | Express routes, middleware, validation, health checks, and server lifecycle |
| `db.js` | Shared PostgreSQL connection pool and database utilities |
| `resume-service.js` | PDF extraction, section identification, chunking, embedding generation, and session creation |
| `rag.js` | Gemini embeddings and session-specific vector retrieval |
| `rag-service.js` | Prompt construction, conversation context, and Gemini answer generation |
| `session-service.js` | Session validation, conversation history, deletion, and expiry cleanup |

The `client/` directory contains the frontend. The `scripts/` directory contains command-line ingestion and retrieval utilities. The `experiments/` directory contains standalone experiments, and `tests/` contains automated backend tests.

## How the RAG pipeline works

### 1. Resume ingestion

The backend receives a PDF upload, validates the file, and extracts its text. The extracted content is divided into meaningful resume sections and smaller chunks. Gemini generates an embedding for each chunk, and the chunks and vectors are stored in PostgreSQL.

### 2. Embeddings

An embedding represents text as a numerical vector. The application uses Gemini embeddings for both resume chunks and user questions. This enables semantic retrieval rather than relying only on exact keyword matching.

### 3. Retrieval

When a user asks a question:

1. The backend validates the question and active session.
2. Conversation history is loaded for that session.
3. Gemini generates an embedding for the current question.
4. PostgreSQL searches for similar resume chunks belonging to that session.
5. The most relevant chunks are selected, subject to the configured similarity threshold.
6. Up to three chunks are returned to the answer-generation step.

### 4. Answer generation

The retrieved chunks and conversation history are supplied to Gemini. The model generates an answer grounded in the retrieved resume context. The backend saves the user and assistant messages and returns the answer with its source chunks.

The similarity threshold and retrieval count are implementation settings; they should be evaluated against the project's retrieval dataset rather than treated as universal values.

## Database

The application uses PostgreSQL and the pgvector extension.

### Prerequisites

- PostgreSQL
- The pgvector extension installed for your PostgreSQL version
- A Gemini API key

### Database Setup

Create the PostgreSQL database:

```bash
sudo -u postgres createdb ai_learning
```

Apply the initial database schema:

```bash
sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -d ai_learning \
  -f migrations/001_initial_schema.sql
```

The migration enables pgvector and creates all required tables, constraints, foreign keys, and indexes.

**Note:** This migration is intended for fresh database initialization. It is not an upgrade or repair script for an existing database.

### Tables

The application uses three primary tables.

#### `sessions`

Stores metadata for each uploaded resume session.

| Column | Purpose |
|---|---|
| `id` | Session UUID |
| `filename` | Uploaded PDF filename |
| `created_at` | Session creation time |
| `expires_at` | Session expiration time |

#### `documents`

Stores the extracted resume chunks and their embeddings.

| Column | Purpose |
|---|---|
| `id` | Document record identifier |
| `session_id` | Associated session UUID |
| `text` | Resume chunk content |
| `embedding` | Vector representation of the chunk |
| `section` | Resume section |
| `content_hash` | Hash used to identify chunk content |
| `chunk_id` | Chunk identifier |

The embedding column is configured for 3072 dimensions:

```sql
VECTOR(3072)
```

#### `messages`

Stores conversation history.

| Column | Purpose |
|---|---|
| `id` | Message identifier |
| `session_id` | Associated session UUID |
| `role` | `user` or `assistant` |
| `content` | Message content |
| `created_at` | Message creation time |

The `documents` and `messages` tables reference `sessions`. Cascading deletion removes the associated records when a session is deleted.

### Vector similarity search

The retrieval service uses pgvector's cosine-distance operator (`<=>`). Conceptually, the query is:

```sql
SELECT
    section,
    text,
    embedding <=> $1 AS distance
FROM documents
WHERE session_id = $2
  AND embedding <=> $1 < 0.32
ORDER BY embedding <=> $1
LIMIT 3;
```

- `$1` is the query embedding.
- `$2` is the active session UUID.
- `<=>` calculates cosine distance.
- Lower distance indicates greater similarity.
- The session filter prevents chunks from other sessions from being retrieved.
- The distance threshold filters weaker matches.

The threshold shown is a project setting and may need adjustment based on evaluation results.

## Backend API

The backend exposes the following endpoints.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health/live` | Checks whether the server is running |
| `GET` | `/health/ready` | Checks application and database readiness |
| `POST` | `/api/resumes` | Uploads a PDF and creates a session |
| `POST` | `/api/chat` | Answers a question using the active resume session |
| `POST` | `/api/chat/stream` | Streams an answer using Server-Sent Events |
| `GET` | `/api/sessions/:sessionId` | Retrieves an active session and its conversation history |
| `DELETE` | `/api/sessions/:sessionId` | Deletes a session and its associated data |

### 1. Upload a resume

**`POST /api/resumes`**

The request uses `multipart/form-data` with a field named `resume`. The accepted file is a PDF, with a maximum size of 5 MB.

```bash
curl -X POST http://localhost:3000/api/resumes \
  -F "resume=@resume.pdf"
```

A successful request returns `201 Created` and session metadata, including the generated session ID, filename, creation time, and expiration time.

### 2. Ask a question

**`POST /api/chat`**

Send the active session ID and question as JSON:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your-session-uuid",
    "question": "What projects are listed on my resume?"
  }'
```

The response contains an `answer` and a `sources` array with relevant resume sections and text.

### 3. Stream an answer

**`POST /api/chat/stream`**

This endpoint streams answer-generation events using Server-Sent Events (SSE). It accepts the same `sessionId` and `question` fields as the regular chat endpoint.

The current frontend uses the regular `/api/chat` endpoint; the streaming endpoint is available in the backend.

### 4. Retrieve a session

**`GET /api/sessions/:sessionId`**

Returns the active session and its stored conversation history.

```bash
curl http://localhost:3000/api/sessions/your-session-uuid
```

An expired or unavailable session cannot be restored.

### 5. Delete a session

**`DELETE /api/sessions/:sessionId`**

Deletes the session and its associated resume documents and messages.

```bash
curl -X DELETE \
  http://localhost:3000/api/sessions/your-session-uuid
```

### 6. Health checks

Liveness:

```bash
curl http://localhost:3000/health/live
```

Readiness:

```bash
curl http://localhost:3000/health/ready
```

The readiness endpoint checks database connectivity. It returns `503 Service Unavailable` when the database is unavailable.

## Installation and local development

### Prerequisites

- Node.js and npm
- PostgreSQL with pgvector installed
- Google Gemini API key

### 1. Clone the repository

```bash
git clone <repository-url>
cd ai-learning
```

### 2. Install dependencies

Install backend dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
npm install --prefix client
```

### 3. Configure environment variables

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
| `GEMINI_API_KEY` | Google Gemini API key |
| `PGUSER` | PostgreSQL username |
| `PGPASSWORD` | PostgreSQL password |
| `PGDATABASE` | PostgreSQL database name |
| `PGHOST` | PostgreSQL host |
| `PGPORT` | PostgreSQL port |
| `PORT` | Express server port |

The backend loads environment variables using dotenv.

**Never commit `.env` or expose API keys and database credentials.**

### 4. Configure the database

Create the `ai_learning` database, enable pgvector, and ensure the application tables and relationships match the schema described in the Database section.

### 5. Start the backend

```bash
npm start
```

For development with Node.js watch mode:

```bash
npm run dev
```

The backend defaults to port `3000` unless another port is configured.

### 6. Start the frontend

In a separate terminal:

```bash
npm run dev --prefix client
```

The Vite development configuration proxies API requests to the backend at `http://localhost:3000`. Keep the backend running while using the frontend.

Open the local URL printed by Vite.

### 7. Use the application

1. Upload a PDF resume.
2. Wait for processing and session creation to finish.
3. Ask questions about the uploaded resume.
4. Refresh or reopen the browser to restore the active session.
5. Use **Replace Resume** to start a new session or **Delete Session** to remove the current session.

## NPM scripts

The root project defines these scripts:

| Command | Description |
|---|---|
| `npm start` | Starts the Express backend |
| `npm run dev` | Starts the backend in watch mode |
| `npm run ingest` | Runs the standalone ingestion utility |
| `npm run query` | Runs the CLI query utility |
| `npm run evaluate` | Runs retrieval evaluation |
| `npm run evaluate:relevance` | Runs retrieval relevance evaluation |
| `npm run test:retrieval` | Runs retrieval testing |
| `npm test` | Runs the Jest test suite |

Frontend commands:

| Command | Description |
|---|---|
| `npm run dev --prefix client` | Starts the Vite development server |
| `npm run build --prefix client` | Builds the frontend for production |

The standalone scripts and experiments are provided as development utilities. The primary application workflow is resume upload and chat through the Express API and React frontend.

## Testing

Run the automated test suite:

```bash
npm test
```

The test suite uses Jest and Supertest. It covers server behavior, resume upload validation, resume processing, session management, and RAG service behavior.

The current project test run contains five test suites and 59 tests. Run the command above to verify the current checkout rather than relying on a previously recorded result.

Build the frontend:

```bash
npm run build --prefix client
```

## Retrieval evaluation

The project includes utilities for evaluating retrieval behavior using predefined resume questions.

Recall@3 checks whether relevant resume content appears among the top three retrieved chunks. The evaluation dataset is small and should be treated as a development aid, not a comprehensive benchmark of answer quality or production reliability.

The evaluation does not fully measure:
- Answer correctness.
- Hallucination rate.
- Answer completeness.
- Response quality.
- Production reliability.

## Current limitations

### Security and sessions
- No user authentication or authorization.
- Session IDs are not a replacement for authenticated user ownership.
- Rate limiting is basic and may require tuning for a public deployment.
- Session expiry is fixed at 24 hours.

### RAG
- Retrieval quality depends on chunking and embedding quality.
- The similarity threshold is manually configured.
- The retrieval evaluation dataset is small.
- Answer correctness and hallucination rates are not comprehensively evaluated.

### Backend and frontend
- The current frontend uses the regular chat endpoint rather than the SSE streaming endpoint.
- AI timeout handling does not necessarily cancel the underlying provider operation.
- Database timeouts do not cover the entire AI request lifecycle.
- Production deployment configuration and operational monitoring require additional work.

## Future improvements

- Add authentication and authorization.
- Associate sessions with authenticated users.
- Improve retrieval and answer-quality evaluation.
- Experiment with chunking strategies and embedding models.
- Improve rate limiting and request tracing.
- Integrate streaming responses into the frontend.
- Improve AI retry and timeout behavior.
- Expand automated test coverage.
- Add production deployment configuration and monitoring.
- Improve frontend accessibility and user experience.

## Learning goals

This project explores:

- Retrieval-Augmented Generation.
- Embeddings and semantic search.
- PostgreSQL and pgvector.
- Gemini API integration.
- LangChain.
- Express.js backend development.
- React frontend development.
- REST API design.
- File upload validation.
- Session management and data isolation.
- Persistent conversation history.
- Database connection pooling.
- Error handling and graceful shutdown.
- Retrieval evaluation.

## License

No license has been specified yet. Unless a license is added to the repository, all rights remain with the copyright holder.