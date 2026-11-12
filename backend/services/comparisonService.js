const Game = require("../models/Game")
const seedGames = require("../data/seedGames.json")
const { cleanText } = require("./nlpService")
const {
    calculateTimeScore,
    expandEmotionalTerms,
    evaluateGameFeatures,
    scoreExperienceAttribute,
    scoreObjectiveStyle,
    scoreDifficulty,
    evaluatePrice,
    calculateGameSimilarity
} = require("./recommendationEngine")

/**
 * Obtiene el documento o registro completo de un videojuego por su título.
 * Búsqueda insensible a mayúsculas/acentos en MongoDB con respaldo en catálogo semilla.
 *
 * @param {string} title Título del juego
 * @returns {Promise<Object|null>} Objeto del juego o null si no existe
 */
async function getGameDetails(title = "") {
    if (!title || typeof title !== "string") return null
    const clean = cleanText(title)
    if (!clean) return null

    // 1. Búsqueda en MongoDB
    try {
        const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const doc = await Game.findOne({
            title: new RegExp(`^${escaped}$`, "i")
        }).lean()
        if (doc) return doc
    } catch (e) {
        // En entornos sin MongoDB activo, se continúa al catálogo en memoria
    }

    // 2. Búsqueda en seedGames (exacta o por inclusión)
    const exactSeed = seedGames.find((g) => cleanText(g.title) === clean)
    if (exactSeed) return exactSeed

    const partialSeed = seedGames.find((g) => {
        const c = cleanText(g.title)
        return c.includes(clean) || clean.includes(c)
    })
    return partialSeed || null
}

/**
 * Cuenta cuántas dimensiones de preferencia activas existen en los criterios.
 *
 * @param {Object} criteria Criterios de búsqueda
 * @returns {number} Cantidad de dimensiones activas
 */
function countActiveCriteria(criteria = {}) {
    let count = 0
    if (Array.isArray(criteria.preferredGenres) && criteria.preferredGenres.length > 0) count++
    if (Array.isArray(criteria.emotionalContext) && criteria.emotionalContext.length > 0) count++
    if (criteria.availableTime) count++
    if (criteria.gameMode) count++
    if (criteria.desiredPacing) count++
    if (criteria.desiredDifficulty) count++
    if (criteria.pricePreference) count++
    if (criteria.objectiveStylePreference) count++
    if (Array.isArray(criteria.likedFeatures) && criteria.likedFeatures.length > 0) count++
    if (criteria.experiencePreferences) {
        const activeExp = Object.values(criteria.experiencePreferences).filter((v) => v != null)
        if (activeExp.length > 0) count += activeExp.length
    }
    return count
}

/**
 * Evalúa si un videojuego incumple alguna restricción estricta del jugador (Sección 7 y 14).
 *
 * @param {Object} game Objeto del juego
 * @param {Object} criteria Criterios acumulados del jugador
 * @returns {Object} { isRestricted: boolean, violations: string[] }
 */
function evaluateGameRestrictions(game, criteria = {}) {
    const violations = []
    if (!game) return { isRestricted: false, violations }

    // 1. Exclusión de géneros (dislikedGenres)
    if (Array.isArray(criteria.dislikedGenres) && criteria.dislikedGenres.length > 0) {
        for (const dg of criteria.dislikedGenres) {
            const hasDisliked = (game.genres || []).some((g) =>
                g.toLowerCase().includes(dg.toLowerCase())
            )
            if (hasDisliked) {
                violations.push(`Incluye el género ${dg}, el cual tienes en tu lista de exclusión.`)
            }
        }
    }

    // 2. Elementos o mecánicas evitadas (dislikedFeatures)
    if (Array.isArray(criteria.dislikedFeatures) && criteria.dislikedFeatures.length > 0) {
        const featureEval = evaluateGameFeatures(game, [], criteria.dislikedFeatures)
        if (featureEval.isSevereConflict) {
            violations.push("Incluye mecánicas o estilos que indicaste preferir evitar.")
        }
    }

    // 3. Condición de precio estricta (isPriceStrict && pricePreference === "gratuito")
    if (criteria.isPriceStrict && criteria.pricePreference === "gratuito") {
        if (game.priceCondition && game.priceCondition.toLowerCase().includes("pago")) {
            violations.push("Es un juego de pago, cuando solicitaste exclusivamente títulos gratuitos.")
        }
    }

    // 4. Modalidad estricta (cooperativo / multijugador)
    if (criteria.gameMode) {
        const reqMode = criteria.gameMode.toLowerCase()
        if (reqMode.includes("coop") || reqMode.includes("multi")) {
            const supports = (game.gameModes || []).some(
                (m) => m.toLowerCase().includes("coop") || m.toLowerCase().includes("multi")
            )
            if (!supports) {
                violations.push("No dispone de la modalidad cooperativa o multijugador solicitada.")
            }
        }
    }

    // 5. Combate prohibido estricto
    const reqCombat = criteria.experiencePreferences?.combat
    const expCombatVal = game.experienceAttributes?.combat
    if (
        (reqCombat === "ninguno" || (criteria.dislikedFeatures || []).includes("combate_accion")) &&
        expCombatVal != null &&
        expCombatVal >= 4
    ) {
        violations.push("Presenta combates intensos y continuos, habiendo solicitado una experiencia sin combate.")
    }

    // 6. Dificultad estricta
    if (criteria.isDifficultyStrict && criteria.desiredDifficulty) {
        const diffRes = scoreDifficulty(game.difficulty, criteria.desiredDifficulty, true)
        if (diffRes.isDiscard) {
            violations.push(`Su nivel de dificultad (${game.difficulty || "desconocido"}) no satisface tu preferencia estricta (${criteria.desiredDifficulty}).`)
        }
    }

    return {
        isRestricted: violations.length > 0,
        violations
    }
}

