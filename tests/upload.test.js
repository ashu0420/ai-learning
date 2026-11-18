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

const request = require("supertest");
const { app } = require("../server");
const { createResumeSession } = require("../resume-service");

describe("POST /api/resumes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should upload a valid PDF successfully", async () => {
        createResumeSession.mockResolvedValue({
            sessionId: "4e8581b6-9d5b-4b88-bb88-a43f5e32cef8",
            filename: "resume.pdf",
            createdAt: new Date(),
            expiresAt: new Date()
        });

        const response = await request(app)
            .post("/api/resumes")
            .attach("resume", Buffer.from("%PDF-1.4 fake pdf content"), {
                filename: "resume.pdf",
                contentType: "application/pdf"
            });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe(
            "Resume uploaded successfully."
        );
        expect(response.body.sessionId).toBeDefined();

        expect(createResumeSession).toHaveBeenCalled();
    });

    test("should reject a request without a file", async () => {
        const response = await request(app)
            .post("/api/resumes");

        expect(response.status).toBe(400);
        expect(response.body.error).toBe(
            "Please upload a PDF resume."
        );

        expect(createResumeSession).not.toHaveBeenCalled();
    });

    test("should reject a file that is not a PDF", async () => {
        const response = await request(app)
            .post("/api/resumes")
            .attach("resume", Buffer.from("This is a text file"), {
                filename: "resume.txt",
                contentType: "text/plain"
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid PDF file.");

        expect(createResumeSession).not.toHaveBeenCalled();
    });
    test("should reject files larger than 5 MB", async () => {
        const largeFile = Buffer.alloc(5 * 1024 * 1024 + 1, "a");

        const response = await request(app)
            .post("/api/resumes")
            .attach("resume", largeFile, {
                filename: "large-resume.pdf",
                contentType: "application/pdf"
            });

        expect(response.status).toBe(413);
        expect(response.body.error).toBe(
            "Resume must be 5 MB or smaller."
        );

        expect(createResumeSession).not.toHaveBeenCalled();
    });

    test("should return 400 when PDF contains no extractable text", async () => {
        createResumeSession.mockRejectedValue(
            new Error("The uploaded PDF contains no extractable text.")
        );

        const response = await request(app)
            .post("/api/resumes")
            .attach("resume", Buffer.from("%PDF-1.4 fake pdf content"), {
                filename: "empty.pdf",
                contentType: "application/pdf"
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain(
            "Could not extract text"
        );
    });

    test("should return 500 when resume processing fails unexpectedly", async () => {
        createResumeSession.mockRejectedValue(
            new Error("Database connection failed")
        );

        const response = await request(app)
            .post("/api/resumes")
            .attach("resume", Buffer.from("%PDF-1.4 fake pdf content"), {
                filename: "resume.pdf",
                contentType: "application/pdf"
            });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe(
            "Resume processing failed. Please try again."
        );
    });
}); 