const { pool } = require("./db");

async function getSession(sessionId) {
    const result = await pool.query(
        `
        SELECT id, filename, created_at, expires_at
        FROM sessions
        WHERE id = $1
          AND expires_at > NOW()
        `,
        [sessionId]
    );

    return result.rows[0] || null;
}

// Retrieve recent conversation history.
async function getConversationHistory(sessionId, limit = 10) {
    const result = await pool.query(
        `
        SELECT role, content, created_at
        FROM (
            SELECT id, role, content, created_at
            FROM messages
            WHERE session_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT $2
        ) recent_messages
        ORDER BY created_at ASC, id ASC
        `,
        [sessionId, limit]
    );

    return result.rows;
}

// Save a user or assistant message.
async function saveMessage(sessionId, role, content) {
    const result = await pool.query(
        `
        INSERT INTO messages (session_id, role, content)
        SELECT id, $2, $3
        FROM sessions
        WHERE id = $1
          AND expires_at > NOW()
        RETURNING id, session_id, role, content, created_at
        `,
        [sessionId, role, content]
    );

    if (result.rowCount === 0) {
        throw new Error("Session not found or expired");
    }

    return result.rows[0];
}

// Delete expired sessions.
// Documents and messages are removed through ON DELETE CASCADE.
async function deleteExpiredSessions() {
    const result = await pool.query(
        `
        DELETE FROM sessions
        WHERE expires_at <= NOW()
        RETURNING id
        `
    );

    return result.rowCount;
}

// Delete a particular session.
async function deleteSession(sessionId) {
    const result = await pool.query(
        `
        DELETE FROM sessions
        WHERE id = $1
        RETURNING id
        `,
        [sessionId]
    );

    return result.rowCount > 0;
}

module.exports = {
    getSession,
    getConversationHistory,
    saveMessage,
    deleteExpiredSessions,
    deleteSession
};