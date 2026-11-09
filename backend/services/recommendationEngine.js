const Game = require("../models/Game")

/**
 * Mapeo de normalización y sinónimos para el contexto emocional.
 * Permite relacionar expresiones voluntarias del usuario con las etiquetas del catálogo.
 */
const EMOTIONAL_SYNONYMS = {
    relajante: ["relajante", "tranquilo", "cero estres", "desconexion", "sin presion", "calmado", "paz", "descansar", "cansado"],
    desafiante: ["desafiante", "reto", "dificil", "complejo", "superacion", "exigente", "estimulante"],
    emocionante: ["emocionante", "adrenalina", "rapido", "estimulante", "intenso", "accion", "aburrido"],
    creativo: ["creativo", "construir", "construccion", "libertad", "sandbox", "imaginacion"],
    "buena historia": ["buena historia", "narrativo", "inmersivo", "profundo", "reflexivo", "trama", "historia"],
    inmersivo: ["inmersivo", "atmosferico", "exploracion", "mundo abierto", "misterio"],
    divertido: ["divertido", "amigos", "caotico", "variado", "party", "risas", "compania"]
}

/**
 * Normaliza y expande un conjunto de emociones o términos ingresados.
 */
function expandEmotionalTerms(terms = []) {
    const expanded = new Set()
    for (const rawTerm of terms) {
        const clean = rawTerm.toLowerCase().trim()
        expanded.add(clean)

        for (const [key, synonyms] of Object.entries(EMOTIONAL_SYNONYMS)) {
            if (synonyms.some((s) => clean.includes(s) || s.includes(clean))) {
                expanded.add(key)
                synonyms.forEach((s) => expanded.add(s))
            }
        }
    }
    return Array.from(expanded)
}

/**
 * Evalúa compatibilidad de tiempo de sesión.
 */
function calculateTimeScore(gameDuration, requestedTime) {
    if (!requestedTime) return 1.0 // Si no se solicitó restricción de tiempo, es totalmente compatible

    const req = requestedTime.toLowerCase()

    if (req.includes("corta") || req.includes("30 min") || req.includes("rapido") || req.includes("poco tiempo")) {
        if (gameDuration.includes("corta")) return 1.0
        if (gameDuration.includes("media")) return 0.5
        return 0.1
    }

    if (req.includes("media") || req.includes("1 hora") || req.includes("hora")) {
        if (gameDuration.includes("media")) return 1.0
        if (gameDuration.includes("corta")) return 0.8
        return 0.5
    }

    if (req.includes("larga") || req.includes("mucho tiempo") || req.includes("tarde") || req.includes("horas")) {
        if (gameDuration.includes("larga")) return 1.0
        if (gameDuration.includes("media")) return 0.7
        return 0.3
    }

    return 1.0
}

/**
 * Motor de recomendación multicriterio con normalización dinámica de pesos.
 *
 * @param {Object} criteria Criterios de preferencia del usuario
 * @param {Object} options Pesos y límites configurables
 * @returns {Promise<Array>} Lista ordenada de juegos con desglose de puntuación
 */
