const crypto = require("crypto");
const { PDFParse } = require("pdf-parse");

const { pool } = require("./db");
const { getEmbedding } = require("./rag");

async function extractResumeText(buffer) {
    const parser = new PDFParse({
        data: buffer
    });

    try {
        const result = await parser.getText();
        const text = result.text.trim();

        if (!text) {
            throw new Error("The uploaded PDF contains no extractable text.");
        }

        return text;
    } finally {
        await parser.destroy();
    }
}
function splitResumeIntoChunks(text) {
    const headingPattern =
        /^(summary|professional summary|objective|experience|work experience|professional experience|employment history|education|technical skills|skills|projects|personal projects|academic projects|certifications|achievements|awards|publications|positions of responsibility|extracurricular activities|extra-curricular activities|internships)$/i;

    const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const sections = [];
    let currentSection = "General";
    let currentContent = [];

    for (const line of lines) {
        if (headingPattern.test(line)) {
            if (currentContent.length > 0) {
                sections.push({
                    section: currentSection,
                    text: currentContent.join("\n")
                });
            }

            currentSection = line;
            currentContent = [];
        } else {
            currentContent.push(line);
        }
    }

    if (currentContent.length > 0) {
        sections.push({
            section: currentSection,
            text: currentContent.join("\n")
        });
    }

    // Fallback: split into smaller chunks if no headings were detected.
    if (sections.length === 0 ||
        (sections.length === 1 && sections[0].section === "General")) {
        return createFallbackChunks(text);
    }

    return sections.flatMap(section =>
        createTextChunks(section.text, section.section)
    );
}

function createTextChunks(text, section, chunkSize = 1200, overlap = 150) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        const chunk = text.slice(start, end).trim();

        if (chunk) {
            chunks.push({ section, text: chunk });
        }

        if (end === text.length) break;

        start = end - overlap;
    }

    return chunks;
}

function createFallbackChunks(text) {
    return createTextChunks(text, "General");
}
async function createResumeSession(buffer, filename) {
    const text = await extractResumeText(buffer);
    const chunks = splitResumeIntoChunks(text);

    if (chunks.length === 0) {
        throw new Error("Could not extract meaningful resume content.");
    }

    if (chunks.length > 100) {
        throw new Error("Resume contains too much content.");
    }

    // Generate embeddings before opening the database transaction.
    const preparedChunks = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        const textForEmbedding =
            `Resume section: ${chunk.section}\n\n${chunk.text}`;

        const embedding = await getEmbedding(textForEmbedding);

        const contentHash = crypto
            .createHash("sha256")
            .update(textForEmbedding)
            .digest("hex");

        preparedChunks.push({
            section: chunk.section,
            text: textForEmbedding,
            embedding,
            contentHash,
            chunkId: `${chunk.section.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${i}`
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const sessionResult = await client.query(
            `
            INSERT INTO sessions (filename, expires_at)
            VALUES ($1, NOW() + INTERVAL '24 hours')
            RETURNING id, filename, created_at, expires_at
            `,
            [filename]
        );

        const session = sessionResult.rows[0];

        for (const chunk of preparedChunks) {
            await client.query(
                `
                INSERT INTO documents
                    (session_id, text, embedding, section, content_hash, chunk_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                `,
                [
                    session.id,
                    chunk.text,
                    JSON.stringify(chunk.embedding),
                    chunk.section,
                    chunk.contentHash,
                    chunk.chunkId
                ]
            );
        }

        await client.query("COMMIT");

        return {
            sessionId: session.id,
            filename: session.filename,
            createdAt: session.created_at,
            expiresAt: session.expires_at
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    extractResumeText,
    splitResumeIntoChunks,
    createResumeSession
};