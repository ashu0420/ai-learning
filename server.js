require("dotenv").config();

const multer = require("multer");
const cors = require("cors");
const { createResumeSession } = require("./resume-service");
const rateLimit = require("express-rate-limit");
const express = require("express");
const {
    answerResumeQuestion,
    streamResumeAnswer
} = require("./rag-service");
const {
    getSession,
    getConversationHistory,
    saveMessage,
    deleteSession,
    deleteExpiredSessions
} = require("./session-service");
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
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB
    }
});

function handleResumeUpload(req, res, next) {
    upload.single("resume")(req, res, (error) => {
        if (error instanceof multer.MulterError) {
            if (error.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({
                    error: "Resume must be 5 MB or smaller."
                });
            }

            return res.status(400).json({
                error: "Invalid file upload."
            });
        }

        if (error) {
            return next(error);
        }

        next();
    });
}

function isValidUUID(value) {
    return typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173"
}));
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

app.post(
    "/api/resumes",
    handleResumeUpload,
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: "Please upload a PDF resume."
                });
            }

            // Check the actual PDF signature, not just the extension.
            if (!req.file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
                return res.status(400).json({
                    error: "Invalid PDF file."
                });
            }

            const session = await createResumeSession(
                req.file.buffer,
                req.file.originalname
            );

            return res.status(201).json({
                message: "Resume uploaded successfully.",
                ...session
            });

        } catch (error) {
            console.error("Resume upload error:", error.message);


            if (error.message.includes("no extractable text")) {
                return res.status(400).json({
                    error: "Could not extract text from this PDF. Please upload a text-based PDF."
                });
            }

            return res.status(500).json({
                error: "Resume processing failed. Please try again."
            });
        }
    }
);

app.post("/api/chat", chatLimiter, async (req, res) => {
    try {
        const { sessionId, question } = req.body || {};

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

        if (!isValidUUID(sessionId)) {
            return res.status(400).json({
                error: "A valid session ID is required."
            });
        }

        const session = await getSession(sessionId);

        if (!session) {
            return res.status(404).json({
                error: "Session not found or expired."
            });
        }

        const history = await getConversationHistory(sessionId);

        await saveMessage(sessionId, "user", question.trim());

        const result = await answerResumeQuestion(
            sessionId,
            question.trim(),
            history
        );

        await saveMessage(
            sessionId,
            "assistant",
            result.answer
        );

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

        return res.status(500).json({
            error: "An unexpected error occurred while answering your question."
        });
    }
});

app.post("/api/chat/stream", chatLimiter, async (req, res) => {
    const { sessionId, question } = req.body || {};

    if (!isValidUUID(sessionId)) {
        return res.status(400).json({
            error: "A valid session ID is required."
        });
    }

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

    try {
        const session = await getSession(sessionId);

        if (!session) {
            return res.status(404).json({
                error: "Session not found or expired."
            });
        }

        const history = await getConversationHistory(sessionId);

        await saveMessage(sessionId, "user", question.trim());

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        let answer = "";

        for await (const event of streamResumeAnswer(
            sessionId,
            question.trim(),
            history
        )) {
            if (res.destroyed) break;

            if (event.type === "token") {
                answer += event.content;
            }

            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        if (!res.destroyed && answer) {
            await saveMessage(sessionId, "assistant", answer);
        }

        if (!res.destroyed) {
            res.end();
        }

    } catch (error) {
        console.error("Streaming API error:", error.message);

        if (!res.headersSent) {
            return res.status(500).json({
                error: "An unexpected error occurred while generating the answer."
            });
        }

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


app.get("/api/sessions/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!isValidUUID(sessionId)) {
            return res.status(400).json({
                error: "Invalid session ID."
            });
        }

        const session = await getSession(sessionId);

        if (!session) {
            return res.status(404).json({
                error: "Session not found or expired."
            });
        }

        const history = await getConversationHistory(sessionId, 100);

        return res.json({
            session,
            messages: history
        });

    } catch (error) {
        console.error("Session retrieval error:", error.message);

        return res.status(500).json({
            error: "Could not retrieve session."
        });
    }
});

app.delete("/api/sessions/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!isValidUUID(sessionId)) {
            return res.status(400).json({
                error: "Invalid session ID."
            });
        }

        const deleted = await deleteSession(sessionId);

        if (!deleted) {
            return res.status(404).json({
                error: "Session not found."
            });
        }

        return res.json({
            message: "Session deleted successfully."
        });

    } catch (error) {
        console.error("Session deletion error:", error.message);

        return res.status(500).json({
            error: "Could not delete session."
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
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

const cleanupTimer = setInterval(async () => {
    try {
        const deletedCount = await deleteExpiredSessions();

        if (deletedCount > 0) {
            console.log(`Cleaned up ${deletedCount} expired sessions.`);
        }
    } catch (error) {
        console.error("Session cleanup failed:", error.message);
    }
}, CLEANUP_INTERVAL);

cleanupTimer.unref();

let isShuttingDown = false;
let shutdownPromise;
let server
function shutdown(signal, serverInstance = server) {
    if (shutdownPromise) {
        return shutdownPromise;
    }

    isShuttingDown = true;
    clearInterval(cleanupTimer);

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