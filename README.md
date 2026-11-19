# Resume RAG Assistant

An AI-powered application that lets users upload a PDF resume and ask questions about its skills, projects, education, experience, and achievements using Retrieval-Augmented Generation (RAG).

The application combines **Google Gemini, LangChain, PostgreSQL, and pgvector** to retrieve relevant resume information and generate context-aware answers.

**Live Demo:** https://resume-rag-assistant-nine.vercel.app/

**Backend:** https://resume-rag-backend-qeac.onrender.com

## Production Architecture

The application is deployed using separate frontend, backend, and database services.

| Layer | Technology | Deployment |
|---|---|---|
| Frontend | React, Vite | Vercel |
| Backend | Node.js, Express.js | Render |
| Database | PostgreSQL, pgvector | Neon |
| AI | Google Gemini, LangChain | Gemini API |

### Application Architecture

```text
              User
               |
               v
       React + Vite Frontend
             (Vercel)
               |
               | HTTPS / REST API
               v
        Node.js + Express
             (Render)
          /     |      \
         /      |       \
        v       v        v
   PostgreSQL  Gemini   RAG Service
   + pgvector   API        |
     (Neon)                |
        ^                  |
        |__________________|
          Retrieved Context
```

The frontend communicates with the Express backend through REST APIs. The backend handles resume processing, session management, vector retrieval, and AI response generation. PostgreSQL with pgvector stores resume chunks, embeddings, sessions, and conversation history.

## Features

### Resume Processing and RAG
- Upload PDF resumes (maximum file size: 5 MB).
- Extract text and identify meaningful resume sections.
- Split extracted content into smaller chunks.
- Generate embeddings using Google Gemini.
- Store document chunks and embeddings in PostgreSQL with pgvector.
- Retrieve relevant resume information using session-specific vector similarity search.
- Generate context-aware answers using Gemini.
- Return relevant source chunks alongside generated answers.

### Session and Conversation Management
- Create an independent session for each uploaded resume.
- Isolate resume documents and conversations by session ID.
- Persist conversation history in PostgreSQL.
- Restore active sessions using browser `localStorage`.
- Replace an uploaded resume by creating a new session.
- Delete sessions and associated documents and messages.
- Automatically expire sessions after 24 hours.

### Backend Engineering
- REST API built with Express.js.
- PDF upload validation using Multer.
- Request validation and rate limiting.
- PostgreSQL connection pooling.
- Liveness and database-readiness health checks.
- AI timeout and error handling.
- Centralized error handling and request logging.
- Graceful shutdown of the HTTP server and database pool.
- Server-Sent Events (SSE) endpoint for answer streaming.

### Frontend
- React application built with Vite.
- Resume upload and conversational chat interface.
- Session restoration using browser `localStorage`.
- Markdown rendering for AI-generated answers.
- Retrieved source display.
- Resume replacement and session deletion.
- Suggested questions and error handling.

### Testing and Evaluation
- Automated backend tests using Jest and Supertest.
- API endpoint and file upload validation tests.
- Resume processing and session management tests.
- RAG service tests.
- Retrieval evaluation utilities, including Recall@3.

## Architecture

The application follows a Retrieval-Augmented Generation (RAG) architecture. Instead of sending the entire resume to the language model for every question, it retrieves relevant resume chunks from PostgreSQL and uses them as context for generating answers.

### 1. Resume Ingestion Flow

When a user uploads a resume:

1. The React frontend sends the PDF to the backend through the resume upload API.
2. Express and Multer validate and handle the uploaded file.
3. The PDF text is extracted using `pdf-parse`.
4. The extracted text is divided into sections and smaller chunks.
5. Google Gemini generates an embedding for each chunk.
6. A new session is created for the uploaded resume.
7. Resume chunks and their embeddings are stored in PostgreSQL using pgvector, associated with the session.

### 2. Question Answering Flow

When a user asks a question:

1. The frontend sends the question along with the session ID to the backend.
2. The backend validates the request and retrieves the conversation history.
3. Gemini generates an embedding for the user's question.
4. PostgreSQL performs vector similarity search to find the most relevant resume chunks belonging to that session.
5. The retrieved chunks and conversation history are provided as context to Gemini.
6. Gemini generates an answer based on the retrieved resume information.
7. The conversation is saved in PostgreSQL, and the response is returned with its relevant source chunks.
8. The frontend displays the answer and sources.

### 3. Session Lifecycle

Each resume upload creates an independent session.

