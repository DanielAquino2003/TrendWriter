const Groq = require('groq-sdk');
const Article = require('../models/Articles');

class ContentGenerator {
  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
    
    // Modelos actuales disponibles en Groq (2025)
    this.models = [
      "llama-3.3-70b-versatile",      // Modelo principal recomendado
      "llama-3.1-8b-instant",        // Más rápido, disponible
      "gemma2-9b-it",                // Alternativa de Google
      "llama3-70b-8192",             // Modelo clásico disponible
      "llama3-8b-8192"               // Modelo rápido disponible
    ];
    
    this.currentModelIndex = 0;
    this.model = this.models[this.currentModelIndex];
  }

  async generateArticle(trend) {
    try {
      const prompt = this.buildPrompt(trend);
      
      console.log(`🤖 Generando artículo con modelo: ${this.model}`);
      
      const response = await this.groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "Eres un experto redactor de contenido SEO especializado en tecnología y economía. Creas artículos optimizados para Google AdSense en español."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: this.model,
        max_tokens: 2048,
        temperature: 0.7,
        top_p: 0.9,
      });

      const content = response.choices[0].message.content;
      return this.parseGeneratedContent(content, trend);
      
    } catch (error) {
      console.error(`Error generando artículo con Groq (${this.model}):`, error.message);
      throw error;
    }
  }

  buildPrompt(trend) {
    return `
Crea un artículo SEO optimizado en español basado en esta tendencia:

Título: ${trend.title}
Categoría: ${trend.category}
Fuente: ${trend.source}
${trend.description ? `Descripción: ${trend.description}` : ''}

Requisitos específicos:
1. Título SEO optimizado (máximo 60 caracteres)
2. Meta description atractiva (entre 120-160 caracteres)
3. Contenido de 800-1200 palabras bien estructurado
4. Usar encabezados H2 y H3 (formato ## y ###)
5. Keywords naturales relacionadas con la tendencia
6. Párrafos cortos y legibles (máximo 3-4 líneas)
7. Incluir llamadas a la acción
8. Lenguaje natural y engaging
9. Optimizado para monetización con AdSense
10. Contenido original y de calidad

Formato de respuesta EXACTO:
TÍTULO: [título optimizado aquí]
META: [meta description aquí]
KEYWORDS: [keyword1, keyword2, keyword3, keyword4, keyword5]
CONTENIDO: 
[artículo completo con estructura de encabezados ## y ###]

IMPORTANTE: Mantén el formato exacto para que el parser funcione correctamente. El contenido debe ser sustancial y completo.
    `;
  }

  parseGeneratedContent(content, trend) {
    try {
      const lines = content.split('\n');
      const article = {
        title: '',
        metaDescription: '',
        keywords: [],
        content: '',
        trendId: trend._id,
        category: trend.category,
        status: 'draft',
        createdAt: new Date()
      };

      let currentSection = '';
      let contentLines = [];

      lines.forEach(line => {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('TÍTULO:')) {
          article.title = trimmedLine.replace('TÍTULO:', '').trim();
        } else if (trimmedLine.startsWith('META:')) {
          article.metaDescription = trimmedLine.replace('META:', '').trim();
        } else if (trimmedLine.startsWith('KEYWORDS:')) {
          const keywordsString = trimmedLine.replace('KEYWORDS:', '').trim();
          article.keywords = keywordsString.split(',').map(k => k.trim()).filter(k => k.length > 0);
        } else if (trimmedLine.startsWith('CONTENIDO:')) {
          currentSection = 'content';
        } else if (currentSection === 'content' && trimmedLine) {
          contentLines.push(line);
        }
      });

      article.content = contentLines.join('\n').trim();
      article.slug = this.generateSlug(article.title);
      
      // Validar que el artículo tenga contenido mínimo
      if (!article.title || article.title.length < 10) {
        throw new Error('Título del artículo muy corto o vacío');
      }
      
      if (!article.content || article.content.length < 500) {
        throw new Error('Artículo generado incompleto o muy corto');
      }
      
      if (!article.metaDescription || article.metaDescription.length < 100) {
        throw new Error('Meta descripción muy corta o vacía');
      }
      
      console.log(`✅ Artículo generado exitosamente: "${article.title}" (${article.content.length} caracteres)`);
      
      return article;
      
    } catch (error) {
      console.error('Error parseando contenido generado:', error.message);
      throw new Error(`Error al parsear el contenido generado: ${error.message}`);
    }
  }

  generateSlug(title) {
    if (!title) return 'articulo-sin-titulo';
    
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  async calculateSEOScore(article) {
    let score = 0;
    const maxScore = 100;
    
    // Título SEO (20 puntos)
    if (article.title && article.title.length >= 30 && article.title.length <= 60) {
      score += 20;
    } else if (article.title && article.title.length >= 20 && article.title.length <= 70) {
      score += 10;
    }
    
    // Meta description (15 puntos)
    if (article.metaDescription && article.metaDescription.length >= 120 && article.metaDescription.length <= 160) {
      score += 15;
    } else if (article.metaDescription && article.metaDescription.length >= 100 && article.metaDescription.length <= 180) {
      score += 8;
    }
    
    // Longitud del contenido (25 puntos)
    if (article.content && article.content.length >= 800 && article.content.length <= 1500) {
      score += 25;
    } else if (article.content && article.content.length >= 600) {
      score += 15;
    }
    
    // Densidad de keywords (20 puntos)
    if (article.keywords && article.keywords.length > 0) {
      const keywordDensity = this.calculateKeywordDensity(article.content, article.keywords);
      if (keywordDensity >= 1 && keywordDensity <= 3) {
        score += 20;
      } else if (keywordDensity >= 0.5 && keywordDensity <= 4) {
        score += 10;
      }
    }
    
    // Estructura con encabezados (10 puntos)
    if (article.content) {
      const hasH2 = article.content.includes('## ');
      const hasH3 = article.content.includes('### ');
      if (hasH2 && hasH3) score += 10;
      else if (hasH2 || hasH3) score += 5;
    }
    
    // Párrafos bien estructurados (10 puntos)
    if (article.content) {
      const paragraphs = article.content.split('\n\n').filter(p => p.trim().length > 0);
      if (paragraphs.length >= 5) score += 10;
      else if (paragraphs.length >= 3) score += 5;
    }
    
    return Math.min(maxScore, score);
  }

  calculateKeywordDensity(content, keywords) {
    if (!keywords || keywords.length === 0 || !content) return 0;
    
    const wordCount = content.split(/\s+/).length;
    let keywordCount = 0;
    
    keywords.forEach(keyword => {
      if (keyword && keyword.trim()) {
        const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = content.match(regex);
        if (matches) keywordCount += matches.length;
      }
    });
    
    return wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;
  }

  // Método mejorado para retry con diferentes modelos disponibles
  async generateArticleWithFallback(trend) {
    let lastError = null;
    
    // Intentar con todos los modelos disponibles
    for (let i = 0; i < this.models.length; i++) {
      try {
        this.model = this.models[i];
        this.currentModelIndex = i;
        console.log(`🔄 Intentando con modelo: ${this.model} (${i + 1}/${this.models.length})`);
        
        const article = await this.generateArticle(trend);
        console.log(`✅ Éxito con modelo: ${this.model}`);
        return article;
        
      } catch (error) {
        lastError = error;
        console.log(`❌ Error con ${this.model}: ${error.message}`);
        
        // Si es un error de modelo no disponible, continuar con el siguiente
        if (error.message && (
          error.message.includes('decommissioned') || 
          error.message.includes('not found') ||
          error.message.includes('invalid_request_error')
        )) {
          continue;
        }
        
        // Si es otro tipo de error y no es el último modelo, continuar
        if (i < this.models.length - 1) {
          continue;
        }
      }
    }
    
    // Si llegamos aquí, todos los modelos fallaron
    console.error('❌ Todos los modelos fallaron. Último error:', lastError?.message);
    throw new Error(`Error al generar artículo con todos los modelos disponibles. Último error: ${lastError?.message || 'Error desconocido'}`);
  }

  // Método para obtener información de los modelos disponibles
  getAvailableModels() {
    return this.models.map((model, index) => ({
      id: model,
      index: index,
      isCurrent: index === this.currentModelIndex,
      status: 'available'
    }));
  }

  // Método para cambiar modelo manualmente
  switchModel(modelId) {
    const modelIndex = this.models.indexOf(modelId);
    if (modelIndex !== -1) {
      this.model = modelId;
      this.currentModelIndex = modelIndex;
      console.log(`🔄 Modelo cambiado a: ${this.model}`);
      return true;
    }
    console.error(`❌ Modelo no encontrado: ${modelId}`);
    return false;
  }
}

module.exports = ContentGenerator;