# !! Software En Proceso

# TrendsWriter Backend API

Una API REST completa para automatizar la búsqueda de tendencias y creación de artículos, con sistema de autenticación JWT y OAuth2.

## 🚀 Características

- **Autenticación Completa**: JWT, OAuth2 (Google, GitHub)
- **Búsqueda de Tendencias**: Automatización de descubrimiento de temas populares
- **Generación de Artículos**: Creación automática de contenido basado en tendencias
- **Gestión de Usuarios**: Perfiles, suscripciones y preferencias
- **API RESTful**: Endpoints bien documentados y organizados
- **Middleware de Seguridad**: Validación, rate limiting, CORS
- **Base de Datos**: MongoDB con Mongoose ODM

## 📋 Requisitos Previos

- Node.js >= 16.x
- MongoDB >= 5.x
- npm o yarn
- Cuentas de desarrollador en Google y GitHub (para OAuth)

## 🔧 Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/DanielAquino2003/TrendWriter.git
cd trendswriter-backend
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/trendswriter

# JWT
JWT_SECRET=tu_jwt_secret_super_seguro_aqui
JWT_EXPIRES_IN=7d

# OAuth2 - Google
GOOGLE_CLIENT_ID=tu_google_client_id
GOOGLE_CLIENT_SECRET=tu_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# OAuth2 - GitHub
GITHUB_CLIENT_ID=tu_github_client_id
GITHUB_CLIENT_SECRET=tu_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback

# Frontend URLs
FRONTEND_URL=http://localhost:3000
FRONTEND_SUCCESS_URL=http://localhost:3000/dashboard
FRONTEND_ERROR_URL=http://localhost:3000/auth?error=true

# APIs para Tendencias
GOOGLE_TRENDS_API_KEY=tu_google_trends_api_key
TWITTER_BEARER_TOKEN=tu_twitter_bearer_token
OPENAI_API_KEY=tu_openai_api_key

# Email Service (opcional)
EMAIL_SERVICE=gmail
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password
```

### 4. Configurar OAuth2

#### Google OAuth2:
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la Google+ API
4. Crea credenciales OAuth2
5. Añade las URLs de redirección autorizadas:
   - `http://localhost:5000/api/auth/google/callback`
   - `http://localhost:3000` (frontend)

#### GitHub OAuth2:
1. Ve a GitHub Settings > Developer settings > OAuth Apps
2. Crea una nueva OAuth App
3. Configura:
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:5000/api/auth/github/callback`

### 5. Iniciar MongoDB
```bash
# Si usas MongoDB local
mongod

# O usar MongoDB Atlas (recomendado para producción)
```

### 6. Ejecutar el servidor
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 🗂️ Estructura del Proyecto

```
trendswriter-backend/
├── src/
│   ├── controllers/
│   │   ├── trendsController.js
│   │   ├── articlesController.js
│   ├── middleware/
│   │   ├── auth.js
│   ├── models/
|   |   ├── Analytics.js
│   │   ├── User.js
│   │   ├── Article.js
│   │   └── Trend.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── trends.js
│   │   ├── articles.js
│   │   └── users.js
│   ├── services/
│   │   ├── trendsService.js
│   │   ├── articleService.js
│   │   └── emailService.js
│   ├── utils/
│   │   ├── database.js
│   │   ├── logger.js
│   │   └── helpers.js
│   └── app.js
├── tests/
├── .env.example
├── package.json
└── README.md
```

## 🔐 Endpoints de Autenticación

### Registro con Email/Password
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Juan Pérez",
  "email": "juan@ejemplo.com",
  "password": "contraseña123"
}
```

### Inicio de Sesión con Email/Password
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "juan@ejemplo.com",
  "password": "contraseña123"
}
```

### OAuth2 - Google
```http
GET /api/auth/google
# Redirige a Google para autenticación
```

### OAuth2 - GitHub
```http
GET /api/auth/github
# Redirige a GitHub para autenticación
```

### Validar Token
```http
GET /api/auth/verify
Authorization: Bearer <token>
```

### Cerrar Sesión
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

## 📈 Endpoints de Tendencias

### Obtener Tendencias Actuales
```http
GET /api/trends/current
Authorization: Bearer <token>