/**
 * Calcula la afinidad personalizada de un videojuego específico utilizando
 * el mismo motor multicriterio y pesos de recommendationEngine (Etapa 3 / 6).
 *
 * @param {Object} game Videojuego a evaluar
 * @param {Object} criteria Criterios activos del jugador
 * @returns {Object} { score: number|null, hasSufficientCriteria: boolean, breakdown, caveats, violations, isRestricted }
 */
function calculateGameAffinityForComparison(game, criteria = {}) {
    if (!game) {
        return {
            score: null,
            hasSufficientCriteria: false,
            breakdown: null,
            caveats: [],
            violations: [],
            isRestricted: false
        }
    }

    const activeCount = countActiveCriteria(criteria)
    if (activeCount === 0) {
        return {
            score: null,
            hasSufficientCriteria: false,
            breakdown: null,
            caveats: [],
            violations: [],
            isRestricted: false
        }
    }

    const {
        preferredGenres = [],
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
        likedFeatures = [],
        dislikedFeatures = []
    } = criteria

    const baseWeights = {
        genreWeight: 0.25,
        emotionWeight: 0.20,
        timeWeight: 0.15,
        modeWeight: 0.15,
        pacingWeight: 0.10,
        featureWeight: 0.15,
        expWeightPerAttr: 0.12,
        objectiveWeight: 0.15,
        difficultyWeight: 0.15,
        priceWeight: 0.15
    }

    const hasGenre = preferredGenres.length > 0
    const hasEmotion = emotionalContext.length > 0
    const hasTime = !!availableTime
    const hasMode = !!gameMode
    const hasPacing = !!desiredPacing
    const hasFeatures = likedFeatures.length > 0
    const hasObjective = !!objectiveStylePreference
    const hasDifficulty = !!desiredDifficulty
    const hasPrice = !!pricePreference

    const activeExpAttrs = Object.entries(experiencePreferences || {})
        .filter(([_, pref]) => pref != null)
        .map(([attr, pref]) => ({ attr, pref }))
    const hasExpAttrs = activeExpAttrs.length > 0

    let activeWeightSum = 0
    if (hasGenre) activeWeightSum += baseWeights.genreWeight
    if (hasEmotion) activeWeightSum += baseWeights.emotionWeight
    if (hasTime) activeWeightSum += baseWeights.timeWeight
    if (hasMode) activeWeightSum += baseWeights.modeWeight
    if (hasPacing) activeWeightSum += baseWeights.pacingWeight
    if (hasFeatures) activeWeightSum += baseWeights.featureWeight
    if (hasExpAttrs) activeWeightSum += baseWeights.expWeightPerAttr * activeExpAttrs.length
    if (hasObjective) activeWeightSum += baseWeights.objectiveWeight
    if (hasDifficulty) activeWeightSum += baseWeights.difficultyWeight
    if (hasPrice) activeWeightSum += baseWeights.priceWeight

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

    // 1. Géneros
    let genreScore = 1.0
    if (hasGenre) {
        let matched = 0
        for (const pref of preferredGenres) {
            if ((game.genres || []).some((g) => g.toLowerCase().includes(pref.toLowerCase()))) {
                matched++
            }
        }
        genreScore = Math.min(matched / preferredGenres.length, 1.0)
    }

    // 2. Emoción
    let emotionScore = 1.0
    if (hasEmotion) {
        const expandedReq = expandEmotionalTerms(emotionalContext)
        const gameTags = (game.emotionalTags || []).map((t) => t.toLowerCase())
        let matched = 0
        for (const req of expandedReq) {
            if (gameTags.includes(req.toLowerCase())) matched++
        }
        emotionScore = Math.min(matched / Math.max(emotionalContext.length, 1), 1.0)
    }

    // 3. Tiempo
    let timeScore = 1.0
    if (hasTime) {
        timeScore = calculateTimeScore(game.sessionDuration, availableTime)
    }

    // 4. Modo
    let modeScore = 1.0
    if (hasMode) {
        const reqMode = gameMode.toLowerCase().trim()
        const supports = (game.gameModes || []).some((m) => m.toLowerCase().includes(reqMode))
        modeScore = supports ? 1.0 : 0.0
    }

    // 5. Ritmo
    let pacingScore = 1.0
    if (hasPacing) {
        const reqPacing = desiredPacing.toLowerCase().trim()
        const gamePacing = (game.pacing || "").toLowerCase().trim()
        if (reqPacing === gamePacing) pacingScore = 1.0
        else if (reqPacing === "moderado" || gamePacing === "moderado") pacingScore = 0.65
        else pacingScore = 0.20
    }

    // 6. Características
    let featureScore = 1.0
    if (hasFeatures) {
        const featureEval = evaluateGameFeatures(game, likedFeatures, dislikedFeatures)
        featureScore = featureEval.matchedLiked.length / likedFeatures.length
        if (featureScore > 1) featureScore = 1.0
    }

    // 7. Estilo de objetivos
    let objectiveScore = 1.0
    if (hasObjective) {
        objectiveScore = scoreObjectiveStyle(game.objectiveStyle, objectiveStylePreference).score
    }

    // 8. Dificultad
    let difficultyScore = 1.0
    if (hasDifficulty) {
        difficultyScore = scoreDifficulty(game.difficulty, desiredDifficulty, isDifficultyStrict).score
    }

    // 9. Precio
    let priceScore = 1.0
    if (hasPrice) {
        priceScore = evaluatePrice(game.priceCondition, pricePreference, isPriceStrict).score
    }

    // 10. Atributos de experiencia
    let expScoreSum = 0
    if (hasExpAttrs) {
        for (const item of activeExpAttrs) {
            const gameVal = game.experienceAttributes ? game.experienceAttributes[item.attr] : null
            const res = scoreExperienceAttribute(gameVal, item.pref)
            expScoreSum += res.score
        }
    }

    let finalWeighted =
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
        finalWeighted += normalizedWeights.expPerAttr * expScoreSum
    }

    // Similaridad
    let similarScore = 0
    if (similarTo.length > 0) {
        const gameSimilar = (game.similarTo || []).map((s) => s.toLowerCase().trim())
        for (const reqSim of similarTo) {
            if (
                gameSimilar.some(
                    (s) => s.includes(reqSim.toLowerCase()) || reqSim.toLowerCase().includes(s)
                ) ||
                game.title.toLowerCase().includes(reqSim.toLowerCase())
            ) {
                similarScore = 0.15
                break
            }
        }
    }
    finalWeighted += similarScore

    // Factor de certeza epistémica
    let certaintyFactor = 1.0
    if (activeCount === 1) certaintyFactor = 0.70
    else if (activeCount === 2) certaintyFactor = 0.85
    else if (activeCount === 3) certaintyFactor = 0.95

    const rawMatch = Math.min(Math.max(finalWeighted, 0.0), 1.0)
    let normalizedScore = Math.min(Math.max(Math.round(rawMatch * certaintyFactor * 100), 0), 100)

    // Evaluar restricciones estrictas
    const { isRestricted, violations } = evaluateGameRestrictions(game, criteria)
    if (isRestricted) {
        // Si incumple una restricción explícita, se penaliza notablemente la afinidad
        normalizedScore = Math.min(normalizedScore, 35)
    }

    const caveats = []
    if (isRestricted) {
        caveats.push(...violations)
    }

    return {
        score: normalizedScore,
        hasSufficientCriteria: true,
        isRestricted,
        violations,
        caveats,
        breakdown: {
            genreScore: Math.round(genreScore * 100),
            emotionScore: Math.round(emotionScore * 100),
            timeScore: Math.round(timeScore * 100),
            modeScore: Math.round(modeScore * 100),
            pacingScore: Math.round(pacingScore * 100),
            featureScore: Math.round(featureScore * 100),
            difficultyScore: Math.round(difficultyScore * 100),
            priceScore: Math.round(priceScore * 100)
        }
    }
}

