require("dotenv").config();

const { searchResume } = require("../rag");

async function main() {
    const questions = [
        "What is the candidate's Codeforces rating?",
        "What projects has the candidate built?",
        "What programming languages does the candidate know?",
        "What is the candidate's favorite food?",
        "What is the candidate's home address?",
        "What is the candidate's favorite programming language?"
    ];

    for (const question of questions) {
        console.log(`\nQuestion: ${question}`);

        const chunks = await searchResume(question);

        for (const chunk of chunks) {
            console.log({
                section: chunk.section,
                distance: chunk.distance,
                text: chunk.text.slice(0, 100)
            });
        }
    }
}

main().catch(console.error);