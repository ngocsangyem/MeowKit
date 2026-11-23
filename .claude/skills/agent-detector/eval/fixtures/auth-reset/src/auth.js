// Password reset tokens.
const tokens = new Map();

function issueResetToken(userId) {
  const token = Math.random().toString(36).slice(2);
  tokens.set(token, { userId, createdAt: Date.now() });
  return token;
}

function redeemResetToken(token) {
  const entry = tokens.get(token);
  if (!entry) return null;
  tokens.delete(token);
  return entry.userId;
}

module.exports = { issueResetToken, redeemResetToken };
