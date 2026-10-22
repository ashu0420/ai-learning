require("dotenv").config();

const { searchResume } = require("./rag");

async function main() {
    const questions = [
        "What is Asheesh's Codeforces rating?",
        "What projects has Asheesh built?",
        "What programming languages does Asheesh know?",
        "What is Asheesh's favorite food?",
        "What is Asheesh's home address?",
        "What is Asheesh's favorite programming language?"
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