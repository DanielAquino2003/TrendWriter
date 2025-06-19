const express = require('express');
const router = express.Router();
const articlesController = require('../controllers/articlesController');
const { authenticateToken } = require('../middleware/auth');
const { checkPlanLimits } = require('../middleware/auth');

/* // Obtener todos los artículos
router.get('/', articlesController.getArticles);

// Obtener un artículo por ID
router.get('/:id', articlesController.getArticleById);

// Crear un nuevo artículo
router.post('/', articlesController.createArticle);

// Actualizar un artículo
router.put('/:id', articlesController.updateArticle);

// Eliminar un artículo
router.delete('/:id', articlesController.deleteArticle);

module.exports = router; */

router.get('/public', articlesController.getPublicArticles);

router.get('/public/:id', articlesController.getPublicArticleById);


// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// Obtener todos los artículos del usuario autenticado
router.get('/', articlesController.getUserArticles);

// Obtener un artículo específico del usuario
router.get('/:id', articlesController.getUserArticleById);

// Crear un nuevo artículo (verificar límites del plan)
router.post('/', checkPlanLimits('articles'), articlesController.createArticle);

// Actualizar un artículo del usuario
router.put('/:id', articlesController.updateUserArticle);

// Eliminar un artículo del usuario
router.delete('/:id', articlesController.deleteUserArticle);

// Publicar un artículo
router.patch('/:id/publish', articlesController.publishUserArticle);

// Obtener estadísticas de artículos del usuario
router.get('/stats/summary', articlesController.getUserArticleStats);

module.exports = router;