- A UUID identifies each session.
- Resume chunks and conversation messages are associated with their session.
- Retrieval queries are filtered by session ID to prevent results from unrelated resume sessions from being mixed.
- The frontend stores the active session ID in `localStorage` to restore the session after a page reload.
- Replacing a resume creates a new session.
- Deleting a session also deletes its associated documents and messages through database cascading.
- Sessions expire after 24 hours, with automatic cleanup.

### 4. Data Isolation and Security

Session IDs are used to scope resume retrieval and conversation history. However, the application currently does not implement authentication or authorization.

A session UUID should not be treated as proof of user identity or ownership. Additional access-control and security mechanisms are required before using the application for sensitive resume data in a production environment.

## Tech Stack

| Category | Technology | Purpose |
|---|---|---|
| Runtime | Node.js | JavaScript runtime for the backend |
| Backend | Express.js 5 | REST API, request handling, and middleware |
| Frontend | React 19 | Component-based user interface |
| Frontend Tooling | Vite | Frontend development server and build tooling |
| AI Model | Google Gemini API | Resume embeddings and context-aware answer generation |
| AI Framework | LangChain | Exploring and integrating RAG-related components |
| Database | PostgreSQL | Persistent storage for sessions, resume chunks, and conversations |
| Vector Search | pgvector | Storing embeddings and performing similarity searches |
| Database Client | node-postgres (`pg`) | PostgreSQL connectivity and connection pooling |
| PDF Processing | pdf-parse | Extracting text from uploaded PDF resumes |
| File Upload | Multer | Handling and validating multipart file uploads |
| Configuration | dotenv | Loading environment variables |
| Testing | Jest | Backend unit and integration testing |
| API Testing | Supertest | Testing Express endpoints |

### Deployment

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| PostgreSQL Database | Neon |
| AI Services | Google Gemini API |

## Project Structure

```text
ai-learning/
├── client/                         # React + Vite frontend
│   ├── src/
│   │   ├── components/             # Chat and UI components
│   │   │   ├── ChatInput.jsx
│   │   │   ├── Message.jsx
│   │   │   └── Welcome.jsx
│   │   ├── services/
│   │   │   └── chatService.js      # Backend API communication
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── migrations/
│   └── 001_initial_schema.sql      # Database schema and pgvector setup
│
├── scripts/                        # Ingestion and evaluation utilities
│   ├── ingest.js
│   ├── query.js
│   ├── evaluate-retrieval.js
│   ├── evaluate-relevance.js
│   └── test-retrieval.js
│
├── experiments/                    # Standalone AI/RAG experiments
│   ├── langchain-rag.js
│   ├── langchain-test.js
│   └── tool-calling.js
│
├── tests/                           # Backend automated tests
│   ├── server.test.js
│   ├── upload.test.js
│   ├── rag-service.test.js
│   ├── resume-service.test.js
│   └── session-service.test.js
│
├── db.js                            # PostgreSQL connection pool
├── rag.js                           # RAG pipeline utilities
├── rag-service.js                   # Retrieval and answer generation
├── resume-service.js                # Resume extraction and processing
├── session-service.js               # Session and conversation management
├── server.js                        # Express application and API routes
│
├── package.json
├── package-lock.json
├── README.md
└── .gitignore
```


## Core Backend Modules

The backend is organized into separate modules, each responsible for a specific part of the application.

| Module | Responsibilities |
|---|---|
| `server.js` | Initializes the Express application, configures middleware, defines API routes, handles health checks, and manages server lifecycle. |
| `db.js` | Configures the PostgreSQL connection pool and provides database connectivity. |
| `resume-service.js` | Processes uploaded PDF resumes, extracts text, identifies sections, and generates chunks for indexing. |
| `rag.js` | Contains utilities used by the RAG pipeline, including embedding-related operations. |
| `rag-service.js` | Handles retrieval of relevant resume chunks and generates context-aware answers using Gemini. |
| `session-service.js` | Manages resume sessions, conversation history, session retrieval, deletion, and expiration. |

### Design Approach

The backend separates HTTP request handling, resume processing, retrieval, session management, and database connectivity.

This separation helps keep API routes focused on request handling while application-specific operations remain within their respective service modules. It also makes individual components easier to test and maintain.

## How the RAG Pipeline Works

The application uses Retrieval-Augmented Generation (RAG) to answer questions using information extracted from uploaded resumes.

The pipeline consists of four main stages:

### 1. Document Processing

When a PDF resume is uploaded:

- Extract text from the PDF using `pdf-parse`.
- Identify relevant resume sections.
- Split the extracted text into smaller chunks.
- Associate the processed content with a newly created session.

Chunking allows the application to retrieve specific pieces of resume information instead of processing the entire document for every question.

