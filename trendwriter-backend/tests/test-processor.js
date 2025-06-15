const mongoose = require('mongoose');
const ArticleProcessor = require('./jobs/articleProcessor');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trendwriter');
  
  const processor = new ArticleProcessor();
  
  // Ver estadísticas
  await processor.getProcessingStats();
  
  // Procesar pendientes
  await processor.processPendingTrends();
  
  await mongoose.disconnect();
}

test().catch(console.error);