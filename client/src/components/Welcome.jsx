const suggestions = [
    "Summarize my professional experience.",
    "What technical skills do I have?",
    "Explain my projects and their technologies.",
    "What are my key achievements?",
    "What is my educational background?",
];

function Welcome({ onSelect }) {
    return (
        <div className="welcome">
            <h2>Explore your resume</h2>

            <p>
                Ask about your technical skills, projects, experience,
                education, or achievements.
            </p>

            <div className="suggestions">
                {suggestions.map((suggestion) => (
                    <button
                        key={suggestion}
                        type="button"
                        onClick={() => onSelect(suggestion)}
                    >
                        {suggestion}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default Welcome;