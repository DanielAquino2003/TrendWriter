// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        message: 'Please provide a valid authentication token' 
      });
    }

    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar el usuario en la base de datos
    const user = await User.findById(decoded.userId).select('-oauthToken -refreshToken');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'User not found or inactive' 
      });
    }

    // Verificar límites del plan
    await user.resetMonthlyUsage();

    // Agregar usuario al objeto request
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'The provided token is malformed or invalid' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Please log in again' 
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'Internal server error during authentication' 
    });
  }
};

// Middleware para verificar límites del plan
const checkPlanLimits = (resource) => {
  return (req, res, next) => {
    const user = req.user;
    
    switch (resource) {
      case 'articles':
        if (!user.canCreateArticle()) {
          return res.status(403).json({
            error: 'Plan limit exceeded',
            message: `You have reached your monthly limit of ${user.planLimits.articlesPerMonth} articles`,
            current: user.usage.articlesThisMonth,
            limit: user.planLimits.articlesPerMonth,
            plan: user.plan
          });
        }
        break;
        
      case 'ai_credits':
        const creditsNeeded = req.body.creditsNeeded || 100; // Default credits needed
        if (user.usage.aiCreditsUsed + creditsNeeded > user.planLimits.aiCreditsPerMonth) {
          return res.status(403).json({
            error: 'AI credits limit exceeded',
            message: `Not enough AI credits. You need ${creditsNeeded} but only have ${user.planLimits.aiCreditsPerMonth - user.usage.aiCreditsUsed} remaining`,
            current: user.usage.aiCreditsUsed,
            limit: user.planLimits.aiCreditsPerMonth,
            needed: creditsNeeded,
            plan: user.plan
          });
        }
        break;
        
      default:
        break;
    }
    
    next();
  };
};

module.exports = {
  authenticateToken,
  checkPlanLimits
};