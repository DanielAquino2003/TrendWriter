const axios = require('axios');
const cheerio = require('cheerio');
const Trend = require('../models/Trend');

class TrendScanner {
  constructor() {
    this.sources = {
      techcrunch: 'https://techcrunch.com/feed/',
      hackernews: 'https://hn.algolia.com/api/v1/search?tags=front_page',
      reddit_technology: 'https://www.reddit.com/r/technology/hot.json',
      reddit_programming: 'https://www.reddit.com/r/programming/hot.json',
      reddit_webdev: 'https://www.reddit.com/r/webdev/hot.json',
      reddit_machinelearning: 'https://www.reddit.com/r/MachineLearning/hot.json',
      coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
      arstechnica: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
      devto: 'https://dev.to/api/articles?top=7'
    };

    // Keywords categorizadas por valor
    this.trendingKeywords = {
      highValue: {
        keywords: ['GPT', 'Claude', 'OpenAI', 'Anthropic', 'LLM', 'machine learning', 'neural network', 'ChatGPT', 'Gemini', 'diffusion', 'transformer'],
        boost: 100
      },
      mediumValue: {
        keywords: ['React', 'Next.js', 'TypeScript', 'Python', 'Rust', 'Go', 'Kubernetes', 'Docker', 'AWS', 'GCP', 'Azure', 'Vercel'],
        boost: 75
      },
      trending: {
        keywords: ['AI', 'crypto', 'blockchain', 'startup', 'YC', 'funding', 'Series A', 'IPO', 'acquisition', 'unicorn'],
        boost: 50
      },
      frameworks: {
        keywords: ['Vue', 'Angular', 'Django', 'FastAPI', 'Svelte', 'Tailwind', 'GraphQL', 'PostgreSQL', 'MongoDB'],
        boost: 25
      }
    };

    // Patrones de breaking news
    this.breakingPatterns = [
      'breaking:', 'just announced', 'launches', 'acquires', 'funding', 'shuts down',
      'raises $', 'million', 'billion', 'ipo', 'merger', 'leaked', 'revealed',
      'first look', 'exclusive', 'official'
    ];

    // Multiplicadores por fuente
    this.sourceMultipliers = {
      hackernews: 1.5,
      reddit_programming: 1.4,
      reddit_machinelearning: 1.3,
      reddit_webdev: 1.2,
      devto: 1.2,
      arstechnica: 1.1,
      techcrunch: 1.0,
      reddit_technology: 0.9,
      coindesk: 0.8
    };
  }

  async scanAllSources() {
    const results = [];

    for (const [source, url] of Object.entries(this.sources)) {
      try {
        console.log(`🔍 Escaneando ${source}...`);
        const trends = await this.scanSource(source, url);
        results.push(...trends);
      } catch (error) {
        console.error(`❌ Error escaneando ${source}:`, error.message);
      }
    }

    return this.saveTrends(results);
  }

