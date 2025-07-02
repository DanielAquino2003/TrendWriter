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
      const detailedInfoPrompt = this.buildResearchPrompt(input.tema, input.contexto);

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

  buildResearchPrompt(tema, contexto) {
    return `
Actúa como un investigador experto en redacción de artículos. Proporciona información detallada y actual sobre el siguiente tema para ayudar a redactar un artículo de alta calidad:

TEMA: ${tema}
CONTEXTO: ${contexto}

Incluye:
- Definición clara del tema.
- Contexto actual o histórico.
- Importancia o impacto.
- Estadísticas si son relevantes.
- Desafíos o controversias relacionadas.

Devuelve el contenido en texto plano, bien redactado, claro y sin formato adicional.
`;
  }

  buildArticlePrompt({
    tema,
    contexto,
    idioma,
    profundidad,
    tono,
    longitud,
    informacion,
  }) {
    const longitudMap = {
      'Corto (500 palabras)': '500',
      'Medio (1000 palabras)': '1000',
      'Largo (2000+ palabras)': '2000',
      'Muy largo (3000+ palabras)': '3000',
    };

    const wordCount = longitudMap[longitud] || '1000';

    return `
Crea un artículo original y optimizado para SEO, en formato markdown listo para ser parseado a texto, con las siguientes características:

- Tema: ${tema}  
- Idioma: ${idioma}  
- Contexto: ${contexto}  
- Tono: ${tono}  
- Profundidad: ${profundidad} (ej. básico, intermedio, experto)  
- Longitud: ${longitud} (en palabras aprox.)  
- Información adicional: ${informacion}

Instrucciones:

1. Título: atractivo, emocional o práctico, de 50-60 caracteres, con palabra clave de cola larga.
2. Meta descripción: 140-160 caracteres, incluye la palabra clave principal y llama al clic.
3. Estructura:
   - Introducción (100-150 palabras): pregunta inicial, anécdota o contexto; explica la relevancia del tema.
   - Desarrollo (ajustado a la longitud total): usa entre 3 y 6 secciones con subtítulos H2/H3 claros. Incluye:
     - Explicación del tema
     - Ejemplos o casos de uso
     - Listas o viñetas con puntos clave
     - 1-2 enlaces externos confiables y 1-2 enlaces internos simulados
   - Conclusión (100-150 palabras): resumen, reflexión y llamado a la acción.
4. SEO:
   - Repite la palabra clave principal 3-5 veces
   - Incluye 3-5 palabras clave relacionadas
   - Párrafos de 2-3 frases, estilo claro y directo

Formato de salida:

TÍTULO: [Título SEO optimizado]  
META: [Meta descripción atractiva]  
KEYWORDS: [keyword1, keyword2, keyword3, keyword4, keyword5]  
CONTENIDO:  
## [Encabezado principal]  
[Introducción]

### [Subtema o sección]  
[Desarrollo con viñetas, ejemplos y enlaces]

## Conclusión  
[Resumen + llamado a la acción]
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
