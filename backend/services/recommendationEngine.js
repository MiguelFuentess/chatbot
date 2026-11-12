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
 * Evalúa las características concretas del juego frente a las preferencias (likedFeatures y dislikedFeatures)
 * correspondientes a las 11 categorías de la Etapa 2.
 */
function evaluateGameFeatures(game, likedFeatures = [], dislikedFeatures = []) {
    const textCorpus = [
        game.title,
        game.description,
        ...(game.genres || []),
        ...(game.emotionalTags || []),
        ...(game.gameModes || []),
        game.difficulty || "",
        game.pacing || "",
        ...(game.experienceHighlights || []),
        ...(game.similarTo || [])
    ].join(" ").toLowerCase()

    const matchedLiked = []
    for (const featId of likedFeatures) {
        let isMatch = false
        switch (featId) {
            case "exploracion":
                isMatch = /explor|mundo abierto|aventura|descubrir|inmersivo|atmosferico/.test(textCorpus)
                break
            case "construccion_creatividad":
                isMatch = /constru|creativ|sandbox|baldosa|crafteo|crafting/.test(textCorpus)
                break
            case "narrativa_historia":
                isMatch = /historia|narrativ|trama|lore|guion|rpg/.test(textCorpus) ||
                          (game.emotionalTags || []).some((t) => t.toLowerCase().includes("historia") || t.toLowerCase().includes("narrativo"))
                break
            case "combate_accion":
                isMatch = /combate|accion|pelea|dispar|lucha|fps|hack and slash|boss|jefe/.test(textCorpus)
                break
            case "estrategia_planificacion":
                isMatch = /estrategia|planific|gestion|tactico|tower defense|por turnos/.test(textCorpus)
                break
            case "puzzles_acertijos":
                isMatch = /puzzle|acertijo|rompecabezas|logica/.test(textCorpus)
                break
            case "libertad_sandbox":
                isMatch = /sandbox|libertad|a tu propio ritmo|mundo abierto|sin presiones/.test(textCorpus)
                break
            case "cooperacion":
                isMatch = (game.gameModes || []).some((m) => m.toLowerCase().includes("coop")) || /cooperativ|amigos/.test(textCorpus)
                break
            case "competencia":
                isMatch = (game.gameModes || []).some((m) => m.toLowerCase().includes("competitiv")) || /competitiv|versus|pvp|battle royale/.test(textCorpus)
                break
            case "supervivencia":
                isMatch = /supervivencia|sobrevivir|recursos|hambre/.test(textCorpus)
                break
            case "desafio_progresion":
                isMatch = game.difficulty === "alta" || /desafiante|reto|superacion|dificultad|derrota/.test(textCorpus)
                break
            default:
                break
        }
        if (isMatch) {
            matchedLiked.push(featId)
        }
    }

    const matchedDisliked = []
    let isSevereConflict = false

    for (const featId of dislikedFeatures) {
        if (featId === "combate_dificil") {
            const hasHardCombat = (game.difficulty === "alta" || /desafiante|reto/.test(textCorpus)) &&
                                  /combate|accion|lucha|boss|hack and slash|soulslike|roguelike/.test(textCorpus)
            if (hasHardCombat) {
                matchedDisliked.push(featId)
                isSevereConflict = true
            }
        } else if (featId === "combate_accion") {
            if (/combate|accion|pelea|dispar|lucha|fps|hack and slash/.test(textCorpus)) {
                matchedDisliked.push(featId)
            }
        } else if (featId === "construccion_creatividad") {
            if (/constru|creativ|sandbox|baldosa|crafteo/.test(textCorpus)) {
                matchedDisliked.push(featId)
            }
        } else if (featId === "estrategia_planificacion") {
            if (/estrategia|planific|gestion|tactico/.test(textCorpus)) {
                matchedDisliked.push(featId)
            }
        } else if (featId === "puzzles_acertijos") {
            if (/puzzle|acertijo|rompecabezas|logica/.test(textCorpus)) {
                matchedDisliked.push(featId)
            }
        } else if (featId === "supervivencia") {
            if (/supervivencia|sobrevivir|recursos/.test(textCorpus)) {
                matchedDisliked.push(featId)
            }
        } else if (featId === "desafio_progresion") {
            if (game.difficulty === "alta" || /desafiante|dificil/.test(textCorpus)) {
                matchedDisliked.push(featId)
            }
        }
    }

    return {
        matchedLiked,
        matchedDisliked,
        isSevereConflict
    }
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
        similarTo = [],
        likedGames = [],
        dislikedGames = [],
        likedFeatures = [],
        dislikedFeatures = [],
        discoveryPreference = null
    } = criteria

    const baseWeights = {
        genreWeight: options.genreWeight ?? 0.30,
        emotionWeight: options.emotionWeight ?? 0.30,
        timeWeight: options.timeWeight ?? 0.15,
        modeWeight: options.modeWeight ?? 0.15,
        pacingWeight: options.pacingWeight ?? 0.10,
        featureWeight: options.featureWeight ?? 0.20,
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
    const hasFeatures = likedFeatures.length > 0

    // Calcular suma de pesos activos para normalización
    let activeWeightSum = 0
    if (hasGenre) activeWeightSum += baseWeights.genreWeight
    if (hasEmotion) activeWeightSum += baseWeights.emotionWeight
    if (hasTime) activeWeightSum += baseWeights.timeWeight
    if (hasMode) activeWeightSum += baseWeights.modeWeight
    if (hasPacing) activeWeightSum += baseWeights.pacingWeight
    if (hasFeatures) activeWeightSum += baseWeights.featureWeight

    // Si no especificó criterios o son 0, usar pesos base
    if (activeWeightSum === 0) activeWeightSum = 1.0

    const normalizedWeights = {
        genre: hasGenre ? baseWeights.genreWeight / activeWeightSum : 0,
        emotion: hasEmotion ? baseWeights.emotionWeight / activeWeightSum : 0,
        time: hasTime ? baseWeights.timeWeight / activeWeightSum : 0,
        mode: hasMode ? baseWeights.modeWeight / activeWeightSum : 0,
        pacing: hasPacing ? baseWeights.pacingWeight / activeWeightSum : 0,
        feature: hasFeatures ? baseWeights.featureWeight / activeWeightSum : 0
    }

    // Obtener catálogo completo
    let allGames = []
    try {
        allGames = await Game.find({})
    } catch (e) {}
    if (!allGames || allGames.length === 0) {
        allGames = require("../data/seedGames.json")
    }
    const expandedEmotions = expandEmotionalTerms(emotionalContext)
    const excludeTitles = [
        ...(options.excludeTitles || []),
        ...(criteria.excludeTitles || [])
    ].map((t) => t.toLowerCase().trim())

    const scoredGames = []

    for (const game of allGames) {
        // --- 0. EXCLUSIÓN DE TÍTULOS ESPECÍFICOS (Rechazados o ya mostrados) ---
        if (excludeTitles.length > 0 && excludeTitles.includes(game.title.toLowerCase().trim())) {
            continue
        }

        // --- 0b. EXCLUSIÓN DE JUEGOS RECHAZADOS POR EL JUGADOR (Regla 8.1 - dislikedGames) ---
        const isDislikedGame = dislikedGames.some((d) => game.title.toLowerCase().trim() === d.toLowerCase().trim())
        if (isDislikedGame) {
            continue
        }

        // --- 0c. EXCLUSIÓN DE JUEGOS DISFRUTADOS PREVIAMENTE (Regla 8.2 - likedGames) ---
        const isAlreadyLiked = likedGames.some((l) => game.title.toLowerCase().trim() === l.toLowerCase().trim())
        if (isAlreadyLiked && (discoveryPreference === "diferente" || options.excludeLikedGames !== false)) {
            continue
        }

        // --- 1. FILTRO DE EXCLUSIÓN ESTRICTO (Disliked Genres) ---
        const matchesDisliked = dislikedGenres.some((disliked) =>
            game.genres.some((g) => g.toLowerCase().includes(disliked.toLowerCase()))
        )

        if (matchesDisliked) {
            continue // Se descarta por completo
        }

        // --- 1b. EVALUACIÓN DE CARACTERÍSTICAS (Regla 8.3 - likedFeatures / dislikedFeatures) ---
        const featureEval = evaluateGameFeatures(game, likedFeatures, dislikedFeatures)
        if (featureEval.isSevereConflict) {
            continue // Descartar títulos en conflicto severo (ej. combate difícil cuando fue rechazado)
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

        // --- 7. EVALUACIÓN DE CARACTERÍSTICAS DISFRUTADAS (Feature Score) ---
        let featureScore = 1.0
        if (hasFeatures) {
            featureScore = featureEval.matchedLiked.length / likedFeatures.length
            if (featureScore > 1) featureScore = 1.0
        }

        // --- 8. EVALUACIÓN DE SIMILITUD Y PREFERENCIA DE DESCUBRIMIENTO (Reglas 8.2 y 8.4) ---
        let similarScore = 0
        const matchedSimilar = []
        const matchedLikedGames = []

        const referenceTitles = [...new Set([...similarTo, ...likedGames])]

        if (referenceTitles.length > 0) {
            for (const ref of referenceTitles) {
                const found = game.similarTo.find(
                    (s) => s.toLowerCase().includes(ref.toLowerCase()) || ref.toLowerCase().includes(s.toLowerCase())
                )
                if (found) {
                    matchedSimilar.push(found)
                    if (likedGames.some((l) => l.toLowerCase() === ref.toLowerCase())) {
                        matchedLikedGames.push(ref)
                    }
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
            normalizedWeights.pacing * pacingScore +
            normalizedWeights.feature * featureScore

        // Ajustes por preferencia de descubrimiento
        if (discoveryPreference === "diferente") {
            if (similarScore > 0) {
                finalScore -= 0.15 // Despriorizar similares a juegos ya conocidos
            }
        } else if (discoveryPreference === "similar") {
            if (similarScore > 0) {
                finalScore += (baseWeights.similarBonus + 0.05) // Mayor impulso cuando busca parecido
            }
        } else {
            if (similarScore > 0) {
                finalScore += baseWeights.similarBonus
            }
        }

        // Penalización por características evitadas leves
        if (featureEval.matchedDisliked.length > 0) {
            finalScore -= 0.20 * featureEval.matchedDisliked.length
        }

        // Normalizar a escala 0 - 100
        const normalizedScore = Math.min(Math.max(Math.round(finalScore * 100), 0), 100)

        scoredGames.push({
            game,
            score: normalizedScore,
            breakdown: {
                genreScore: Math.round(genreScore * 100),
                emotionScore: Math.round(emotionScore * 100),
                timeScore: Math.round(timeScore * 100),
                modeScore: Math.round(modeScore * 100),
                pacingScore: Math.round(pacingScore * 100),
                featureScore: Math.round(featureScore * 100),
                similarBonus: similarScore > 0 && discoveryPreference !== "diferente"
            },
            matchFactors: {
                matchedGenres,
                matchedEmotions,
                matchedSimilar,
                matchedLikedGames,
                matchedFeatures: featureEval.matchedLiked,
                matchedDislikedFeatures: featureEval.matchedDisliked,
                discoveryPreference,
                sessionDuration: game.sessionDuration,
                pacing: game.pacing,
                gameModes: game.gameModes
            }
        })
    }

    // Ordenar descendente por afinidad
    scoredGames.sort((a, b) => b.score - a.score)

    let results = scoredGames
    if (typeof options.minScore === "number") {
        results = results.filter((item) => item.score >= options.minScore)
    }

    return results.slice(0, limit)
}

module.exports = {
    evaluateRecommendations,
    calculateTimeScore,
    expandEmotionalTerms,
    evaluateGameFeatures
}
