const crypto = require('crypto');

const sessions = new Map();

function createSession(files) {
    const sessionId = `ED-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const senderToken = crypto.randomBytes(16).toString('hex');
    const receiverToken = crypto.randomBytes(16).toString('hex');
    
    const session = {
        sessionId,
        senderToken,
        receiverToken,
        files,
        createdAt: Date.now(),
        senderSocketId: null,
        receiverSocketId: null,
        state: 'pending'
    };
    
    sessions.set(sessionId, session);
    return session;
}

function getSession(sessionId) {
    return sessions.get(sessionId);
}

function removeSession(sessionId) {
    sessions.delete(sessionId);
}

function getAllSessions() {
    return sessions;
}

module.exports = {
    createSession,
    getSession,
    removeSession,
    getAllSessions
};
