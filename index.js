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
        const section = getSection(chunk);

        let textForEmbedding = chunk;

        if (section === "Projects") {
            textForEmbedding = `Resume of Asheesh Chauhan
    
    ${chunk}`;
        }

        const embedding = await getEmbedding(textForEmbedding);

        documents.push({
            text: textForEmbedding,
            embedding: embedding,
            metadata: {
                section: section
            }
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
function getSection(chunk) {
    if (chunk.startsWith("Summary")) {
        return "Summary";
    }

    if (chunk.startsWith("Technical Skills")) {
        return "Technical Skills";
    }

    if (chunk.startsWith("ZCoder")) {
        return "Projects";
    }

    if (chunk.startsWith("FreeMovers")) {
        return "Projects";
    }

    if (chunk.startsWith("IITG Voting System")) {
        return "Projects";
    }

    if (chunk.startsWith("Additional Technical Projects")) {
        return "Projects";
    }

    if (chunk.startsWith("Education")) {
        return "Education";
    }

    if (chunk.startsWith("Achievements")) {
        return "Achievements";
    }

    if (chunk.startsWith("Extra-Curricular")) {
        return "Extra-Curricular";
    }

    return "Header";
}
main();