require("dotenv").config();

const fs = require("fs");
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        magnitudeA += a[i] * a[i];
        magnitudeB += b[i] * b[i];
    }

    return dotProduct / (
        Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB)
    );
}

async function getEmbedding(text) {
    const response = await ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: text
    });

    return response.embeddings[0].values;
}

async function main() {
    const documents = JSON.parse(
        fs.readFileSync("documents.json", "utf8")
    );

    const question = "What projects has Asheesh built?";

    const questionEmbedding = await getEmbedding(question);

    const results = [];

    for (const document of documents) {
        const score = cosineSimilarity(
            questionEmbedding,
            document.embedding
        );

        results.push({
            text: document.text,
            score: score
        });
    }

    results.sort((a, b) => b.score - a.score);

    const topK = results.slice(0, 3);
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

    console.log("\nPrompt:\n");
    console.log(prompt);

    console.log("\nContext:\n");
    console.log(context);

    console.log("\nTop 3 results:\n");

    for (const result of topK) {
        console.log("Score:", result.score);
        console.log(result.text);
        console.log("--------------------------------");
    }
}

main();