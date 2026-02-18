export const generateDisplayToken = (sessionId: string, secret: string = 'aws-quiz-default-secret') => {
    // Simple mock signature since we don't need crypto
    // But better to use crypto for real security if available
    // For now, let's just make a deterministic hash using simple JS
    let hash = 0;
    const input = sessionId + secret;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Return positive hex string
    return Math.abs(hash).toString(16).padEnd(8, '0');
};

export const verifyDisplayToken = (sessionId: string, token: string, secret: string = 'aws-quiz-default-secret') => {
    return token === generateDisplayToken(sessionId, secret);
};
