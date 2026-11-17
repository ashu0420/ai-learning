const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { searchResume } = require("./rag");

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 30000;

function withTimeout(promise, timeoutMs) {
    let timeoutId;

    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            const error = new Error("AI operation timed out");
            error.code = "AI_TIMEOUT";
            reject(error);
        }, timeoutMs);
    });

    return Promise.race([promise, timeout])
        .finally(() => clearTimeout(timeoutId));
}

const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite",
    apiKey: process.env.GEMINI_API_KEY
});

const promptTemplate = PromptTemplate.fromTemplate(`
    You are a helpful resume assistant.

    Answer the user's question using only the resume context below.
    If the context does not contain enough information, say you could
    not find enough information in the resume.

    Do not invent facts or infer personal preferences.

    Resume context:
    {context}

    User question:
    {question}
`);

const answerChain = promptTemplate.pipe(model);

const relevanceTemplate = PromptTemplate.fromTemplate(`
    You are evaluating resume evidence.

    Question:
    {question}

    Resume chunks:
    {chunks}

    For each chunk, determine whether it directly answers the question
    or supports the requested factual answer.

    Do not infer personal preferences from skills or project experience.
    Evaluate only the supplied text.

    Return ONLY the numbers of relevant chunks, separated by commas.
    For example: 1,3
    If none are relevant, return NONE.
`);

const relevanceChain = relevanceTemplate.pipe(model);

async function getRelevantChunkIndexes(question, chunks) {
    const formattedChunks = chunks
        .map((chunk, index) =>
            `[${index + 1}] Section: ${chunk.section}\n${chunk.text}`
        )
        .join("\n\n");

    const result = await withTimeout(
        relevanceChain.invoke({
            question,
            chunks: formattedChunks
        }),
        AI_TIMEOUT_MS
    );

    const judgment = String(result.content).trim().toUpperCase();

    if (judgment === "NONE") {
        return [];
    }

    if (!/^[1-9]\d*(\s*,\s*[1-9]\d*)*$/.test(judgment)) {
        throw new Error("Invalid relevance evaluator response");
    }

    const indexes = judgment
        .split(",")
        .map(value => Number(value.trim()) - 1);

    if (indexes.some(index => index < 0 || index >= chunks.length)) {
        throw new Error("Relevance evaluator returned an invalid index");
    }

    return [...new Set(indexes)];
}

async function answerResumeQuestion(question) {
    const chunks = await searchResume(question);

    if (chunks.length === 0) {
        return {
            answer: "I couldn't find enough information in the resume to answer that question.",
            sources: []
        };
    }

    const relevantIndexes = await getRelevantChunkIndexes(
        question.trim(),
        chunks
    );

    const relevantChunks = relevantIndexes.map(
        index => chunks[index]
    );

    if (relevantChunks.length === 0) {
        return {
            answer: "I couldn't find enough relevant information in the resume to answer that question.",
            sources: []
        };
    }

    const context = relevantChunks
        .map(chunk => `Section: ${chunk.section}\n${chunk.text}`)
        .join("\n\n");

    const result = await withTimeout(
        answerChain.invoke({
            context,
            question: question.trim()
        }),
        AI_TIMEOUT_MS
    );

    return {
        answer: result.content,
        sources: relevantChunks.map(chunk => ({
            section: chunk.section,
            text: chunk.text
        }))
    };
}
async function* streamResumeAnswer(question) {
    console.log("Stage 1: Searching resume...");

    const chunks = await searchResume(question);

    console.log("Stage 1 complete. Chunks:", chunks.length);

    console.log("Stage 2: Evaluating relevance...");

    const relevantIndexes = await getRelevantChunkIndexes(
        question.trim(),
        chunks
    );

    console.log("Stage 2 complete. Relevant indexes:", relevantIndexes);

    const relevantChunks = relevantIndexes.map(
        index => chunks[index]
    );

    if (relevantChunks.length === 0) {
        yield {
            type: "token",
            content: "I couldn't find enough relevant information in the resume to answer that question."
        };
        yield { type: "done" };
        return;
    }

    const sources = relevantChunks.map(chunk => ({
        section: chunk.section,
        text: chunk.text
    }));

    // Send sources before generating the answer.
    yield {
        type: "sources",
        sources
    };

    const context = relevantChunks
        .map(chunk => `Section: ${chunk.section}\n${chunk.text}`)
        .join("\n\n");

    const stream = await answerChain.stream({
        context,
        question: question.trim()
    });

    // Generate and emit answer incrementally.
    for await (const chunk of stream) {
        if (chunk.content) {
            yield {
                type: "token",
                content: chunk.content
            };
        }
    }

    yield { type: "done" };
}
module.exports = {
    answerResumeQuestion,
    streamResumeAnswer
};