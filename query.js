require("dotenv").config();


const { Client } = require("pg");


const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});



async function getEmbedding(text) {
    const response = await ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: text
    });

    return response.embeddings[0].values;
}

async function main() {
  

    const question = "What projects has Asheesh built?";

    const questionEmbedding = await getEmbedding(question);

    const client = new Client({
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        host: process.env.PGHOST,
        port: process.env.PGPORT
    });

    await client.connect();

    const result = await client.query(
        `
        SELECT text, section,
               embedding <=> $1 AS distance
        FROM documents
        WHERE section = 'Projects'
        ORDER BY embedding <=> $1
        LIMIT 3
        `,
        [JSON.stringify(questionEmbedding)]
    );

    const topK = result.rows;

    await client.end();
    const context = topK
        .map(result => result.text)
        .join("\n\n");
    const prompt = `
        Answer the question using only the provided context.
        
        Context:
        ${context}
        
        Question:
        ${question}
        `;
    const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt
    });

    console.log("\nAnswer:");
    console.log(response.text);

    

    console.log("\nContext:\n");
    console.log(context);

    console.log("\nTop 3 results:\n");

    for (const result of topK) {
        console.log("Distance:", result.distance);
    }
}

main();