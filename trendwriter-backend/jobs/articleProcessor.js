const cron = require('node-cron');
const Trend = require('../src/models/Trend');
const Article = require('../src/models/Article');
const ContentGenerator = require('../src/services/ContentGenerator');

class ArticleProcessor {
  constructor() {
    this.contentGenerator = new ContentGenerator();
    this.isProcessing = false;
  }

  // MÉTODO PRINCIPAL: Procesar EL MEJOR trend cada 10 minutos
  async processBestTrend() {
    if (this.isProcessing) {
      console.log('⏳ Ya hay un proceso en curso, saltando...');
      return;
    }

    let trend = null;
    try {
      this.isProcessing = true;
      console.log('🌟 Buscando EL MEJOR trend para procesar...');

      // Buscar EL MEJOR trend no procesado
      trend = await Trend.findOne({
        processed: false,
        score: { $gt: 100 } // Score mínimo para considerar
      })
      .sort({ 
        viralScore: -1,    // Prioridad 1: Viral score más alto
        score: -1,         // Prioridad 2: Score más alto
        createdAt: -1      // Prioridad 3: Más reciente
      });

      if (!trend) {
        console.log('✅ No hay trends disponibles para procesar');
        return null;
      }

      console.log(`🎯 PROCESANDO EL MEJOR TREND:`);
      console.log(`   📰 Título: "${trend.title}"`);
      console.log(`   🔥 Viral Score: ${trend.viralScore}`);
      console.log(`   ⭐ Score: ${trend.score}`);
      console.log(`   📅 Creado: ${trend.createdAt}`);
      
      // Verificar si ya existe un artículo para esta tendencia
      const existingArticle = await Article.findOne({ trendId: trend._id });
      if (existingArticle) {
        console.log(`⚠️ Ya existe artículo para este trend, marcando como procesada...`);
        await this.markTrendAsProcessed(trend._id, existingArticle._id);
        return existingArticle;
      }

      // Generar el artículo
      console.log('📝 Generando artículo...');
      const article = await this.contentGenerator.generateArticleWithFallback(trend);
      
      // Calcular score SEO
      const seoScore = await this.contentGenerator.calculateSEOScore(article);
      article.seoScore = seoScore;

      // Guardar artículo en la base de datos
      const savedArticle = await this.saveArticle(article);
      
      // Marcar trend como procesado
      await this.markTrendAsProcessed(trend._id, savedArticle._id);

      console.log(`✅ ARTÍCULO GENERADO EXITOSAMENTE:`);
      console.log(`   📰 Título: "${article.title}"`);
      console.log(`   🎯 SEO Score: ${seoScore}`);
      console.log(`   🔗 ID: ${savedArticle._id}`);

      return savedArticle;

    } catch (error) {
      console.error(`❌ Error procesando el mejor trend:`, error.message);
      
      // Si había un trend siendo procesado, marcarlo con error
      if (trend) {
        await this.markTrendWithError(trend._id, error.message);
      }
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  // Método para procesar múltiples trends (solo para uso manual/administrativo)
  async processPendingTrends(limit = 5) {
    if (this.isProcessing) {
      console.log('⏳ Ya hay un proceso de generación en curso, saltando...');
      return;
    }

    try {
      this.isProcessing = true;
      console.log(`🚀 Procesamiento manual de hasta ${limit} trends...`);

      // Buscar trends no procesados
      const pendingTrends = await Trend.find({
        processed: false,              
        score: { $gt: 100 }        
      })
      .sort({ viralScore: -1, score: -1, createdAt: -1 })
      .limit(limit);

      console.log(`📊 Encontrados ${pendingTrends.length} trends pendientes`);

      if (pendingTrends.length === 0) {
        console.log('✅ No hay trends pendientes para procesar');
        return [];
      }

      const results = [];
      let processed = 0;
      let errors = 0;

      // Procesar cada trend
      for (const trend of pendingTrends) {
        try {
          console.log(`\n🔄 Procesando: "${trend.title}" (Score: ${trend.score}, Viral: ${trend.viralScore})`);
          
          // Verificar si ya existe un artículo
          const existingArticle = await Article.findOne({ trendId: trend._id });
          if (existingArticle) {
            console.log(`⚠️ Ya existe artículo, marcando como procesada...`);
            await this.markTrendAsProcessed(trend._id, existingArticle._id);
            results.push(existingArticle);
            continue;
          }

          // Generar artículo
          const article = await this.contentGenerator.generateArticleWithFallback(trend);
          const seoScore = await this.contentGenerator.calculateSEOScore(article);
          article.seoScore = seoScore;

          // Guardar artículo
          const savedArticle = await this.saveArticle(article);
          await this.markTrendAsProcessed(trend._id, savedArticle._id);

          results.push(savedArticle);
          processed++;
          console.log(`✅ Artículo generado: "${article.title}" (SEO Score: ${seoScore})`);

          // Pausa entre generaciones
          await this.delay(2000);

        } catch (error) {
          errors++;
          console.error(`❌ Error procesando "${trend.title}":`, error.message);
          await this.markTrendWithError(trend._id, error.message);
        }
      }

      console.log(`\n📈 Resumen del procesamiento manual:`);
      console.log(`✅ Procesados exitosamente: ${processed}`);
      console.log(`❌ Errores: ${errors}`);
      console.log(`📊 Total: ${pendingTrends.length}`);

      return results;

    } catch (error) {
      console.error('❌ Error en el procesamiento manual:', error);
      return [];
    } finally {
      this.isProcessing = false;
    }
  }

  // Guardar artículo en la base de datos
  async saveArticle(articleData) {
    const article = new Article({
      ...articleData,
      status: 'published',
      publishedAt: new Date()
    });

    return await article.save();
  }

  // Marcar trend como procesado
  async markTrendAsProcessed(trendId, articleId = null) {
    try {
      const updateData = {
        processed: true,
        processedAt: new Date()
      };

      if (articleId) {
        updateData.articleId = articleId;
      }

      // Limpiar errores si existen
      updateData.processingError = undefined;
      updateData.lastErrorAt = undefined;
      updateData.errorCount = 0;

      const result = await Trend.findByIdAndUpdate(
        trendId, 
        updateData,
        { new: true, runValidators: true }
      );

      if (!result) {
        throw new Error(`No se encontró el trend con ID: ${trendId}`);
      }

      console.log(`✅ Trend marcado como procesado: "${result.title}"`);
      return result;

    } catch (error) {
      console.error(`❌ Error marcando trend como procesado:`, error);
      throw error;
    }
  }

  // Marcar trend con error
  async markTrendWithError(trendId, errorMessage) {
    try {
      const result = await Trend.findByIdAndUpdate(
        trendId, 
        {
          processingError: errorMessage,
          lastErrorAt: new Date(),
          $inc: { errorCount: 1 }
        },
        { new: true, runValidators: true }
      );

      if (!result) {
        throw new Error(`No se encontró el trend con ID: ${trendId}`);
      }

      console.log(`⚠️ Trend marcado con error: "${result.title}" (Errores: ${result.errorCount})`);
      return result;

    } catch (error) {
      console.error(`❌ Error marcando trend con error:`, error);
      throw error;
    }
  }

  // Método para procesar un trend específico
  async processSpecificTrend(trendId) {
    try {
      const trend = await Trend.findById(trendId);
      if (!trend) {
        throw new Error('Trend no encontrado');
      }

      if (trend.processed) {
        console.log('⚠️ Este trend ya fue procesado');
        return null;
      }

      console.log(`🔄 Procesando trend específico: "${trend.title}"`);

      const article = await this.contentGenerator.generateArticleWithFallback(trend);
      const seoScore = await this.contentGenerator.calculateSEOScore(article);
      article.seoScore = seoScore;

      const savedArticle = await this.saveArticle(article);
      await this.markTrendAsProcessed(trend._id, savedArticle._id);

      console.log(`✅ Artículo generado: "${article.title}" (SEO Score: ${seoScore})`);
      return savedArticle;

    } catch (error) {
      console.error('❌ Error procesando trend específico:', error);
      throw error;
    }
  }

  // Estadísticas del procesamiento
  async getProcessingStats() {
    try {
      const totalTrends = await Trend.countDocuments();
      const processedTrends = await Trend.countDocuments({ processed: true });
      const pendingTrends = await Trend.countDocuments({ processed: false });
      const failedTrends = await Trend.countDocuments({ processingError: { $exists: true } });
      
      // Estadísticas por score
      const highScoreTrends = await Trend.countDocuments({ 
        processed: false, 
        viralScore: { $gt: 400 } 
      });
      const totalArticles = await Article.countDocuments();
      
      // Mejor trend disponible
      const bestTrend = await Trend.findOne({ processed: false })
        .sort({ viralScore: -1, score: -1 })
        .select('title viralScore score createdAt');
      
      const stats = {
        totalTrends,
        processedTrends,
        pendingTrends,
        failedTrends,
        highScoreTrends,
        totalArticles,
        processingRate: totalTrends > 0 ? ((processedTrends / totalTrends) * 100).toFixed(2) : 0,
        bestTrend: bestTrend ? {
          title: bestTrend.title,
          viralScore: bestTrend.viralScore,
          score: bestTrend.score,
          createdAt: bestTrend.createdAt
        } : null,
        timestamp: new Date()
      };
      
      console.log('📊 ESTADÍSTICAS DE PROCESAMIENTO:');
      console.log(`   📈 Total trends: ${stats.totalTrends}`);
      console.log(`   ✅ Procesados: ${stats.processedTrends}`);
      console.log(`   ⏳ Pendientes: ${stats.pendingTrends}`);
      console.log(`   ❌ Con errores: ${stats.failedTrends}`);
      console.log(`   🔥 Premium pendientes (>400 viral): ${stats.highScoreTrends}`);
      console.log(`   📰 Artículos generados: ${stats.totalArticles}`);
      console.log(`   📊 Tasa de procesamiento: ${stats.processingRate}%`);
      
      if (stats.bestTrend) {
        console.log(`   🎯 SIGUIENTE MEJOR TREND:`);
        console.log(`      📰 "${stats.bestTrend.title}"`);
        console.log(`      🔥 Viral: ${stats.bestTrend.viralScore}`);
        console.log(`      ⭐ Score: ${stats.bestTrend.score}`);
      }
      
      return stats;
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return { error: error.message, timestamp: new Date() };
    }
  }

  // Método utilitario para pausas
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // INICIALIZAR CRON JOBS - SOLO EL MEJOR TREND CADA 10 MINUTOS
  initCronJobs() {
    // ⭐ PRINCIPAL: Procesar EL MEJOR trend cada 10 minutos
    cron.schedule('*/2 * * * *', () => {
      console.log('\n⏰ CRON: Procesando EL MEJOR trend disponible...');
      this.processBestTrend().catch(error => {
        console.error('❌ Error en cron de mejor trend:', error.message);
      });
    });

    // Mostrar estadísticas cada 30 minutos
    cron.schedule('*/30 * * * *', () => {
      console.log('\n⏰ CRON: Mostrando estadísticas...');
      this.getProcessingStats().catch(error => {
        console.error('❌ Error en cron de estadísticas:', error.message);
      });
    });

    console.log('📅 Cron jobs del ArticleProcessor iniciados:');
    console.log('   🎯 MEJOR trend: cada 10 minutos');
    console.log('   📊 Estadísticas: cada 30 minutos');
    console.log('');
    console.log('🎯 ESTRATEGIA: Solo se procesa EL MEJOR trend cada 10 minutos');
    console.log('   - Se elige por: viralScore > score > fecha');
    console.log('   - Se marca como procesado inmediatamente');
    console.log('   - No hay procesamiento simultáneo');
  }
}

module.exports = ArticleProcessor;