### 2. Embedding Generation and Storage

- Generate vector embeddings for each resume chunk using the Google Gemini API.
- Store the chunks and their embeddings in PostgreSQL.
- Use the pgvector extension to store and search vector data.
- Associate each chunk with its corresponding session.

These embeddings represent the semantic meaning of the resume content and enable similarity-based retrieval.

### 3. Semantic Retrieval

When a user submits a question:

- Generate an embedding for the question using Gemini.
- Search for semantically similar resume chunks using pgvector.
- Restrict the search to the active session.
- Retrieve up to three relevant chunks based on similarity and the configured relevance threshold.

Session filtering ensures that retrieved information belongs to the resume associated with the current conversation.

### 4. Context-Aware Answer Generation

- Combine the retrieved resume chunks with the conversation history.
- Send the context and user question to Google Gemini.
- Generate an answer grounded in the retrieved resume information.
- Store the user question and generated response in PostgreSQL.
- Return the answer along with its retrieved sources.

Returning source chunks helps users understand which parts of their resume were used to generate an answer.

### Retrieval Evaluation

The project includes retrieval evaluation scripts to measure how effectively relevant resume chunks are retrieved.

The evaluation utilities include:

- Recall@3 measurement.
- Retrieval relevance evaluation.
- Experiments for testing retrieval behavior.

These evaluations focus on retrieval quality; they do not constitute a comprehensive measurement of generated-answer correctness or hallucination rates.

## Database

The application uses **PostgreSQL with the pgvector extension** to store resume data, vector embeddings, sessions, and conversation history.

### Database Schema

The database consists of three primary tables:

| Table | Purpose |
|---|---|
| `sessions` | Stores information about individual resume sessions. |
| `documents` | Stores extracted resume chunks, their embeddings, and associated session IDs. |
| `messages` | Stores user questions and AI-generated responses associated with a session. |

### Relationships

- A session can contain multiple resume document chunks.
- A session can contain multiple conversation messages.
- Documents and messages reference their parent session.
- Foreign key constraints with cascading deletion ensure that deleting a session also deletes its associated documents and messages.

### Vector Storage and Retrieval

The `documents` table uses pgvector's `VECTOR(3072)` data type to store embeddings generated by Google Gemini.

When a user asks a question:

1. The question is converted into an embedding.
2. PostgreSQL compares the question embedding with stored resume embeddings.
3. Similarity search identifies the most relevant chunks.
4. Results are restricted to the active session.

This allows the application to perform semantic search directly inside PostgreSQL without requiring a separate vector database.

### Database Migration

The initial database schema is defined in:

```text
migrations/001_initial_schema.sql
```

For a fresh local PostgreSQL database with pgvector installed, run:

```bash
sudo -u postgres createdb ai_learning

sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -d ai_learning \
  -f migrations/001_initial_schema.sql
```

The migration enables pgvector and creates the required tables, constraints, and indexes.

**Note:** This migration is intended for initializing a fresh database, not upgrading an existing database.

## Backend API

The backend exposes REST endpoints through Express.js for resume uploads, question answering, session management, and application health checks.

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health/live` | Checks whether the backend server is running. |
| `GET` | `/health/ready` | Checks backend readiness and database connectivity. |
| `POST` | `/api/resumes` | Uploads and processes a PDF resume and creates a session. |
| `POST` | `/api/chat` | Processes a question using session-specific retrieval and Gemini. |
| `POST` | `/api/chat/stream` | Provides a Server-Sent Events (SSE) endpoint for streaming chat responses. |
| `GET` | `/api/sessions/:sessionId` | Retrieves session information and conversation history. |
| `DELETE` | `/api/sessions/:sessionId` | Deletes a session and its associated data. |

### API Details

**Health Checks**

- `/health/live` provides a liveness check to verify that the server is running.
- `/health/ready` checks whether the application can connect to its database.

**Resume Upload**

The resume upload endpoint accepts a PDF file, processes its contents, generates embeddings, and creates a session for the uploaded resume.

**Chat**

The chat endpoint accepts a question associated with an existing session. The backend retrieves relevant resume chunks, generates a context-aware response, and returns the answer with its sources.

**Session Management**

The session endpoints allow the frontend to restore an existing session and delete a session when it is no longer needed.

### Streaming Support

The backend also exposes `/api/chat/stream` using Server-Sent Events (SSE).

The current frontend uses the regular `/api/chat` endpoint. The streaming endpoint is available at the backend level but is not yet integrated into the frontend chat interface.

### Example Requests

The following examples demonstrate basic API usage:

**Check backend health**

```bash
curl -i https://resume-rag-backend-qeac.onrender.com/health/live
```

**Check database readiness**

```bash
curl -i https://resume-rag-backend-qeac.onrender.com/health/ready
```

## Installation and Local Development

### Prerequisites

Make sure you have the following installed or configured:

- Node.js and npm
- PostgreSQL
- pgvector PostgreSQL extension
- Google Gemini API key

### 1. Clone the Repository

```bash
git clone https://github.com/ashu0420/ai-learning.git
cd ai-learning
```

### 2. Install Dependencies

Install backend dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
cd client
npm install
cd ..
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key

PGUSER=your_postgres_user
PGPASSWORD=your_postgres_password
PGDATABASE=ai_learning
PGHOST=localhost
PGPORT=5432

PORT=3000
```

