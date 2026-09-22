require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const { PDFParse } = require("pdf-parse");
const { GoogleGenAI } = require("@google/genai");
const { Client } = require("pg");

const client = new Client({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    host: process.env.PGHOST,
    port: process.env.PGPORT
});

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
    await client.connect();

    console.log("Connected to PostgreSQL");
    for (const chunk of chunks) {
        const section = getSection(chunk);
        const chunkId = getChunkId(chunk);
        console.log("Chunk:", chunkId);

        let textForEmbedding =
            "Resume of Asheesh Chauhan\n" +
            "Section: " + section + "\n\n" +
        chunk;

        const hash = crypto
            .createHash("sha256")
            .update(textForEmbedding)
            .digest("hex");

        const existing = await client.query(
            `
            SELECT content_hash
            FROM documents
            WHERE chunk_id = $1
            `,
            [chunkId]
        );

        if (
            existing.rows.length > 0 &&
            existing.rows[0].content_hash === hash
        ) {
            console.log(`Skipped unchanged chunk: ${chunkId}`);
            continue;
        }

        const embedding = await getEmbedding(textForEmbedding);
        await client.query(
            `
            INSERT INTO documents
                (text, embedding, section, content_hash, chunk_id)
            VALUES
                ($1, $2, $3, $4, $5)
            ON CONFLICT (chunk_id)
            DO UPDATE SET
                text = EXCLUDED.text,
                embedding = EXCLUDED.embedding,
                section = EXCLUDED.section,
                content_hash = EXCLUDED.content_hash
            `,
            [
                textForEmbedding,
                JSON.stringify(embedding),
                section,
                hash,
                chunkId
            ]
        );

        documents.push({
            text: textForEmbedding,
            embedding: embedding,
            metadata: {
                section: section
            }
        });

        console.log(`Embedded one chunk: ${chunkId}`);
    }

    fs.writeFileSync(
        "documents.json",
        JSON.stringify(documents)
    );

    await client.end();
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
function getChunkId(chunk) {
    if (chunk.includes("ZCoder")) {
        return "projects-zcoder";
    }

    if (chunk.includes("FreeMovers")) {
        return "projects-freemovers";
    }

    if (chunk.includes("IITG Voting System")) {
        return "projects-voting";
    }

    if (chunk.includes("Additional Technical Projects")) {
        return "projects-additional";
    }

    const section = getSection(chunk);

    if (section === "Summary") {
        return "summary";
    }

    if (section === "Technical Skills") {
        return "technical-skills";
    }

    if (section === "Education") {
        return "education";
    }

    if (section === "Achievements") {
        return "achievements";
    }

    if (section === "Extra-Curricular") {
        return "extra-curricular";
    }

    return "header";
}
main();

