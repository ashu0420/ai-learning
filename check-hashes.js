require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const { PDFParse } = require("pdf-parse");
const { Client } = require("pg");

const client = new Client({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    host: process.env.PGHOST,
    port: process.env.PGPORT
});

function getChunkId(chunk) {
    if (chunk.includes("ZCoder")) return "projects-zcoder";
    if (chunk.includes("FreeMovers")) return "projects-freemovers";
    if (chunk.includes("IITG Voting System")) return "projects-voting";
    if (chunk.includes("Additional Technical Projects")) return "projects-additional";

    if (chunk.startsWith("Summary")) return "summary";
    if (chunk.startsWith("Technical Skills")) return "technical-skills";
    if (chunk.startsWith("Education")) return "education";
    if (chunk.startsWith("Achievements")) return "achievements";
    if (chunk.startsWith("Extra-Curricular")) return "extra-curricular";

    return "header";
}

async function main() {
    const dataBuffer = fs.readFileSync("mastercv.pdf");
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();

    const sections = result.text.split(
        /\n(?=Summary|Technical Skills|Projects|ZCoder|FreeMovers|IITG Voting System|Additional Technical Projects|Education|Achievements|Extra-Curricular)/
    );

    const chunks = sections.filter(
        section => section.trim() !== "Projects"
    );

    await client.connect();

    for (const chunk of chunks) {
        const chunkId = getChunkId(chunk);

        let text = chunk;

        if (
            chunk.includes("ZCoder") ||
            chunk.includes("FreeMovers") ||
            chunk.includes("IITG Voting System") ||
            chunk.includes("Additional Technical Projects")
        ) {
            text = "Resume of Asheesh Chauhan\n\n" + chunk;
        }

        const hash = crypto
            .createHash("sha256")
            .update(text)
            .digest("hex");

        const result = await client.query(
            "SELECT content_hash FROM documents WHERE chunk_id = $1",
            [chunkId]
        );

        const storedHash = result.rows[0]?.content_hash;

        if (chunkId === "projects-zcoder") {
            console.log("\n--- CURRENT ZCODER TEXT ---");
            console.log(JSON.stringify(text));

            console.log("\n--- STORED ZCODER TEXT ---");
            const stored = await client.query(
                "SELECT text FROM documents WHERE chunk_id = $1",
                [chunkId]
            );
            console.log(JSON.stringify(stored.rows[0].text));
        }
    }

    await client.end();
    await parser.destroy();
}

main();
