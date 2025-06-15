const Trend = require('../models/Trend');
const TrendScanner = require('../services/TrendScanner');

const trendScanner = new TrendScanner();

exports.getTrends = async (req, res) => {
  try {
    const { category, limit = 10, sort = '-viralScore' } = req.query;
    
    const filter = {};
    if (category) filter.category = category;
    
    const trends = await Trend.find(filter)
      .sort(sort)
      .limit(parseInt(limit))
      .exec();
    
    res.json({
      success: true,
      data: trends,
      total: trends.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.scanTrends = async (req, res) => {
  try {
    const newTrends = await trendScanner.scanAllSources();
    
    res.json({
      success: true,
      message: `${newTrends.length} nuevas tendencias encontradas`,
      data: newTrends
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getTrendById = async (req, res) => {
  try {
    const trend = await Trend.findById(req.params.id);
    
    if (!trend) {
      return res.status(404).json({
        success: false,
        error: 'Tendencia no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: trend
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};