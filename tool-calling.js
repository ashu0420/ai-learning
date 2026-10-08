require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");
const { searchResume } = require("./rag");


const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const toolDefinitions = [{
    functionDeclarations: [
        {
            name: "getProjectDetails",
            description: "Get technical details about one of Asheesh's projects.",
            parameters: {
                type: "OBJECT",
                properties: {
                    project: {
                        type: "STRING",
                        description: "The name of the project."
                    }
                },
                required: ["project"]
            }
        },
        {
            name: "searchProjects",
            description: "Find Asheesh's projects that use a specific technology.",
            parameters: {
                type: "OBJECT",
                properties: {
                    technology: {
                        type: "STRING",
                        description: "The technology to search for."
                    }
                },
                required: ["technology"]
            }
        },
        {
            name: "searchResume",
            description: "Search Asheesh's resume for relevant information.",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "The question or search query to search for in the resume."
                    }
                },
                required: ["query"]
            }
        }
    ]
}];
function getProjectDetails(project) {
    // throw new Error("Database connection failed");
    if (project === "ZCoder") {
        return {
            success: true,
            data: {
                name: "ZCoder",
                technologies: ["Node.js", "Next.js", "MongoDB"]
            }
        };
    }

    return {
        success: false,
        error: "Project not found"
    };
}


const validTechnologies = [
    "Node.js",
    "Next.js",
    "MongoDB",
    "React",
    "Firebase"
];
const allowedTools = [
    "getProjectDetails",
    "searchProjects",
    "searchResume"
];

function searchProjects(technology) {
    if (!validTechnologies.includes(technology)) {
        return {
            success: false,
            error: `Invalid technology: ${technology}`
        };
    }
    const projects = [
        {
            name: "ZCoder",
            technologies: ["Node.js", "Next.js", "MongoDB"]
        },
        {
            name: "FreeMovers",
            technologies: ["React", "Next.js", "MongoDB"]
        },
        {
            name: "IITG Voting System",
            technologies: ["Next.js", "Firebase"]
        }
    ];

    const matches = projects.filter(project =>
        project.technologies.includes(technology)
    );

    return {
        success: true,
        data: matches
    };
}
// console.log(searchProjects("Next.js"));
const tools = {
    getProjectDetails,
    searchProjects,
    searchResume
};

async function executeTool(functionCall) {
    const tool = tools[functionCall.name];

    if (!tool) {
        return {
            success: false,
            error: "Tool not found"
        };
    }

    const argumentMap = {
        getProjectDetails: "project",
        searchProjects: "technology",
        searchResume: "query"
    };

    const argumentName = argumentMap[functionCall.name];

    if (!argumentName) {
        return {
            success: false,
            error: "Tool arguments not configured"
        };
    }

    return await tool(functionCall.args[argumentName]);
}

async function main() {

    const contents = [
        {
            role: "user",
            parts: [
                {
                    text: "What challenges did Asheesh face while building ZCoder?"
                }
            ]
        }
    ];
    const MAX_ITERATIONS = 5;
    let finalAnswerFound = false;

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
        console.log(`\nIteration ${iteration}`);

        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: contents,
            config: {
                tools: toolDefinitions
            }
        });

        contents.push(response.candidates[0].content);



        const functionCalls = [];


        for (const part of response.candidates[0].content.parts) {
            if (part.functionCall) {
                functionCalls.push(part.functionCall);
            }
        }

        if (!functionCalls.length) {
            console.log("\nFinal answer:");
            console.log(response.text);

            finalAnswerFound = true;
            break;
        }



        const toolResponses = []
        for (const functionCall of functionCalls) {
            console.log("\nTool requested:", functionCall.name);
            console.log("Arguments:", functionCall.args);

            if (!allowedTools.includes(functionCall.name)) {
                throw new Error(`Tool not allowed: ${functionCall.name}`);
            }
            let result;

            try {
                 result = await executeTool(functionCall);
            } catch (error) {
                result = {
                    success: false,
                    error: "Tool execution failed"
                };
            }

            // console.log("DEBUG result:", result);

            const toolResponse = {
                functionResponse: {
                    name: functionCall.name,
                    response: {
                        result: result
                    },
                    id: functionCall.id
                }
            };

            toolResponses.push(toolResponse);

            console.log("\nTool result:", result);

        }
        contents.push({
            role: "user",
            parts: [...toolResponses]
        });
    }
    if (!finalAnswerFound) {
        console.log("\nError:");
        console.log("Maximum tool-calling iterations reached.");
    }

    // const finalResponse = await ai.models.generateContent({
    //     model: "gemini-3.1-flash-lite",
    //     contents: [
    //         {
    //             role: "user",
    //             parts: [
    //                 {
    //                     text: "What technologies does ZCoder use?"
    //                 }
    //             ]
    //         },
    //         response.candidates[0].content,
    //         {
    //             role: "user",
    //             parts: [toolResponse]
    //         }
    //     ],
    //     config: {
    //         tools: toolDefinitions
    //     }
    // });

    // console.log("\nFinal answer:");
    // console.log(finalResponse.text);
}

main();



