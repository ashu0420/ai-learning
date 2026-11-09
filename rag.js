require("dotenv").config();

const { Pool } = require("pg");
const { GoogleGenAI } = require("@google/genai");
const pool = new Pool({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000
});
pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err.message);
});
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

async function searchResume(query) {
    const queryEmbedding = await getEmbedding(query);
    const result = await pool.query({
        text: `
            SELECT text, section,
                   embedding <=> $1 AS distance
            FROM documents
            ORDER BY embedding <=> $1
            LIMIT 3
        `,
        values: [JSON.stringify(queryEmbedding)],
        query_timeout: 10000
    });

    return result.rows.map(row => ({
        section: row.section,
        text: row.text,
        distance: Number(row.distance)
    }));

}
async function checkDatabase() {
    await pool.query("SELECT 1");
    return true;
}
async function closePool() {
    await pool.end();
}

module.exports = {
    searchResume,
    closePool,
    checkDatabase
};
