/* const Trend = require('../models/Trend');
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
}; */

const Trend = require('../models/Trend');
const Article = require('../models/Article');

// Obtener tendencias globales (sin userId)
const getPublicTrends = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';

    const trends = await Trend.find({ userId: { $exists: false } }) // solo tendencias públicas
      .sort({ [sortBy]: -1 }) // orden descendente
      .limit(limit); // límite de resultados

    res.status(200).json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('Error al obtener tendencias públicas:', error);
    res.status(500).json({ error: 'Error al obtener tendencias públicas' });
  }
};


const getPublicTrendById = async (req, res) => {
  try {
    const trend = await Trend.findOne({ _id: req.params.id, userId: { $exists: false } });
    if (!trend) return res.status(404).json({ error: 'Tendencia no encontrada o no pública' });

    res.status(200).json({
      success: true,
      data: trend,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener la tendencia pública' });
  }
};


// Obtener tendencias del usuario
const getUserTrends = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, processed, source } = req.query;
    const userId = req.userId;

    // Construir filtros
    let filters = { userId };
    
    if (category) filters.category = category;
    if (processed !== undefined) filters.processed = processed === 'true';
    if (source) filters.source = source;

    // Ejecutar consulta
    const trends = await Trend.find(filters)
      .populate('articleId', 'title status publishedAt')
      .sort({ score: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Trend.countDocuments(filters);

    res.json({
      success: true,
      data: {
        trends,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting user trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trends',
      message: error.message
    });
  }
};

// Obtener tendencias procesables del usuario
const getUserProcessableTrends = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const userId = req.userId;

    const trends = await Trend.getProcessableTrendsByUser(userId, parseInt(limit));

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Error getting processable trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch processable trends',
      message: error.message
    });
  }
};

// Crear una tendencia manual
const createUserTrend = async (req, res) => {
  try {
    const userId = req.userId;
    
    const trendData = {
      ...req.body,
      userId,
      source: req.body.source || 'manual'
    };

    const trend = new Trend(trendData);
    trend.calculateScore();
    await trend.save();

    res.status(201).json({
      success: true,
      data: trend,
      message: 'Trend created successfully'
    });
  } catch (error) {
    console.error('Error creating trend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create trend',
      message: error.message
    });
  }
};

// Obtener estadísticas de tendencias del usuario
const getUserTrendStats = async (req, res) => {
  try {
    const userId = req.userId;
    const stats = await Trend.getStatsByUser(userId);

    res.json({
      success: true,
      data: stats[0] || {
        total: 0,
        processed: 0,
        highScore: 0,
        avgScore: 0,
        categories: []
      }
    });
  } catch (error) {
    console.error('Error getting trend stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trend statistics',
      message: error.message
    });
  }
};

// Procesar tendencia a artículo
const processTrendToArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const user = req.user;

    // Verificar que la tendencia existe y pertenece al usuario
    const trend = await Trend.findOne({ _id: id, userId });
    
    if (!trend) {
      return res.status(404).json({
        success: false,
        error: 'Trend not found',
        message: 'Trend not found or you do not have permission to process it'
      });
    }

    if (trend.processed) {
      return res.status(400).json({
        success: false,
        error: 'Already processed',
        message: 'This trend has already been processed'
      });
    }

    // Aquí iría la lógica de procesamiento con AI
    // Por ahora, simulamos la creación del artículo
    
    const articleData = {
      userId,
      title: `Article about: ${trend.title}`,
      content: `Generated content for trend: ${trend.description}`,
      category: trend.category,
      trendId: trend._id,
      status: 'draft'
    };

    const article = new Article(articleData);
    await article.save();

    // Marcar la tendencia como procesada
    trend.processed = true;
    trend.processedAt = new Date();
    trend.articleId = article._id;
    await trend.save();

    // Actualizar uso del usuario
    user.usage.articlesThisMonth += 1;
    user.usage.aiCreditsUsed += 100; // Sumar créditos usados
    await user.save();

    res.json({
      success: true,
      data: {
        trend,
        article
      },
      message: 'Trend processed successfully'
    });
  } catch (error) {
    console.error('Error processing trend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process trend',
      message: error.message
    });
  }
};

// Escanear nuevas tendencias (placeholder)
const scanUserTrends = async (req, res) => {
  try {
    const userId = req.userId;
    const user = req.user;

    // Aquí iría la lógica de escaneo de tendencias
    // Por ahora retornamos un mensaje de éxito
    
    res.json({
      success: true,
      message: 'Trend scanning initiated',
      data: {
        userId,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error scanning trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan trends',
      message: error.message
    });
  }
};

// Obtener una tendencia por ID
const getTrendById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const trend = await Trend.findOne({ _id: id, userId })
      .populate('articleId', 'title status publishedAt')
      .lean();

    if (!trend) {
      return res.status(404).json({
        success: false,
        error: 'Trend not found',
        message: 'No trend found with this ID for the current user'
      });
    }

    res.json({
      success: true,
      data: trend
    });
  } catch (error) {
    console.error('Error getting trend by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trend by ID',
      message: error.message
    });
  }
};

const updateUserTrend = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const updateData = req.body;

    const trend = await Trend.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true }
    );

    if (!trend) {
      return res.status(404).json({
        success: false,
        error: 'Trend not found or unauthorized'
      });
    }

    res.json({
      success: true,
      data: trend,
      message: 'Trend updated successfully'
    });
  } catch (error) {
    console.error('Error updating trend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update trend',
      message: error.message
    });
  }
};

const deleteUserTrend = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const result = await Trend.findOneAndDelete({ _id: id, userId });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Trend not found or unauthorized'
      });
    }

    res.json({
      success: true,
      message: 'Trend deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting trend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete trend',
      message: error.message
    });
  }
};



module.exports = {
  getUserTrends,
  getUserProcessableTrends,
  createUserTrend,
  getUserTrendStats,
  processTrendToArticle,
  scanUserTrends,
  getTrendById,
  updateUserTrend,
  deleteUserTrend,
  getPublicTrends,
  getPublicTrendById
};