async function evaluateRecommendations(criteria = {}, options = {}) {
    const {
        preferredGenres = [],
        dislikedGenres = [],
        emotionalContext = [],
        availableTime = null,
        gameMode = null,
        desiredPacing = null,
        desiredDifficulty = null,
        similarTo = []
    } = criteria

    const baseWeights = {
        genreWeight: options.genreWeight ?? 0.30,
        emotionWeight: options.emotionWeight ?? 0.30,
        timeWeight: options.timeWeight ?? 0.15,
        modeWeight: options.modeWeight ?? 0.15,
        pacingWeight: options.pacingWeight ?? 0.10,
        similarBonus: options.similarBonus ?? 0.15,
        ...options.weights
    }

    const limit = options.limit || 5

    // Determinar qué criterios fueron activados expresamente por el usuario
    const hasGenre = preferredGenres.length > 0
    const hasEmotion = emotionalContext.length > 0
    const hasTime = !!availableTime
    const hasMode = !!gameMode
    const hasPacing = !!desiredPacing

    // Calcular suma de pesos activos para normalización
    let activeWeightSum = 0
    if (hasGenre) activeWeightSum += baseWeights.genreWeight
    if (hasEmotion) activeWeightSum += baseWeights.emotionWeight
    if (hasTime) activeWeightSum += baseWeights.timeWeight
    if (hasMode) activeWeightSum += baseWeights.modeWeight
    if (hasPacing) activeWeightSum += baseWeights.pacingWeight

    // Si no especificó criterios o son 0, usar pesos base
    if (activeWeightSum === 0) activeWeightSum = 1.0

    const normalizedWeights = {
        genre: hasGenre ? baseWeights.genreWeight / activeWeightSum : 0,
        emotion: hasEmotion ? baseWeights.emotionWeight / activeWeightSum : 0,
        time: hasTime ? baseWeights.timeWeight / activeWeightSum : 0,
        mode: hasMode ? baseWeights.modeWeight / activeWeightSum : 0,
        pacing: hasPacing ? baseWeights.pacingWeight / activeWeightSum : 0
    }

    // Obtener catálogo completo
    const allGames = await Game.find({})
    const expandedEmotions = expandEmotionalTerms(emotionalContext)

    const scoredGames = []

    for (const game of allGames) {
        // --- 1. FILTRO DE EXCLUSIÓN ESTRICTO (Disliked Genres) ---
        const matchesDisliked = dislikedGenres.some((disliked) =>
            game.genres.some((g) => g.toLowerCase().includes(disliked.toLowerCase()))
        )

        if (matchesDisliked) {
            continue // Se descarta por completo
        }

        // --- 2. EVALUACIÓN DE MODO DE JUEGO ---
        let modeScore = 1.0
        if (hasMode) {
            const reqMode = gameMode.toLowerCase().trim()
            const supportsMode = game.gameModes.some((m) => m.toLowerCase().includes(reqMode))

            if (supportsMode) {
                modeScore = 1.0
            } else {
                if (reqMode.includes("coop") || reqMode.includes("amigo") || reqMode.includes("multi")) {
                    continue // Descartar si el usuario pide cooperativo y el juego solo es individual
                }
                modeScore = 0.0
            }
        }

        // --- 3. EVALUACIÓN DE GÉNEROS FAVORITOS ---
        let genreScore = 1.0
        const matchedGenres = []
        if (hasGenre) {
            for (const pref of preferredGenres) {
                const found = game.genres.find((g) => g.toLowerCase().includes(pref.toLowerCase()))
                if (found) {
                    matchedGenres.push(found)
                }
            }
            genreScore = matchedGenres.length / preferredGenres.length
            if (genreScore > 1) genreScore = 1.0
        }

        // --- 4. EVALUACIÓN DE CONTEXTO EMOCIONAL ---
        let emotionScore = 1.0
        const matchedEmotions = []
        if (hasEmotion) {
            for (const emo of expandedEmotions) {
                const foundInTags = game.emotionalTags.find((t) => t.toLowerCase().includes(emo))
                if (foundInTags && !matchedEmotions.includes(foundInTags)) {
                    matchedEmotions.push(foundInTags)
                }
            }
            emotionScore = Math.min(matchedEmotions.length / Math.max(emotionalContext.length, 1), 1.0)
        }

        // --- 5. EVALUACIÓN DE TIEMPO DISPONIBLE ---
        const timeScore = calculateTimeScore(game.sessionDuration, availableTime)

        // --- 6. EVALUACIÓN DE RITMO (Pacing) ---
        let pacingScore = 1.0
        if (hasPacing) {
            pacingScore = game.pacing.toLowerCase() === desiredPacing.toLowerCase() ? 1.0 : 0.2
        }

        // --- 7. BONUS POR JUEGOS SIMILARES ---
        let similarScore = 0
        const matchedSimilar = []
        if (similarTo.length > 0) {
            for (const sim of similarTo) {
                const found = game.similarTo.find((s) => s.toLowerCase().includes(sim.toLowerCase()))
                if (found) {
                    matchedSimilar.push(found)
                    similarScore = 1.0
                }
            }
        }

        // --- CÁLCULO PONDERADO NORMALIZADO ---
        let finalScore =
            normalizedWeights.genre * genreScore +
            normalizedWeights.emotion * emotionScore +
            normalizedWeights.time * timeScore +
            normalizedWeights.mode * modeScore +
            normalizedWeights.pacing * pacingScore

        if (similarScore > 0) {
            finalScore += baseWeights.similarBonus
        }

        // Normalizar a escala 0 - 100
        const normalizedScore = Math.min(Math.round(finalScore * 100), 100)

        scoredGames.push({
            game,
            score: normalizedScore,
            breakdown: {
                genreScore: Math.round(genreScore * 100),
                emotionScore: Math.round(emotionScore * 100),
                timeScore: Math.round(timeScore * 100),
                modeScore: Math.round(modeScore * 100),
                pacingScore: Math.round(pacingScore * 100),
                similarBonus: similarScore > 0
            },
            matchFactors: {
                matchedGenres,
                matchedEmotions,
                matchedSimilar,
                sessionDuration: game.sessionDuration,
                pacing: game.pacing,
                gameModes: game.gameModes
            }
        })
    }

    // Ordenar descendente por afinidad
    scoredGames.sort((a, b) => b.score - a.score)

    return scoredGames.slice(0, limit)
}

module.exports = {
    evaluateRecommendations,
    calculateTimeScore,
    expandEmotionalTerms
}
