const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Importar jobs
const trendScanner = require('./jobs/trendScanner');
const ArticleProcessor = require('./jobs/articleProcessor');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trendwriter')
  .then(() => {
    console.log('✅ MongoDB conectado');
    console.log('📊 Base de datos:', mongoose.connection.db.databaseName);
  })
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// Importar rutas
const trendsRoutes = require('./src/routes/trends');
const articlesRoutes = require('./src/routes/articles');

// Usar rutas
app.use('/api/trends', trendsRoutes);
app.use('/api/articles', articlesRoutes);

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Inicializar procesador de artículos
const articleProcessor = new ArticleProcessor();

// Rutas adicionales para control manual
app.post('/api/process-trends', async (req, res) => {
  try {
    console.log('🚀 Procesamiento manual iniciado desde API');
    // No esperar la respuesta para no bloquear la API
    articleProcessor.processPendingTrends().catch(console.error);
    res.json({ message: 'Procesamiento iniciado', timestamp: new Date() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/processing-stats', async (req, res) => {
  try {
    const stats = await articleProcessor.getProcessingStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/retry-failed', async (req, res) => {
  try {
    console.log('🔄 Reintento manual iniciado desde API');
    articleProcessor.retryFailedTrends().catch(console.error);
    res.json({ message: 'Reintento iniciado', timestamp: new Date() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  
  // Inicializar cron jobs
  console.log('📅 Iniciando cron jobs...');
  
  // Cron jobs originales del scanner
  trendScanner.initCronJobs();
  
  // Nuevos cron jobs del procesador
  articleProcessor.initCronJobs();
  
  console.log('✅ Todos los cron jobs iniciados');
  
  // Mostrar estadísticas iniciales
  setTimeout(() => {
    articleProcessor.getProcessingStats();
  }, 5000);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('🔄 Cerrando aplicación...');
  await mongoose.disconnect();
  console.log('✅ Aplicación cerrada correctamente');
  process.exit(0);
});