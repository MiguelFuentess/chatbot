const mongoose = require("mongoose")

/**
 * Validador para atributos numéricos de experiencia graduables entre 0 y 5 o null.
 */
const experienceAttributeValidator = {
    validator: function (v) {
        if (v === null || v === undefined) return true
        return Number.isInteger(v) && v >= 0 && v <= 5
    },
    message: (props) => `${props.path} debe ser un número entero entre 0 y 5 o null, recibido: ${props.value}`
}

/**
 * Subdocumento de atributos de experiencia de juego (Etapa 1 - Tercera Evolución).
 * Permite capturar dimensiones granulares del diseño lúdico.
 */
const experienceAttributesSchema = new mongoose.Schema(
    {
        exploration: {
            type: Number,
            default: null,
            validate: experienceAttributeValidator
        },
        narrative: {
            type: Number,
            default: null,
            validate: experienceAttributeValidator
        },
        creativity: {
            type: Number,
            default: null,
            validate: experienceAttributeValidator
        },
        strategy: {
            type: Number,
            default: null,
            validate: experienceAttributeValidator
        },
        combat: {
            type: Number,
            default: null,
            validate: experienceAttributeValidator
        },
        freedom: {
            type: Number,
            default: null,
            validate: experienceAttributeValidator
        },
        complexity: {
            type: Number,
            default: null,
            validate: experienceAttributeValidator
        }
    },
    { _id: false }
)

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
        },
        // --- NUEVOS ATRIBUTOS DE METADATOS AMPLIADOS (Etapa 1 - Tercera Evolución) ---
        objectiveStyle: {
            type: String,
            enum: {
                values: ["libre", "guiado", "mixto"],
                message: "objectiveStyle debe ser 'libre', 'guiado', 'mixto' o null, recibido: {VALUE}"
            },
            default: null,
            required: false
        },
        experienceAttributes: {
            type: experienceAttributesSchema,
            default: null,
            required: false
        }
    },
    {
        timestamps: true
    }
)

// Índice de texto para búsquedas por título, descripción y etiquetas
gameSchema.index({ title: "text", description: "text", emotionalTags: "text", genres: "text" })

module.exports = mongoose.model("Game", gameSchema)
