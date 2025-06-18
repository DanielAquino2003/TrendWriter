const Groq = require('groq-sdk');
const Article = require('../models/Article');

class ContentGenerator {
  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
    
    this.models = [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "gemma2-9b-it",
      "llama3-70b-8192",
      "llama3-8b-8192"
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
            content: "Eres un redactor experto en tecnología, especializado en crear contenido SEO atractivo, práctico y optimizado para Google AdSense en español. Usas un tono conversacional, pero autoritativo, como si explicaras a un amigo curioso."
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
Crea un artículo SEO optimizado en español basado en esta tendencia tecnológica:

Título: ${trend.title}
Categoría: ${trend.category}
Fuente: ${trend.source}
${trend.description ? `Descripción: ${trend.description}` : ''}

Requisitos específicos:
1. **Título**: Crea un título atractivo y SEO optimizado (50-60 caracteres) usando una palabra clave de cola larga. Incluye un gancho emocional o práctico (p. ej., "Guía práctica", "¿Qué debes saber?"). Asegúrate de que el título sea claro y no esté vacío.
2. **Meta descripción**: Escribe una meta descripción atractiva (140-160 caracteres) con la palabra clave principal y un gancho para incentivar clics. No dejes este campo vacío.
3. **Contenido**: Genera un artículo de 800-1200 palabras, estructurado con:
   - **Introducción (100-150 palabras)**: Comienza con una pregunta impactante, estadística o anécdota. Explica la tendencia en términos simples, su relevancia para el lector (p. ej., "Cómo afecta a tu negocio") y promete valor (p. ej., "Te contamos cómo aprovecharla").
   - **Cuerpo (600-900 palabras)**: Usa 3-5 encabezados H2 con palabras clave secundarias. Incluye:
     - Explicación clara de la tendencia (p. ej., "¿Qué es [tendencia]?").
     - Soluciones prácticas o casos de uso (p. ej., "Cómo las pymes pueden usar [tendencia]"). Si es posible, añade un enfoque local para hispanohablantes (p. ej., "Impacto en Latam").
     - Ejemplo o escenario hipotético (p. ej., "Imagina un banco usando [tendencia] para X").
     - Lista numerada o viñetas para facilitar lectura (p. ej., "5 formas de aplicar [tendencia]").
     - 1-2 enlaces internos a artículos relacionados y 1-2 externos a sitios de autoridad (p. ej., Wired, TechCrunch).
   - **Conclusión (100-150 palabras)**: Resume puntos clave, refuerza la importancia de la tendencia e incluye una llamada a la acción (p. ej., "Suscríbete para más guías tech"). Termina con una pregunta para fomentar comentarios.
4. **SEO**:
   - Usa la palabra clave principal 3-5 veces de forma natural.
   - Incluye 2-3 palabras clave de cola larga relacionadas.
   - Asegura legibilidad (párrafos de 2-3 frases, puntaje Flesch-Kincaid 60-70).
5. **Tono y estilo**:
   - Conversacional, pero autoritativo, con toques de storytelling.
   - Evita frases genéricas (p. ej., "cambiará el mundo"). Usa lenguaje vívido (p. ej., "desbloquea posibilidades revolucionarias").
6. **Originalidad**:
   - No copies contenido existente. Ofrece una perspectiva única (p. ej., implicaciones éticas, aplicaciones locales, predicciones).
7. **Formato de respuesta EXACTO**:
TÍTULO: [título optimizado]
META: [meta descripción]
KEYWORDS: [keyword1, keyword2, keyword3, keyword4, keyword5]
CONTENIDO:
[artículo completo en markdown con ## y ###]

IMPORTANTE: Mantén el formato exacto para el parser. Asegúrate de que el título, meta descripción y contenido no estén vacíos. El contenido debe ser completo, útil y optimizado para retención y monetización con AdSense. Si el modelo no puede generar el contenido completo debido a límites de tokens, indica claramente que el artículo está incompleto y sugiere usar un modelo con mayor capacidad.
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
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  async calculateSEOScore(article) {
    let score = 0;
    
    // Título SEO (30 puntos)
    if (article.title && article.title.length >= 30 && article.title.length <= 60) {
      score += 30;
    } else if (article.title && article.title.length >= 20 && article.title.length <= 70) {
      score += 15;
    }
    
    // Meta descripción (20 puntos)
    if (article.metaDescription && article.metaDescription.length >= 120 && article.metaDescription.length <= 160) {
      score += 20;
    } else if (article.metaDescription && article.metaDescription.length >= 100 && article.metaDescription.length <= 180) {
      score += 10;
    }
    
    // Longitud del contenido (30 puntos)
    if (article.content && article.content.length >= 1000 && article.content.length <= 1500) {
      score += 30;
    } else if (article.content && article.content.length >= 800 && article.content.length <= 2000) {
      score += 20;
    } else if (article.content && article.content.length >= 600) {
      score += 10;
    }
    
    // Densidad de keywords (25 puntos)
    if (article.keywords && article.keywords.length > 0) {
      const keywordDensity = this.calculateKeywordDensity(article.content, article.keywords);
      if (keywordDensity >= 1 && keywordDensity <= 3) {
        score += 25;
      } else if (keywordDensity >= 0.5 && keywordDensity <= 4) {
        score += 15;
      }
    }
    
    // Estructura con encabezados (15 puntos)
    if (article.content) {
      const hasH2 = article.content.includes('## ');
      const hasH3 = article.content.includes('### ');
      if (hasH2 && hasH3) score += 15;
      else if (hasH2 || hasH3) score += 8;
    }
    
    // Párrafos bien estructurados (15 puntos)
    if (article.content) {
      const paragraphs = article.content.split('\n\n').filter(p => p.trim().length > 0);
      if (paragraphs.length >= 8) score += 15;
      else if (paragraphs.length >= 5) score += 10;
      else if (paragraphs.length >= 3) score += 5;
    }
    
    // Enlaces internos/externos (10 puntos)
    if (article.content) {
      const hasInternalLinks = article.content.includes('(https://tudominio.com');
      const hasExternalLinks = article.content.match(/https?:\/\/(?!tudominio\.com)/);
      if (hasInternalLinks && hasExternalLinks) score += 10;
      else if (hasInternalLinks || hasExternalLinks) score += 5;
    }
    
    return score;
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

  async generateArticleWithFallback(trend) {
    let lastError = null;
    
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
        
        if (error.message && (
          error.message.includes('decommissioned') || 
          error.message.includes('not found') ||
          error.message.includes('invalid_request_error')
        )) {
          continue;
        }
        
        if (i < this.models.length - 1) {
          continue;
        }
      }
    }
    
    console.error('❌ Todos los modelos fallaron. Último error:', lastError?.message);
    throw new Error(`Error al generar artículo con todos los modelos disponibles. Último error: ${lastError?.message || 'Error desconocido'}`);
  }

  getAvailableModels() {
    return this.models.map((model, index) => ({
      id: model,
      index: index,
      isCurrent: index === this.currentModelIndex,
      status: 'available'
    }));
  }

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