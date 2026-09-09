require("dotenv").config();

const fs = require("fs");
const { PDFParse } = require("pdf-parse");
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
    const dataBuffer = fs.readFileSync("mastercv.pdf");

    const parser = new PDFParse({
        data: dataBuffer
    });

    const result = await parser.getText();

    const sections = result.text.split(
        /\n(?=Summary|Technical Skills|Projects|ZCoder|FreeMovers|IITG Voting System|Additional Technical Projects|Education|Achievements|Extra-Curricular)/
    );

    const chunks = sections.filter(
        section => section.trim() !== "Projects"
    );

    const documents = [];

    for (const chunk of chunks) {
        const embedding = await getEmbedding(chunk);

        documents.push({
            text: chunk,
            embedding: embedding
        });
    }
    fs.writeFileSync(
        "documents.json",
        JSON.stringify(documents)
    );

    console.log("Embeddings saved.");

    console.log("Total documents:", documents.length);
    console.log("First document:", documents[0].text);
    console.log("Vector dimensions:", documents[0].embedding.length);

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

    for (const result of topK) {
        console.log(result.score, result.text);
    }
    const context = topK
        .map(result => result.text)
        .join("\n\n");

    const prompt = `
Answer the user's question using only the information provided below.

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
    await parser.destroy();
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

    return dotProduct / (
        Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB)
    );
}
main();