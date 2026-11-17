jest.mock("../rag-service", () => ({
    answerResumeQuestion: jest.fn(),
    streamResumeAnswer: jest.fn()
}));

jest.mock("../rag", () => ({
    checkDatabase: jest.fn(),
    closePool: jest.fn()
}));

jest.mock("../session-service", () => ({
    getSession: jest.fn(),
    getConversationHistory: jest.fn(),
    saveMessage: jest.fn(),
    deleteSession: jest.fn(),
    deleteExpiredSessions: jest.fn()
}));

jest.mock("../resume-service", () => ({
    createResumeSession: jest.fn()
}));

const { checkDatabase, closePool } = require("../rag");
const { answerResumeQuestion } = require("../rag-service");

const {
    getSession,
    getConversationHistory,
    saveMessage
} = require("../session-service");

const request = require("supertest");
const { app, startServer, shutdown } = require("../server");

const SESSION_ID = "4e8581b6-9d5b-4b88-bb88-a43f5e32cef8";

jest.spyOn(process, "exit").mockImplementation(() => { });


describe("Health API", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        getSession.mockResolvedValue({
            id: SESSION_ID,
            filename: "test-resume.pdf",
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

        getConversationHistory.mockResolvedValue([]);

        saveMessage.mockResolvedValue({
            id: 1,
            session_id: SESSION_ID
        });
    });

    test("GET /health/live should return 200 and alive status", async () => {
        const response = await request(app)
            .get("/health/live");

        expect(response.status).toBe(200);

        expect(response.headers["content-type"])
            .toMatch(/application\/json/);

        expect(response.body).toEqual({
            status: "alive"
        });
    });

    test("Unknown endpoint should return 404", async () => {
        const response = await request(app)
            .get("/unknown");

        expect(response.status).toBe(404);

        expect(response.body).toEqual({
            error: "Endpoint not found"
        });
    });

    test("POST /api/chat should reject an empty question", async () => {
        const response = await request(app)
            .post("/api/chat")
            .send({
                sessionId: SESSION_ID,
                question: ""
            });

        expect(response.status).toBe(400);

        expect(response.body).toEqual({
            error: "Please provide a non-empty question."
        });
    });

    test("POST /api/chat should reject a missing question", async () => {
        const response = await request(app)
            .post("/api/chat")
            .send({ sessionId: SESSION_ID, });

        expect(response.status).toBe(400);

        expect(response.body).toEqual({
            error: "Please provide a non-empty question."
        });
    });

    test("POST /api/chat should reject a non-string question", async () => {
        const response = await request(app)
            .post("/api/chat")
            .send({
                sessionId: SESSION_ID,
                question: 123
            });

        expect(response.status).toBe(400);

        expect(response.body).toEqual({
            error: "Please provide a non-empty question."
        });
    });

    test("POST /api/chat should reject a question longer than 1000 characters", async () => {
        const response = await request(app)
            .post("/api/chat")
            .send({
                sessionId: SESSION_ID,
                question: "a".repeat(1001)
            });

        expect(response.status).toBe(400);

        expect(response.body).toEqual({
            error: "Question must be 1000 characters or fewer."
        });
    });

    test("GET /health/ready should return 200 when database is connected", async () => {
        checkDatabase.mockResolvedValueOnce();

        const response = await request(app)
            .get("/health/ready");

        expect(response.status).toBe(200);

        expect(response.headers["content-type"])
            .toMatch(/application\/json/);

        expect(response.body).toEqual({
            status: "ready",
            database: "connected"
        });

        expect(checkDatabase).toHaveBeenCalledTimes(1);
    });

    test("GET /health/ready should return 503 when database is unavailable", async () => {
        checkDatabase.mockRejectedValueOnce(
            new Error("Database unavailable")
        );

        const response = await request(app)
            .get("/health/ready");

        expect(response.status).toBe(503);

        expect(response.body).toEqual({
            status: "not ready",
            database: "unavailable"
        });

        expect(checkDatabase).toHaveBeenCalledTimes(1);
    });

    test("POST /api/chat should reject malformed JSON", async () => {
        const response = await request(app)
            .post("/api/chat")
            .set("Content-Type", "application/json")
            .send('{"question":');

        expect(response.status).toBe(400);

        expect(response.body).toEqual({
            error: "Invalid JSON in request body."
        });
    });

    test("POST /api/chat should reject request bodies larger than 10 KB", async () => {
        const response = await request(app)
            .post("/api/chat")
            .set("Content-Type", "application/json")
            .send(JSON.stringify({
                sessionId: SESSION_ID,
                question: "a".repeat(11000)
            }));

        expect(response.status).toBe(413);

        expect(response.body).toEqual({
            error: "Request body is too large. Maximum allowed size is 10 KB."
        });
    });

    test("POST /api/chat should return an answer for a valid question", async () => {
        const mockedAnswer = {
            answer: "I studied Engineering Physics at IIT Guwahati.",
            sources: []
        };

        answerResumeQuestion.mockResolvedValueOnce(mockedAnswer);

        const response = await request(app)
            .post("/api/chat")
            .send({
                sessionId: SESSION_ID,
                question: "  What did I study?  "
            });

        expect(response.status).toBe(200);

        expect(response.headers["content-type"])
            .toMatch(/application\/json/);

        expect(response.body).toEqual(mockedAnswer);

        expect(answerResumeQuestion).toHaveBeenCalledWith(
            SESSION_ID,
            "What did I study?",
            []
        );
    });

    test("POST /api/chat should return 504 when AI service times out", async () => {
        const error = new Error("AI request timed out");

        error.code = "AI_TIMEOUT";

        answerResumeQuestion.mockRejectedValueOnce(error);

        const response = await request(app)
            .post("/api/chat")
            .send({
                sessionId: SESSION_ID,
                question: "What did I study?"
            });

        expect(response.status).toBe(504);

        expect(response.body).toEqual({
            error: "The AI service took too long to respond. Please try again."
        });
    });

    test("POST /api/chat should return 503 when AI service is rate-limited", async () => {
        answerResumeQuestion.mockRejectedValueOnce({
            status: 429,
            message: "Too many requests"
        });

        const response = await request(app)
            .post("/api/chat")
            .send({
                sessionId: SESSION_ID,
                question: "What did I study?"
            });

        expect(response.status).toBe(503);

        expect(response.body).toEqual({
            error: "The AI service is temporarily unavailable or rate-limited. Please try again later."
        });
    });

    test("POST /api/chat should return 503 when AI service is unavailable", async () => {
        answerResumeQuestion.mockRejectedValueOnce({
            status: 503,
            message: "AI service unavailable"
        });

        const response = await request(app)
            .post("/api/chat")
            .send({
                sessionId: SESSION_ID,
                question: "What did I study?"
            });

        expect(response.status).toBe(503);

        expect(response.body).toEqual({
            error: "The AI service is temporarily unavailable or rate-limited. Please try again later."
        });
    });

    test("POST /api/chat should return 500 when an unexpected error occurs", async () => {
        answerResumeQuestion.mockRejectedValueOnce(
            new Error("Internal database connection details")
        );

        const response = await request(app)
            .post("/api/chat")
            .send({
                sessionId: SESSION_ID,
                question: "What did I study?"
            });

        expect(response.status).toBe(500);

        expect(response.body).toEqual({
            error: "An unexpected error occurred while answering your question."
        });

        expect(response.body.error).not.toContain(
            "Internal database connection details"
        );
    });

    test("POST /api/chat should accept a question of exactly 1000 characters", async () => {
        const question = "a".repeat(1000);

        const mockedAnswer = {
            answer: "This is a valid response.",
            sources: []
        };

        answerResumeQuestion.mockResolvedValueOnce(mockedAnswer);

        const response = await request(app)
            .post("/api/chat")
            .send({
                sessionId: SESSION_ID,
                question
            });

        expect(response.status).toBe(200);

        expect(response.body).toEqual(mockedAnswer);

        expect(answerResumeQuestion).toHaveBeenCalledWith(
            SESSION_ID,
            question,
            []
        );
    });

    test("POST /api/chat should reject a whitespace-only question", async () => {
        const response = await request(app)
            .post("/api/chat")
            .send({
                sessionId: SESSION_ID,
                question: "     "
            });

        expect(response.status).toBe(400);

        expect(response.body).toEqual({
            error: "Please provide a non-empty question."
        });

        expect(answerResumeQuestion).not.toHaveBeenCalled();
    });

    test("POST /api/chat should reject a question containing only tabs and newlines", async () => {
        const response = await request(app)
            .post("/api/chat")
            .send({
                sessionId: SESSION_ID,
                question: "\t\n   \t"
            });

        expect(response.status).toBe(400);

        expect(response.body).toEqual({
            error: "Please provide a non-empty question."
        });

        expect(answerResumeQuestion).not.toHaveBeenCalled();
    });

    test("POST /api/chat should trim tabs and newlines from a valid question", async () => {
        const mockedAnswer = {
            answer: "I studied Engineering Physics at IIT Guwahati.",
            sources: []
        };

        answerResumeQuestion.mockResolvedValueOnce(mockedAnswer);

        const response = await request(app)
            .post("/api/chat")
            .send({
                sessionId: SESSION_ID,
                question: "\t\nWhat did I study?\n\t"
            });

        expect(response.status).toBe(200);

        expect(response.body).toEqual(mockedAnswer);

        expect(answerResumeQuestion).toHaveBeenCalledWith(
            SESSION_ID,
            "What did I study?",
            []
        );
    });

    test("GET /api/chat should return 404", async () => {
        const response = await request(app)
            .get("/api/chat");

        expect(response.status).toBe(404);

        expect(response.body).toEqual({
            error: "Endpoint not found"
        });

        expect(answerResumeQuestion).not.toHaveBeenCalled();
    });

    test("PUT /api/chat should return 404", async () => {
        const response = await request(app)
            .put("/api/chat")
            .send({
                sessionId: SESSION_ID,
                question: "What did I study?"
            });

        expect(response.status).toBe(404);

        expect(response.body).toEqual({
            error: "Endpoint not found"
        });

        expect(answerResumeQuestion).not.toHaveBeenCalled();
    });

    test("DELETE /api/chat should return 404", async () => {
        const response = await request(app)
            .delete("/api/chat");

        expect(response.status).toBe(404);

        expect(response.body).toEqual({
            error: "Endpoint not found"
        });

        expect(answerResumeQuestion).not.toHaveBeenCalled();
    });

    test("POST /api/chat should reject plain text content", async () => {
        const response = await request(app)
            .post("/api/chat")
            .set("Content-Type", "text/plain")
            .send("What did I study?");

        expect(response.status).toBe(400);

        expect(response.body).toEqual({
            error: "Please provide a non-empty question."
        });

        expect(answerResumeQuestion).not.toHaveBeenCalled();
    });
    test("POST /api/chat should return 429 when rate limit is exceeded", async () => {
        answerResumeQuestion.mockResolvedValue({
            answer: "Test answer",
            sources: []
        });

        let response;

        for (let i = 0; i < 101; i++) {
            response = await request(app)
                .post("/api/chat")
                .send({
                    sessionId: SESSION_ID,
                    question: "Test question"
                });
        }

        expect(response.status).toBe(429);

        expect(response.body).toEqual({
            error: "Too many requests. Please try again later."
        });
    });
});


