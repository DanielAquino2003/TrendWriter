// models/PersonalizedTrend.js
const mongoose = require('mongoose');

const personalizedTrendSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Trending Keywords personalizados
  trendingKeywords: [{
    keyword: String,
    score: Number,
    category: String,
    source: String,
    lastSeen: Date
  }],
  
  // Historial de temas que funcionaron
  topicsHistory: [{
    topic: String,
    category: String,
    avgPerformance: Number,
    articlesCount: Number,
    lastUsed: Date
  }],
  
  // Historial de conversiones
  conversionHistory: [{
    articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
    topic: String,
    conversionRate: Number,
    revenue: Number,
    date: Date
  }],
  
  // Preferencias aprendidas
  learnedPreferences: {
    bestPublishingTimes: [String], // ['09:00', '14:00', '18:00']
    bestContentLength: { min: Number, max: Number },
    bestCategories: [String],
    bestKeywordTypes: [String],
    bestTone: String
  },
  
  // Métricas de personalización
  personalizationScore: { type: Number, default: 0 },
  
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

personalizedTrendSchema.index({ userId: 1 }, { unique: true });

// Método para actualizar tendencias personalizadas
personalizedTrendSchema.methods.updateFromArticlePerformance = function(article, performance) {
  // Actualizar historial de temas
  const existingTopic = this.topicsHistory.find(t => t.topic === article.title);
  if (existingTopic) {
    existingTopic.avgPerformance = (existingTopic.avgPerformance + performance.ctr) / 2;
    existingTopic.articlesCount += 1;
    existingTopic.lastUsed = new Date();
  } else {
    this.topicsHistory.push({
      topic: article.title,
      category: article.category,
      avgPerformance: performance.ctr,
      articlesCount: 1,
      lastUsed: new Date()
    });
  }
  
  // Actualizar conversiones
  if (performance.conversions > 0) {
    this.conversionHistory.push({
      articleId: article._id,
      topic: article.title,
      conversionRate: performance.conversions / performance.views,
      revenue: performance.revenue,
      date: new Date()
    });
  }
  
  this.lastUpdated = new Date();
  return this.save();
};

module.exports = mongoose.model('PersonalizedTrend', personalizedTrendSchema);