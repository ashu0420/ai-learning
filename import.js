require("dotenv").config();
const crypto = require("crypto");

const fs = require("fs");
const { Client } = require("pg");

const documents = JSON.parse(
    fs.readFileSync("documents.json", "utf8")
);

const client = new Client({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    host: process.env.PGHOST,
    port: process.env.PGPORT
});

async function main() {
    await client.connect();

    console.log("Connected to PostgreSQL");
    let inserted = 0;
    let skipped = 0;
    for (const document of documents) {
        const chunkId = getChunkId(document);
        // console.log(chunkId);
        const hash = crypto
            .createHash("sha256")
            .update(document.text)
            .digest("hex");

        const result = await client.query(
            `
                INSERT INTO documents (text, embedding, section, content_hash, chunk_id)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (chunk_id)
                DO UPDATE SET
                    text = EXCLUDED.text,
                    embedding = EXCLUDED.embedding,
                    section = EXCLUDED.section,
                    content_hash = EXCLUDED.content_hash
                `,
            [
                document.text,
                JSON.stringify(document.embedding),
                document.metadata.section,
                hash,
                chunkId
            ]
            );
       
    }

    console.log(`Processed: ${documents.length}`);
    // console.log(`Inserted: ${inserted}`);
    // console.log(`Skipped: ${skipped}`);

    await client.end();
}
function getChunkId(document) {
    const text = document.text;

    if (text.includes("ZCoder")) {
        return "projects-zcoder";
    }

    if (text.includes("FreeMovers")) {
        return "projects-freemovers";
    }

    if (text.includes("IITG Voting System")) {
        return "projects-voting";
    }

    if (text.includes("Additional Technical Projects")) {
        return "projects-additional";
    }

    if (document.metadata.section === "Summary") {
        return "summary";
    }

    if (document.metadata.section === "Technical Skills") {
        return "technical-skills";
    }

    if (document.metadata.section === "Education") {
        return "education";
    }

    if (document.metadata.section === "Achievements") {
        return "achievements";
    }

    if (document.metadata.section === "Extra-Curricular") {
        return "extra-curricular";
    }

    return "header";
}

main();
