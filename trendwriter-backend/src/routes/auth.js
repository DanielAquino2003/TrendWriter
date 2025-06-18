const express = require("express")
const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth20").Strategy
const GitHubStrategy = require("passport-github2").Strategy
const User = require("../models/User")
const jwt = require("jsonwebtoken")
const router = express.Router()

// Configurar estrategias OAuth
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

module.exports = router
