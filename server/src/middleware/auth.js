import jwt from 'jsonwebtoken';

/**
 * Express middleware to authenticate requests using JWT.
 * Assumes a Bearer token layout in the Authorization header.
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication token is missing.' });
  }

  try {
    const decodedPayload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedPayload;
    next();
  } catch (error) {
    console.warn('[Auth] Token validation failure:', error.message);
    return res.status(403).json({ error: 'Forbidden', message: 'Authentication token is expired or invalid.' });
  }
};
