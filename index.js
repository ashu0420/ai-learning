require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

async function main() {
    const response = await ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: "Employees receive 20 days of paid leave every year."
    });

    console.log(response.embeddings[0].values.length);
}

main();