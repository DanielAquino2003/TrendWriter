const axios = require('axios');
const cheerio = require('cheerio');
const he = require('he');
const Trend = require('../models/Trend');

class TrendScanner {
  constructor() {
    this.sources = {
      techcrunch: 'https://techcrunch.com/feed/',
      hackernews: 'https://hn.algolia.com/api/v1/search?tags=front_page',
      reddit_technology: 'https://www.reddit.com/r/technology/hot.json',
      reddit_programming: 'https://www.reddit.com/r/programming/hot.json',
      reddit_machinelearning: 'https://www.reddit.com/r/MachineLearning/hot.json',
      reddit_futurology: 'https://www.reddit.com/r/Futurology/hot.json',
      arstechnica: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
      devto: 'https://dev.to/api/articles?top=7',
      wired: 'https://www.wired.com/feed/rss',
      theverge: 'https://www.theverge.com/rss/index.xml',
      medium_tech: 'https://medium.com/feed/tag/technology'
    };

    this.trendingKeywords = {
      highValue: {
        keywords: ['AI', 'machine learning', 'neural network', 'LLM', 'quantum computing', 'generative AI', 'autonomous vehicles'],
        boost: 100
      },
      mediumValue: {
        keywords: ['Python', 'Rust', 'TypeScript', 'Kubernetes', 'cloud computing', 'cybersecurity', 'Web3'],
        boost: 75
      },
      trending: {
        keywords: ['blockchain', 'startup', 'funding', 'sustainability tech', 'AR/VR', 'metaverse', '5G'],
        boost: 50
      },
      frameworks: {
        keywords: ['React', 'Next.js', 'Svelte', 'Tailwind', 'GraphQL', 'FastAPI', 'Django'],
        boost: 25
      }
    };

    this.breakingPatterns = [
      'breaking:', 'just announced', 'launches', 'acquires', 'funding', 'shuts down',
      'raises $', 'million', 'billion', 'ipo', 'merger', 'leaked', 'revealed',
      'first look', 'exclusive', 'official', 'unveiled'
    ];

    this.sourceMultipliers = {
      hackernews: 1.5,
      wired: 1.4,
      theverge: 1.4,
      reddit_programming: 1.3,
      reddit_machinelearning: 1.3,
      reddit_futurology: 1.2,
      devto: 1.2,
      arstechnica: 1.1,
      techcrunch: 1.0,
      reddit_technology: 0.8,
      medium_tech: 1.0
    };
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  calculateSimilarity(title1, title2) {
    const normalized1 = this.normalizeTitle(title1);
    const normalized2 = this.normalizeTitle(title2);
    
    const words1 = normalized1.split(' ').filter(word => word.length > 2);
    const words2 = normalized2.split(' ').filter(word => word.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  sanitizeTitle(title) {
    if (!title) return '';
    
    let sanitized = he.decode(title);
    
    sanitized = sanitized
      .replace(/[\r\n\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return sanitized;
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
      },
      timeout: 10000
    });
    const trends = [];

    switch (source) {
      case 'hackernews':
        const hnData = response.data;
        if (hnData.hits) {
          hnData.hits.forEach(hit => {
            const title = this.sanitizeTitle(hit.title);
            if (title && title.length > 10) {
              trends.push({
                title: title,
                source: 'hackernews',
                category: 'tech',
                rawScore: hit.points || 0,
                score: this.normalizeScore(hit.points || 0, 'hackernews'),
                url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
                createdAt: new Date(hit.created_at)
              });
            }
          });
        }
        break;

      case 'reddit_technology':
      case 'reddit_programming':
      case 'reddit_machinelearning':
      case 'reddit_futurology':
        const redditData = response.data;
        if (redditData.data && redditData.data.children) {
          redditData.data.children.forEach(post => {
            const title = this.sanitizeTitle(post.data.title);
            if (title && title.length > 10) {
              trends.push({
                title: title,
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
            const title = this.sanitizeTitle(article.title);
            if (title && title.length > 10) {
              trends.push({
                title: title,
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
      case 'wired':
      case 'theverge':
      case 'medium_tech':
        const $ = cheerio.load(response.data, { xmlMode: true });
        $('item').each((i, item) => {
          const title = this.sanitizeTitle($(item).find('title').text());
          const link = $(item).find('link').text().trim();
          const pubDate = $(item).find('pubDate').text().trim();
          
          if (title && title.length > 10) {
            trends.push({
              title: title,
              source: source,
              category: 'tech',
              rawScore: 100,
              score: this.normalizeScore(100, source),
              url: link,
              createdAt: pubDate ? new Date(pubDate) : new Date()
            });
          }
        });
        break;
    }

    console.log(`📊 ${source}: ${trends.length} trends extraídos`);
    return trends;
  }

  normalizeScore(rawScore, source) {
    let normalizedScore = 0;

    switch (source) {
      case 'hackernews':
        normalizedScore = Math.min(1000, Math.max(0, rawScore * 0.8));
        break;

      case 'reddit_technology':
      case 'reddit_programming':
      case 'reddit_machinelearning':
      case 'reddit_futurology':
        if (rawScore <= 0) {
          normalizedScore = 0;
        } else {
          normalizedScore = Math.min(1000, Math.log(rawScore + 1) * 100);
        }
        break;

      case 'devto':
        normalizedScore = Math.min(1000, Math.max(0, rawScore * 5));
        break;

      case 'techcrunch':
      case 'arstechnica':
      case 'wired':
      case 'theverge':
      case 'medium_tech':
        normalizedScore = 100;
        break;

      default:
        normalizedScore = Math.min(1000, Math.max(0, rawScore));
    }

    return Math.round(normalizedScore);
  }

  async saveTrends(trends) {
    const saved = [];
    const MINIMUM_SCORE_THRESHOLD = 35;
    const SIMILARITY_THRESHOLD = 0.75;

    console.log(`🔄 Procesando ${trends.length} trends candidatos...`);

    for (const trendData of trends) {
      try {
        if (!trendData.title || trendData.title.length < 10) {
          continue;
        }

        const viralScore = await this.calculateViralScore(trendData);
        
        if (viralScore <= MINIMUM_SCORE_THRESHOLD) {
          console.log(`❌ Trend descartado por score bajo: "${trendData.title}" (viral: ${viralScore})`);
          continue;
        }

        let existing = await Trend.findOne({
          title: trendData.title,
          source: trendData.source
        });

        if (!existing) {
          const recentTrends = await Trend.find({
            createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
          }).select('title source').limit(100);

          for (const recentTrend of recentTrends) {
            const similarity = this.calculateSimilarity(trendData.title, recentTrend.title);
            if (similarity > SIMILARITY_THRESHOLD) {
              existing = recentTrend;
              console.log(`🔄 Trend similar encontrado: "${trendData.title.substring(0, 50)}..." vs "${recentTrend.title.substring(0, 50)}..." (similitud: ${Math.round(similarity * 100)}%)`);
              break;
            }
          }
        }

        if (!existing) {
          const trend = new Trend({
            ...trendData,
            viralScore: viralScore,
            qualityTier: this.getQualityTier(viralScore)
          });
          
          await trend.save();
          saved.push(trend);
          console.log(`✅ Trend guardado: "${trend.title.substring(0, 60)}..." (score: ${trend.score}, viral: ${trend.viralScore}, tier: ${trend.qualityTier})`);
        } else {
          console.log(`🔄 Trend duplicado ignorado: "${trendData.title.substring(0, 50)}..."`);
        }
      } catch (error) {
        console.error(`❌ Error guardando trend "${trendData.title?.substring(0, 50)}...":`, error.message);
      }
    }

    console.log(`📊 Resumen: ${saved.length} nuevas tendencias de calidad encontradas y guardadas de ${trends.length} candidatos (filtro: >${MINIMUM_SCORE_THRESHOLD})`);
    
    if (saved.length > 0) {
      const bestTrend = saved.reduce((best, current) => 
        (current.viralScore || 0) > (best.viralScore || 0) ? current : best
      );
      console.log(`🌟 Mejor trend de este escaneo: "${bestTrend.title.substring(0, 80)}..." (Viral: ${bestTrend.viralScore}, Score: ${bestTrend.score})`);
      
      const tierCounts = saved.reduce((acc, trend) => {
        acc[trend.qualityTier] = (acc[trend.qualityTier] || 0) + 1;
        return acc;
      }, {});
      console.log('📈 Distribución por calidad:', tierCounts);
    }

    return saved;
  }

  getQualityTier(viralScore) {
    if (viralScore >= 800) return 'premium';
    if (viralScore >= 600) return 'high';
    if (viralScore >= 400) return 'medium';
    if (viralScore >= 200) return 'standard';
    return 'low';
  }

  async calculateViralScore(trendData) {
    let score = trendData.score;

    let keywordBonus = 0;
    for (const [category, config] of Object.entries(this.trendingKeywords)) {
      for (const keyword of config.keywords) {
        if (trendData.title.toLowerCase().includes(keyword.toLowerCase())) {
          keywordBonus = Math.max(keywordBonus, config.boost);
          break;
        }
      }
    }
    score += keywordBonus;

    const sourceMultiplier = this.sourceMultipliers[trendData.source] || 1.0;
    score *= sourceMultiplier;

    const ageInHours = (Date.now() - new Date(trendData.createdAt)) / (1000 * 60 * 60);
    const recencyBoost = Math.max(0, 50 - (ageInHours * 2));
    score += recencyBoost;

    const isBreaking = this.breakingPatterns.some(pattern => 
      trendData.title.toLowerCase().includes(pattern.toLowerCase())
    );
    if (isBreaking) {
      score *= 1.3;
      console.log(`🚨 Breaking news detected: ${trendData.title.substring(0, 60)}...`);
    }

    if (trendData.title.length > 40 && trendData.title.length < 120) {
      score += 15;
    }

    const clickbaitPatterns = ['you won\'t believe', 'shocking', 'amazing', 'incredible', 'must see'];
    const isClickbait = clickbaitPatterns.some(pattern => 
      trendData.title.toLowerCase().includes(pattern)
    );
    if (isClickbait) {
      score *= 0.7;
    }

    if (trendData.title.includes('?')) {
      score += 10;
    }

    return Math.min(1000, Math.max(0, Math.round(score)));
  }

  async getBestTrendForProcessing() {
    const PROCESSING_THRESHOLD = 250;
    
    const bestTrend = await Trend.findOne({
      processed: { $ne: true },
      viralScore: { $gt: PROCESSING_THRESHOLD },
      status: { $ne: 'error' }
    })
    .sort({ 
      viralScore: -1,
      score: -1,
      createdAt: -1
    });

    if (bestTrend) {
      console.log(`🎯 Mejor trend elegible: "${bestTrend.title.substring(0, 60)}..." (Viral: ${bestTrend.viralScore}, Tier: ${bestTrend.qualityTier})`);
    } else {
      console.log(`❌ No hay trends elegibles para procesamiento (threshold: >${PROCESSING_THRESHOLD})`);
    }

    return bestTrend;
  }

  async getStats() {
    const total = await Trend.countDocuments();
    const processed = await Trend.countDocuments({ processed: true });
    const pending = total - processed;
    const errors = await Trend.countDocuments({ status: 'error' });
    
    const premium = await Trend.countDocuments({ qualityTier: 'premium' });
    const high = await Trend.countDocuments({ qualityTier: 'high' });
    const medium = await Trend.countDocuments({ qualityTier: 'medium' });
    const standard = await Trend.countDocuments({ qualityTier: 'standard' });
    const low = await Trend.countDocuments({ qualityTier: 'low' });
    
    const eligibleForProcessing = await Trend.countDocuments({ 
      processed: { $ne: true },
      viralScore: { $gt: 250 },
      status: { $ne: 'error' }
    });

    const sourceStats = {};
    for (const source of Object.keys(this.sources)) {
      sourceStats[source] = await Trend.countDocuments({ source });
    }

    return {
      total,
      processed,
      pending,
      errors,
      eligibleForProcessing,
      qualityTiers: {
        premium,
        high,
        medium,
        standard,
        low
      },
      sourceDistribution: sourceStats,
      processingRate: total > 0 ? Math.round((processed / total) * 100) : 0,
      qualityRate: total > 0 ? Math.round(((premium + high + medium) / total) * 100) : 0
    };
  }

  async cleanupOldTrends(daysOld = 30) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const result = await Trend.deleteMany({
      createdAt: { $lt: cutoffDate },
      processed: true,
      qualityTier: { $in: ['low', 'standard'] }
    });

    console.log(`🧹 Limpieza completada: ${result.deletedCount} trends antiguos eliminados`);
    return result.deletedCount;
  }
}

module.exports = TrendScanner;