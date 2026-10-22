require("dotenv").config();

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { searchResume } = require("./rag");

const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite",
    apiKey: process.env.GEMINI_API_KEY
});

// Template for generating answers
const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful resume assistant.

Answer the user's question using only the resume context below.
If the context does not contain enough information, say that you
could not find enough information in the resume.

Do not infer personal preferences or facts that are not supported
by the context.

Resume context:
{context}

User question:
{question}
`);

const chain = promptTemplate.pipe(model);

const relevanceTemplate = PromptTemplate.fromTemplate(`
    You are an evidence evaluator for a resume question-answering system.
    
    Your task is to determine whether the supplied resume chunk contains
    sufficient evidence to answer the user's specific question.
    
    User question:
    {question}
    
    Resume chunk:
    {chunk}
    
    Follow these rules carefully:
    
    1. Return YES only if the chunk explicitly answers the question
       or directly supports the requested factual answer.
    
    2. Return NO if the chunk is unrelated, provides only general background,
       or mentions the topic without establishing the requested fact.
    
    3. Do not infer personal preferences, intentions, opinions, or other
       personal facts from indirect clues.
    
    4. For example, listing programming languages does not establish
       someone's favorite language. Building a project with a language
       does not establish that it is their favorite.
    
    5. Evaluate only the supplied chunk. Do not use outside knowledge.
    
    Return exactly one word: YES or NO.
    `);

const relevanceChain = relevanceTemplate.pipe(model);

async function isRelevant(question, chunk) {
    const result = await relevanceChain.invoke({
        question,
        chunk: chunk.text
    });

    const judgment = String(result.content).trim().toUpperCase();

    // Fail closed if the model returns an unexpected response.
    if (judgment !== "YES" && judgment !== "NO") {
        console.warn("Unexpected relevance judgment:", judgment);
        return false;
    }

    return judgment === "YES";
}

async function main() {
    const question = "What projects has Asheesh built?";    // Step 1: Retrieve candidate chunks.
    const chunks = await searchResume(question);

    console.log("Retrieved chunks:", chunks.length);

    // Step 2: Evaluate each chunk.
    const evaluatedChunks = await Promise.all(
        chunks.map(async (chunk) => ({
            ...chunk,
            relevant: await isRelevant(question, chunk)
        }))
    );

    for (const chunk of evaluatedChunks) {
        console.log({
            section: chunk.section,
            distance: chunk.distance,
            relevant: chunk.relevant
        });
    }

    // Step 3: Keep chunks judged relevant.
    const relevantChunks = evaluatedChunks.filter(
        chunk => chunk.relevant
    );

    // Step 4: Return a fallback if none pass.
    if (relevantChunks.length === 0) {
        console.log(
            "I couldn't find enough relevant information in the resume to answer that question."
        );
        return;
    }

    // Step 5: Build context from the retained chunks.
    const context = relevantChunks
        .map(chunk => `Section: ${chunk.section}\n${chunk.text}`)
        .join("\n\n");

    // Step 6: Generate the answer.
    const response = await chain.invoke({
        context,
        question
    });

    console.log("\nAnswer:", response.content);
}


// async function testRelevance() {
//     const question =
//         "What is Asheesh's favorite programming language?";

//     const testCases = [
//         {
//             name: "Explicit evidence",
//             chunk: `
//                 Asheesh explicitly states that his favorite
//                 programming language is C++.
// `,
//             expected: "YES"
//         },
//         {
//             name: "Skills list only",
//             chunk: `
//                 Technical Skills:
// C++, JavaScript, TypeScript, Python, SQL.
//             `,
//             expected: "NO"
//         },
//         {
//             name: "Project uses C++",
//             chunk: `
//                 Asheesh built a text file compressor in C++
// using Huffman coding.
// `,
//             expected: "NO"
//         }
//     ];

//     for (const testCase of testCases) {
//         const result = await relevanceChain.invoke({
//             question,
//             chunk: testCase.chunk
//         });

//         const actual = String(result.content)
//             .trim()
//             .toUpperCase();

//         console.log(`\nTest: ${testCase.name} `);
//         console.log(`Expected: ${testCase.expected} `);
//         console.log(`Actual: ${actual} `);
//         console.log(
//             `Result: ${actual === testCase.expected ? "PASS" : "FAIL"
//             } `
//         );
//     }
// }


main().catch(console.error);