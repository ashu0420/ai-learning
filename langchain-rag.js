require("dotenv").config();

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { searchResume } = require("./rag");

const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite",
    apiKey: process.env.GEMINI_API_KEY
});

const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful resume assistant.

Answer the user's question using the resume context below.
If the context does not contain enough information, say that you
could not find enough information in the resume.

Resume context:
{context}

User question:
{question}
`);

const chain = promptTemplate.pipe(model);

async function main() {
    const question = "What is Asheesh's Codeforces rating?";
    
    const chunks = await searchResume(question);

    const context = chunks
        .map(chunk => `Section: ${chunk.section}\n${chunk.text}`)
        .join("\n\n");

    const response = await chain.invoke({
        context,
        question
    });

    console.log(response.content);
}

main().catch(console.error);    