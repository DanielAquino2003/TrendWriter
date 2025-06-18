// routes/analytics.js
const express = require('express');
const Analytics = require('../models/Analytics');
const Article = require('../models/Article');
const Website = require('../models/Website');
const { authenticateToken } = require('../middleware/auth');
const { getGoogleAnalyticsData } = require('../services/analyticsService');
const router = express.Router();

// GET /api/analytics/overview - Dashboard principal
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const { period = '30d', websiteId } = req.query;
    
    const dateRange = getDateRange(period);
    const query = { 
      userId: req.user.userId,
      date: { $gte: dateRange.start, $lte: dateRange.end }
    };
    
    if (websiteId) {
      query.websiteId = websiteId;
    }
    
    // Agregar datos de analytics
    const analytics = await Analytics.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalVisits: { $sum: '$visits' },
          totalPageViews: { $sum: '$pageViews' },
          totalUniqueVisitors: { $sum: '$uniqueVisitors' },
          avgBounceRate: { $avg: '$bounceRate' },
          avgTimeOnPage: { $avg: '$avgTimeOnPage' },
          totalClicks: { $sum: '$clicks' },
          avgCTR: { $avg: '$ctr' },
          totalConversions: { $sum: '$conversions' },
          totalRevenue: { $sum: '$revenue' }
        }
      }
    ]);
    
    // Top articles
    const topArticles = await Analytics.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$articleId',
          totalVisits: { $sum: '$visits' },
          totalRevenue: { $sum: '$revenue' },
          avgCTR: { $avg: '$ctr' }
        }
      },
      { $sort: { totalVisits: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'articles',
          localField: '_id',
          foreignField: '_id',
          as: 'article'
        }
      },
      { $unwind: '$article' },
      {
        $project: {
          title: '$article.title',
          slug: '$article.slug',
          category: '$article.category',
          totalVisits: 1,
          totalRevenue: 1,
          avgCTR: 1
        }
      }
    ]);
    
    // Traffic sources
    const trafficSources = await Analytics.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          organic: { $sum: '$trafficSources.organic' },
          social: { $sum: '$trafficSources.social' },
          direct: { $sum: '$trafficSources.direct' },
          referral: { $sum: '$trafficSources.referral' },
          email: { $sum: '$trafficSources.email' },
          paid: { $sum: '$trafficSources.paid' }
        }
      }
    ]);
    
    // Trending keywords
    const trendingKeywords = await Analytics.aggregate([
      { $match: query },
      { $unwind: '$keywords' },
      {
        $group: {
          _id: '$keywords.term',
          totalVisits: { $sum: '$keywords.visits' },
          avgPosition: { $avg: '$keywords.position' }
        }
      },
      { $sort: { totalVisits: -1 } },
      { $limit: 20 }
    ]);
    
    res.json({
      overview: analytics[0] || {},
      topArticles,
      trafficSources: trafficSources[0] || {},
      trendingKeywords,
      period,
      dateRange
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/analytics/article/:id - Analytics de artículo específico
router.get('/article/:id', authenticateToken, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const dateRange = getDateRange(period);
    
    // Verificar que el artículo pertenezca al usuario
    const article = await Article.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    const analytics = await Analytics.find({
      articleId: req.params.id,
      date: { $gte: dateRange.start, $lte: dateRange.end }
    }).sort({ date: 1 });
    
    // Calcular métricas agregadas
    const summary = analytics.reduce((acc, day) => ({
      totalVisits: acc.totalVisits + day.visits,
      totalPageViews: acc.totalPageViews + day.pageViews,
      totalUniqueVisitors: acc.totalUniqueVisitors + day.uniqueVisitors,
      avgBounceRate: (acc.avgBounceRate + day.bounceRate) / 2,
      avgTimeOnPage: (acc.avgTimeOnPage + day.avgTimeOnPage) / 2,
      totalClicks: acc.totalClicks + day.clicks,
      totalConversions: acc.totalConversions + day.conversions,
      totalRevenue: acc.totalRevenue + day.revenue
    }), {
      totalVisits: 0,
      totalPageViews: 0,
      totalUniqueVisitors: 0,
      avgBounceRate: 0,
      avgTimeOnPage: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: 0
    });
    
    // Calcular CTR
    summary.ctr = summary.totalVisits > 0 ? (summary.totalClicks / summary.totalVisits) * 100 : 0;
    
    res.json({
      article: {
        id: article._id,
        title: article.title,
        publishedAt: article.publishedAt,
        category: article.category
      },
      summary,
      dailyData: analytics,
      period,
      dateRange
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/analytics/sync - Sincronizar con Google Analytics
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const { websiteId } = req.body;
    
    const website = await Website.findOne({
      _id: websiteId,
      userId: req.user.userId
    });
    
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }
    
    if (website.analyticsProvider !== 'google' || !website.analyticsConfig.viewId) {
      return res.status(400).json({ error: 'Google Analytics not configured' });
    }
    
    // Sincronizar últimos 30 días
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const analyticsData = await getGoogleAnalyticsData(
      website.analyticsConfig,
      startDate,
      endDate
    );
    
    // Procesar y guardar datos
    const syncResults = {
      processed: 0,
      errors: 0,
      dateRange: { start: startDate, end: endDate }
    };
    
    for (const dayData of analyticsData) {
      try {
        // Buscar artículos correspondientes a las URLs
        const articles = await Article.find({
          userId: req.user.userId,
          websiteId: website._id,
          publishedTo: { $in: dayData.pages.map(p => p.url) }
        });
        
        for (const article of articles) {
          const pageData = dayData.pages.find(p => 
            article.publishedTo && article.publishedTo.includes(p.path)
          );
          
          if (pageData) {
            await Analytics.findOneAndUpdate(
              {
                userId: req.user.userId,
                articleId: article._id,
                websiteId: website._id,
                date: dayData.date
              },
              {
                visits: pageData.visits,
                pageViews: pageData.pageViews,
                uniqueVisitors: pageData.uniqueVisitors,
                bounceRate: pageData.bounceRate,
                avgTimeOnPage: pageData.avgTimeOnPage,
                trafficSources: dayData.trafficSources,
                countries: dayData.countries,
                devices: dayData.devices,
                keywords: pageData.keywords || []
              },
              { upsert: true, new: true }
            );
            
            syncResults.processed++;
          }
        }
      } catch (error) {
        console.error('Error processing analytics for day:', dayData.date, error);
        syncResults.errors++;
      }
    }
    
    // Actualizar último sync
    website.performanceSummary.lastUpdated = new Date();
    await website.save();
    
    res.json({
      message: 'Analytics synchronized successfully',
      results: syncResults
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function getDateRange(period) {
  const end = new Date();
  let start;
  
  switch (period) {
    case '7d':
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  
  return { start, end };
}

module.exports = router;