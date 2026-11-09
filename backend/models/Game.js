const mongoose = require("mongoose")

const gameSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "El título del videojuego es obligatorio"],
            trim: true,
            unique: true
        },
        description: {
            type: String,
            required: [true, "La descripción es obligatoria"],
            trim: true
        },
        genres: {
            type: [String],
            required: true,
            default: []
        },
        platforms: {
            type: [String],
            default: ["PC"]
        },
        gameModes: {
            type: [String],
            required: true,
            enum: ["individual", "cooperativo", "multijugador"],
            default: ["individual"]
        },
        pacing: {
            type: String,
            enum: ["relajado", "moderado", "intenso"],
            default: "moderado"
        },
        difficulty: {
            type: String,
            enum: ["baja", "media", "alta", "ajustable"],
            default: "media"
        },
        sessionDuration: {
            type: String,
            enum: ["corta (< 30 min)", "media (30-60 min)", "larga (> 1 hora)"],
            required: true
        },
        emotionalTags: {
            type: [String],
            default: []
        },
        experienceHighlights: {
            type: [String],
            default: []
        },
        similarTo: {
            type: [String],
            default: []
        },
        imageUrl: {
            type: String,
            default: ""
        },
        priceCondition: {
            type: String,
            enum: ["Gratuito", "De pago", "Free-to-play"],
            default: "De pago"
        }
    },
    {
        timestamps: true
    }
)

// Índice de texto para búsquedas por título, descripción y etiquetas
gameSchema.index({ title: "text", description: "text", emotionalTags: "text", genres: "text" })

module.exports = mongoose.model("Game", gameSchema)