# Query Parameters:
# - category: tech, business, entertainment, etc.
# - region: US, ES, MX, etc.
# - limit: número de resultados (default: 10)
```

### Buscar Tendencias por Keyword
```http
GET /api/trends/search?keyword=artificial+intelligence
Authorization: Bearer <token>
```

### Análisis de Tendencia Específica
```http
GET /api/trends/analyze/:trendId
Authorization: Bearer <token>
```

## 📝 Endpoints de Artículos

### Generar Artículo desde Tendencia
```http
POST /api/articles/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "trendId": "60d0fe4f5311236168a109ca",
  "style": "professional", // casual, professional, technical
  "language": "es",
  "wordCount": 800
}
```

### Obtener Artículos del Usuario
```http
GET /api/articles/my-articles
Authorization: Bearer <token>

# Query Parameters:
# - page: número de página (default: 1)
# - limit: artículos por página (default: 10)
# - status: draft, published, archived
```

### Obtener Artículo Específico
```http
GET /api/articles/:articleId
Authorization: Bearer <token>
```

### Actualizar Artículo
```http
PUT /api/articles/:articleId
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Nuevo título",
  "content": "Contenido actualizado...",
  "status": "published"
}
```

### Eliminar Artículo
```http
DELETE /api/articles/:articleId
Authorization: Bearer <token>
```

## 👤 Endpoints de Usuario

### Obtener Perfil
```http
GET /api/users/profile
Authorization: Bearer <token>
```

### Actualizar Perfil
```http
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Nuevo nombre",
  "bio": "Descripción del perfil",
  "preferences": {
    "categories": ["tech", "business"],
    "language": "es",
    "notifications": true
  }
}
```

### Obtener Estadísticas
```http
GET /api/users/stats
Authorization: Bearer <token>
```

## 🔒 Middleware de Autenticación

Para proteger rutas, usa el middleware `auth`:

```javascript
const auth = require('./middleware/auth');

// Proteger una ruta
router.get('/protected-route', auth, (req, res) => {
  // req.user contiene la información del usuario
  res.json({ user: req.user });
});
```

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Tests con coverage
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

## 📊 Modelos de Datos

### Usuario
```javascript
{
  _id: ObjectId,
  email: String,
  password: String, // hasheado
  name: String,
  avatar: String,
  oauthProvider: String, // 'local', 'google', 'github'
  oauthId: String,
  profile: {
    bio: String,
    website: String,
    location: String
  },
  preferences: {
    categories: [String],
    language: String,
    notifications: Boolean
  },
  subscription: {
    plan: String, // 'free', 'premium', 'pro'
    status: String,
    expiresAt: Date
  },
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date
}
```

### Tendencia
```javascript
{
  _id: ObjectId,
  keyword: String,
  category: String,
  region: String,
  searchVolume: Number,
  growthRate: Number,
  relatedKeywords: [String],
  sources: [String],
  sentiment: String, // 'positive', 'neutral', 'negative'
  difficulty: Number, // 1-10
  createdAt: Date,
  updatedAt: Date
}
```

### Artículo
```javascript
{
  _id: ObjectId,
  title: String,
  content: String,
  summary: String,
  author: ObjectId, // ref: User
  trend: ObjectId, // ref: Trend
  status: String, // 'draft', 'published', 'archived'
  style: String,
  language: String,
  wordCount: Number,
  seoScore: Number,
  tags: [String],
  publishedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## 🚀 Despliegue

### Heroku
```bash
# Instalar Heroku CLI
npm install -g heroku

# Login
heroku login

# Crear app
heroku create trendswriter-backend

# Configurar variables de entorno
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=mongodb+srv://...
heroku config:set JWT_SECRET=...

# Deploy
git push heroku main
```

### Docker
```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

## 🔧 Configuración Adicional

### Rate Limiting
```javascript
// Configurado en middleware/rateLimiter.js
// Auth endpoints: 5 requests/15min
// API endpoints: 100 requests/15min
```

### CORS
```javascript
// Configurado para permitir requests desde:
// - http://localhost:3000 (desarrollo)
// - https://tu-dominio.com (producción)
```

### Logging
```javascript
// Usando Winston para logging
// Logs guardados en ./logs/
// Niveles: error, warn, info, debug
```

## 📚 Documentación API

La documentación completa de la API está disponible en:
- Desarrollo: `http://localhost:5000/api-docs`
- Producción: `https://tu-api.com/api-docs`

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una branch para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Ver `LICENSE` para más detalles.

## 📞 Soporte

- Email: aquinosantiagodani@gmail.com

## 🙏 Agradecimientos

- [OpenAI](https://openai.com) por la API de generación de contenido
- [Google Trends](https://trends.google.com) por los datos de tendencias
- [Passport.js](http://www.passportjs.org/) por la autenticación OAuth2
- [MongoDB](https://www.mongodb.com/) por la base de datos

---

Made with ❤️ by the TrendsWriter team
