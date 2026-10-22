const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { searchResume } = require("./rag");


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

    const result = await relevanceChain.invoke({
        question,
        chunks: formattedChunks
    });

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

    const result = await answerChain.invoke({
        context,
        question: question.trim()
    });

    return{
        answer: result.content,
        sources: relevantChunks.map(chunk => ({
            section: chunk.section,
            text: chunk.text
        }))
    };
    
}

module.exports = {
    answerResumeQuestion
};