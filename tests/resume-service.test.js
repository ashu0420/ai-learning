const {
    extractResumeText,
    splitResumeIntoChunks,
    createTextChunks,
    createResumeSession
} = require("../resume-service");

jest.mock("pdf-parse", () => ({
    PDFParse: jest.fn()
}));

jest.mock("../db", () => ({
    pool: {
        connect: jest.fn()
    }
}));

jest.mock("../rag", () => ({
    getEmbedding: jest.fn()
}));

const { PDFParse } = require("pdf-parse");

describe("extractResumeText", () => {
    let mockGetText;
    let mockDestroy;

    beforeEach(() => {
        jest.clearAllMocks();

        mockGetText = jest.fn();
        mockDestroy = jest.fn().mockResolvedValue(undefined);

        PDFParse.mockImplementation(() => ({
            getText: mockGetText,
            destroy: mockDestroy
        }));
    });

    test("should extract text from a PDF", async () => {
        mockGetText.mockResolvedValue({
            text: "Candidate Name\nEngineering Physics\nIIT Guwahati"
        });

        const result = await extractResumeText(
            Buffer.from("fake-pdf")
        );

        expect(result).toBe(
            "Candidate Name\nEngineering Physics\nIIT Guwahati"
        );

        expect(PDFParse).toHaveBeenCalledWith({
            data: Buffer.from("fake-pdf")
        });

        expect(mockDestroy).toHaveBeenCalled();
    });

    test("should throw an error when PDF contains no extractable text", async () => {
        mockGetText.mockResolvedValue({
            text: "   "
        });

        await expect(
            extractResumeText(Buffer.from("fake-pdf"))
        ).rejects.toThrow(
            "The uploaded PDF contains no extractable text."
        );

        expect(mockDestroy).toHaveBeenCalled();
    });

    test("should destroy the parser even when extraction fails", async () => {
        mockGetText.mockRejectedValue(
            new Error("PDF parsing failed")
        );

        await expect(
            extractResumeText(Buffer.from("fake-pdf"))
        ).rejects.toThrow("PDF parsing failed");

        expect(mockDestroy).toHaveBeenCalled();
    });
});
describe("splitResumeIntoChunks", () => {
    test("should split resume content based on section headings", () => {
        const resumeText = `
            Candidate Name
            Engineering Physics
            Education
            IIT Guwahati
            B.Tech Engineering Physics
            Projects
            Resume Assistant
            Built using Node.js and Gemini
            Technical Skills
            C++, JavaScript, Python
        `;

        const result = splitResumeIntoChunks(resumeText);

        expect(result.length).toBe(4);

        expect(result[0].section).toBe("General");
        expect(result[0].text).toContain("Candidate Name");

        expect(result[1].section).toBe("Education");
        expect(result[1].text).toContain("IIT Guwahati");

        expect(result[2].section).toBe("Projects");
        expect(result[2].text).toContain("Resume Assistant");

        expect(result[3].section).toBe("Technical Skills");
        expect(result[3].text).toContain("JavaScript");
    });

    test("should use General section when no headings are detected", () => {
        const resumeText = `
            Candidate Name
            Engineering Physics
            IIT Guwahati
            Interested in software development.
        `;

        const result = splitResumeIntoChunks(resumeText);

        expect(result.length).toBeGreaterThan(0);

        expect(
            result.every(chunk => chunk.section === "General")
        ).toBe(true);
    });

    test("should return an empty array for empty input", () => {
        const result = splitResumeIntoChunks("");

        expect(result).toEqual([]);
    });
});