Replace the placeholder values with your local PostgreSQL credentials and Gemini API key.

Do not commit `.env` or expose API keys in the repository.

### 4. Initialize the Database

Create the database and execute the initial migration:

```bash
sudo -u postgres createdb ai_learning

sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -d ai_learning \
  -f migrations/001_initial_schema.sql
```

This initializes the required tables, relationships, indexes, and pgvector extension.

### 5. Start the Backend

From the project root:

```bash
npm run dev
```

The backend runs at:

```text
http://localhost:3000
```

### 6. Start the Frontend

Open another terminal:

```bash
cd client
npm run dev
```

Vite starts the frontend development server. Open the local URL displayed in the terminal.

The frontend development server is configured to communicate with the backend running on port `3000`.

## NPM Scripts

The project provides scripts for running the backend, testing, data ingestion, and retrieval evaluation.

### Backend Scripts

Run these commands from the project root.

| Command | Description |
|---|---|
| `npm run dev` | Starts the backend using Node.js watch mode. |
| `npm start` | Starts the backend using Node.js. |
| `npm test` | Runs the Jest test suite. |
| `npm run ingest` | Runs the resume ingestion utility. |
| `npm run query` | Runs the query utility. |
| `npm run evaluate` | Evaluates retrieval performance. |
| `npm run evaluate:relevance` | Evaluates retrieval relevance. |
| `npm run test:retrieval` | Runs retrieval tests. |

### Frontend Scripts

Run these commands from the `client/` directory.

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite development server. |
| `npm run build` | Builds the frontend for production. |
| `npm run preview` | Previews the production build locally. |
| `npm run lint` | Runs ESLint to check frontend code. |

### Running Tests

Run the backend test suite:

```bash
npm test
```

Run retrieval evaluation:

```bash
npm run evaluate
npm run evaluate:relevance
```

Run the frontend production build:

```bash
cd client
npm run build
```

## Testing

The backend uses **Jest** and **Supertest** to test application behavior and API endpoints.

### Test Coverage

The test suite is organized into five files:

| Test File | Area Covered |
|---|---|
| `server.test.js` | Express server and API behavior |
| `upload.test.js` | Resume upload functionality |
| `rag-service.test.js` | RAG retrieval and answer-generation service |
| `resume-service.test.js` | Resume processing functionality |
| `session-service.test.js` | Session and conversation management |

### Running Tests

Run the complete backend test suite:

```bash
npm test
```

Jest executes the tests sequentially using the `--runInBand` option.

### Frontend Build Verification

Verify that the frontend can be built for production:

```bash
cd client
npm run build
```

### Retrieval Evaluation

In addition to automated tests, the project includes separate scripts for evaluating retrieval performance and relevance.

