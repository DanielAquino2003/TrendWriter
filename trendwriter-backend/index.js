const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const passport = require("passport")
const session = require("express-session")
const MongoStore = require("connect-mongo")
require("dotenv").config()

// Importar jobs
const trendScanner = require("./jobs/trendScanner")
const ArticleProcessor = require("./jobs/articleProcessor")

const app = express()
const PORT = process.env.PORT || 5000

// Configuración de CORS mejorada para autenticación
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Conectar a MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/trendwriter")
  .then(() => {
    console.log("✅ MongoDB conectado")
    console.log("📊 Base de datos:", mongoose.connection.db.databaseName)
  })
  .catch((err) => console.error("❌ Error conectando a MongoDB:", err))

// Configuración de sesiones (necesario para Passport, aunque usemos JWT)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/trendwriter",
      touchAfter: 24 * 3600, // lazy session update
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production", // true en producción con HTTPS
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
    },
  }),
)

// Inicializar Passport
app.use(passport.initialize())
app.use(passport.session())

// Configuración de serialización de Passport (aunque no usemos sesiones para auth)
passport.serializeUser((user, done) => {
  done(null, user._id)
})

passport.deserializeUser(async (id, done) => {
  try {
    const User = require("./models/User")
    const user = await User.findById(id)
    done(null, user)
  } catch (error) {
    done(error, null)
  }
})

// Middleware de autenticación JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Token de acceso requerido" })
  }

  const jwt = require("jsonwebtoken")
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido" })
    }
    req.user = user
    next()
  })
}

// Middleware opcional de autenticación (no bloquea si no hay token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (token) {
    const jwt = require("jsonwebtoken")
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user
      }
    })
  }
  next()
}

// Ruta de health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    auth: "enabled",
  })
})

// Importar y usar rutas de autenticación
const authRoutes = require("./src/routes/auth")
app.use("/api/auth", authRoutes)

// Importar rutas existentes
const trendsRoutes = require("./src/routes/trends")
const articlesRoutes = require("./src/routes/articles")

// Usar rutas existentes (algunas pueden necesitar protección)
app.use("/api/trends", optionalAuth, trendsRoutes)
app.use("/api/articles", optionalAuth, articlesRoutes)

// Rutas protegidas para usuarios autenticados
const userRoutes = require("./src/routes/user")
app.use("/api/user", authenticateToken, userRoutes)

// Ruta para obtener información del usuario actual
app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const User = require("./models/User")
    const user = await User.findById(req.user.userId).select("-oauthToken -refreshToken")

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "Usuario no encontrado" })
    }

    res.json({ user })
  } catch (error) {
    console.error("Error obteniendo usuario:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

// Inicializar procesador de artículos
const articleProcessor = new ArticleProcessor()

// Rutas adicionales para control manual (protegidas)
app.post("/api/process-trends", authenticateToken, async (req, res) => {
  try {
    console.log("🚀 Procesamiento manual iniciado desde API por usuario:", req.user.email)
    // No esperar la respuesta para no bloquear la API
    articleProcessor.processPendingTrends().catch(console.error)
    res.json({ message: "Procesamiento iniciado", timestamp: new Date() })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get("/api/processing-stats", authenticateToken, async (req, res) => {
  try {
    const stats = await articleProcessor.getProcessingStats()
    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post("/api/retry-failed", authenticateToken, async (req, res) => {
  try {
    console.log("🔄 Reintento manual iniciado desde API por usuario:", req.user.email)
    articleProcessor.retryFailedTrends().catch(console.error)
    res.json({ message: "Reintento iniciado", timestamp: new Date() })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Ruta para estadísticas públicas (sin autenticación)
app.get("/api/public-stats", async (req, res) => {
  try {
    const User = require("./models/User")
    const totalUsers = await User.countDocuments({ isActive: true })

    res.json({
      totalUsers,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error("❌ Error no manejado:", err)

  if (err.name === "ValidationError") {
    return res.status(400).json({ error: "Datos de entrada inválidos" })
  }

  if (err.name === "CastError") {
    return res.status(400).json({ error: "ID inválido" })
  }

  res.status(500).json({ error: "Error interno del servidor" })
})

// Ruta 404 para rutas no encontradas - CORREGIDA
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" })
})

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`)
  console.log(`🔐 Autenticación habilitada`)
  console.log(`🌐 CORS configurado para: ${corsOptions.origin}`)

  // Verificar variables de entorno críticas
  const requiredEnvVars = ["JWT_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "FRONTEND_URL"]

  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])

  if (missingVars.length > 0) {
    console.warn("⚠️  Variables de entorno faltantes:", missingVars.join(", "))
  } else {
    console.log("✅ Todas las variables de entorno están configuradas")
  }

  // Inicializar cron jobs
  console.log("📅 Iniciando cron jobs...")

  // Cron jobs originales del scanner
  trendScanner.initCronJobs()

  // Nuevos cron jobs del procesador
  articleProcessor.initCronJobs()

  console.log("✅ Todos los cron jobs iniciados")

  // Mostrar estadísticas iniciales
  setTimeout(() => {
    articleProcessor.getProcessingStats()
  }, 5000)
})

// Manejo de errores no capturados
process.on("uncaughtException", (error) => {
  console.error("❌ Error no capturado:", error)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Promesa rechazada no manejada:", reason)
})

// Manejo de cierre graceful
process.on("SIGINT", async () => {
  console.log("🔄 Cerrando aplicación...")

  try {
    // Cerrar conexión a MongoDB
    await mongoose.disconnect()
    console.log("✅ MongoDB desconectado")

    console.log("✅ Aplicación cerrada correctamente")
    process.exit(0)
  } catch (error) {
    console.error("❌ Error durante el cierre:", error)
    process.exit(1)
  }
})
