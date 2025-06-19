const express = require("express")
const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth20").Strategy
const GitHubStrategy = require("passport-github2").Strategy
const User = require("../models/User")
const jwt = require("jsonwebtoken")
const router = express.Router()
const bcrypt = require("bcrypt")


// === Google OAuth Strategy (ya la tienes configurada) ===
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      console.log("Google OAuth callback:", profile)
      try {
        let user = await User.findOne({
          $or: [{ oauthId: profile.id, oauthProvider: "google" }, { email: profile.emails[0].value }],
        })

        if (user) {
          // Actualizar tokens si es necesario
          user.oauthToken = accessToken
          user.refreshToken = refreshToken
          user.lastLoginAt = new Date()
          await user.save()
        } else {
          // Crear nuevo usuario
          user = new User({
            email: profile.emails[0].value,
            oauthProvider: "google",
            oauthId: profile.id,
            oauthToken: accessToken,
            refreshToken: refreshToken,
            profile: {
              name: profile.displayName,
              avatar: profile.photos[0]?.value,
            },
            lastLoginAt: new Date(),
          })
          await user.resetMonthlyUsage()
          await user.save()
        }

        return done(null, user)
      } catch (error) {
        return done(error, null)
      }
    },
  ),
)

// Rutas de autenticación
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }))

router.get("/google/callback", passport.authenticate("google", { session: false }), (req, res) => {
  const token = jwt.sign({ userId: req.user._id, email: req.user.email }, process.env.JWT_SECRET, { expiresIn: "7d" })

  // Redirigir al frontend con el token
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`)
})

router.post("/verify-token", async (req, res) => {
  try {
    const { token } = req.body
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId).select("-oauthToken -refreshToken")

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid user" })
    }

    res.json({ user, token })
  } catch (error) {
    res.status(401).json({ error: "Invalid token" })
  }
})

router.post("/logout", (req, res) => {
  // En un sistema sin sesiones, simplemente confirmamos el logout
  res.json({ message: "Logged out successfully" })
})

// ========== Email/Password Register ==========
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body
    if (!email || !password || !name) {
      return res.status(400).json({ error: "All fields are required" })
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(409).json({ error: "User already exists" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = new User({
      email,
      password: hashedPassword,
      oauthProvider: "local",
      profile: { name },
      lastLoginAt: new Date(),
    })

    await user.save()

    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    })

    res.status(201).json({ user: { email: user.email, name: user.profile.name }, token })
  } catch (err) {
    console.error("Error en /register:", err)
    res.status(500).json({ error: "Registration failed" })
  }
})


// ========== Email/Password Login ==========
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" })
    }

    const user = await User.findOne({ email })
    if (!user || user.oauthProvider !== "local") {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    })

    res.json({ user: { email: user.email, name: user.profile.name }, token })
  } catch (err) {
    res.status(500).json({ error: "Login failed" })
  }
})

module.exports = router
