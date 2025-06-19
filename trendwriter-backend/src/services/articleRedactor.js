const Groq = require('groq-sdk');

class ArticleRedactor {
  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    this.models = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'gemma2-9b-it',
      'llama3-70b-8192',
      'llama3-8b-8192',
    ];

    this.currentModelIndex = 0;
    this.model = this.models[this.currentModelIndex];
  }

  async redactArticle(input) {
    try {
      console.log(`Redactando artículo sobre: ${input.tema} con modelo: ${this.model}`);

      // Paso 1: Investigar sobre el tema
      const detailedInfoPrompt = this.buildResearchPrompt(input.tema);

      const detailedInfo = await this.askModel(detailedInfoPrompt);

      console.log('Información detallada obtenida:', detailedInfo);

      // Paso 2: Redactar artículo con toda la información
      const articlePrompt = this.buildArticlePrompt({
        ...input,
        informacion: detailedInfo,
      });

      console.log('Redactando articulo...');

      const articleResult = await this.askModel(articlePrompt);

      return { resultado: articleResult };
    } catch (error) {
      console.error('Error redacting article:', error);
      throw new Error('Failed to redact article');
    }
  }

  buildResearchPrompt(tema) {
    return `
Actúa como un investigador experto en redacción de artículos. Proporciona información detallada y actual sobre el siguiente tema para ayudar a redactar un artículo de alta calidad:

TEMA: ${tema}

Incluye:
- Definición clara del tema.
- Contexto actual o histórico.
- Importancia o impacto.
- Casos de uso reales o aplicaciones.
- Estadísticas si son relevantes.
- Desafíos o controversias relacionadas.

Devuelve el contenido en texto plano, bien redactado, claro y sin formato adicional.
`;
  }

  buildArticlePrompt({
    tema,
    categoria,
    formato,
    slug,
    etiquetas,
    tono = 'informativo',
    longitud = 'Medio (1000 palabras)',
    informacion,
  }) {
    const longitudMap = {
      'Corto (500 palabras)': '500',
      'Medio (1000 palabras)': '1000',
      'Largo (2000+ palabras)': '2000',
    };

    const wordCount = longitudMap[longitud] || '1000';

    return `
Crea un artículo original, bien escrito y optimizado para SEO en español sobre el siguiente tema:

TEMA: ${tema}
CATEGORÍA: ${categoria}
FORMATO: ${formato}
SLUG: ${slug}
ETIQUETAS: ${etiquetas}
TONO: ${tono}
LONGITUD: ${longitud} (${wordCount} palabras aprox.)

INFORMACIÓN DE CONTEXTO:
${informacion}

REQUISITOS:
1. **Título**: Atractivo, SEO optimizado (50-60 caracteres), con palabra clave de cola larga y gancho emocional/práctico.
2. **Meta descripción**: 140-160 caracteres con la palabra clave principal. Debe invitar al clic.
3. **Cuerpo del artículo**:
   - Introducción (100-150 palabras): pregunta o anécdota inicial, relevancia del tema, promesa de valor.
   - Desarrollo (adaptado a ${wordCount} palabras): usa 3-6 encabezados H2 y H3 con subtítulos claros. Incluye:
     - Explicación de "${tema}"
     - Ejemplos aplicados, historias o casos de uso
     - Listas o viñetas con tips o puntos clave
     - 1-2 enlaces internos y 1-2 externos (ej: Wired, Harvard Business Review)
   - Conclusión (100-150 palabras): resumen, llamado a la acción, reflexión final.

4. **SEO**:
   - Palabra clave principal repetida 3-5 veces
   - Palabras clave relacionadas (3-5) incluidas naturalmente
   - Estilo legible y directo (párrafos de 2-3 frases)

5. **Tono**: Usa un tono ${tono} según lo indicado. Asegúrate de que sea adecuado al lector objetivo. 

6. **Formato de respuesta EXACTO**:
TÍTULO: [título optimizado]
META: [meta descripción]
KEYWORDS: [keyword1, keyword2, keyword3, keyword4, keyword5]
CONTENIDO:
[artículo completo en markdown usando ## y ###, con viñetas y subtítulos claros]

IMPORTANTE: No dejes campos vacíos. El contenido debe ser original, útil, y optimizado para retención y posicionamiento SEO.
Si no puedes completarlo, indica que es incompleto y sugiere usar un modelo más grande.
`;
  }

  async askModel(prompt) {
    // Intentar usar cada modelo hasta que uno no genere error de rate limit
    for (let i = 0; i < this.models.length; i++) {
      this.currentModelIndex = i;
      this.model = this.models[i];
      try {
        console.log(`Intentando con modelo: ${this.model}`);
        const response = await this.groq.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4096,
        });
        return response.choices[0].message.content.trim();
      } catch (error) {
        if (error.status === 429) {
          console.warn(`Límite de tokens excedido para modelo ${this.model}, intentando con otro modelo...`);
          // seguir al siguiente modelo en el bucle
        } else {
          // Si es otro error, lanzarlo para manejarlo en otro lugar
          throw error;
        }
      }
    }
    throw new Error('No quedan modelos disponibles: todos excedieron el límite de tokens.');
  }
}

module.exports = new ArticleRedactor();
