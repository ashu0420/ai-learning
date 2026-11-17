function ChatInput({ question, onQuestionChange, onSubmit, loading }) {
    return (
        <form className="composer" onSubmit={onSubmit}>
            <input
                type="text"
                value={question}
                onChange={(event) => onQuestionChange(event.target.value)}
                placeholder="Ask a question about the resume..."
                maxLength={1000}
                disabled={loading}
            />

            <button type="submit" disabled={loading || !question.trim()}>
                {loading ? "Thinking..." : "Send"}
            </button>
        </form>
    );
}

export default ChatInput;