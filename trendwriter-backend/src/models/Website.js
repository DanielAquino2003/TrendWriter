// models/Website.js
const mongoose = require('mongoose');

const websiteSchema = new mongoose.Schema({
  id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString(),
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  domain: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Domain must be a valid URL'
    }
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // CMS Integration
  cmsType: {
    type: String,
    enum: ['wordpress', 'custom', 'webflow', 'ghost', 'strapi', 'contentful'],
    default: 'custom'
  },
  apiCredentials: {
    endpoint: String,
    username: String,
    password: { type: String, select: false },
    token: { type: String, select: false },
    additionalConfig: mongoose.Schema.Types.Mixed
  },
  connected: {
    type: Boolean,
    default: false
  },
  lastConnectionTest: Date,
  connectionError: String,
  
  // Analytics Integration
  analyticsProvider: {
    type: String,
    enum: ['google', 'plausible', 'custom', 'none'],
    default: 'none'
  },
  analyticsConfig: {
    trackingId: String,
    apiKey: { type: String, select: false },
    viewId: String
  },
  
  // Performance Summary
  performanceSummary: {
    totalArticles: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    avgCTR: { type: Number, default: 0 },
    bestKeywords: [String],
    topArticles: [{
      articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
      title: String,
      views: Number,
      ctr: Number
    }],
    lastUpdated: Date
  },
  
  // SEO Settings
  seoSettings: {
    defaultMetaDescription: String,
    defaultKeywords: [String],
    authorName: String,
    siteName: String,
    favicon: String,
    logo: String
  },
  
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índices
websiteSchema.index({ userId: 1, domain: 1 }, { unique: true });
websiteSchema.index({ userId: 1, createdAt: -1 });

websiteSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Website', websiteSchema);