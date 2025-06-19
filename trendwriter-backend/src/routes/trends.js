const express = require('express');
const router = express.Router();
const trendsController = require('../controllers/trendsController');
const { authenticateToken } = require('../middleware/auth');
const { checkPlanLimits } = require('../middleware/auth');
/* 
router.get('/', trendsController.getTrends);
router.get('/scan', trendsController.scanTrends);
router.get('/:id', trendsController.getTrendById);

module.exports = router; */

// ruta publica para obtener tendencias

router.get('/public', trendsController.getPublicTrends);

router.get('/public/:id', trendsController.getPublicTrendById);

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// Obtener todas las tendencias del usuario
router.get('/', trendsController.getUserTrends);

// Escanear nuevas tendencias para el usuario
router.get('/scan', checkPlanLimits('ai_credits'), trendsController.scanUserTrends);

// Obtener tendencias procesables del usuario
router.get('/processable', trendsController.getUserProcessableTrends);

// Obtener una tendencia específica del usuario
router.get('/:id', trendsController.getTrendById);

// Crear una tendencia manual
router.post('/', trendsController.createUserTrend);

// Actualizar una tendencia
router.put('/:id', trendsController.updateUserTrend);

// Eliminar una tendencia
router.delete('/:id', trendsController.deleteUserTrend);

// Procesar una tendencia específica en artículo
router.post('/:id/process', checkPlanLimits('articles'), checkPlanLimits('ai_credits'), trendsController.processTrendToArticle);

// Obtener estadísticas de tendencias del usuario
router.get('/stats/summary', trendsController.getUserTrendStats);

module.exports = router;