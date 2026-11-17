require("dotenv").config();

const { PromptTemplate } = require("@langchain/core/prompts");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");

const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite",
    apiKey: process.env.GEMINI_API_KEY
});

const promptTemplate = PromptTemplate.fromTemplate(
    "Explain {topic} in simple English. Keep your answer under 100 words."
);
const chain = promptTemplate.pipe(model);


async function main() {
    const response = await chain.invoke({
        topic: "Vector Databases"
    });

    console.log(response.content);
}

main().catch(console.error);




