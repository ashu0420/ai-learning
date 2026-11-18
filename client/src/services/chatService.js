const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function handleResponse(response) {
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

export async function uploadResume(file) {
    const formData = new FormData();
    formData.append("resume", file);

    const response = await fetch(`${API_BASE}/resumes`, {
        method: "POST",
        body: formData,
    });

    return handleResponse(response);
}

export async function sendChatMessage(question, sessionId) {
    const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            question,
            sessionId,
        }),
    });

    const data = await handleResponse(response);

    return {
        answer: data.answer,
        sources: data.sources || [],
    };
}

export async function getSession(sessionId) {
    const response = await fetch(
        `${API_BASE}/sessions/${encodeURIComponent(sessionId)}`
    );

    return handleResponse(response);
}

export async function deleteSession(sessionId) {
    const response = await fetch(
        `${API_BASE}/sessions/${encodeURIComponent(sessionId)}`,
        {
            method: "DELETE",
        }
    );

    return handleResponse(response);
}