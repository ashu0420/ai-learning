const suggestions = [
    "What projects has Asheesh built?",
    "What is Asheesh's Codeforces rating?",
    "What technologies has Asheesh used?",
];

function Welcome({ onSelect }) {
    return (
        <div className="welcome">
            <h2>Explore my resume</h2>

            <p>
                Ask about my technical skills, projects, achievements, or
                competitive programming experience.
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