const Article = require('../models/Article');

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
};