/**
 * Servicio de Modelo de Eventos de Retroalimentación Estructurada (Etapa 7)
 *
 * Responsabilidad:
 * - Definición y normalización de tipos de retroalimentación acotados:
 *     1. game_interest: Interés explícito en un videojuego específico.
 *     2. game_rejection: Descarte o rechazo de un videojuego específico.
 *     3. feature_like: Preferencia por una característica o atributo mecánico.
 *     4. feature_dislike: Aversión o rechazo hacia una característica o atributo.
 *     5. preference_correction: Corrección o modificación de una preferencia previa.
 *     6. alternative_request: Solicitud de alternativas o nuevas opciones.
 *     7. neutral_comment: Comentarios neutrales o consultas fácticas sin carga de preferencia.
 * - Clasificación de intensidad:
 *     - mild_preference: Preferencia flexible (ej. "preferiría menos combate").
 *     - clear_preference: Preferencia clara y directa (ej. "me interesa por su historia").
 *     - strict_restriction: Restricción estricta o exclusión obligatoria (ej. "no quiero ningún combate").
 * - Registro estructurado en la memoria conversacional temporal sin duplicaciones.
 * - Resolución descriptiva de referencias (ej. "el que tiene más historia", "el último").
 */

const { cleanText } = require("./nlpService")

const FEEDBACK_TYPES = {
    GAME_INTEREST: "game_interest",
    GAME_REJECTION: "game_rejection",
    FEATURE_LIKE: "feature_like",
    FEATURE_DISLIKE: "feature_dislike",
    PREFERENCE_CORRECTION: "preference_correction",
    ALTERNATIVE_REQUEST: "alternative_request",
    NEUTRAL_COMMENT: "neutral_comment"
}

const FEEDBACK_INTENSITIES = {
    MILD: "mild_preference",
    CLEAR: "clear_preference",
    STRICT: "strict_restriction"
}

const FEEDBACK_SENTIMENTS = {
    POSITIVE: "positive",
    NEGATIVE: "negative",
    NEUTRAL: "neutral"
}

const FEEDBACK_SCOPES = {
    CURRENT_SESSION: "current_session",
    HABITUAL: "habitual",
    GAME_SPECIFIC: "game_specific"
}

/**
 * Crea un objeto estructurado de evento de retroalimentación.
 *
 * @param {Object} params
 * @returns {Object} Evento estructurado
 */
