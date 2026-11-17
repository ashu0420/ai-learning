jest.mock("../db", () => ({
    pool: {
        query: jest.fn()
    }
}));

const { pool } = require("../db");

const {
    getSession,
    getConversationHistory,
    saveMessage,
    deleteExpiredSessions,
    deleteSession
} = require("../session-service");

const SESSION_ID = "4e8581b6-9d5b-4b88-bb88-a43f5e32cef8";

beforeEach(() => {
    jest.clearAllMocks();
});

describe("getSession", () => {
    test("should return an active session", async () => {
        const mockSession = {
            id: SESSION_ID,
            filename: "resume.pdf",
            created_at: new Date(),
            expires_at: new Date(Date.now() + 86400000)
        };

        pool.query.mockResolvedValueOnce({
            rows: [mockSession]
        });

        const result = await getSession(SESSION_ID);

        expect(result).toEqual(mockSession);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("expires_at > NOW()"),
            [SESSION_ID]
        );
    });

    test("should return null when session does not exist or has expired", async () => {
        pool.query.mockResolvedValueOnce({
            rows: []
        });

        const result = await getSession(SESSION_ID);

        expect(result).toBeNull();
    });
});
describe("getConversationHistory", () => {
    test("should return recent messages in chronological order", async () => {
        const mockMessages = [
            {
                role: "user",
                content: "What did I study?",
                created_at: new Date("2026-11-17T10:00:00Z")
            },
            {
                role: "assistant",
                content: "You studied Engineering Physics.",
                created_at: new Date("2026-11-17T10:00:05Z")
            }
        ];

        pool.query.mockResolvedValueOnce({
            rows: mockMessages
        });

        const result = await getConversationHistory(SESSION_ID);

        expect(result).toEqual(mockMessages);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("ORDER BY created_at ASC, id ASC"),
            [SESSION_ID, 10]
        );
    });

    test("should use a custom message limit", async () => {
        pool.query.mockResolvedValueOnce({
            rows: []
        });

        await getConversationHistory(SESSION_ID, 20);

        expect(pool.query).toHaveBeenCalledWith(
            expect.any(String),
            [SESSION_ID, 20]
        );
    });
});

describe("saveMessage", () => {
    test("should save a message for an active session", async () => {
        const mockMessage = {
            id: 1,
            session_id: SESSION_ID,
            role: "user",
            content: "What did I study?",
            created_at: new Date()
        };

        pool.query.mockResolvedValueOnce({
            rows: [mockMessage],
            rowCount: 1
        });

        const result = await saveMessage(
            SESSION_ID,
            "user",
            "What did I study?"
        );

        expect(result).toEqual(mockMessage);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("expires_at > NOW()"),
            [SESSION_ID, "user", "What did I study?"]
        );
    });

    test("should throw an error when session does not exist or has expired", async () => {
        pool.query.mockResolvedValueOnce({
            rows: [],
            rowCount: 0
        });

        await expect(
            saveMessage(SESSION_ID, "user", "Hello")
        ).rejects.toThrow("Session not found or expired");
    });
});

describe("deleteExpiredSessions", () => {
    test("should delete expired sessions and return the count", async () => {
        pool.query.mockResolvedValueOnce({
            rows: [{ id: SESSION_ID }, { id: "another-session-id" }],
            rowCount: 2
        });

        const result = await deleteExpiredSessions();

        expect(result).toBe(2);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("expires_at <= NOW()")
        );
    });

    test("should return zero when no expired sessions exist", async () => {
        pool.query.mockResolvedValueOnce({
            rows: [],
            rowCount: 0
        });

        const result = await deleteExpiredSessions();

        expect(result).toBe(0);
    });
});
describe("deleteSession", () => {
    test("should return true when a session is deleted", async () => {
        pool.query.mockResolvedValueOnce({
            rows: [{ id: SESSION_ID }],
            rowCount: 1
        });

        const result = await deleteSession(SESSION_ID);

        expect(result).toBe(true);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("DELETE FROM sessions"),
            [SESSION_ID]
        );
    });

    test("should return false when the session does not exist", async () => {
        pool.query.mockResolvedValueOnce({
            rows: [],
            rowCount: 0
        });

        const result = await deleteSession(SESSION_ID);

        expect(result).toBe(false);
    });
});