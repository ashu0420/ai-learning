const { pool, checkDatabase, closePool } = require("./db");
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

async function searchResume(sessionId, query) {
    if (!sessionId || !query) {
        throw new Error("Session ID and query are required");
    }

    const queryEmbedding = await getEmbedding(query);

    const result = await pool.query({
        text: `
            SELECT text, section,
                   embedding <=> $1 AS distance
            FROM documents
            WHERE session_id = $2
            ORDER BY embedding <=> $1
            LIMIT 3
        `,
        values: [
            JSON.stringify(queryEmbedding),
            sessionId
        ],
        query_timeout: 10000
    });

    return result.rows.map(row => ({
        section: row.section,
        text: row.text,
        distance: Number(row.distance)
    }));
}


module.exports = {
    searchResume,
    getEmbedding,
    closePool,
    checkDatabase
};
