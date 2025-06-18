// models/Analytics.js
const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true,
    index: true
  },
  websiteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: true,
    index: true
  },
  
  // Metrics
  date: {
    type: Date,
    required: true,
    index: true
  },
  visits: { type: Number, default: 0 },
  pageViews: { type: Number, default: 0 },
  uniqueVisitors: { type: Number, default: 0 },
  bounceRate: { type: Number, default: 0 },
  avgTimeOnPage: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  ctr: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  
  // Traffic Sources
  trafficSources: {
    organic: { type: Number, default: 0 },
    social: { type: Number, default: 0 },
    direct: { type: Number, default: 0 },
    referral: { type: Number, default: 0 },
    email: { type: Number, default: 0 },
    paid: { type: Number, default: 0 }
  },
  
  // Geographic Data
  countries: [{
    code: String,
    name: String,
    visits: Number
  }],
  
  // Device Data
  devices: {
    desktop: { type: Number, default: 0 },
    mobile: { type: Number, default: 0 },
    tablet: { type: Number, default: 0 }
  },
  
  // Keywords that brought traffic
  keywords: [{
    term: String,
    visits: Number,
    position: Number
  }],
  
  createdAt: { type: Date, default: Date.now }
});

// Índices compuestos para consultas eficientes
analyticsSchema.index({ userId: 1, date: -1 });
analyticsSchema.index({ articleId: 1, date: -1 });
analyticsSchema.index({ websiteId: 1, date: -1 });
analyticsSchema.index({ userId: 1, articleId: 1, date: -1 }, { unique: true });

module.exports = mongoose.model('Analytics', analyticsSchema);