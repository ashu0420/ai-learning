require("dotenv").config();

const { Client } = require("pg");
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

async function searchResume(query) {
    const client = new Client({
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        host: process.env.PGHOST,
        port: process.env.PGPORT,
    });

    await client.connect();

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

    await client.end();

    return result.rows.map(row => ({
        section: row.section,
        text: row.text
    }));
}

module.exports = {
    searchResume
};
