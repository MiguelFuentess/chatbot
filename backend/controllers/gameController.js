const Game = require("../models/Game")

// Obtener todos los videojuegos con soporte de filtros opcionales
exports.getGames = async (req, res) => {
    try {
        const { genre, mode, pacing, difficulty, sessionDuration, search } = req.query
        const filter = {}

        if (genre) {
            filter.genres = { $regex: new RegExp(genre, "i") }
        }

        if (mode) {
            filter.gameModes = mode.toLowerCase()
        }

        if (pacing) {
            filter.pacing = pacing.toLowerCase()
        }

        if (difficulty) {
            filter.difficulty = difficulty.toLowerCase()
        }

        if (sessionDuration) {
            filter.sessionDuration = sessionDuration
        }

        if (search) {
            filter.$text = { $search: search }
        }

        const games = await Game.find(filter).sort({ title: 1 })
        res.status(200).json({
            count: games.length,
            games
        })
    } catch (error) {
        console.error("Error al obtener videojuegos:", error)
        res.status(500).json({
            message: "Error interno al consultar el catálogo de videojuegos",
            error: error.message
        })
    }
}

// Obtener un videojuego por su ID
exports.getGameById = async (req, res) => {
    try {
        const game = await Game.findById(req.params.id)
        if (!game) {
            return res.status(404).json({ message: "Videojuego no encontrado" })
        }
        res.status(200).json(game)
    } catch (error) {
        console.error("Error al obtener videojuego por ID:", error)
        res.status(500).json({
            message: "Error interno al consultar el videojuego",
            error: error.message
        })
    }
}

// Obtener lista consolidada de géneros disponibles en el catálogo
exports.getGenres = async (req, res) => {
    try {
        const genres = await Game.distinct("genres")
        res.status(200).json(genres.sort())
    } catch (error) {
        console.error("Error al obtener géneros:", error)
        res.status(500).json({
            message: "Error interno al consultar géneros",
            error: error.message
        })
    }
}
