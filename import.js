require("dotenv").config();

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

    for (const document of documents) {
        await client.query(
            `
            INSERT INTO documents (text, embedding, section)
            VALUES ($1, $2, $3)
            `,
            [
                document.text,
                JSON.stringify(document.embedding),
                document.metadata.section
            ]
        );
    }

    console.log(`Inserted ${documents.length} documents`);

    await client.end();
}

main();
