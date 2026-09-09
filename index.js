require("dotenv").config();

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

function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        magnitudeA += a[i] * a[i];
        magnitudeB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

async function main() {
    const text1 = "Employees receive 20 days of paid leave every year.";
    const text2 = "Workers get 20 annual vacation days.";
    const text3 = "The office has three meeting rooms.";

    const embedding1 = await getEmbedding(text1);
    const embedding2 = await getEmbedding(text2);
    const embedding3 = await getEmbedding(text3);

    console.log("1 vs 2:", cosineSimilarity(embedding1, embedding2));
    console.log("1 vs 3:", cosineSimilarity(embedding1, embedding3));
}

main();