import { useState, useEffect, useRef } from "react";
import {
  sendChatMessage,
  uploadResume,
  getSession,
  deleteSession,
} from "./services/chatService";

import "./App.css";
import Message from "./components/Message";
import Welcome from "./components/Welcome";
import ChatInput from "./components/ChatInput";

const SESSION_KEY = "resume_assistant_session_id";

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);

  const [restoring, setRestoring] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const chatEndRef = useRef(null);

  // Restore the previous session when the application opens.
  useEffect(() => {
    async function restoreSession() {
      const savedSessionId = localStorage.getItem(SESSION_KEY);

      if (!savedSessionId) {
        setRestoring(false);
        return;
      }

      try {
        const data = await getSession(savedSessionId);

        setSessionId(savedSessionId);
        setMessages(data.messages || []);
      } catch (error) {
        localStorage.removeItem(SESSION_KEY);
        setError("Your previous session has expired. Please upload your resume again.");
      } finally {
        setRestoring(false);
      }
    }

    restoreSession();
  }, []);

  // Automatically scroll to the latest message.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Upload a new resume and create a session.
  async function handleUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");

    if (file.type !== "application/pdf") {
      setError("Please select a PDF file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Resume must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setUploading(true);

    try {
      const data = await uploadResume(file);

      // Replace the previous session only after the new upload succeeds.
      const previousSessionId = sessionId;

      localStorage.setItem(SESSION_KEY, data.sessionId);

      setSessionId(data.sessionId);
      setMessages([]);
      setQuestion("");

      // Delete the previous session in the background.
      if (previousSessionId) {
        deleteSession(previousSessionId).catch((error) => {
          console.error("Could not delete previous session:", error);
        });
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  // Delete the current session.
  async function handleDeleteSession() {
    if (!sessionId || loading || uploading) return;

    const confirmed = window.confirm(
      "Delete this resume and its conversation?"
    );

    if (!confirmed) return;

    setError("");

    try {
      await deleteSession(sessionId);

      localStorage.removeItem(SESSION_KEY);

      setSessionId(null);
      setMessages([]);
      setQuestion("");
    } catch (error) {
      setError(error.message);
    }
  }

  // Submit a question.
  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || loading || !sessionId) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", content: trimmedQuestion },
    ]);

    setQuestion("");
    setLoading(true);
    setError("");

    try {
      const data = await sendChatMessage(trimmedQuestion, sessionId);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: `Error: ${error.message}`,
          failedQuestion: trimmedQuestion,
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (restoring) {
    return (
      <main className="app">
        <div className="loading">Restoring your session...</div>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="header">
        <div className="logo">R</div>

        <div>
          <h1>Resume Assistant</h1>
          <p>
            {sessionId
              ? "Ask questions about your uploaded resume"
              : "Upload your resume to get started"}
          </p>
        </div>

        {sessionId && (
          <div className="session-actions">
            <label className="replace-button">
              {uploading ? "Uploading..." : "Replace Resume"}

              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleUpload}
                disabled={loading || uploading}
                hidden
              />
            </label>

            <button
              type="button"
              onClick={handleDeleteSession}
              disabled={loading || uploading}
            >
              Delete session
            </button>
          </div>
        )}
      </header>

      {error && <div className="error-message">{error}</div>}

      {!sessionId ? (
        <section className="upload-section">
          <h2>Upload your resume</h2>

          <p>
            Upload a PDF resume to start a conversation about your
            experience, projects, and skills.
          </p>

          <label className="upload-button">
            {uploading ? "Processing resume..." : "Choose PDF resume"}

            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleUpload}
              disabled={uploading}
              hidden
            />
          </label>

          <p className="upload-note">
            PDF only · Maximum size 5 MB · Session lasts 24 hours
          </p>
        </section>
      ) : (
        <>
          <section className="chat">
            {messages.length === 0 && (
              <Welcome onSelect={setQuestion} />
            )}

            {messages.map((message, index) => (
              <Message
                key={`${message.role}-${message.id || index}`}
                message={message}
                onRetry={(failedQuestion) =>
                  setQuestion(failedQuestion)
                }
              />
            ))}

            {loading && (
              <div className="loading">
                <span className="spinner" />
                Searching the resume and generating an answer...
              </div>
            )}

            <div ref={chatEndRef} />
          </section>

          <ChatInput
            question={question}
            onQuestionChange={setQuestion}
            onSubmit={handleSubmit}
            loading={loading}
          />
        </>
      )}

      <footer>
        Answers are generated by AI and should be verified against the sources.
      </footer>
    </main>
  );
}

export default App;