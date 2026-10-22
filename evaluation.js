require("dotenv").config();

const { searchResume } = require("./rag");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { PromptTemplate } = require("@langchain/core/prompts");

const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite",
    apiKey: process.env.GEMINI_API_KEY
});

const relevanceTemplate = PromptTemplate.fromTemplate(`
    You are an evidence evaluator for a resume question-answering system.
    
    Question:
    {question}
    
    Retrieved resume chunks:
    {chunks}
    
    For each chunk, determine whether it contains information that
    directly answers the question or supports the requested factual answer.
    
    Rules:
    - Do not infer personal preferences from skills or project experience.
    - Reject unrelated chunks.
    - Evaluate each chunk independently.
    - Use only the supplied text.
    
    Return ONLY the numbers of relevant chunks, separated by commas.
    For example: 1,3
    If no chunks are relevant, return: NONE
    `);

const relevanceChain = relevanceTemplate.pipe(model);

async function getRelevantChunkIndexes(question, chunks) {
    const formattedChunks = chunks
        .map((chunk, index) =>
            `[${index + 1}] Section: ${chunk.section}\n${chunk.text}`
        )
        .join("\n\n");

    const result = await relevanceChain.invoke({
        question,
        chunks: formattedChunks
    });

    const judgment = String(result.content).trim().toUpperCase();

    if (judgment === "NONE") {
        return [];
    }

    // Accept only a comma-separated list of positive integers.
    if (!/^[1-9]\d*(\s*,\s*[1-9]\d*)*$/.test(judgment)) {
        console.warn("Unexpected evaluator response:", judgment);
        return [];
    }

    const indexes = judgment
        .split(",")
        .map(value => Number(value.trim()) - 1);

    // Fail closed if any index is invalid.
    if (indexes.some(index => index < 0 || index >= chunks.length)) {
        console.warn("Evaluator returned an invalid chunk index.");
        return [];
    }

    return [...new Set(indexes)];
}
const testCases = [
    {
        question: "What is Asheesh's maximum Codeforces rating?",
        expected: "answerable"
    },
    {
        question: "What projects has Asheesh built?",
        expected: "answerable"
    },
    {
        question: "What is Asheesh's favorite food?",
        expected: "unanswerable"
    },
    {
        question: "What is Asheesh's home address?",
        expected: "unanswerable"
    },
    {
        question: "What technologies has Asheesh used in his projects?",
        expected: "answerable"
    }
];

async function main() {
    let passed = 0;

    for (const test of testCases) {
        console.log(`\nQuestion: ${test.question}`);

        const chunks = await searchResume(test.question);

        const relevantIndexes = await getRelevantChunkIndexes(
            test.question,
            chunks
        );

        const relevantChunks = relevantIndexes.map(
            index => chunks[index]
        );

        const actual = relevantChunks.length > 0
            ? "answerable"
            : "unanswerable";

        const success = actual === test.expected;

        if (success) passed++;

        console.log("Expected:", test.expected);
        console.log("Actual:", actual);
        console.log("Relevant chunks:", relevantChunks.length);
        console.log(success ? "PASS" : "FAIL");
    }

    console.log(`\nResults: ${passed}/${testCases.length} tests passed.`);
}

main().catch(console.error);