See the [Retrieval Evaluation](#retrieval-evaluation) section for details.

## Retrieval Evaluation

The project includes standalone evaluation scripts to examine retrieval quality and relevance in the RAG pipeline.

### 1. Retrieval Hit Evaluation

Script: `scripts/evaluate-retrieval.js`

This script evaluates whether the expected resume section appears among the top three retrieved chunks for a given question.

Current test cases cover:

- Candidate's degree — Education
- Codeforces rating — Achievements
- Candidate's projects — Projects

The script reports the retrieved sections, similarity distances, and the number of successful retrievals.

It uses a similarity distance threshold of `0.32` and retrieves up to three results.

### 2. LLM-Based Relevance Evaluation

Script: `scripts/evaluate-relevance.js`

This script uses Gemini as an evaluator to judge whether retrieved chunks contain information that directly answers or supports a question.

The evaluation includes both answerable and unanswerable questions, such as:

- Candidate's maximum Codeforces rating.
- Projects built by the candidate.
- Candidate's favorite food.
- Candidate's home address.
- Technologies used in projects.

The script compares the expected answerability with the evaluator's judgment and reports the results.

### 3. Retrieval Behavior Testing

Script: `scripts/test-retrieval.js`

This script runs a collection of questions through the retrieval pipeline and displays:

- Retrieved resume sections.
- Similarity distances.
- A preview of the retrieved text.

It also includes questions that cannot be answered from the resume, helping inspect retrieval behavior for unrelated queries.

### Running Evaluations

Run the scripts from the project root:

```bash
npm run evaluate
npm run evaluate:relevance
npm run test:retrieval
```

### Evaluation Limitations

The current evaluation uses a small, manually defined set of questions based on a resume.

The retrieval evaluation checks whether an expected section appears in the top three results. The relevance evaluation relies on an LLM-based judgment.

These experiments are useful for inspecting retrieval behavior, but they are not a comprehensive benchmark of retrieval accuracy or generated-answer correctness.

Future improvements could include a larger labelled evaluation dataset, standard retrieval metrics such as Precision@K and Recall@K, and systematic evaluation of answer faithfulness and hallucinations.

## Current Limitations

The application is deployed and functional, but several areas require further engineering before it can be considered production-ready.

### Security and Access Control

- Authentication and authorization are not implemented.
- Session UUIDs are used to identify sessions but do not establish user identity or ownership.
- Additional access-control mechanisms are required to protect sensitive resume data.
- Rate limiting is implemented, but its configuration may need adjustment based on actual usage.

### RAG and AI Reliability

- Retrieval evaluation currently uses a small, manually defined set of questions.
- Generated answers are not yet evaluated through a comprehensive faithfulness or hallucination benchmark.
- Retrieval quality depends on chunking, embedding quality, and the configured similarity threshold.
- LLM-generated responses may still contain inaccurate information.

### Backend and Infrastructure

- The backend runs on Render's free service, which may sleep after periods of inactivity and introduce cold-start delays.
- The AI request lifecycle and provider operations do not yet have comprehensive cancellation and timeout handling.
- Production monitoring and observability need further improvement.

### Frontend

- The backend supports Server-Sent Events (SSE), but the frontend currently uses the regular chat API.
- Authentication and user-specific session management are not available.

## Future Improvements

The following improvements could make the application more reliable, secure, and scalable.

### 1. Authentication and Security
- Implement Google OAuth or email-based authentication.
- Introduce user-level authorization and session ownership.
- Restrict access to resumes and conversations based on authenticated users.
- Improve rate limiting and request-level security.

### 2. RAG Quality and Evaluation
- Build a larger, labelled evaluation dataset.
- Introduce standard retrieval metrics such as Precision@K and Recall@K.
- Evaluate answer faithfulness and factual accuracy.
- Experiment with improved chunking strategies and retrieval thresholds.
- Explore reranking to improve the relevance of retrieved chunks.

### 3. Backend Reliability
- Improve timeout and cancellation handling for AI operations.
- Introduce structured logging and application monitoring.
- Improve error tracking and operational observability.
- Add more comprehensive integration and load tests.

### 4. Frontend and User Experience
- Integrate the existing SSE endpoint for streaming responses.
- Improve session management and conversation history.
- Add clearer loading and error states.
- Improve the experience for longer resumes and conversations.

### 5. Scalability
- Evaluate background processing for resume ingestion.
- Optimize database queries and vector indexes as the dataset grows.
- Introduce caching where repeated operations can benefit from it.
- Evaluate infrastructure options for handling increased traffic.

## Learning Goals

This project was built to explore practical AI application development while strengthening backend engineering skills.

### AI and RAG
- Understanding Retrieval-Augmented Generation (RAG).
- Generating and working with vector embeddings.
- Implementing semantic search using pgvector.
- Integrating Google Gemini for embeddings and answer generation.
- Exploring LangChain and LLM-based application development.
- Evaluating retrieval relevance and answerability.

### Backend Engineering
- Designing REST APIs using Node.js and Express.js.
- Implementing PDF uploads and file validation.
- Separating application logic into service modules.
- Managing sessions and conversation history.
- Using PostgreSQL connection pooling.
- Implementing error handling, request validation, and graceful shutdown.

### Database Engineering
- Designing relational database schemas.
- Working with foreign keys and cascading deletion.
- Using PostgreSQL migrations.
- Storing and querying vector embeddings with pgvector.

### Frontend and Deployment
- Building a React application with Vite.
- Connecting frontend components to backend APIs.
- Managing application state and session persistence.
- Deploying a full-stack application using Vercel, Render, and Neon.
- Configuring environment variables across deployment environments.

## License

No license has been specified yet. Unless a license is added to the repository, all rights remain with the copyright holder.