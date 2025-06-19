/* const Article = require('../models/Article');

exports.getArticles = async (req, res) => {
  try {
    const { category, sort = '-createdAt', search, limit, page = 1 } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // Inicializa la query sin ejecutar
    let query = Article.find(filter).sort(sort);

    // Aplica paginación si se pasa un límite
    let total;
    if (limit) {
      const parsedLimit = parseInt(limit);
      const parsedPage = parseInt(page);
      const skip = (parsedPage - 1) * parsedLimit;

      query = query.skip(skip).limit(parsedLimit);
      total = await Article.countDocuments(filter); // Total sin paginación
    }

    const articles = await query.exec();

    res.json({
      success: true,
      data: articles,
      total: total ?? articles.length,
      page: limit ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getArticleById = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Artículo no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: article
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.createArticle = async (req, res) => {
  try {
    const article = new Article(req.body);
    await article.save();
    
    res.status(201).json({
      success: true,
      message: 'Artículo creado exitosamente',
      data: article
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.updateArticle = async (req, res) => {
  try {
    const article = await Article.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Artículo no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Artículo actualizado exitosamente',
      data: article
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.deleteArticle = async (req, res) => {
  try {
    const article = await Article.findByIdAndDelete(req.params.id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Artículo no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Artículo eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; */

const Article = require('../models/Article');
const User = require('../models/User');
const articleRedactor = require('../services/articleRedactor'); // o donde esté el archivo

const getPublicArticles = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';

    const articles = await Article.find({ userId: { $exists: false } }) // solo artículos públicos
      .sort({ [sortBy]: -1 }) // orden descendente por el campo especificado
      .limit(limit); // aplica el límite

    res.status(200).json({
      success: true,
      data: articles,
    });
  } catch (error) {
    console.error('Error al obtener artículos públicos:', error);
    res.status(500).json({ error: 'Error al obtener artículos públicos' });
  }
};

const redactArticleController = async (req, res) => {
  try {
    const { tema, categoria, slug, tono, longitud, formato, etiquetas } = req.body;

    console.log('Datos recibidos para redactar artículo:', {
      tema,
      categoria,
      slug,
      tono,
      longitud,
      formato,
      etiquetas,
    });

    if (!tema || !categoria || !slug || !tono || !longitud || !formato || !etiquetas) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const { resultado } = await articleRedactor.redactArticle({
      tema,
      categoria,
      slug,
      tono,
      longitud,
      formato,
      etiquetas
    });

    res.json({
      success: true,
      data: resultado,
    });
  } catch (error) {
    console.error('Error al redactar el artículo:', error);
    res.status(500).json({ error: 'Error al redactar el artículo' });
  }
};

const getPublicArticleById = async (req, res) => {
  try {
    const article = await Article.findOne({ _id: req.params.id, userId: { $exists: false } });
    if (!article) return res.status(404).json({ error: 'Artículo no encontrado o no público' });

    res.status(200).json({
      success: true,
      data: article,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el artículo público' });
  }
};


// Obtener todos los artículos del usuario
const getUserArticles = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category, search } = req.query;
    const userId = req.userId;

    // Construir filtros
    let filters = { userId };
    
    if (status) filters.status = status;
    if (category) filters.category = category;
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // Ejecutar consulta con paginación
    const articles = await Article.find(filters)
      .populate('trendId', 'title category score')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Contar total para paginación
    const total = await Article.countDocuments(filters);

    res.json({
      success: true,
      data: {
        articles,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting user articles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch articles',
      message: error.message
    });
  }
};

// Obtener un artículo específico del usuario
const getUserArticleById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const article = await Article.findOne({ _id: id, userId })
      .populate('trendId', 'title category score source')
      .lean();

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
        message: 'Article not found or you do not have permission to access it'
      });
    }

    res.json({
      success: true,
      data: article
    });
  } catch (error) {
    console.error('Error getting article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch article',
      message: error.message
    });
  }
};

// Crear un nuevo artículo
const createArticle = async (req, res) => {
  try {
    const userId = req.userId;
    const user = req.user;
    
    // Crear el artículo
    const articleData = {
      ...req.body,
      userId,
      slug: req.body.slug || generateSlug(req.body.title)
    };

    const article = new Article(articleData);
    await article.save();

    // Actualizar el uso mensual del usuario
    user.usage.articlesThisMonth += 1;
    await user.save();

    res.status(201).json({
      success: true,
      data: article,
      message: 'Article created successfully'
    });
  } catch (error) {
    console.error('Error creating article:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate slug',
        message: 'An article with this slug already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create article',
      message: error.message
    });
  }
};

// Actualizar un artículo del usuario
const updateUserArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const article = await Article.findOneAndUpdate(
      { _id: id, userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
        message: 'Article not found or you do not have permission to update it'
      });
    }

    res.json({
      success: true,
      data: article,
      message: 'Article updated successfully'
    });
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update article',
      message: error.message
    });
  }
};

// Eliminar un artículo del usuario
const deleteUserArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const article = await Article.findOneAndDelete({ _id: id, userId });

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
        message: 'Article not found or you do not have permission to delete it'
      });
    }

    res.json({
      success: true,
      message: 'Article deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete article',
      message: error.message
    });
  }
};

// Publicar un artículo
const publishUserArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const article = await Article.findOneAndUpdate(
      { _id: id, userId },
      { 
        status: 'published',
        publishedAt: new Date()
      },
      { new: true }
    );

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
        message: 'Article not found or you do not have permission to publish it'
      });
    }

    res.json({
      success: true,
      data: article,
      message: 'Article published successfully'
    });
  } catch (error) {
    console.error('Error publishing article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish article',
      message: error.message
    });
  }
};

// Obtener estadísticas de artículos
const getUserArticleStats = async (req, res) => {
  try {
    const userId = req.userId;

    const stats = await Article.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
          draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          ready: { $sum: { $cond: [{ $eq: ['$status', 'ready'] }, 1, 0] } },
          avgSeoScore: { $avg: '$seoScore' },
          avgReadabilityScore: { $avg: '$readabilityScore' },
          totalEstimatedRevenue: { $sum: '$estimatedRevenue' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        total: 0,
        published: 0,
        draft: 0,
        ready: 0,
        avgSeoScore: 0,
        avgReadabilityScore: 0,
        totalEstimatedRevenue: 0
      }
    });
  } catch (error) {
    console.error('Error getting article stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch article statistics',
      message: error.message
    });
  }
};

// Función auxiliar para generar slug
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

module.exports = {
  getUserArticles,
  getUserArticleById,
  createArticle,
  updateUserArticle,
  deleteUserArticle,
  publishUserArticle,
  getUserArticleStats,
  getPublicArticles,
  getPublicArticleById,
  redactArticleController
};