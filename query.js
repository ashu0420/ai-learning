require("dotenv").config();

const { Client } = require("pg");
const readline = require("readline");

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

async function getEmbedding(text) {
    const response = await ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: text,
    });

    return response.embeddings[0].values;
}


function needsQueryRewriting(question) {
    const contextualWords = [
        "it",
        "its",
        "they",
        "them",
        "this",
        "that",
        "these",
        "those",
        "which one",
        "which ones",
        "the same",
        "previous",
        "above"
    ];

    const lowerQuestion = question.toLowerCase();

    return contextualWords.some(word =>
        lowerQuestion.includes(word)
    );
}
async function main() {
    const conversationHistory = [];

    const client = new Client({
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        host: process.env.PGHOST,
        port: process.env.PGPORT,
    });

    await client.connect();
    async function searchResume(query) {
        const queryEmbedding = await getEmbedding(query);

        const result = await client.query(
            `
            SELECT text, section,
                   embedding <=> $1 AS distance
            FROM documents
            ORDER BY embedding <=> $1
            LIMIT 3
            `,
            [JSON.stringify(queryEmbedding)]
        );

        return result.rows;
    }

    while (true) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const question = await new Promise((resolve) => {
            rl.question("Ask a question: ", resolve);
        });

        rl.close();

        if (question.toLowerCase() === "exit") {
            break;
        }
        let rewritten = question;

        if (conversationHistory.length > 0 && needsQueryRewriting(question)) {
            const recentHistory = conversationHistory.slice(-6);
            const history = recentHistory.join("\n");

            rewritten = await rewriteQuery(question, history);
        }

        console.log("\nRewritten query:", rewritten);

        const topK = await searchResume(rewritten);

        if (topK.length === 0) {
            console.log("\nAnswer:");
            console.log("I couldn't find this information in the provided resume.");

            conversationHistory.push(`User: ${question}`);
            conversationHistory.push(
                `Assistant: I couldn't find this information in the provided resume.`
            );

            continue;
        }

        const context = topK.map((result) => result.text).join("\n\n");

        const prompt = `
Answer the question using only the provided context.

Context:
${context}

Question:
${question}
`;

        // Generate final answer
        const answer = await callLLM(prompt);

        console.log("\nAnswer:");
        console.log(answer);

        console.log("\nTop 3 results:\n");

        for (const result of topK) {
            console.log("Section:", result.section);
            console.log("Distance:", result.distance);
            console.log("--------------------");
        }

        // Store conversation in temporary memory
        conversationHistory.push(`User: ${question}`);
        conversationHistory.push(`Assistant: ${answer}`);

        console.log("\n--------------------");
    }

    await client.end();
}

async function rewriteQuery(question, conversationHistory) {
    const prompt = `
    You are a query rewriting assistant for a resume RAG system.
    
    Rewrite the user's latest question into a self-contained search query.
    
    Use the conversation history only to resolve references such as
    "it", "that", "which one", "this project", etc.
    
    Preserve the intent and constraints of the LATEST question.
    Do not copy constraints or topics from previous questions unless
    the latest question explicitly refers to them.
    
    Do not answer the question.
    Return only the rewritten search query.
    
    Conversation history:
    ${conversationHistory}
    
    Latest question:
    ${question}
    `;

    const rewrittenQuery = await callLLM(prompt);

    return rewrittenQuery.trim();
}
async function callLLM(prompt) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: prompt
            });

            return response.text;

        } catch (error) {
            if (error.status === 429) {
                console.log("Gemini quota exceeded. Please wait for the quota to reset.");
                throw error;
            }

            console.log(`Answer generation failed (attempt ${attempt}/3)`);

            if (attempt === 3) {
                throw error;
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}
main();