  async scanSource(source, url) {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TrendScanner/1.0)'
      }
    });
    const trends = [];

    switch (source) {
      case 'hackernews':
        const hnData = response.data;
        hnData.hits.forEach(hit => {
          if (hit.title && hit.title.trim()) {
            trends.push({
              title: hit.title,
              source: 'hackernews',
              category: 'tech',
              rawScore: hit.points || 0,
              score: this.normalizeScore(hit.points || 0, 'hackernews'),
              url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
              createdAt: new Date(hit.created_at)
            });
          }
        });
        break;

      case 'reddit_technology':
      case 'reddit_programming':
      case 'reddit_webdev':
      case 'reddit_machinelearning':
        const redditData = response.data;
        if (redditData.data && redditData.data.children) {
          redditData.data.children.forEach(post => {
            if (post.data.title && post.data.title.trim()) {
              trends.push({
                title: post.data.title,
                source: source,
                category: 'tech',
                rawScore: post.data.score,
                score: this.normalizeScore(post.data.score, 'reddit'),
                url: post.data.url,
                createdAt: new Date(post.data.created * 1000)
              });
            }
          });
        }
        break;

      case 'devto':
        const devtoData = response.data;
        if (Array.isArray(devtoData)) {
          devtoData.forEach(article => {
            if (article.title && article.title.trim()) {
              trends.push({
                title: article.title,
                source: 'devto',
                category: 'tech',
                rawScore: article.public_reactions_count || 0,
                score: this.normalizeScore(article.public_reactions_count || 0, 'devto'),
                url: article.url,
                createdAt: new Date(article.published_at)
              });
            }
          });
        }
        break;

      case 'techcrunch':
      case 'arstechnica':
      case 'coindesk':
        // RSS feeds - usando cheerio para parsear XML
        const $ = cheerio.load(response.data, { xmlMode: true });
        $('item').each((i, item) => {
          const title = $(item).find('title').text().trim();
          const link = $(item).find('link').text().trim();
          const pubDate = $(item).find('pubDate').text().trim();
          
          if (title) {
            trends.push({
              title: title,
              source: source,
              category: 'tech',
              rawScore: 100, // Score base para RSS
              score: this.normalizeScore(100, source),
              url: link,
              createdAt: pubDate ? new Date(pubDate) : new Date()
            });
          }
        });
        break;
    }

    return trends;
  }

  // Función mejorada para normalizar scores
  normalizeScore(rawScore, source) {
    let normalizedScore = 0;

    switch (source) {
      case 'hackernews':
        // HN: scores típicos van de 0 a ~1000, algunos excepcionales hasta 3000+
        normalizedScore = Math.min(1000, Math.max(0, rawScore * 0.8));
        break;

      case 'reddit_technology':
      case 'reddit_programming':
      case 'reddit_webdev':
      case 'reddit_machinelearning':
        // Reddit: usar función logarítmica para comprimir valores altos
        if (rawScore <= 0) {
          normalizedScore = 0;
        } else {
          normalizedScore = Math.min(1000, Math.log(rawScore + 1) * 100);
        }
        break;

      case 'devto':
        // Dev.to: reactions son menores, usar multiplicador
        normalizedScore = Math.min(1000, Math.max(0, rawScore * 5));
        break;

      case 'techcrunch':
      case 'arstechnica':
      case 'coindesk':
        // RSS feeds: score base fijo
        normalizedScore = 100;
        break;

      default:
        normalizedScore = Math.min(1000, Math.max(0, rawScore));
    }

    return Math.round(normalizedScore);
  }

  async saveTrends(trends) {
    const saved = [];
    const MINIMUM_SCORE_THRESHOLD = 50; // Solo guardar trends con score > 50

    for (const trendData of trends) {
      try {
        // Calcular viral score ANTES de verificar threshold
        const viralScore = await this.calculateViralScore(trendData);
        
        // FILTRO DE CALIDAD: Solo guardar si supera el threshold
        if (viralScore <= MINIMUM_SCORE_THRESHOLD) {
          console.log(`❌ Trend descartado por score bajo: "${trendData.title}" (viral: ${viralScore})`);
          continue;
        }

        // Verificar duplicados más inteligente
        const existing = await Trend.findOne({
          $or: [
            { title: trendData.title, source: trendData.source },
            { title: { $regex: new RegExp(trendData.title.substring(0, 50), 'i') } }
          ]
        });

        if (!existing) {
          const trend = new Trend({
            ...trendData,
            viralScore: viralScore,
            qualityTier: this.getQualityTier(viralScore) // Añadir tier de calidad
          });
          
          await trend.save();
          saved.push(trend);
          console.log(`✅ Trend guardado: ${trend.title} (score: ${trend.score}, viral: ${trend.viralScore}, tier: ${trend.qualityTier})`);
        }
      } catch (error) {
        console.error('❌ Error guardando trend:', error.message);
      }
    }

    console.log(`📊 ${saved.length} nuevas tendencias de calidad encontradas y guardadas (filtro: >${MINIMUM_SCORE_THRESHOLD})`);
    
    if (saved.length > 0) {
      const bestTrend = saved.reduce((best, current) => 
        (current.viralScore || 0) > (best.viralScore || 0) ? current : best
      );
      console.log(`🌟 Mejor trend de este escaneo: "${bestTrend.title}" (Viral: ${bestTrend.viralScore}, Score: ${bestTrend.score})`);
    }

    return saved;
  }

  // Clasificar trends por tiers de calidad
  getQualityTier(viralScore) {
    if (viralScore >= 800) return 'premium'; // Trends excepcionales
    if (viralScore >= 600) return 'high';    // Trends de alta calidad
    if (viralScore >= 400) return 'medium';  // Trends buenos
    if (viralScore >= 200) return 'standard'; // Trends aceptables
    return 'low'; // Trends básicos (aunque ya filtrados por threshold)
  }

  async calculateViralScore(trendData) {
    let score = trendData.score; // Score ya normalizado

    // 1. Bonificación por keywords trending (mejorado)
    for (const [category, config] of Object.entries(this.trendingKeywords)) {
      for (const keyword of config.keywords) {
        if (trendData.title.toLowerCase().includes(keyword.toLowerCase())) {
          score += config.boost;
          // Solo una bonificación por categoría para evitar spam
          break;
        }
      }
    }

    // 2. Multiplicador por fuente (mejorado)
    const sourceMultiplier = this.sourceMultipliers[trendData.source] || 1.0;
    score *= sourceMultiplier;

    // 3. Boost por recency (nuevo)
    const ageInHours = (Date.now() - new Date(trendData.createdAt)) / (1000 * 60 * 60);
    const recencyBoost = Math.max(0, 100 - (ageInHours * 5)); // Decae 5 puntos por hora
    score += recencyBoost;

    // 4. Detección de breaking news (nuevo)
    const isBreaking = this.breakingPatterns.some(pattern => 
      trendData.title.toLowerCase().includes(pattern.toLowerCase())
    );
    if (isBreaking) {
      score *= 1.5;
      console.log(`🚨 Breaking news detected: ${trendData.title}`);
    }

    // 5. Boost por longitud del título (títulos más descriptivos suelen ser mejor)
    if (trendData.title.length > 50 && trendData.title.length < 100) {
      score += 25; // Sweet spot para títulos
    }

    // 6. Penalización por títulos clickbait
    const clickbaitPatterns = ['you won\'t believe', 'shocking', 'amazing', 'incredible'];
    const isClickbait = clickbaitPatterns.some(pattern => 
      trendData.title.toLowerCase().includes(pattern)
    );
    if (isClickbait) {
      score *= 0.7; // Penalizar clickbait
    }

    return Math.min(1000, Math.max(0, Math.round(score)));
  }

  // Método para obtener el mejor trend elegible para procesamiento
  async getBestTrendForProcessing() {
    const PROCESSING_THRESHOLD = 300; // Solo procesar trends con viralScore > 300
    
    const bestTrend = await Trend.findOne({
      processed: { $ne: true },
      viralScore: { $gt: PROCESSING_THRESHOLD },
      status: { $ne: 'error' }
    })
    .sort({ 
      viralScore: -1,  // Primero por viral score
      score: -1,       // Luego por score
      createdAt: -1    // Finalmente por fecha
    });

    if (bestTrend) {
      console.log(`🎯 Mejor trend elegible: "${bestTrend.title}" (Viral: ${bestTrend.viralScore}, Tier: ${bestTrend.qualityTier})`);
    } else {
      console.log(`❌ No hay trends elegibles para procesamiento (threshold: >${PROCESSING_THRESHOLD})`);
    }

    return bestTrend;
  }

  // Método para obtener estadísticas con filtros de calidad
  async getStats() {
    const total = await Trend.countDocuments();
    const processed = await Trend.countDocuments({ processed: true });
    const pending = total - processed;
    const errors = await Trend.countDocuments({ status: 'error' });
    
    // Estadísticas por tiers de calidad
    const premium = await Trend.countDocuments({ qualityTier: 'premium' });
    const high = await Trend.countDocuments({ qualityTier: 'high' });
    const medium = await Trend.countDocuments({ qualityTier: 'medium' });
    
    // Trends elegibles para procesamiento
    const eligibleForProcessing = await Trend.countDocuments({ 
      processed: { $ne: true },
      viralScore: { $gt: 300 },
      status: { $ne: 'error' }
    });

    return {
      total,
      processed,
      pending,
      errors,
      eligibleForProcessing,
      qualityTiers: {
        premium,
        high,
        medium
      },
      processingRate: total > 0 ? Math.round((processed / total) * 100) : 0
    };
  }
}

module.exports = TrendScanner;