describe("Graceful Shutdown", () => {

    test("should ignore repeated shutdown calls", async () => {
        closePool.mockResolvedValue();

        const server = startServer(0);

        const serverClosed = new Promise((resolve) => {
            server.once("close", resolve);
        });

        const firstShutdown = shutdown("TEST");
        const secondShutdown = shutdown("TEST");

        expect(secondShutdown).toBe(firstShutdown);

        await firstShutdown;
        await serverClosed;

        expect(closePool).toHaveBeenCalledTimes(1);
    });


    test("should reject when database pool cleanup fails", async () => {

        // Reset module cache to get fresh shutdown state.
        jest.resetModules();

        // Get fresh mocked database module.
        const { closePool: freshClosePool } = require("../rag");

        // Get fresh server module and shutdown state.
        const {
            startServer: freshStartServer,
            shutdown: freshShutdown
        } = require("../server");

        // Make database cleanup fail.
        freshClosePool.mockRejectedValueOnce(
            new Error("Database cleanup failed")
        );

        // Start a fresh HTTP server.
        const server = freshStartServer(0);

        // Wait for the server to close.
        const serverClosed = new Promise((resolve) => {
            server.once("close", resolve);
        });

        // Initiate shutdown.
        const shutdownPromise = freshShutdown("TEST");

        // Shutdown should reject when database cleanup fails.
        await expect(shutdownPromise).rejects.toThrow(
            "Database cleanup failed"
        );

        // Ensure HTTP server is closed.
        await serverClosed;

        // Ensure database cleanup was attempted exactly once.
        expect(freshClosePool).toHaveBeenCalledTimes(1);
    });
    test("should force exit when graceful shutdown times out", async () => {
        jest.resetModules();

        const { closePool: freshClosePool } = require("../rag");

        const {
            startServer: freshStartServer,
            shutdown: freshShutdown
        } = require("../server");

        jest.useFakeTimers();

        let resolvePoolCleanup;

        freshClosePool.mockReturnValue(
            new Promise((resolve) => {
                resolvePoolCleanup = resolve;
            })
        );

        const server = freshStartServer(0);

        const serverClosed = new Promise((resolve) => {
            server.once("close", resolve);
        });

        const shutdownPromise = freshShutdown("TEST");

        try {
            // Wait for the HTTP server to close.
            await serverClosed;

            // Allow the server close callback to reach database cleanup.
            await Promise.resolve();

            // Trigger the 10-second shutdown timeout.
            jest.advanceTimersByTime(10000);

            // Verify forced exit.
            expect(process.exit).toHaveBeenCalledWith(1);

            // Complete database cleanup so no asynchronous work is left hanging.
            resolvePoolCleanup();

            // Wait for graceful shutdown to finish.
            await shutdownPromise;
        } finally {
            jest.useRealTimers();
        }

    });
});


afterAll(() => {
    jest.restoreAllMocks();
});