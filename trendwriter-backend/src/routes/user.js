const express = require("express")
const User = require("../models/User")
const router = express.Router()

// Obtener perfil del usuario
router.get("/profile", async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-oauthToken -refreshToken")

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "Usuario no encontrado" })
    }

    res.json({ user })
  } catch (error) {
    console.error("Error obteniendo perfil:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

// Actualizar perfil del usuario
router.put("/profile", async (req, res) => {
  try {
    const { name, bio, website } = req.body

    const user = await User.findById(req.user.userId)

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "Usuario no encontrado" })
    }

    // Actualizar campos permitidos
    if (name) user.profile.name = name
    if (bio !== undefined) user.profile.bio = bio
    if (website !== undefined) user.profile.website = website

    await user.save()

    // Devolver usuario sin tokens sensibles
    const updatedUser = await User.findById(req.user.userId).select("-oauthToken -refreshToken")

    res.json({ user: updatedUser })
  } catch (error) {
    console.error("Error actualizando perfil:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

// Obtener estadísticas del usuario
router.get("/stats", async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "Usuario no encontrado" })
    }

    const stats = {
      usage: user.usage,
      plan: user.plan,
      planLimits: user.planLimits,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    }

    res.json({ stats })
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

// Eliminar cuenta del usuario
router.delete("/account", async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" })
    }

    // Marcar como inactivo en lugar de eliminar completamente
    user.isActive = false
    user.deletedAt = new Date()
    await user.save()

    res.json({ message: "Cuenta eliminada correctamente" })
  } catch (error) {
    console.error("Error eliminando cuenta:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

module.exports = router
