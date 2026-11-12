const Game = require("../models/Game")
const {
    calculateGameSimilarity,
    calculateBatchDiversity,
    selectDiverseRecommendations,
    normalizeDiscoveryMode,
    getDiscoveryConfig,
    explainBatchDiversity
} = require("./diversityService")

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
            case "pixel_art":
                isMatch = /pixel art|pixelado|retro|estilo retro/.test(textCorpus) || (game.visualStyle && /pixel/i.test(game.visualStyle))
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
        } else if (featId === "pixel_art") {
            if (/pixel art|pixelado|retro|estilo retro/.test(textCorpus) || (game.visualStyle && /pixel/i.test(game.visualStyle))) {
                matchedDisliked.push(featId)
                isSevereConflict = true
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
 * Evalúa compatibilidad de un atributo graduable de experiencia (0 a 5 o null).
 * Si el atributo es desconocido (null/undefined), se evalúa con 0.50 (neutro)
 * y se marca como desconocido para reflejarlo en la cobertura sin inventar datos.
 *
 * @param {number|null} gameValue Valor real del videojuego [0..5] o null
 * @param {string|Object} preference Preferencia deseada ("alto", "bajo", "ninguno")
 * @returns {Object} { score: number, isUnknown: boolean }
 */
function scoreExperienceAttribute(gameValue, preference) {
    if (gameValue === null || gameValue === undefined) {
        return { score: 0.50, isUnknown: true }
    }
    if (!preference) {
        return { score: 1.0, isUnknown: false }
    }

    const pref = typeof preference === "string" ? preference.toLowerCase().trim() : (preference.desired || "").toLowerCase().trim()

    if (pref === "alto" || pref === "alta") {
        // Escala [0..5] para preferencia alta: 5 -> 1.0, 4 -> 0.88, 3 -> 0.70, 2 -> 0.45, 1 -> 0.20, 0 -> 0.0
        const table = [0.0, 0.20, 0.45, 0.70, 0.88, 1.0]
        const score = table[gameValue] ?? (gameValue / 5)
        return { score, isUnknown: false }
    }

    if (pref === "bajo" || pref === "baja") {
        // Escala [0..5] para preferencia baja: 0 -> 1.0, 1 -> 0.90, 2 -> 0.75, 3 -> 0.40, 4 -> 0.15, 5 -> 0.0
        const table = [1.0, 0.90, 0.75, 0.40, 0.15, 0.0]
        const score = table[gameValue] ?? (1 - gameValue / 5)
        return { score, isUnknown: false }
    }

    if (pref === "ninguno" || pref === "ninguna" || pref === "cero") {
        // Cero absoluto: 0 -> 1.0, 1 -> 0.60, 2 -> 0.20, >= 3 -> 0.0
        const table = [1.0, 0.60, 0.20, 0.0, 0.0, 0.0]
        const score = table[gameValue] ?? 0.0
        return { score, isUnknown: false }
    }

    return { score: 1.0, isUnknown: false }
}

/**
 * Evalúa compatibilidad del estilo de objetivos (libre, guiado, mixto).
 *
 * @param {string|null} gameObjectiveStyle Estilo en catálogo
 * @param {string|null} requestedStyle Estilo solicitado
 * @returns {Object} { score: number, isUnknown: boolean }
 */
function scoreObjectiveStyle(gameObjectiveStyle, requestedStyle) {
    if (!requestedStyle) return { score: 1.0, isUnknown: false }
    if (!gameObjectiveStyle) return { score: 0.50, isUnknown: true }

    const gameVal = gameObjectiveStyle.toLowerCase().trim()
    const reqVal = requestedStyle.toLowerCase().trim()

    if (reqVal === "guiado") {
        if (gameVal === "guiado") return { score: 1.0, isUnknown: false }
        if (gameVal === "mixto") return { score: 0.75, isUnknown: false }
        return { score: 0.20, isUnknown: false }
    }
    if (reqVal === "libre") {
        if (gameVal === "libre") return { score: 1.0, isUnknown: false }
        if (gameVal === "mixto") return { score: 0.75, isUnknown: false }
        return { score: 0.20, isUnknown: false }
    }
    if (reqVal === "mixto") {
        if (gameVal === "mixto") return { score: 1.0, isUnknown: false }
        return { score: 0.70, isUnknown: false }
    }
    return { score: 1.0, isUnknown: false }
}

/**
 * Evalúa compatibilidad de nivel de dificultad (baja, media, alta, ajustable).
 *
 * @param {string|null} gameDifficulty Dificultad en catálogo
 * @param {string|null} requestedDifficulty Dificultad solicitada
 * @param {boolean} isStrict Si se descarta en caso de discordancia
 * @returns {Object} { score: number, isUnknown: boolean, isDiscard: boolean }
 */
function scoreDifficulty(gameDifficulty, requestedDifficulty, isStrict = false) {
    if (!requestedDifficulty) return { score: 1.0, isUnknown: false, isDiscard: false }
    if (!gameDifficulty) return { score: 0.50, isUnknown: true, isDiscard: false }

    const gameVal = gameDifficulty.toLowerCase().trim()
    let reqVal = requestedDifficulty.toLowerCase().trim()
    if (reqVal === "relajada" || reqVal === "facil" || reqVal === "fácil") reqVal = "baja"
    if (reqVal === "equilibrada" || reqVal === "moderada") reqVal = "media"
    if (reqVal === "desafiante" || reqVal === "dificil" || reqVal === "difícil") reqVal = "alta"

    if (reqVal === "baja") {
        if (gameVal === "baja") return { score: 1.0, isUnknown: false, isDiscard: false }
        if (gameVal === "ajustable") return { score: 0.90, isUnknown: false, isDiscard: false }
        if (gameVal === "media") return { score: 0.45, isUnknown: false, isDiscard: isStrict }
        if (gameVal === "alta") return { score: 0.05, isUnknown: false, isDiscard: isStrict }
    }
    if (reqVal === "alta") {
        if (gameVal === "alta") return { score: 1.0, isUnknown: false, isDiscard: false }
        if (gameVal === "ajustable") return { score: 0.85, isUnknown: false, isDiscard: false }
        if (gameVal === "media") return { score: 0.40, isUnknown: false, isDiscard: isStrict }
        if (gameVal === "baja") return { score: 0.05, isUnknown: false, isDiscard: isStrict }
    }
    if (reqVal === "media") {
        if (gameVal === "media") return { score: 1.0, isUnknown: false, isDiscard: false }
        if (gameVal === "ajustable") return { score: 0.90, isUnknown: false, isDiscard: false }
        if (gameVal === "baja") return { score: 0.60, isUnknown: false, isDiscard: false }
        if (gameVal === "alta") return { score: 0.50, isUnknown: false, isDiscard: false }
    }
    if (reqVal === "ajustable") {
        if (gameVal === "ajustable") return { score: 1.0, isUnknown: false, isDiscard: false }
        return { score: 0.75, isUnknown: false, isDiscard: false }
    }

    return { score: 1.0, isUnknown: false, isDiscard: false }
}

/**
 * Evalúa compatibilidad de precio (Gratuito, De pago, Free-to-play).
 *
 * @param {string|null} gamePrice Condición de precio en catálogo
 * @param {string|null} requestedPrice Preferencia solicitada ("gratuito", "de pago")
 * @param {boolean} isStrict Si es un filtro estricto obligatorio
 * @returns {Object} { score: number, isUnknown: boolean, isDiscard: boolean }
 */
function evaluatePrice(gamePrice, requestedPrice, isStrict = false) {
    if (!requestedPrice) return { score: 1.0, isUnknown: false, isDiscard: false }
    if (!gamePrice) return { score: 0.50, isUnknown: true, isDiscard: false }

    const gameVal = gamePrice.toLowerCase().trim()
    const reqVal = requestedPrice.toLowerCase().trim()

    if (reqVal === "gratuito" || reqVal === "gratis" || reqVal === "free-to-play" || reqVal === "f2p") {
        const isFree = gameVal.includes("gratuito") || gameVal.includes("free")
        if (isFree) {
            return { score: 1.0, isUnknown: false, isDiscard: false }
        }
        if (isStrict) {
            return { score: 0.0, isUnknown: false, isDiscard: true }
        }
        return { score: 0.15, isUnknown: false, isDiscard: false }
    }

    if (reqVal === "de pago") {
        if (gameVal.includes("pago")) return { score: 1.0, isUnknown: false, isDiscard: false }
        return { score: 0.80, isUnknown: false, isDiscard: false }
    }

    return { score: 1.0, isUnknown: false, isDiscard: false }
}

/**
 * Motor de recomendación multicriterio con normalización dinámica de pesos,
 * evaluación de atributos de experiencia graduables y calibración epistémica de afinidad.
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
        isDifficultyStrict = false,
        pricePreference = null,
        isPriceStrict = false,
        objectiveStylePreference = null,
        experiencePreferences = {},
        similarTo = [],
        likedGames = [],
        dislikedGames = [],
        likedFeatures = [],
        dislikedFeatures = [],
        discoveryPreference = null
    } = criteria

    const baseWeights = {
        genreWeight: options.genreWeight ?? 0.25,
        emotionWeight: options.emotionWeight ?? 0.20,
        timeWeight: options.timeWeight ?? 0.15,
        modeWeight: options.modeWeight ?? 0.15,
        pacingWeight: options.pacingWeight ?? 0.10,
        featureWeight: options.featureWeight ?? 0.15,
        expWeightPerAttr: options.expWeightPerAttr ?? 0.12,
        objectiveWeight: options.objectiveWeight ?? 0.15,
        difficultyWeight: options.difficultyWeight ?? 0.15,
        priceWeight: options.priceWeight ?? 0.15,
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
    const hasObjective = !!objectiveStylePreference
    const hasDifficulty = !!desiredDifficulty
    const hasPrice = !!pricePreference

    // Extraer atributos de experiencia graduables especificados
    const activeExpAttrs = Object.entries(experiencePreferences || {})
        .filter(([_, pref]) => pref != null)
        .map(([attr, pref]) => ({ attr, pref }))
    const hasExpAttrs = activeExpAttrs.length > 0

    // Calcular suma de pesos activos para normalización estricta (Sección 5)
    let activeWeightSum = 0
    if (hasGenre) activeWeightSum += baseWeights.genreWeight
    if (hasEmotion) activeWeightSum += baseWeights.emotionWeight
    if (hasTime) activeWeightSum += baseWeights.timeWeight
    if (hasMode) activeWeightSum += baseWeights.modeWeight
    if (hasPacing) activeWeightSum += baseWeights.pacingWeight
    if (hasFeatures) activeWeightSum += baseWeights.featureWeight
    if (hasExpAttrs) activeWeightSum += (baseWeights.expWeightPerAttr * activeExpAttrs.length)
    if (hasObjective) activeWeightSum += baseWeights.objectiveWeight
    if (hasDifficulty) activeWeightSum += baseWeights.difficultyWeight
    if (hasPrice) activeWeightSum += baseWeights.priceWeight

    // Si no especificó criterios o son 0, usar pesos base
    if (activeWeightSum === 0) activeWeightSum = 1.0

    const normalizedWeights = {
        genre: hasGenre ? baseWeights.genreWeight / activeWeightSum : 0,
        emotion: hasEmotion ? baseWeights.emotionWeight / activeWeightSum : 0,
        time: hasTime ? baseWeights.timeWeight / activeWeightSum : 0,
        mode: hasMode ? baseWeights.modeWeight / activeWeightSum : 0,
        pacing: hasPacing ? baseWeights.pacingWeight / activeWeightSum : 0,
        feature: hasFeatures ? baseWeights.featureWeight / activeWeightSum : 0,
        expPerAttr: hasExpAttrs ? baseWeights.expWeightPerAttr / activeWeightSum : 0,
        objective: hasObjective ? baseWeights.objectiveWeight / activeWeightSum : 0,
        difficulty: hasDifficulty ? baseWeights.difficultyWeight / activeWeightSum : 0,
        price: hasPrice ? baseWeights.priceWeight / activeWeightSum : 0
    }

    // Contar dimensiones activas únicas para calibración de certeza (Sección 8)
    const activeDimensionsList = []
    if (hasGenre) activeDimensionsList.push("género")
    if (hasEmotion) activeDimensionsList.push("emoción")
    if (hasTime) activeDimensionsList.push("tiempo")
    if (hasMode) activeDimensionsList.push("modalidad")
    if (hasPacing) activeDimensionsList.push("ritmo")
    if (hasFeatures) activeDimensionsList.push("características")
    if (hasExpAttrs) activeDimensionsList.push("atributos de experiencia")
    if (hasObjective) activeDimensionsList.push("estilo de objetivos")
    if (hasDifficulty) activeDimensionsList.push("dificultad")
    if (hasPrice) activeDimensionsList.push("precio")
    if (similarTo.length > 0 || likedGames.length > 0) activeDimensionsList.push("juegos de referencia")

    const K = activeDimensionsList.length
    // Factor de calibración: evita que 1 criterio aislado reporte certeza inflada del 100%
    const certaintyFactor = K === 1 ? 0.78 : K === 2 ? 0.90 : 1.00

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

        // --- 1. FILTRO DE EXCLUSIÓN ESTRICTO POR GÉNERO (Disliked Genres - ej. Terror) ---
        const matchesDisliked = dislikedGenres.some((disliked) =>
            game.genres.some((g) => g.toLowerCase().includes(disliked.toLowerCase()))
        )
        if (matchesDisliked) {
            continue // Descarte estricto
        }

        // --- 1b. EVALUACIÓN DE CARACTERÍSTICAS (likedFeatures / dislikedFeatures) ---
        const featureEval = evaluateGameFeatures(game, likedFeatures, dislikedFeatures)
        if (featureEval.isSevereConflict) {
            continue // Descartar títulos en conflicto severo (ej. combate difícil cuando fue rechazado)
        }

        // --- 1c. FILTRO ESTRICTO DE CONDICIÓN DE PRECIO (Sección 7) ---
        let priceScore = 1.0
        let priceDetails = null
        if (hasPrice) {
            const priceRes = evaluatePrice(game.priceCondition, pricePreference, isPriceStrict)
            if (priceRes.isDiscard) {
                continue // Descarte estricto si solo quería gratuitos y el juego es de pago
            }
            priceScore = priceRes.score
            priceDetails = {
                gameValue: game.priceCondition,
                requested: pricePreference,
                score: priceRes.score,
                isUnknown: priceRes.isUnknown
            }
        }

        // --- 1d. FILTRO ESTRICTO DE COMBATE PROHIBIDO (Sección 7) ---
        const reqCombat = experiencePreferences?.combat
        const expCombatVal = game.experienceAttributes ? game.experienceAttributes.combat : null
        if ((reqCombat === "ninguno" || dislikedFeatures.includes("combate_accion")) && expCombatVal != null && expCombatVal >= 4) {
            continue // Descartar títulos de combate continuo/intenso si pidió expresamente cero combates
        }

        // --- 1e. FILTRO ESTRICTO DE DIFICULTAD (si isDifficultyStrict) ---
        let difficultyScore = 1.0
        let difficultyDetails = null
        if (hasDifficulty) {
            const diffRes = scoreDifficulty(game.difficulty, desiredDifficulty, isDifficultyStrict)
            if (diffRes.isDiscard) {
                continue
            }
            difficultyScore = diffRes.score
            difficultyDetails = {
                gameValue: game.difficulty,
                requested: desiredDifficulty,
                score: diffRes.score,
                isUnknown: diffRes.isUnknown
            }
        }

        // --- 2. EVALUACIÓN DE MODO DE JUEGO (Filtro estricto cooperativo) ---
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

        // --- 8. EVALUACIÓN DE ATRIBUTOS GRADUABLES DE EXPERIENCIA (Etapa 3 - Sección 6) ---
        const matchedExpDetails = []
        if (hasExpAttrs) {
            for (const { attr, pref } of activeExpAttrs) {
                const gameAttrVal = game.experienceAttributes ? game.experienceAttributes[attr] : null
                const evalRes = scoreExperienceAttribute(gameAttrVal, pref)
                matchedExpDetails.push({
                    attribute: attr,
                    gameValue: gameAttrVal,
                    requestedPreference: pref,
                    score: evalRes.score,
                    isUnknown: evalRes.isUnknown
                })
            }
        }

        // --- 9. EVALUACIÓN DE ESTILO DE OBJETIVOS (Etapa 3) ---
        let objectiveScore = 1.0
        let objectiveDetails = null
        if (hasObjective) {
            const objRes = scoreObjectiveStyle(game.objectiveStyle, objectiveStylePreference)
            objectiveScore = objRes.score
            objectiveDetails = {
                gameValue: game.objectiveStyle,
                requested: objectiveStylePreference,
                score: objRes.score,
                isUnknown: objRes.isUnknown
            }
        }

        // --- 10. EVALUACIÓN DE SIMILITUD Y PREFERENCIA DE DESCUBRIMIENTO ---
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

        // --- CÁLCULO PONDERADO NORMALIZADO (Sección 5) ---
        let finalWeightedScore =
            normalizedWeights.genre * genreScore +
            normalizedWeights.emotion * emotionScore +
            normalizedWeights.time * timeScore +
            normalizedWeights.mode * modeScore +
            normalizedWeights.pacing * pacingScore +
            normalizedWeights.feature * featureScore +
            normalizedWeights.objective * objectiveScore +
            normalizedWeights.difficulty * difficultyScore +
            normalizedWeights.price * priceScore

        if (hasExpAttrs) {
            for (const expItem of matchedExpDetails) {
                finalWeightedScore += normalizedWeights.expPerAttr * expItem.score
            }
        }

        // Ajustes por preferencia de descubrimiento (Etapa 4)
        if (discoveryPreference === "diferente" || discoveryPreference === "exploratory") {
            if (similarScore > 0) {
                finalWeightedScore -= 0.15 // Despriorizar similares a juegos ya conocidos
            }
            if (likedGames.length > 0) {
                // Impulso a títulos contrastantes frente a los videojuegos ya disfrutados
                let maxSimToLiked = 0
                for (const lTitle of likedGames) {
                    const lGame = allGames.find(g => g.title.toLowerCase().trim() === lTitle.toLowerCase().trim())
                    if (lGame) {
                        const s = calculateGameSimilarity(game, lGame)
                        if (s > maxSimToLiked) maxSimToLiked = s
                    }
                }
                const contrastBonus = (1.0 - maxSimToLiked) * 0.25
                finalWeightedScore += contrastBonus
            }
        } else if (discoveryPreference === "similar" || discoveryPreference === "familiar") {
            if (similarScore > 0) {
                finalWeightedScore += (baseWeights.similarBonus + 0.05) // Mayor impulso cuando busca parecido
            }
        } else {
            if (similarScore > 0) {
                finalWeightedScore += baseWeights.similarBonus
            }
        }

        // Penalización por características evitadas leves
        if (featureEval.matchedDisliked.length > 0) {
            finalWeightedScore -= 0.20 * featureEval.matchedDisliked.length
        }

        // Coincidencia estricta en escala 0.0 a 1.0
        const rawMatchScore = Math.min(Math.max(finalWeightedScore, 0.0), 1.0)

        // Calibración de certeza epistémica (Sección 8):
        // Con 1 o 2 criterios aislados, la afinidad estimada no alcanza 100% artificial
        const normalizedScore = Math.min(Math.max(Math.round(rawMatchScore * certaintyFactor * 100), 0), 100)

        // Detección de advertencias transparentes (caveats - Sección 9)
        const caveats = []
        if ((reqCombat === "bajo" || reqCombat === "ninguno") && expCombatVal != null && expCombatVal >= 2 && expCombatVal < 4) {
            caveats.push("Ten en cuenta que incluye algunos enfrentamientos ligeros, aunque el combate no es su foco principal.")
        }
        if (objectiveStylePreference === "guiado" && game.objectiveStyle === "mixto") {
            caveats.push("Ten en cuenta que combina objetivos guiados con zonas de exploración libre.")
        }
        if (objectiveStylePreference === "libre" && game.objectiveStyle === "mixto") {
            caveats.push("Ten en cuenta que ofrece libertad de acción pero incluye ciertas misiones estructuradas.")
        }
        if (desiredDifficulty === "baja" && game.difficulty === "ajustable") {
            caveats.push("Ten en cuenta que dispone de dificultad personalizable en sus ajustes para una experiencia accesible.")
        }

        // Lista de restricciones satisfechas verificables
        const restrictionsSatisfied = []
        if (dislikedGenres.length > 0) restrictionsSatisfied.push(`exclusión de ${dislikedGenres.join(", ")}`)
        if (isPriceStrict && hasPrice) restrictionsSatisfied.push("acceso gratuito estricto")
        if (hasMode && (gameMode.includes("coop") || gameMode.includes("multi"))) restrictionsSatisfied.push(`soporte ${gameMode}`)
        if (reqCombat === "ninguno") restrictionsSatisfied.push("sin combates exigentes")

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
                objectiveScore: Math.round(objectiveScore * 100),
                difficultyScore: Math.round(difficultyScore * 100),
                priceScore: Math.round(priceScore * 100),
                experienceScores: matchedExpDetails.reduce((acc, curr) => {
                    acc[curr.attribute] = Math.round(curr.score * 100)
                    return acc
                }, {}),
                matchScore: Math.round(rawMatchScore * 100),
                coveragePercent: Math.min(Math.round((K / 4) * 100), 100),
                confidenceLevel: K === 1 ? "Estimación preliminar (criterio único)" : K === 2 ? "Estimación moderada (2 criterios)" : "Estimación sólida (multicriterio)",
                evaluatedDimensions: activeDimensionsList,
                restrictionsSatisfied,
                similarBonus: similarScore > 0 && discoveryPreference !== "diferente"
            },
            matchFactors: {
                matchedGenres,
                matchedEmotions,
                matchedSimilar,
                matchedLikedGames,
                matchedFeatures: featureEval.matchedLiked,
                matchedDislikedFeatures: featureEval.matchedDisliked,
                matchedExperienceAttributes: matchedExpDetails,
                objectiveDetails,
                difficultyDetails,
                priceDetails,
                caveats,
                discoveryPreference,
                sessionDuration: game.sessionDuration,
                pacing: game.pacing,
                gameModes: game.gameModes
            }
        })
    }

    // Ordenar descendente por afinidad individual (Etapa 3)
    scoredGames.sort((a, b) => b.score - a.score)

    let results = scoredGames
    if (typeof options.minScore === "number") {
        results = results.filter((item) => item.score >= options.minScore)
    }

    // --- SELECCIÓN DIVERSA CON RELEVANCIA MARGINAL MÁXIMA (Etapa 4) ---
    // Conserva la afinidad individual y aplica selección balanceada por MMR
    const defaultMode = (criteria.similarTo?.length > 0 && !criteria.discoveryPreference) ? "familiar" : "balanced"
    const mode = options.discoveryMode || criteria.discoveryPreference || options.mode || defaultMode
    const diverseResults = selectDiverseRecommendations(results, {
        limit,
        discoveryMode: mode,
        disableDiversity: options.disableDiversity === true,
        forceMMR: options.forceMMR === true
    })

    return diverseResults
}

module.exports = {
    evaluateRecommendations,
    calculateTimeScore,
    expandEmotionalTerms,
    evaluateGameFeatures,
    scoreExperienceAttribute,
    scoreObjectiveStyle,
    scoreDifficulty,
    evaluatePrice,
    calculateGameSimilarity,
    calculateBatchDiversity,
    selectDiverseRecommendations,
    normalizeDiscoveryMode,
    getDiscoveryConfig,
    explainBatchDiversity
}
