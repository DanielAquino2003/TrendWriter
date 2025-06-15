const cron = require('node-cron');
const TrendScanner = require('../src/services/TrendScanner');
const Trend = require('../src/models/Trend');

const trendScanner = new TrendScanner();

// Función para inicializar los cron jobs
function initCronJobs() {
  // SOLO escanear tendencias cada 1 minuto (NO generar artículos aquí)
  cron.schedule('*/1 * * * *', async () => {
    console.log('🔍 Escaneando tendencias...');
    
    try {
      const newTrends = await trendScanner.scanAllSources();
      console.log(`✅ ${newTrends.length} nuevas tendencias encontradas y guardadas`);
      
      // Solo mostrar estadísticas de los trends encontrados
      if (newTrends.length > 0) {
        const bestTrend = newTrends.reduce((best, current) => 
          current.viralScore > best.viralScore ? current : best
        );
        console.log(`🌟 Mejor trend de este escaneo: "${bestTrend.title}" (Viral: ${bestTrend.viralScore}, Score: ${bestTrend.score})`);
      }
      
    } catch (error) {
      console.error('❌ Error en escaneo de tendencias:', error);
    }
  });

  // Limpiar tendencias antiguas diariamente
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Limpiando tendencias antiguas...');
    
    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const result = await Trend.deleteMany({
        createdAt: { $lt: threeDaysAgo },
        processed: false
      });
      
      console.log(`✅ ${result.deletedCount} tendencias antiguas eliminadas`);
    } catch (error) {
      console.error('❌ Error limpiando tendencias:', error);
    }
  });

  // Mostrar estadísticas cada 10 minutos
  cron.schedule('*/10 * * * *', async () => {
    try {
      const totalTrends = await Trend.countDocuments();
      const pendingTrends = await Trend.countDocuments({ processed: false });
      const processedTrends = await Trend.countDocuments({ processed: true });
      
      console.log(`📊 Stats: ${totalTrends} total, ${pendingTrends} pendientes, ${processedTrends} procesadas`);
      
      // Mostrar el mejor trend disponible
      const bestTrend = await Trend.findOne({ processed: false })
        .sort({ viralScore: -1, score: -1 })
        .select('title viralScore score');
      
      if (bestTrend) {
        console.log(`🎯 Mejor trend disponible: "${bestTrend.title}" (Viral: ${bestTrend.viralScore}, Score: ${bestTrend.score})`);
      }
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
    }
  });
  
  console.log('📅 Cron jobs de TrendScanner iniciados:');
  console.log('   - 🔍 Escaneo: cada 1 minuto');
  console.log('   - 🧹 Limpieza: diario a las 2:00 AM');
  console.log('   - 📊 Estadísticas: cada 10 minutos');
}

// Exportar la función
module.exports = {
  initCronJobs,
  trendScanner
};