/**
 * Genera una explicación personalizada que contrasta de forma transparente y objetiva
 * ambos videojuegos a partir de sus metadatos reales y las preferencias del jugador.
 *
 * @param {Object} gameA Documento del primer videojuego
 * @param {Object} gameB Documento del segundo videojuego
 * @param {Object} affinityA Afinidad calculada para el juego A
 * @param {Object} affinityB Afinidad calculada para el juego B
 * @param {Object} criteria Criterios activos del jugador
 * @param {string} aspect Aspecto específico a contrastar (general, tranquilidad, dificultad, duracion, etc.)
 * @returns {string} Explicación comparativa personalizada
 */
function generateComparativeExplanation(gameA, gameB, affinityA, affinityB, criteria = {}, aspect = "general") {
    if (!gameA || !gameB) return ""

    const parts = []

    // 1. Similitudes y puntos de contacto
    const sharedGenres = (gameA.genres || []).filter((g) =>
        (gameB.genres || []).some((bg) => bg.toLowerCase() === g.toLowerCase())
    )
    if (sharedGenres.length > 0) {
        parts.push(`Ambos títulos comparten el género **${sharedGenres.slice(0, 2).join(" y ")}**.`)
    } else {
        parts.push(`**${gameA.title}** y **${gameB.title}** pertenecen a géneros diferentes (${gameA.genres?.[0] || "Aventura"} frente a ${gameB.genres?.[0] || "Estrategia"}), ofreciendo propuestas lúdicas muy distintas.`)
    }

    // 2. Diferencias clave en atributos de experiencia
    const expA = gameA.experienceAttributes || {}
    const expB = gameB.experienceAttributes || {}

    const diffSentences = []

    // Aspecto específico solicitado por el usuario
    if (aspect === "tranquilidad") {
        const isARelaxing = gameA.pacing === "relajado" || (gameA.emotionalTags || []).includes("relajante")
        const isBRelaxing = gameB.pacing === "relajado" || (gameB.emotionalTags || []).includes("relajante")
        if (isARelaxing && !isBRelaxing) {
            diffSentences.push(`En cuanto a tranquilidad, **${gameA.title}** tiene un enfoque más relajado y pacífico, mientras que **${gameB.title}** prioriza un ritmo ${gameB.pacing || "intenso"} con mayor exigencia.`)
        } else if (!isARelaxing && isBRelaxing) {
            diffSentences.push(`En cuanto a tranquilidad, **${gameB.title}** es considerablemente más tranquilo y relajado, mientras que **${gameA.title}** ofrece un ritmo ${gameA.pacing || "intenso"}.`)
        } else if (isARelaxing && isBRelaxing) {
            diffSentences.push(`Tanto **${gameA.title}** como **${gameB.title}** ofrecen experiencias relajantes y tranquilas sin presiones.`)
        }
    } else if (aspect === "dificultad") {
        diffSentences.push(`En cuanto a desafío y dificultad, **${gameA.title}** presenta dificultad ${gameA.difficulty || "media"} y ritmo ${gameA.pacing || "moderado"}, mientras que **${gameB.title}** ofrece dificultad ${gameB.difficulty || "media"} y ritmo ${gameB.pacing || "moderado"}.`)
    } else if (aspect === "duracion") {
        diffSentences.push(`En cuanto a duración de sesión, **${gameA.title}** está pensado para ${gameA.sessionDuration || "sesiones moderadas"}, mientras que **${gameB.title}** para ${gameB.sessionDuration || "otra duración"}.`)
    } else if (aspect === "modalidad") {
        diffSentences.push(`En cuanto a modalidad, **${gameA.title}** soporta ${gameA.gameModes?.join(", ") || "individual"}, y **${gameB.title}** soporta ${gameB.gameModes?.join(", ") || "individual"}.`)
    }

    if (expA.combat != null && expB.combat != null && Math.abs(expA.combat - expB.combat) >= 2) {
        if (expA.combat > expB.combat) {
            diffSentences.push(`**${gameA.title}** tiene mucha mayor presencia de combate (${expA.combat}/5) en comparación con **${gameB.title}** (${expB.combat}/5).`)
        } else {
            diffSentences.push(`**${gameB.title}** incluye combates más exigentes (${expB.combat}/5), mientras que **${gameA.title}** es más pacífico y relajado (${expA.combat}/5).`)
        }
    }

    if (expA.narrative != null && expB.narrative != null && Math.abs(expA.narrative - expB.narrative) >= 2) {
        if (expA.narrative > expB.narrative) {
            diffSentences.push(`**${gameA.title}** destaca por un enfoque narrativo e historia mucho más profunda (${expA.narrative}/5).`)
        } else {
            diffSentences.push(`**${gameB.title}** pone un énfasis significativamente mayor en la historia y la trama (${expB.narrative}/5).`)
        }
    }

    if (expA.exploration != null && expB.exploration != null && Math.abs(expA.exploration - expB.exploration) >= 2) {
        if (expA.exploration > expB.exploration) {
            diffSentences.push(`**${gameA.title}** ofrece un mundo con mayor libertad de exploración (${expA.exploration}/5).`)
        } else {
            diffSentences.push(`**${gameB.title}** invita más a explorar y descubrir entornos (${expB.exploration}/5).`)
        }
    }

    if (expA.creativity != null && expB.creativity != null && Math.abs(expA.creativity - expB.creativity) >= 2) {
        if (expA.creativity > expB.creativity) {
            diffSentences.push(`**${gameA.title}** brinda mayores herramientas de construcción y creatividad (${expA.creativity}/5).`)
        } else {
            diffSentences.push(`**${gameB.title}** se centra más en la creatividad y la construcción (${expB.creativity}/5).`)
        }
    }

    if (diffSentences.length > 0) {
        parts.push(diffSentences.join(" "))
    } else {
        // Comparación por ritmo o dificultad si los atributos son similares
        parts.push(`En cuanto al ritmo, **${gameA.title}** se experimenta como ${gameA.pacing || "moderado"}, mientras que **${gameB.title}** tiene un ritmo ${gameB.pacing || "moderado"}.`)
    }

    // 3. Ajuste al perfil del jugador
    if (affinityA.hasSufficientCriteria && affinityB.hasSufficientCriteria) {
        if (affinityA.isRestricted && !affinityB.isRestricted) {
            parts.push(`Ten en cuenta que **${gameA.title}** no satisface plenamente tus restricciones (${affinityA.violations[0] || "incompatibilidad"}), por lo que **${gameB.title}** (${affinityB.score}% afinidad) se ajusta mejor a tu sesión actual.`)
        } else if (!affinityA.isRestricted && affinityB.isRestricted) {
            parts.push(`Ten en cuenta que **${gameB.title}** no satisface tus restricciones (${affinityB.violations[0] || "incompatibilidad"}), por lo que **${gameA.title}** (${affinityA.score}% afinidad) resulta una opción más recomendable hoy.`)
        } else if (affinityA.score > affinityB.score + 10) {
            parts.push(`Para lo que buscas hoy, **${gameA.title}** (${affinityA.score}% afinidad) se alinea mejor con tus preferencias que **${gameB.title}** (${affinityB.score}%).`)
        } else if (affinityB.score > affinityA.score + 10) {
            parts.push(`Para lo que buscas hoy, **${gameB.title}** (${affinityB.score}% afinidad) se alinea mejor con tus preferencias que **${gameA.title}** (${affinityA.score}%).`)
        } else {
            parts.push(`Ambos títulos presentan una afinidad similar con tu búsqueda (${affinityA.score}% frente a ${affinityB.score}%). Tu elección dependerá de si hoy te apetece más el enfoque de ${gameA.title} o la propuesta de ${gameB.title}.`)
        }
    } else {
        parts.push("Dado que aún no hemos conversado sobre tus preferencias específicas de hoy, esta es una comparación descriptiva neutral entre sus respectivos estilos.")
    }

    return parts.join(" ")
}

