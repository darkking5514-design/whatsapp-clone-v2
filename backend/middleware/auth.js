const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'meri_super_secret_key_123456789';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;