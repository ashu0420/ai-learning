require("dotenv").config();

const rateLimit = require("express-rate-limit");
const express = require("express");
const {
    answerResumeQuestion,
    streamResumeAnswer
} = require("./rag-service");
const { closePool, checkDatabase } = require("./rag");

const app = express();
const PORT = process.env.PORT || 3000;

const chatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_MAX) || 100,
    message: {
        error: "Too many requests. Please try again later."
    },
    standardHeaders: "draft-8",
    legacyHeaders: false
});

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

app.post("/api/chat", chatLimiter, async (req, res) => {
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

app.post("/api/chat/stream", chatLimiter, async (req, res) => {
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

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
        for await (const event of streamResumeAnswer(question.trim())) {
            if (res.destroyed) {
                break;
            }

            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        if (!res.destroyed) {
            res.end();
        }
    } catch (error) {
        console.error("Streaming API error:", error.message);

        if (!res.destroyed) {
            res.write(`data: ${JSON.stringify({
                type: "error",
                error: error.code === "AI_TIMEOUT"
                    ? "The AI service took too long to respond."
                    : "An unexpected error occurred while generating the answer."
            })}\n\n`);

            res.end();
        }
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


let isShuttingDown = false;
let shutdownPromise;
let server
function shutdown(signal, serverInstance = server) {
    if (shutdownPromise) {
        return shutdownPromise;
    }

    isShuttingDown = true;

    shutdownPromise = new Promise((resolve, reject) => {
        console.log(`${signal} received. Starting graceful shutdown...`);

        const shutdownTimer = setTimeout(() => {
            console.error("Graceful shutdown timed out. Forcing exit.");
            process.exit(1);
        }, 10000);

        const closeDatabase = async () => {
            try {
                await closePool();

                clearTimeout(shutdownTimer);

                console.log("PostgreSQL connection pool closed.");
                resolve();
            } catch (error) {
                clearTimeout(shutdownTimer);

                console.error("Database shutdown error:", error.message);
                reject(error);
            }
        };

        const closeHttpServer = () => {
            serverInstance.close(async (err) => {
                if (err) {
                    clearTimeout(shutdownTimer);
                    reject(err);
                    return;
                }

                console.log("HTTP server closed.");

                await closeDatabase();
            });
        };

        if (!serverInstance) {
            closeDatabase();
            return;
        }

        if (serverInstance.listening) {
            closeHttpServer();
        } else {
            // Server exists but may not have finished starting.
            serverInstance.once("listening", closeHttpServer);

            serverInstance.once("error", (error) => {
                clearTimeout(shutdownTimer);
                reject(error);
            });
        }
    });

    return shutdownPromise;
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

function startServer(port = PORT) {
    server = app.listen(port, () => {
        console.log(
            `Resume assistant API running on port ${server.address().port}`
        );
    });

    return server;
}

module.exports = {
    app,
    startServer,
    shutdown
};

if (require.main === module) {
    startServer();
}