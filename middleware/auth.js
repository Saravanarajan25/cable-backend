const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('[Auth] No token provided or invalid format');
            console.error('[Auth] Authorization header:', authHeader);
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Log token for debugging (only first/last few chars for security)
        if (process.env.NODE_ENV !== 'production') {
            console.log('[Auth] Token received:', token.substring(0, 20) + '...' + token.substring(token.length - 20));
            console.log('[Auth] JWT_SECRET set:', !!process.env.JWT_SECRET);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (process.env.NODE_ENV !== 'production') {
            console.log('[Auth] Token verified successfully for user:', decoded.username);
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error('[Auth] Token verification failed:', error.message);
        console.error('[Auth] Error type:', error.name);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }

        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;
