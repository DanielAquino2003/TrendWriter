const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // No es obligatorio para todos los artículosº
    index: true // Index for faster lookups by user
  },

  title: { type: String, required: true },
  slug: { type: String, unique: true },
  content: { type: String, required: true },
  metaDescription: String,
  keywords: [String],
  category: String,
  trendId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trend' },
  seoScore: { type: Number, default: 0 },
  readabilityScore: { type: Number, default: 0 },
  estimatedRevenue: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['draft', 'ready', 'published', 'error'],
    default: 'draft'
  },
  publishedAt: Date,
  wordpressId: Number,
  createdAt: { type: Date, default: Date.now }
});

// Añadir indices para optimizar consultas
ArticleSchema.index({ userId: 1, status: 1 });
ArticleSchema.index({ userId: 1, createdAt: -1 });
ArticleSchema.index({ userId: 1, category: 1});

module.exports = mongoose.model('Article', ArticleSchema);