process.env.AI_TIMEOUT_MS = "100";
jest.mock("../rag", () => ({
    searchResume: jest.fn()
}));

jest.mock("@langchain/google-genai", () => ({
    ChatGoogleGenerativeAI: jest.fn()
}));

jest.mock("@langchain/core/prompts", () => ({
    PromptTemplate: {
        fromTemplate: jest.fn()
    }
}));

const { PromptTemplate } = require("@langchain/core/prompts");
const { searchResume } = require("../rag");

// Relevance chain returns immediately.
// Answer chain takes 500 ms.
const relevanceInvoke = jest.fn().mockResolvedValue({
    content: "1"
});

const answerInvoke = jest.fn(() => new Promise((resolve) => {
    setTimeout(() => {
        resolve({
            content: "Mocked AI response"
        });
    }, 500);
}));

PromptTemplate.fromTemplate
    .mockReturnValueOnce({
        pipe: jest.fn(() => ({
            invoke: answerInvoke
        }))
    })
    .mockReturnValueOnce({
        pipe: jest.fn(() => ({
            invoke: relevanceInvoke
        }))
    });

searchResume.mockResolvedValue([
    {
        section: "Education",
        text: "B.Tech Engineering Physics at IIT Guwahati"
    }
]);

const { answerResumeQuestion } = require("../rag-service");

describe("RAG Service Timeout", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        searchResume.mockResolvedValue([
            {
                section: "Education",
                text: "B.Tech Engineering Physics at IIT Guwahati"
            }
        ]);
    });

    test("should throw AI_TIMEOUT when answer generation exceeds timeout", async () => {
        await expect(
            answerResumeQuestion(
                "4e8581b6-9d5b-4b88-bb88-a43f5e32cef8",
                "What did I study?",
                []
            )
        ).rejects.toMatchObject({
            code: "AI_TIMEOUT",
            message: "AI operation timed out"
        });

        expect(relevanceInvoke).toHaveBeenCalledTimes(1);
        expect(answerInvoke).toHaveBeenCalledTimes(1);
    });
});