describe("createTextChunks", () => {
    test("should create a single chunk for short text", () => {
        const text = "A short resume description.";

        const result = createTextChunks(text, "Summary");

        expect(result).toEqual([
            {
                section: "Summary",
                text
            }
        ]);
    });

    test("should split long text into multiple chunks", () => {
        const text = "a".repeat(2500);

        const result = createTextChunks(text, "Experience");

        expect(result.length).toBe(3);

        expect(result[0].text.length).toBe(1200);
        expect(result[1].text.length).toBe(1200);
        expect(result[2].text.length).toBe(400);
    });

    test("should maintain overlap between consecutive chunks", () => {
        const text = "a".repeat(2500);

        const result = createTextChunks(text, "Projects");

        expect(result[0].text.slice(-150)).toBe(
            result[1].text.slice(0, 150)
        );
    });

    test("should preserve the section name in every chunk", () => {
        const text = "a".repeat(2500);

        const result = createTextChunks(text, "Education");

        expect(
            result.every(chunk => chunk.section === "Education")
        ).toBe(true);
    });

    test("should return an empty array for empty text", () => {
        const result = createTextChunks("", "General");

        expect(result).toEqual([]);
    });
});

describe("createResumeSession", () => {
    const { pool } = require("../db");
    const { getEmbedding } = require("../rag");

    let mockClient;

    beforeEach(() => {
        jest.clearAllMocks();

        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };

        pool.connect.mockResolvedValue(mockClient);
        getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

        PDFParse.mockImplementation(() => ({
            getText: jest.fn().mockResolvedValue({
                text: "Candidate Name\nEducation\nIIT Guwahati"
            }),
            destroy: jest.fn().mockResolvedValue(undefined)
        }));
    });

    test("should create a session and insert resume chunks", async () => {
        const mockSession = {
            id: "4e8581b6-9d5b-4b88-bb88-a43f5e32cef8",
            filename: "resume.pdf",
            created_at: new Date(),
            expires_at: new Date()
        };

        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [mockSession] }) // INSERT session
            .mockResolvedValueOnce({}) // INSERT document
            .mockResolvedValueOnce({}); // COMMIT

        const result = await createResumeSession(
            Buffer.from("fake-pdf"),
            "resume.pdf"
        );

        expect(result.sessionId).toBe(mockSession.id);
        expect(result.filename).toBe("resume.pdf");

        expect(getEmbedding).toHaveBeenCalled();

        expect(mockClient.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO sessions"),
            ["resume.pdf"]
        );

        expect(mockClient.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO documents"),
            expect.arrayContaining([
                mockSession.id,
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String)
            ])
        );

        expect(mockClient.release).toHaveBeenCalled();
    });

    test("should rollback when database insertion fails", async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({
                rows: [{
                    id: "4e8581b6-9d5b-4b88-bb88-a43f5e32cef8"
                }]
            })
            .mockRejectedValueOnce(
                new Error("Database insertion failed")
            )
            .mockResolvedValueOnce({}); // ROLLBACK

        await expect(
            createResumeSession(
                Buffer.from("fake-pdf"),
                "resume.pdf"
            )
        ).rejects.toThrow("Database insertion failed");

        expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
        expect(mockClient.release).toHaveBeenCalled();
    });

    test("should reject a PDF with no extractable text", async () => {
        PDFParse.mockImplementation(() => ({
            getText: jest.fn().mockResolvedValue({ text: "   " }),
            destroy: jest.fn().mockResolvedValue(undefined)
        }));

        await expect(
            createResumeSession(Buffer.from("fake-pdf"), "resume.pdf")
        ).rejects.toThrow(
            "The uploaded PDF contains no extractable text."
        );

        expect(pool.connect).not.toHaveBeenCalled();
    });

    test("should reject resumes containing more than 100 chunks", async () => {
        PDFParse.mockImplementation(() => ({
            getText: jest.fn().mockResolvedValue({
                text: "a".repeat(121000)
            }),
            destroy: jest.fn().mockResolvedValue(undefined)
        }));

        await expect(
            createResumeSession(Buffer.from("fake-pdf"), "resume.pdf")
        ).rejects.toThrow(
            "Resume contains too much content."
        );

        expect(pool.connect).not.toHaveBeenCalled();
    });
});