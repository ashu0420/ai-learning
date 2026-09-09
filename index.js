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

        console.log("Embedded one chunk");
    }

    fs.writeFileSync(
        "documents.json",
        JSON.stringify(documents)
    );

    console.log("Total documents:", documents.length);
    console.log("Embeddings saved to documents.json");

    await parser.destroy();
}

main();