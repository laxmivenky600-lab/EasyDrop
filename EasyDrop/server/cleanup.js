const sessions = require('./sessions');

const SESSION_TTL = 5 * 60 * 1000; // 5 minutes

function startCleanupTask(io) {
    setInterval(() => {
        const now = Date.now();
        for (const [sessionId, session] of sessions.getAllSessions().entries()) {
            if (now - session.createdAt > SESSION_TTL) {
                if (!session.receiverSocketId) {
                    io.to(sessionId).emit('expired');
                    sessions.removeSession(sessionId);
                }
            }
        }
    }, 10000); // Check every 10 seconds
}

module.exports = { startCleanupTask };
