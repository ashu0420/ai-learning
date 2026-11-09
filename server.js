require("dotenv").config();

const express = require("express");
const { answerResumeQuestion } = require("./rag-service");
const { closePool, checkDatabase } = require("./rag");

const app = express();
const PORT = process.env.PORT || 3000;
app.use((req, res, next) => {

    const startTime = Date.now();

    res.on("finish", () => {
        const duration = Date.now() - startTime;

        console.log(
            `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`
        );
    });

    next();
});
app.use(express.json({ limit: "10kb" }));
app.get("/health/live", (req, res) => {
    res.status(200).json({
        status: "alive"
    });
});

app.get("/health/ready", async (req, res) => {
    try {
        await checkDatabase();

        return res.status(200).json({
            status: "ready",
            database: "connected"
        });
    } catch (error) {
        console.error("Readiness check failed:", error.message);

        return res.status(503).json({
            status: "not ready",
            database: "unavailable"
        });
    }
});

app.post("/api/chat", async (req, res) => {
    try {
        const { question } = req.body || {};

        if (typeof question !== "string" || !question.trim()) {
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

        if (error.code === "AI_TIMEOUT") {
            return res.status(504).json({
                error: "The AI service took too long to respond. Please try again."
            });
        }

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

app.use((req, res) => {
    return res.status(404).json({
        error: "Endpoint not found"
    });
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

const server = app.listen(PORT, () => {
    console.log(`Resume assistant API running on port ${PORT}`);
});

let isShuttingDown = false;
async function shutdown(signal) {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    console.log(`${signal} received. Starting graceful shutdown...`);
    const shutdownTimer = setTimeout(() => {
        console.error("Graceful shutdown timed out. Forcing exit.");
        process.exit(1);
    }, 10000);

    server.close(async (err) => {
        if (err) {
            console.error("HTTP server shutdown error:", err);
            process.exit(1);
        }

        console.log("HTTP server closed.");

        try {
            await closePool();
            clearTimeout(shutdownTimer);
            console.log("PostgreSQL connection pool closed.");
            process.exit(0);
        } catch (error) {
            console.error("Database shutdown error:", error.message);
            process.exit(1);
        }
    });
}


process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));