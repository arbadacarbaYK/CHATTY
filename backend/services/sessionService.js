const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database for session storage
const dbPath = path.join(__dirname, '../sessions.db');
const db = new sqlite3.Database(dbPath);

// Create sessions table
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    conversation_history TEXT,
    skill_level TEXT DEFAULT 'beginner',
    avatar_name TEXT DEFAULT 'Satoshe',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_id ON chat_sessions(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_updated_at ON chat_sessions(updated_at)`);
});

class SessionService {
  constructor() {
    // Clean up old sessions every hour
    setInterval(() => {
      this.cleanupOldSessions();
    }, 60 * 60 * 1000);
  }

  // Get or create user session
  async getUserSession(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM chat_sessions WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            // Parse conversation history
            try {
              row.conversation_history = JSON.parse(row.conversation_history || '[]');
            } catch (e) {
              row.conversation_history = [];
            }
            resolve(row);
          } else {
            // Create new session
            const sessionId = this.generateSessionId();
            const newSession = {
              session_id: sessionId,
              user_id: userId,
              conversation_history: [],
              skill_level: 'beginner',
              avatar_name: 'Satoshe',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            
            db.run(
              'INSERT INTO chat_sessions (session_id, user_id, conversation_history, skill_level, avatar_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [newSession.session_id, newSession.user_id, JSON.stringify(newSession.conversation_history), newSession.skill_level, newSession.avatar_name, newSession.created_at, newSession.updated_at],
              (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(newSession);
                }
              }
            );
          }
        }
      );
    });
  }

  // Update conversation history
  async updateConversationHistory(userId, conversationHistory) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE chat_sessions SET conversation_history = ?, updated_at = ? WHERE user_id = ?',
        [JSON.stringify(conversationHistory), new Date().toISOString(), userId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Update session settings
  async updateSessionSettings(userId, skillLevel, avatarName) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE chat_sessions SET skill_level = ?, avatar_name = ?, updated_at = ? WHERE user_id = ?',
        [skillLevel, avatarName, new Date().toISOString(), userId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Clear conversation history
  async clearConversationHistory(userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE chat_sessions SET conversation_history = ?, updated_at = ? WHERE user_id = ?',
        [JSON.stringify([]), new Date().toISOString(), userId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Get session statistics
  async getSessionStats() {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as total_sessions, COUNT(CASE WHEN updated_at > datetime("now", "-1 hour") THEN 1 END) as active_sessions FROM chat_sessions',
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  // Cleanup old sessions (older than 7 days)
  async cleanupOldSessions() {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM chat_sessions WHERE updated_at < datetime("now", "-7 days")',
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Generate unique session ID
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = new SessionService(); 