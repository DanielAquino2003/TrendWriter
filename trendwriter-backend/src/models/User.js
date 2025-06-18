const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true, // This creates a unique index implicitly
    lowercase: true,
    trim: true,
  },
  // OAuth2 Integration
  oauthProvider: {
    type: String,
    enum: ['google', 'github', 'linkedin', 'twitter', 'local'],
    default: 'local',
  },
  oauthId: {
    type: String,
    sparse: true, // Permite nulls múltiples
  },
  oauthToken: {
    type: String,
    select: false, // No incluir en queries por defecto
  },
  refreshToken: {
    type: String,
    select: false,
  },
  // User Preferences
  preferredCategories: [
    {
      type: String,
      enum: [
        'technology',
        'economy',
        'health',
        'entertainment',
        'sports',
        'politics',
        'science',
        'marketing',
        'travel',
        'other',
      ],
    },
  ],
  language: {
    type: String,
    default: 'en',
    enum: ['en', 'es', 'fr', 'de', 'it', 'pt'],
  },
  timezone: {
    type: String,
    default: 'UTC',
  },
  // Subscription & Limits
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free',
  },
  planLimits: {
    articlesPerMonth: { type: Number, default: 10 },
    websitesAllowed: { type: Number, default: 1 },
    aiCreditsPerMonth: { type: Number, default: 1000 },
  },
  usage: {
    articlesThisMonth: { type: Number, default: 0 },
    aiCreditsUsed: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: Date.now },
  },
  // Profile
  profile: {
    name: String,
    avatar: String,
    bio: String,
    website: String,
  },
  // Settings
  settings: {
    emailNotifications: { type: Boolean, default: true },
    autoPublish: { type: Boolean, default: false },
    seoOptimization: { type: Boolean, default: true },
    contentTone: {
      type: String,
      enum: ['professional', 'casual', 'technical', 'friendly'],
      default: 'professional',
    },
  },
  // Metadata
  lastLoginAt: Date,
  isActive: { type: Boolean, default: true },
  deletedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Índices
userSchema.index({ oauthProvider: 1, oauthId: 1 });
userSchema.index({ plan: 1, createdAt: -1 });

// Middleware para actualizar updatedAt
userSchema.pre('save', function (next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Métodos
userSchema.methods.canCreateArticle = function () {
  return this.usage.articlesThisMonth < this.planLimits.articlesPerMonth;
};

userSchema.methods.resetMonthlyUsage = function () {
  const now = new Date();
  const lastReset = new Date(this.usage.lastResetDate);

  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.usage.articlesThisMonth = 0;
    this.usage.aiCreditsUsed = 0;
    this.usage.lastResetDate = now;
    return this.save();
  }
  return Promise.resolve(this);
};

module.exports = mongoose.model('User', userSchema);