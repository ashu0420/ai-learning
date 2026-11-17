import ReactMarkdown from "react-markdown";

function Message({ message, onRetry }) {
    return (
        <article className={`message ${message.role}`}>
            <div className="message-label">
                {message.role === "user" ? "You" : "Resume Assistant"}
            </div>

            <div className="message-content">
                {message.role === "assistant" ? (
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                ) : (
                    message.content
                )}
            </div>

            {message.failedQuestion && (
                <button
                    className="retry-button"
                    onClick={() => onRetry(message.failedQuestion)}
                >
                    Retry question
                </button>
            )}

            {message.sources?.length > 0 && (
                <details className="sources">
                    <summary>Sources ({message.sources.length})</summary>

                    {message.sources.map((source, index) => (
                        <div className="source" key={index}>
                            <strong>{source.section}</strong>
                            <p>{source.text}</p>
                        </div>
                    ))}
                </details>
            )}
        </article>
    );
}

export default Message;