const express = require('express');
const router = express.Router();
const articlesController = require('../controllers/articlesController');

// Obtener todos los artículos
router.get('/', articlesController.getArticles);

// Obtener un artículo por ID
router.get('/:id', articlesController.getArticleById);

// Crear un nuevo artículo
router.post('/', articlesController.createArticle);

// Actualizar un artículo
router.put('/:id', articlesController.updateArticle);

// Eliminar un artículo
router.delete('/:id', articlesController.deleteArticle);

module.exports = router;