/**
 * Servicio integral de comparación de dos videojuegos (Etapa 6).
 *
 * @param {Object} params
 * @param {string} params.titleA Título del primer juego
 * @param {string} params.titleB Título del segundo juego
 * @param {Object} params.criteria Criterios del jugador
 * @param {string} params.aspect Aspecto concreto a contrastar (general, exploracion, combate, etc.)
 * @returns {Promise<Object>} Resultado estructurado de comparación
 */
async function compareGamesData({ titleA, titleB, criteria = {}, aspect = "general" }) {
    if (!titleA || !titleB) {
        return {
            error: "missing_selection",
            message: "Se requiere seleccionar dos videojuegos para realizar la comparación."
        }
    }

    if (cleanText(titleA) === cleanText(titleB)) {
        return {
            error: "same_game",
            message: "Por favor selecciona dos videojuegos diferentes. No es posible comparar un título consigo mismo."
        }
    }

    const [gameA, gameB] = await Promise.all([
        getGameDetails(titleA),
        getGameDetails(titleB)
    ])

    if (!gameA) {
        return {
            error: "game_not_found",
            missingGame: titleA,
            message: `No se encontró en el catálogo de PC el videojuego "${titleA}".`
        }
    }

    if (!gameB) {
        return {
            error: "game_not_found",
            missingGame: titleB,
            message: `No se encontró en el catálogo de PC el videojuego "${titleB}".`
        }
    }

    // 1. Evaluar afinidad personalizada para ambos videojuegos
    const affinityA = calculateGameAffinityForComparison(gameA, criteria)
    const affinityB = calculateGameAffinityForComparison(gameB, criteria)

    // 2. Medir similitud multidimensional objetiva
    const similarity = calculateGameSimilarity(gameA, gameB)

    // 3. Comparar atributos estructurados
    const genresA = gameA.genres || []
    const genresB = gameB.genres || []
    const commonGenres = genresA.filter((g) =>
        genresB.some((bg) => bg.toLowerCase() === g.toLowerCase())
    )
    const onlyGenresA = genresA.filter(
        (g) => !genresB.some((bg) => bg.toLowerCase() === g.toLowerCase())
    )
    const onlyGenresB = genresB.filter(
        (g) => !genresA.some((ag) => ag.toLowerCase() === g.toLowerCase())
    )

    const modesA = gameA.gameModes || []
    const modesB = gameB.gameModes || []
    const commonModes = modesA.filter((m) =>
        modesB.some((bm) => bm.toLowerCase() === m.toLowerCase())
    )

    // Atributos de experiencia (0 a 5)
    const expLabels = {
        exploration: "Exploración",
        narrative: "Narrativa e historia",
        creativity: "Creatividad y crafteo",
        strategy: "Estrategia y táctica",
        combat: "Combate y acción",
        freedom: "Libertad de juego",
        complexity: "Complejidad"
    }

    const expA = gameA.experienceAttributes || {}
    const expB = gameB.experienceAttributes || {}

    const experienceComparison = Object.keys(expLabels).map((key) => {
        const valA = expA[key] != null ? expA[key] : null
        const valB = expB[key] != null ? expB[key] : null

        let higher = "equal"
        if (valA == null || valB == null) {
            higher = "unknown"
        } else if (valA > valB) {
            higher = "A"
        } else if (valB > valA) {
            higher = "B"
        }

        return {
            key,
            label: expLabels[key],
            valA,
            valB,
            diff: valA != null && valB != null ? Math.abs(valA - valB) : null,
            higher
        }
    })

    // 4. Explicación personalizada contextual
    const explanation = generateComparativeExplanation(gameA, gameB, affinityA, affinityB, criteria, aspect)

    return {
        success: true,
        gameA,
        gameB,
        affinityA,
        affinityB,
        similarity,
        explanation,
        aspect,
        attributeComparison: {
            genres: {
                common: commonGenres,
                onlyA: onlyGenresA,
                onlyB: onlyGenresB
            },
            modes: {
                common: commonModes,
                modesA,
                modesB
            },
            sessionDuration: {
                valA: gameA.sessionDuration || null,
                valB: gameB.sessionDuration || null,
                isSame: gameA.sessionDuration === gameB.sessionDuration
            },
            difficulty: {
                valA: gameA.difficulty || null,
                valB: gameB.difficulty || null,
                isSame: gameA.difficulty === gameB.difficulty
            },
            pacing: {
                valA: gameA.pacing || null,
                valB: gameB.pacing || null,
                isSame: gameA.pacing === gameB.pacing
            },
            priceCondition: {
                valA: gameA.priceCondition || "De pago",
                valB: gameB.priceCondition || "De pago",
                isSame: gameA.priceCondition === gameB.priceCondition
            },
            objectiveStyle: {
                valA: gameA.objectiveStyle || null,
                valB: gameB.objectiveStyle || null,
                isSame: gameA.objectiveStyle === gameB.objectiveStyle
            },
            experienceAttributes: experienceComparison
        }
    }
}

module.exports = {
    getGameDetails,
    countActiveCriteria,
    evaluateGameRestrictions,
    calculateGameAffinityForComparison,
    generateComparativeExplanation,
    compareGamesData
}
