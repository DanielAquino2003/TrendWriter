const express = require('express');
const router = express.Router();
const trendsController = require('../controllers/trendsController');

router.get('/', trendsController.getTrends);
router.get('/scan', trendsController.scanTrends);
router.get('/:id', trendsController.getTrendById);

module.exports = router;