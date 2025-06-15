const mongoose = require('mongoose');

const trendSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['technology', 'economy', 'health', 'entertainment', 'sports', 'politics', 'science', 'other', 'tech']
  },
  source: {
    type: String,
    required: true
  },
  url: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  score: {
    type: Number,
    default: 0,
    min: 0,
    max: 1000
  },
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  processedAt: {
    type: Date
  },
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article'
  },
  // Nuevos campos para manejo de errores
  processingError: {
    type: String
  },
  lastErrorAt: {
    type: Date
  },
  errorCount: {
    type: Number,
    default: 0
  },
  // Metadatos adicionales
  keywords: [{
    type: String,
    trim: true
  }],
  engagement: {
    views: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    comments: { type: Number, default: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para optimizar consultas
trendSchema.index({ processed: 1, score: -1 });
trendSchema.index({ category: 1, createdAt: -1 });
trendSchema.index({ source: 1, createdAt: -1 });
trendSchema.index({ score: -1, createdAt: -1 });

// Middleware para actualizar updatedAt
trendSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Método para calcular el score basado en diferentes factores
trendSchema.methods.calculateScore = function() {
  let score = 0;
  
  // Puntuación base por fuente
  const sourceScores = {
    'twitter': 50,
    'reddit': 60,
    'google_trends': 70,
    'news': 80,
    'manual': 100
  };
  
  score += sourceScores[this.source] || 30;
  
  // Puntuación por engagement
  if (this.engagement) {
    score += Math.min(this.engagement.views / 100, 50);
    score += Math.min(this.engagement.shares / 10, 30);
    score += Math.min(this.engagement.comments / 5, 20);
  }
  
  // Puntuación por keywords relevantes
  if (this.keywords && this.keywords.length > 0) {
    score += Math.min(this.keywords.length * 5, 25);
  }
  
  // Puntuación por recencia (más reciente = más puntos)
  const hoursOld = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
  if (hoursOld < 24) {
    score += 50 - (hoursOld * 2);
  }
  
  this.score = Math.min(Math.max(score, 0), 1000);
  return this.score;
};

// Método estático para obtener tendencias procesables
trendSchema.statics.getProcessableTrends = function(limit = 10) {
  return this.find({
    processed: false,
    score: { $gt: 100 },
    $or: [
      { processingError: { $exists: false } },
      { errorCount: { $lt: 3 } }
    ]
  })
  .sort({ score: -1, createdAt: -1 })
  .limit(limit);
};

// Método estático para estadísticas
trendSchema.statics.getStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        processed: { $sum: { $cond: ['$processed', 1, 0] } },
        highScore: { $sum: { $cond: [{ $gt: ['$score', 100] }, 1, 0] } },
        avgScore: { $avg: '$score' },
        categories: { $addToSet: '$category' }
      }
    }
  ]);
};

module.exports = mongoose.model('Trend', trendSchema);