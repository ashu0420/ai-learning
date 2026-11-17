require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");
const { Client } = require("pg");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const client = new Client({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    host: process.env.PGHOST,
    port: process.env.PGPORT
});

async function getEmbedding(text) {
    const response = await ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: text
    });

    return response.embeddings[0].values;
}

const testCases = [
    {
        question: "What is Asheesh's degree?",
        expectedSection: "Education"
    },
    {
        question: "What is Asheesh's Codeforces rating?",
        expectedSection: "Achievements"
    },
    {
        question: "What projects has Asheesh built?",
        expectedSection: "Projects"
    }
];

async function main() {
    await client.connect();

    let passed = 0;

    for (const testCase of testCases) {
        const questionEmbedding = await getEmbedding(testCase.question);

        const result = await client.query(
            `
        SELECT section,
               embedding <=> $1 AS distance
        FROM documents
        WHERE embedding <=> $1 < 0.32
        ORDER BY embedding <=> $1
        LIMIT 3
        `,
            [JSON.stringify(questionEmbedding)]
        );

        const sections = result.rows.map(row => row.section);

        const success = sections.includes(testCase.expectedSection);

        console.log("\nQuestion:", testCase.question);
        console.log("Expected:", testCase.expectedSection);

        console.log(
            "Retrieved:",
            result.rows.map(row => ({
                section: row.section,
                distance: Number(row.distance).toFixed(4)
            }))
        );

        console.log("Result:", success ? "PASS" : "FAIL");

        if (success) {
            passed++;
        }
    }

    console.log(
        `\nRecall@3: ${passed}/${testCases.length}`
    );

    await client.end();
}

main();