function createFeedbackEvent({
    gameTitle = null,
    type = FEEDBACK_TYPES.NEUTRAL_COMMENT,
    feature = null,
    sentiment = FEEDBACK_SENTIMENTS.NEUTRAL,
    motive = null,
    reason = null,
    intensity = FEEDBACK_INTENSITIES.CLEAR,
    scope = FEEDBACK_SCOPES.CURRENT_SESSION,
    turn = 1
}) {
    const genId = `fb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    const now = new Date().toISOString()
    const finalReason = reason || motive || null

    return {
        id: genId,
        eventId: genId,
        gameTitle: gameTitle || null,
        type,
        feature: feature || null,
        sentiment,
        motive: finalReason,
        reason: finalReason,
        intensity,
        scope,
        turn: turn || 1,
        createdAt: now,
        timestamp: now
    }
}

/**
 * Registra un evento de retroalimentación en la memoria temporal de la sesión,
 * evitando estrictamente eventos duplicados (Requisito Sección 10 y Escenario 23).
 *
 * @param {Object} memory Memoria conversacional
 * @param {Object} eventData Datos del evento
 * @returns {Object|null} El evento registrado o null si era duplicado
 */
function recordFeedbackEvent(memory = {}, eventData = {}) {
    if (!memory || !memory.recommendationFeedback) return null
    if (!Array.isArray(memory.recommendationFeedback.events)) {
        memory.recommendationFeedback.events = []
    }

    const events = memory.recommendationFeedback.events

    // Prevención de duplicados idénticos en el mismo turno conversacional
    const isDuplicate = events.some((e) => {
        const sameGame = cleanText(e.gameTitle || "") === cleanText(eventData.gameTitle || "")
        const sameType = e.type === eventData.type
        const sameFeature = cleanText(e.feature || "") === cleanText(eventData.feature || "")
        const sameTurn = e.turn === eventData.turn
        return sameGame && sameType && sameFeature && sameTurn
    })

    if (isDuplicate) {
        return null
    }

    const event = createFeedbackEvent(eventData)
    events.push(event)

    // Limitar histórico a 30 eventos para evitar fugas de memoria en la sesión
    if (events.length > 30) {
        memory.recommendationFeedback.events = events.slice(-30)
    }

    return event
}

/**
 * Analiza cláusulas de contraste lingüístico para detectar retroalimentación mixta.
 * Ej: "Me gusta la historia, pero no el combate" -> { positive: [...], negative: [...] }
 *
 * @param {string} userMessage Mensaje del usuario
 * @returns {Object|null} Estructura con cláusulas identificadas o null si no es mixta
 */
function parseMixedFeedbackClauses(userMessage = "") {
    const raw = (userMessage || "").trim()
    const clean = cleanText(raw)

    // Detectar conectores de contraste
    const contrastRegex = /\b(?:pero|aunque|sin\s+embargo|no\s+obstante|a\s+pesar\s+de\s+que|mas)\b/i
    if (!contrastRegex.test(raw)) {
        return null
    }

    const parts = raw.split(contrastRegex)
    if (parts.length < 2) return null

    const clauseA = cleanText(parts[0])
    const clauseB = cleanText(parts.slice(1).join(" "))

    const result = {
        hasContrast: true,
        positiveClauses: [],
        negativeClauses: [],
        positiveFeatures: [],
        negativeFeatures: []
    }

    function analyzeClause(cText, isFirstPart) {
        const isNegated = /(?:no\s+me|no\s+quiero|sin|evit|poco|nada\s+de|demasiado|odio|detesto|complicado|dificil)/i.test(cText)
        const isAffirmative = /(?:me\s+gusta|me\s+interesa|me\s+llama|buena|apetece|prefiero|quiero|mucha)/i.test(cText)

        // Features en la cláusula
        const foundFeatures = []
        if (/historia|trama|narrativ|lore|guion/i.test(cText)) foundFeatures.push("narrativa_historia")
        if (/combate|pelea|accion|tiros|disparos/i.test(cText)) foundFeatures.push("combate_accion")
        if (/explor|mundo\s+abierto|descubrir/i.test(cText)) foundFeatures.push("exploracion")
        if (/creativ|constru|crafteo/i.test(cText)) foundFeatures.push("construccion_creatividad")
        if (/estrateg|tactica|gestion|pensar/i.test(cText)) foundFeatures.push("estrategia_planificacion")
        if (/tranquil|relaj|paz|calma/i.test(cText)) foundFeatures.push("relajante")
        if (/dificil|desafio|complicado|complejo|frustrante/i.test(cText)) foundFeatures.push("combate_dificil")

        if (isNegated || (!isAffirmative && !isFirstPart)) {
            result.negativeClauses.push(cText)
            result.negativeFeatures.push(...foundFeatures)
        } else {
            result.positiveClauses.push(cText)
            result.positiveFeatures.push(...foundFeatures)
        }
    }

    analyzeClause(clauseA, true)
    analyzeClause(clauseB, false)

    result.positiveFeatures = [...new Set(result.positiveFeatures)]
    result.negativeFeatures = [...new Set(result.negativeFeatures)]

    if (result.positiveFeatures.length > 0 || result.negativeFeatures.length > 0) {
        return result
    }

    return null
}

/**
 * Resuelve referencias a videojuegos descritos por atributos superlativos
 * (ej. "el que tiene más historia", "el que tiene menos combate", "el último").
 *
 * @param {string} userMessage Mensaje del usuario
 * @param {Array<string>} candidateTitles Títulos visibles en pantalla
 * @param {Function} getGameDetailsFn Función para obtener detalles del juego
 * @returns {Promise<string|null>} Título del videojuego resuelto o null
 */
async function resolveDescriptiveGameReference(userMessage = "", candidateTitles = [], getGameDetailsFn) {
    if (!Array.isArray(candidateTitles) || candidateTitles.length === 0) return null
    const clean = cleanText(userMessage)

    // 1. Referencia a "el último"
    if (/(?:\b(?:el\s+)?(?:[uú]ltim[oa]|final)(?:\s+juego|\s+opci[oó]n)?\b)/i.test(clean)) {
        return candidateTitles[candidateTitles.length - 1]
    }

    // 2. Referencia superlativa: "el que tiene más [atributo]" o "el de más [atributo]"
    const moreMatch = clean.match(/(?:el\s+que\s+tiene\s+m[aá]s|el\s+de\s+m[aá]s|con\s+m[aá]s)\s+([a-z]+)/i)
    const lessMatch = clean.match(/(?:el\s+que\s+tiene\s+menos|el\s+de\s+menos|con\s+menos)\s+([a-z]+)/i)

    const isMore = !!moreMatch
    const isLess = !!lessMatch
    const targetAttributeWord = (moreMatch && moreMatch[1]) || (lessMatch && lessMatch[1]) || null

    if (!targetAttributeWord || !getGameDetailsFn) return null

    let attrKey = null
    if (/historia|narrativ|trama|guion/i.test(targetAttributeWord)) attrKey = "narrative"
    else if (/combate|pelea|accion/i.test(targetAttributeWord)) attrKey = "combat"
    else if (/explor/i.test(targetAttributeWord)) attrKey = "exploration"
    else if (/creativ|constru/i.test(targetAttributeWord)) attrKey = "creativity"
    else if (/estrateg|tactica|gestion/i.test(targetAttributeWord)) attrKey = "strategy"
    else if (/libertad|abierto/i.test(targetAttributeWord)) attrKey = "freedom"
    else if (/complej|dificil/i.test(targetAttributeWord)) attrKey = "complexity"

    if (!attrKey) return null

    // Consultar detalles de los candidatos y comparar los valores del atributo
    const games = await Promise.all(candidateTitles.map((t) => getGameDetailsFn(t)))
    const validGames = games.filter(Boolean)
    if (validGames.length === 0) return null

    validGames.sort((g1, g2) => {
        const val1 = g1.experienceAttributes ? g1.experienceAttributes[attrKey] ?? 0 : 0
        const val2 = g2.experienceAttributes ? g2.experienceAttributes[attrKey] ?? 0 : 0
        return isMore ? val2 - val1 : val1 - val2
    })

    return validGames[0]?.title || null
}

/**
 * Clasifica la intensidad de una expresión de preferencia.
 *
 * @param {string} text Texto del usuario
 * @returns {string} mild_preference | clear_preference | strict_restriction
 */
function classifyFeedbackIntensity(text = "") {
    const clean = cleanText(text)

    // Restricciones estrictas
    if (
        /(?:no\s+quiero\s+ning[uú]n|cero\s+(?:combate|estrategia|terror)|sin\s+(?:nada\s+de\s+)?combates?|nada\s+de\s+(?:combate|peleas?|tiros|shooters?)|odio|detesto|jam[aá]s|bajo\s+ning[uú]n\s+concepto|exclusivamente|solo\s+juegos?\s+gratis|[uú]nicamente)/i.test(clean)
    ) {
        return FEEDBACK_INTENSITIES.STRICT
    }

    // Preferencias leves / flexibles
    if (
        /(?:preferir[ií]a\s+menos|un\s+poco\s+menos|algo\s+no\s+tan|no\s+tanto|no\s+tan\s+dif[ií]cil|algo\s+m[aá]s\s+tranquilo|si\s+es\s+posible|tal\s+vez|quiz[aá]s)/i.test(clean)
    ) {
        return FEEDBACK_INTENSITIES.MILD
    }

    return FEEDBACK_INTENSITIES.CLEAR
}

module.exports = {
    FEEDBACK_TYPES,
    FEEDBACK_INTENSITIES,
    FEEDBACK_SENTIMENTS,
    FEEDBACK_SCOPES,
    createFeedbackEvent,
    recordFeedbackEvent,
    parseMixedFeedbackClauses,
    resolveDescriptiveGameReference,
    classifyFeedbackIntensity
}
