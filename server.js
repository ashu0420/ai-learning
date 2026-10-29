require("dotenv").config();

const express = require("express");
const { answerResumeQuestion } = require("./rag-service");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10kb" }));

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.post("/api/chat", async (req, res) => {
    try {
        const { question } = req || {};

        if (typeof question  !== "string" || !question.trim()) {
            return res.status(400).json({
                error: "Please provide a non-empty question."
            });
        }

        if (question.length > 1000) {
            return res.status(400).json({
                error: "Question must be 1000 characters or fewer."
            });
        }

        const result = await answerResumeQuestion(question.trim());
        return res.json(result);
    } catch (error) {
        console.error("Chat API error:", error.message);

        if (error.status === 429 || error.status === 503) {
            return res.status(503).json({
                error: "The AI service is temporarily unavailable or rate-limited. Please try again later."
            });
        }

        res.status(500).json({
            error: "An unexpected error occurred while answering your question."
        });
    }
});

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({
            error: "Invalid JSON in request body."
        });
    }

    if (err.status === 413 && err.type === "entity.too.large") {
        return res.status(413).json({
            error: "Request body is too large. Maximum allowed size is 10 KB."
        });
    }

    console.error("Request error:", err.message);

    return res.status(err.status || 500).json({
        error: "An error occurred while processing the request."
    });
});

app.listen(PORT, () => {
    console.log(`Resume assistant API running on port ${PORT}`);
});