/**
 * Servicio de Recomendaciones Conversacionales y Retroalimentación del Jugador (Etapa 5)
 *
 * Responsabilidad:
 * - Resolución de referencias a videojuegos recomendados (por nombre, ordinal o pronombres).
 * - Detección de ambigüedad cuando se usan pronombres relativos sin foco previo.
 * - Clasificación de intenciones post-recomendación:
 *     1. Interés positivo (aprobación / me gusta).
 *     2. Rechazo explícito (descarte de un título).
 *     3. Solicitud de información detallada (de qué trata, modo, dificultad, duración).
 *     4. Comparación de atributos entre dos recomendaciones.
 *     5. Solicitud de alternativas o insatisfacción no justificada.
 *     6. Modificación de preferencias conservando criterios válidos.
 * - Extracción precisa de motivos positivos y negativos sin inventar datos.
 * - Respuestas sustentadas exclusivamente en atributos verificables del catálogo (Game / seedGames).
 * - Manejo transparente del agotamiento de alternativas compatibles.
 */

const Game = require("../models/Game")
const seedGames = require("../data/seedGames.json")
const { cleanText } = require("./nlpService")

/**
 * Obtiene los detalles completos de un videojuego desde la base de datos o el catálogo semilla en memoria.
 *
 * @param {string} title Título del videojuego
 * @returns {Promise<Object|null>} Documento o estructura con atributos verificables
 */
async function getGameDetails(title = "") {
    if (!title) return null
    const clean = cleanText(title)

    // 1. Intento de búsqueda en MongoDB si está disponible
    try {
        const doc = await Game.findOne({
            title: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
        })
        if (doc) return doc.toObject ? doc.toObject() : doc
    } catch (e) {
        // En entornos de prueba sin DB activa, continuamos al catálogo en memoria
    }

    // 2. Búsqueda en catálogo semilla en memoria
    const found = seedGames.find((g) => {
        const gClean = cleanText(g.title)
        return gClean === clean || gClean.includes(clean) || clean.includes(gClean)
    })

    return found || null
}

/**
 * Resuelve a qué videojuego se refiere el usuario dentro del contexto de las recomendaciones mostradas.
 *
 * @param {string} userMessage Mensaje del usuario
 * @param {Object} dialogueState Estado de diálogo actual
 * @returns {Object} Diagnóstico de resolución de referencia
 */
function resolveGameReference(userMessage = "", dialogueState = {}) {
    const clean = cleanText(userMessage)
    const lastRecs = Array.isArray(dialogueState.lastRecommendedGames) ? dialogueState.lastRecommendedGames : []
    const currentFocus = dialogueState.currentReferencedGame || null

    // 1. Detección por número ordinal explícito ("el primero", "el 1", "el segundo", "el tercero")
    let ordinalIndex = null
    if (/(?:\b(?:el\s+)?primer(?:o|a)?(?:\s+juego|\s+opci[oó]n)?\b|\bel\s+1\b|\bopci[oó]n\s+1\b|\bn[uú]mero\s+1\b)/i.test(clean)) {
        ordinalIndex = 0
    } else if (/(?:\b(?:el\s+)?segund(?:o|a)?(?:\s+juego|\s+opci[oó]n)?\b|\bel\s+2\b|\bopci[oó]n\s+2\b|\bn[uú]mero\s+2\b)/i.test(clean)) {
        ordinalIndex = 1
    } else if (/(?:\b(?:el\s+)?tercer(?:o|a)?(?:\s+juego|\s+opci[oó]n)?\b|\bel\s+3\b|\bopci[oó]n\s+3\b|\bn[uú]mero\s+3\b)/i.test(clean)) {
        ordinalIndex = 2
    }

    if (ordinalIndex != null) {
        if (lastRecs[ordinalIndex]) {
            return {
                resolvedGameTitle: lastRecs[ordinalIndex],
                resolvedFrom: "ordinal",
                ordinalIndex,
                isAmbiguous: false,
                isNotRecommended: false
            }
        }
    }

    // 2. Detección por nombre explícito dentro del último conjunto de recomendaciones
    for (let idx = 0; idx < lastRecs.length; idx++) {
        const title = lastRecs[idx]
        const cleanTitle = cleanText(title)
        const regex = new RegExp(`\\b${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
        if (regex.test(clean) || clean.includes(cleanTitle)) {
            return {
                resolvedGameTitle: title,
                resolvedFrom: "title",
                ordinalIndex: idx,
                isAmbiguous: false,
                isNotRecommended: false
            }
        }
    }

    // 3. Detección por nombre explícito en el catálogo general (juego no perteneciente al lote actual)
    for (const seed of seedGames) {
        const cleanTitle = cleanText(seed.title)
        const regex = new RegExp(`\\b${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
        if (regex.test(clean) || clean.includes(cleanTitle)) {
            const inCurrentRecs = lastRecs.some((t) => cleanText(t) === cleanTitle)
            if (!inCurrentRecs) {
                return {
                    resolvedGameTitle: seed.title,
                    resolvedFrom: "catalog_external",
                    ordinalIndex: null,
                    isAmbiguous: false,
                    isNotRecommended: true
                }
            }
        }
    }

    // 4. Detección por pronombres relativos o demostrativos ("ese juego", "este juego", "este", "ese", "aquel")
    const isPronounMatch = /(?:\b(?:ese|este|aquel)\s+(?:juego|t[ií]tulo|opci[oó]n)\b|\b(?:este|ese|aquel)\b)/i.test(clean)
    if (isPronounMatch) {
        // Si ya hay un videojuego en foco explícito, la referencia continúa sobre él
        if (currentFocus) {
            return {
                resolvedGameTitle: currentFocus,
                resolvedFrom: "current_focus",
                ordinalIndex: lastRecs.indexOf(currentFocus) !== -1 ? lastRecs.indexOf(currentFocus) : null,
                isAmbiguous: false,
                isNotRecommended: false
            }
        }

        // Si solo se recomendó un único juego en el lote
        if (lastRecs.length === 1) {
            return {
                resolvedGameTitle: lastRecs[0],
                resolvedFrom: "single_candidate",
                ordinalIndex: 0,
                isAmbiguous: false,
                isNotRecommended: false
            }
        }

        // Si hay múltiples recomendaciones en pantalla y no hay foco previo -> Referencia ambigua
        if (lastRecs.length > 1) {
            return {
                resolvedGameTitle: null,
                resolvedFrom: "ambiguous_pronoun",
                ordinalIndex: null,
                isAmbiguous: true,
                candidates: [...lastRecs],
                isNotRecommended: false
            }
        }
    }

    // 5. Sin referencia a juego específico
    return {
        resolvedGameTitle: null,
        resolvedFrom: null,
        ordinalIndex: null,
        isAmbiguous: false,
        isNotRecommended: false
    }
}

/**
 * Detecta si el usuario desea comparar dos videojuegos recomendados.
 *
 * @param {string} userMessage Mensaje del usuario
 * @param {Object} dialogueState Estado actual
 * @returns {Object|null} Información de comparación o null si no aplica
 */
function detectComparisonIntent(userMessage = "", dialogueState = {}) {
    const clean = cleanText(userMessage)
    const isComparisonQuery =
        /(?:comparar?|comparaci[oó]n|diferencia|cu[aá]l\s+(?:de\s+los\s+dos\s+)?es\s+m[aá]s|cu[aá]l\s+de\s+estos|entre\s+[a-z\s0-9]+y\s+[a-z\s0-9]+)/i.test(clean)

    if (!isComparisonQuery) return null

    const lastRecs = Array.isArray(dialogueState.lastRecommendedGames) ? dialogueState.lastRecommendedGames : []
    const targets = []

    // 1. Identificar si menciona títulos directamente
    for (const title of seedGames.map((g) => g.title)) {
        const cleanTitle = cleanText(title)
        if (clean.includes(cleanTitle)) {
            targets.push(title)
        }
    }

    // 2. Identificar si menciona ordinales ("el primero y el segundo", etc.)
    if (targets.length < 2 && lastRecs.length >= 2) {
        if (/primer/i.test(clean) && /segund/i.test(clean)) {
            targets.length = 0
            targets.push(lastRecs[0], lastRecs[1])
        } else if (/primer/i.test(clean) && /tercer/i.test(clean) && lastRecs[2]) {
            targets.length = 0
            targets.push(lastRecs[0], lastRecs[2])
        } else if (/segund/i.test(clean) && /tercer/i.test(clean) && lastRecs[2]) {
            targets.length = 0
            targets.push(lastRecs[1], lastRecs[2])
        } else if (targets.length === 0 && /(?:cu[aá]l\s+(?:de\s+los\s+dos\s+)?es\s+m[aá]s|compara(?:r)?\s+(?:las|ambas|las\s+dos)\s+opciones)/i.test(clean)) {
            // Comparar por defecto los dos primeros títulos en pantalla
            targets.push(lastRecs[0], lastRecs[1])
        }
    }

    if (targets.length < 2) return null

    // Identificar el aspecto a comparar
    let aspect = "general"
    if (/tranquil|relaj|calm|paz/i.test(clean)) {
        aspect = "tranquilidad"
    } else if (/dificil|complej|exigente|reto|desafio/i.test(clean)) {
        aspect = "dificultad"
    } else if (/cort|duraci[oó]n|larg|tiempo/i.test(clean)) {
        aspect = "duracion"
    } else if (/amigos|coop|solo|jugador|modalidad/i.test(clean)) {
        aspect = "modalidad"
    }

    return {
        gameA: targets[0],
        gameB: targets[1],
        aspect
    }
}

/**
 * Detecta la intención del usuario ante una recomendación o conjunto de recomendaciones.
 *
 * @param {string} userMessage Mensaje del usuario
 * @param {Object} dialogueState Estado del diálogo
 * @param {Object} resolvedRef Diagnóstico de referencia resuelta
 * @returns {Object} Intención detectada y metadatos
 */
function detectFeedbackIntent(userMessage = "", dialogueState = {}, resolvedRef = {}) {
    const clean = cleanText(userMessage)

    // 1. Solicitud de alternativas directa
    const isRequestingAlternatives =
        /(?:mu[eé]strame\s+otros|otros\s+juegos|otras\s+opciones|buscar\s+alternativas|dame\s+otras\s+opciones|m[aá]s\s+alternativas|ver\s+otras|ver\s+m[aá]s\s+alternativas|diferentes\s+juegos|cambiar\s+opciones|opciones\s+diferentes)/i.test(clean)

    // 2. Insatisfacción general o vaga ("no me convencen estas opciones", "no me gusta ninguno")
    const isVagueDissatisfaction =
        /(?:no\s+me\s+convencen?\s+(?:estas|las|esas)\s+opciones|ningun(?:o|a)\s+me\s+(?:gusta|llama|convence)|no\s+me\s+gusta\s+ningun(?:o|a)|no\s+me\s+convence\s+nada|no\s+me\s+llama\s+la\s+atenci[oó]n\s+ningun(?:o|a))/i.test(clean) &&
        !resolvedRef.resolvedGameTitle

    // 3. Rechazo explícito
    const isRejection =
        /(?:no\s+me\s+gusta|no\s+me\s+convence|no\s+quiero|descarta|descartar|quitar?|eliminar?|no\s+me\s+llama|no\s+es\s+lo\s+que\s+busco|ese\s+no\s+me\s+gusta|este\s+no\s+me\s+gusta|descarta\s+(?:este|ese))/i.test(clean)

    // 4. Interés o aprobación
    const isInterest =
        /(?:me\s+interesa|me\s+llama\s+la\s+atenci[oó]n|me\s+gusta|me\s+encanta|prefiero|me\s+quedo\s+con|me\s+convence|elijo|lo\s+compro|voy\s+por|este\s+me\s+gusta|ese\s+me\s+gusta|este\s+me\s+interesa|el\s+primero\s+me\s+interesa|el\s+segundo\s+me\s+interesa)/i.test(clean) &&
        !isRejection

    // 5. Solicitud de información detallada
    const isInfoQuestion =
        /(?:de\s+qu[eé]\s+trata|cu[eé]ntame\s+m[aá]s|quiero\s+saber\s+m[aá]s|expl[ií]came|informaci[oó]n|de\s+que\s+va|c[oó]mo\s+es|qu[eé]\s+tal\s+es)/i.test(clean)
    const isModeQuestion =
        /(?:es\s+para\s+un\s+jugador|se\s+puede\s+jugar\s+con\s+amigos|puedo\s+jugar\s+con\s+amigos|tiene\s+cooperativo|es\s+cooperativo|es\s+multijugador|es\s+individual|se\s+juega\s+solo)/i.test(clean)
    const isDifficultyQuestion =
        /(?:es\s+dif[ií]cil|qu[eé]\s+dificultad\s+tiene|es\s+muy\s+dif[ií]cil|es\s+f[aá]cil|es\s+complicado|es\s+exigente)/i.test(clean)
    const isDurationQuestion =
        /(?:sirve\s+para\s+partidas\s+cortas|cu[aá]nto\s+dura(?:\s+una\s+partida)?|es\s+para\s+jugar\s+un\s+rato|cu[aá]ntas\s+horas\s+dura|es\s+largo|es\s+corto)/i.test(clean)
    const isUnsupportedInfo =
        /(?:cu[aá]nto\s+cuesta|precio|qu[eé]\s+tarjeta\s+gr[aá]fica|requisitos\s+t[eé]cnicos|qu[eé]\s+pc\s+necesita|fps|qu[eé]\s+nota\s+tiene|reseñas\s+en\s+steam)/i.test(clean)

    if (isUnsupportedInfo) return { type: "info_unsupported", targetGame: resolvedRef.resolvedGameTitle }
    if (isModeQuestion) return { type: "info_mode", targetGame: resolvedRef.resolvedGameTitle }
    if (isDifficultyQuestion) return { type: "info_difficulty", targetGame: resolvedRef.resolvedGameTitle }
    if (isDurationQuestion) return { type: "info_duration", targetGame: resolvedRef.resolvedGameTitle }
    if (isInfoQuestion) return { type: "info_general", targetGame: resolvedRef.resolvedGameTitle }

    if (isRejection) return { type: "rejection", targetGame: resolvedRef.resolvedGameTitle }
    if (isInterest) return { type: "interest", targetGame: resolvedRef.resolvedGameTitle }
    if (isVagueDissatisfaction) return { type: "vague_dissatisfaction" }
    if (isRequestingAlternatives) return { type: "alternatives" }

    return { type: "general" }
}

/**
 * Extrae motivos explícitos de retroalimentación (positivo o negativo) expresados por el usuario.
 *
 * @param {string} userMessage Mensaje del usuario
 * @returns {Object} Motivos clasificados y atributos a modificar
 */
function extractFeedbackMotives(userMessage = "") {
    const text = cleanText(userMessage)
    const motives = {
        hasMotives: false,
        rejectedFeatures: [],
        preferredFeatures: [],
        updatedPacing: null,
        updatedMode: null,
        explanationText: ""
    }

    // Motivos negativos: combate intenso / dificultad alta
    if (/(?:no\s+quiero|sin|evitar|demasiado|mucha)\s+.*?(?:combate|combates|pelea|peleas|accion|tiros)/i.test(text)) {
        motives.hasMotives = true
        motives.rejectedFeatures.push("combate_accion")
        motives.updatedPacing = "relajado"
        motives.explanationText = "evitar combates intensos en esta sesión"
    }
    if (/(?:demasiado|muy)\s+(?:dif[ií]cil|complicado|frustrante|exigente)|(?:no\s+quiero\s+sufrir)/i.test(text)) {
        motives.hasMotives = true
        motives.rejectedFeatures.push("combate_dificil")
        motives.updatedPacing = "relajado"
        motives.explanationText = "buscar una experiencia menos exigente y sin frustración"
    }

    // Motivos positivos: tranquilidad / exploración / historia
    if (/(?:parece|es|busca|quiero)\s+.*?(?:tranquil|relaj|desconect|paz)/i.test(text)) {
        motives.hasMotives = true
        motives.updatedPacing = "relajado"
        motives.explanationText = "valorar la tranquilidad y el ritmo relajado"
    }
    if (/(?:tiene|gusta|apetece|quiero)\s+.*?(?:explor|mundo abierto|descubrir)/i.test(text)) {
        motives.hasMotives = true
        motives.preferredFeatures.push("exploracion")
        motives.explanationText = "interés por explorar y descubrir secretos"
    }
    if (/(?:buena\s+historia|trama|narrativa|guion)/i.test(text)) {
        motives.hasMotives = true
        motives.preferredFeatures.push("narrativa_historia")
        motives.explanationText = "interés por una buena narrativa e historia"
    }

    return motives
}

/**
 * Responde una pregunta específica sobre un videojuego utilizando exclusivamente atributos verificables.
 *
 * @param {Object} game Documento del videojuego con campos reales
 * @param {string} infoType Tipo de consulta (info_general, info_mode, info_difficulty, info_duration, info_unsupported)
 * @returns {string} Respuesta factual y amena
 */
function answerGameQuestion(game, infoType = "info_general") {
    if (!game) return "No dispongo de los datos de ese videojuego en el catálogo actual para responder a tu consulta."

    const title = game.title

    switch (infoType) {
        case "info_general": {
            const highlight = game.experienceHighlights?.[0] ? ` Aspecto clave: "${game.experienceHighlights[0]}".` : ""
            return `**${title}**: ${game.description}${highlight}`
        }

        case "info_mode": {
            const modes = game.gameModes || []
            const supportsCoop = modes.some((m) => m.toLowerCase().includes("cooperativo"))
            const supportsMulti = modes.some((m) => m.toLowerCase().includes("multijugador"))
            const isSingleOnly = modes.length === 1 && modes[0].toLowerCase().includes("individual")

            if (supportsCoop) {
                return `Sí, **${title}** cuenta con modo cooperativo para jugar con amigos (además de soporte individual). Es una opción excelente para compartir la experiencia.`
            } else if (supportsMulti) {
                return `**${title}** soporta modo multijugador para jugar con otras personas en línea.`
            } else if (isSingleOnly) {
                return `**${title}** está diseñado exclusivamente para un solo jugador en solitario, enfocado en una experiencia íntima e inmersiva.`
            }
            return `**${title}** está registrado en el catálogo con soporte para modalidad ${modes.join(" y ")}.`
        }

        case "info_difficulty": {
            const diff = game.difficulty || "media"
            const pacing = game.pacing || "moderado"
            let note = ""
            if (diff === "baja" && pacing === "relajado") {
                note = "Es un juego sumamente accesible, diseñado para disfrutar con calma y sin presiones ni penalizaciones frustrantes."
            } else if (diff === "alta" || pacing === "intenso") {
                note = "Presenta un desafío exigente con ritmo intenso, pensado para poner a prueba tu habilidad y reflejos."
            } else {
                note = "Tiene una curva de dificultad equilibrada y un ritmo moderado, adecuado para jugar a tu propio ritmo."
            }
            return `En cuanto a dificultad, **${title}** tiene una dificultad ${diff} y un ritmo ${pacing}. ${note}`
        }

        case "info_duration": {
            const duration = game.sessionDuration || "media (30-60 min)"
            let note = ""
            if (duration.includes("corta")) {
                note = "Sí, es ideal para partidas cortas de 20 a 30 minutos; puedes avanzar significativamente en poco tiempo."
            } else if (duration.includes("media")) {
                note = "Las sesiones recomendadas rondan entre 30 y 60 minutos, lo que permite disfrutar de un buen progreso sin requerir sesiones maratónicas."
            } else {
                note = "Está pensado para sesiones más extensas de más de una hora, invitando a sumergirte con tiempo disponible."
            }
            return `**${title}** está catalogado para sesiones de **${duration}**. ${note}`
        }

        case "info_unsupported": {
            return `El catálogo actual del asistente no contiene precios en tiempo real ni requisitos de hardware técnico para **${title}**, pero puedo detallarte su jugabilidad, modos disponibles, duración de partida o nivel de desafío.`
        }

        default:
            return `**${title}**: ${game.description}`
    }
}

/**
 * Compara dos videojuegos recomendados a partir de atributos verificables del catálogo.
 *
 * @param {Object} gameA Documento del primer juego
 * @param {Object} gameB Documento del segundo juego
 * @param {string} aspect Aspecto a contrastar (tranquilidad, dificultad, duracion, modalidad, general)
 * @returns {string} Síntesis comparativa objetiva
 */
function compareGames(gameA, gameB, aspect = "general") {
    if (!gameA || !gameB) {
        return "Para realizar una comparación, necesito que ambos videojuegos estén registrados en el catálogo de recomendaciones."
    }

    const titleA = gameA.title
    const titleB = gameB.title

    switch (aspect) {
        case "tranquilidad": {
            const isARelaxing = gameA.pacing === "relajado" || (gameA.emotionalTags || []).includes("relajante")
            const isBRelaxing = gameB.pacing === "relajado" || (gameB.emotionalTags || []).includes("relajante")

            if (isARelaxing && !isBRelaxing) {
                return `Según las características registradas en el catálogo, **${titleA}** tiene un enfoque más relajado y pacífico, mientras que **${titleB}** prioriza un ritmo ${gameB.pacing || "intenso"} con mayor exigencia.`
            } else if (!isARelaxing && isBRelaxing) {
                return `Según los datos del catálogo, **${titleB}** es considerablemente más tranquilo (ritmo relajado), mientras que **${titleA}** ofrece una experiencia más activa con ritmo ${gameA.pacing || "intenso"}.`
            } else if (isARelaxing && isBRelaxing) {
                return `Tanto **${titleA}** como **${titleB}** ofrecen experiencias relajantes y sin presiones. **${titleA}** destaca por ${gameA.genres?.[0] || "su ambientación"}, mientras que **${titleB}** se enfoca en ${gameB.genres?.[0] || "su propuesta"}.`
            } else {
                return `Ni **${titleA}** ni **${titleB}** son juegos puramente relajantes; ambos presentan ritmos ${gameA.pacing || "moderados"} y ${gameB.pacing || "activos"}, con mayor énfasis en el dinamismo y el desafío.`
            }
        }

        case "dificultad": {
            return `En cuanto a desafío: **${titleA}** presenta dificultad ${gameA.difficulty || "media"} con ritmo ${gameA.pacing || "moderado"}, mientras que **${titleB}** ofrece dificultad ${gameB.difficulty || "media"} y ritmo ${gameB.pacing || "moderado"}.`
        }

        case "duracion": {
            return `Sobre duración de sesión: **${titleA}** está optimizado para ${gameA.sessionDuration || "sesiones moderadas"}, mientras que **${titleB}** se adapta a ${gameB.sessionDuration || "otra duración"}.`
        }

        case "modalidad": {
            return `Respecto a modalidad: **${titleA}** soporta ${gameA.gameModes?.join(", ") || "individual"}, y **${titleB}** soporta ${gameB.gameModes?.join(", ") || "individual"}.`
        }

        default: {
            return `Comparando ambas opciones: **${titleA}** es un título de ${gameA.genres?.join(", ") || "aventura"} con ritmo ${gameA.pacing || "moderado"}; mientras que **${titleB}** destaca en ${gameB.genres?.join(", ") || "su género"} con dificultad ${gameB.difficulty || "media"}.`
        }
    }
}

/**
 * Gestiona el turno conversacional completo cuando el usuario interactúa tras recibir recomendaciones (Etapa 5).
 *
 * @param {Object} params
 * @param {string} params.userMessage Mensaje del usuario
 * @param {Object} params.criteria Criterios acumulados actuales
 * @param {Object} params.dialogueState Estado actual del diálogo
 * @param {Object} params.analysis Análisis NLP del mensaje
 * @returns {Promise<Object|null>} Respuesta estructurada del turno o null si debe delegarse
 */
async function handlePostRecommendationTurn({
    userMessage = "",
    criteria = {},
    dialogueState = {},
    analysis = {}
}) {
    const { evaluateRecommendations } = require("./recommendationEngine")
    const { generateExplanation } = require("./explanationService")
    const { composeRecommendationIntro } = require("./responseComposer")

    const rawClean = cleanText(userMessage)
    const state = dialogueState

    // 1. Detección de intención de comparación entre dos títulos
    const comp = detectComparisonIntent(userMessage, state)
    if (comp) {
        const gameA = await getGameDetails(comp.gameA)
        const gameB = await getGameDetails(comp.gameB)
        const compReply = compareGames(gameA, gameB, comp.aspect)
        state.currentReferencedGame = comp.gameA

        return {
            reply: compReply,
            updatedCriteria: criteria,
            dialogueState: state,
            recommendations: [],
            suggestedReplies: [
                `Me interesa ${comp.gameA}`,
                `Me interesa ${comp.gameB}`,
                "Buscar alternativas",
                "Nueva búsqueda"
            ]
        }
    }

    // 2. Resolución de referencia a juego mencionado
    const resolvedRef = resolveGameReference(userMessage, state)

    // Caso A: Referencia ambigua ("ese juego", "el juego" con múltiples opciones en pantalla)
    if (resolvedRef.isAmbiguous) {
        const candidates = resolvedRef.candidates || state.lastRecommendedGames || []
        const candidateList = candidates.map((t, idx) => `${idx + 1}. ${t}`).join(", ")
        const reply = `¿A cuál de los juegos recomendados te refieres? Tenemos en pantalla: ${candidateList}.`
        const suggestedReplies = candidates.map((t, idx) => `El ${["primer", "segundo", "tercer"][idx] || idx + 1} juego (${t})`)

        return {
            reply,
            updatedCriteria: criteria,
            dialogueState: state,
            recommendations: [],
            suggestedReplies
        }
    }

    // Caso B: El usuario menciona un juego del catálogo que NO fue recomendado en el lote actual
    if (resolvedRef.isNotRecommended && resolvedRef.resolvedGameTitle) {
        const extGame = await getGameDetails(resolvedRef.resolvedGameTitle)
        const fbIntent = detectFeedbackIntent(userMessage, state, resolvedRef)

        if (fbIntent.type.startsWith("info_") && extGame) {
            const answer = answerGameQuestion(extGame, fbIntent.type)
            const reply = `Aunque **${extGame.title}** no formaba parte del lote de recomendaciones en pantalla, te cuento sobre él:\n\n${answer}\n\n¿Te gustaría que busquemos títulos similares a él o prefieres volver a tus recomendaciones?`
            return {
                reply,
                updatedCriteria: criteria,
                dialogueState: state,
                recommendations: [],
                suggestedReplies: [
                    `Quiero juegos parecidos a ${extGame.title}`,
                    "Buscar alternativas",
                    "Nueva búsqueda"
                ]
            }
        }

        // Si expresó gusto o interés por ese juego externo
        if (!criteria.likedGames.includes(resolvedRef.resolvedGameTitle)) {
            criteria.likedGames.push(resolvedRef.resolvedGameTitle)
        }
        if (!criteria.similarTo.includes(resolvedRef.resolvedGameTitle)) {
            criteria.similarTo.push(resolvedRef.resolvedGameTitle)
        }

        const reply = `**${resolvedRef.resolvedGameTitle}** es un gran referente. No lo incluí en esta selección porque explorábamos otras opciones para tu búsqueda actual, pero he anotado que te gusta para tenerlo en cuenta.\n\n¿Quieres que busque recomendaciones en esa línea o prefieres ver otras alternativas?`
        return {
            reply,
            updatedCriteria: criteria,
            dialogueState: state,
            recommendations: [],
            suggestedReplies: [
                `Quiero algo parecido a ${resolvedRef.resolvedGameTitle}`,
                "Buscar alternativas",
                "Nueva búsqueda"
            ]
        }
    }

    // 3. Si hay un juego resuelto (por nombre, ordinal o foco previo)
    if (resolvedRef.resolvedGameTitle) {
        const targetTitle = resolvedRef.resolvedGameTitle
        state.currentReferencedGame = targetTitle
        const fbIntent = detectFeedbackIntent(userMessage, state, resolvedRef)

        // Caso 3.1: Solicitud de información detallada (de qué trata, modo, dificultad, duración, unsupported)
        if (fbIntent.type.startsWith("info_")) {
            const game = await getGameDetails(targetTitle)
            const answer = answerGameQuestion(game, fbIntent.type)
            const reply = `${answer}\n\n¿Te gustaría saber más detalles, comparar con otra opción o prefieres explorar alternativas?`
            return {
                reply,
                updatedCriteria: criteria,
                dialogueState: state,
                recommendations: [],
                suggestedReplies: [
                    `Me interesa ${targetTitle}`,
                    "Comparar con otra opción",
                    "Buscar alternativas",
                    "Nueva búsqueda"
                ]
            }
        }

        // Caso 3.2: Interés o aprobación
        if (fbIntent.type === "interest") {
            if (!Array.isArray(state.interestedGames)) state.interestedGames = []
            if (!state.interestedGames.includes(targetTitle)) {
                state.interestedGames.push(targetTitle)
            }

            const motives = extractFeedbackMotives(userMessage)
            if (motives.hasMotives) {
                if (motives.preferredFeatures.length > 0) {
                    for (const f of motives.preferredFeatures) {
                        if (!criteria.likedFeatures.includes(f)) criteria.likedFeatures.push(f)
                    }
                }
                if (motives.updatedPacing) {
                    criteria.desiredPacing = motives.updatedPacing
                }
                if (!Array.isArray(state.feedbackMotives)) state.feedbackMotives = []
                state.feedbackMotives.push({
                    game: targetTitle,
                    type: "interest",
                    motiveText: motives.explanationText
                })
            }

            if (state.conversationMemory && state.conversationMemory.recommendationFeedback) {
                const rf = state.conversationMemory.recommendationFeedback
                if (!rf.interestedGames.some(i => i.title === targetTitle)) {
                    rf.interestedGames.push({
                        title: targetTitle,
                        motive: motives.explanationText || null,
                        turn: state.turnCount
                    })
                }
            }

            const game = await getGameDetails(targetTitle)
            const reasonNote = motives.explanationText ? ` especialmente porque buscas ${motives.explanationText}` : ""
            const descNote = game?.description ? ` ${game.description}` : ""
            const reply = `¡Excelente elección! **${targetTitle}** es un título fantástico${reasonNote}.${descNote}\n\n¿Te gustaría conocer más detalles sobre él o prefieres buscar alternativas para comparar?`

            return {
                reply,
                updatedCriteria: criteria,
                dialogueState: state,
                recommendations: [],
                suggestedReplies: [
                    `Quiero saber más sobre ${targetTitle}`,
                    "Buscar alternativas",
                    "Nueva búsqueda"
                ]
            }
        }

        // Caso 3.3: Rechazo explícito de un juego específico
        if (fbIntent.type === "rejection") {
            if (!Array.isArray(state.rejectedGames)) state.rejectedGames = []
            if (!state.rejectedGames.includes(targetTitle)) {
                state.rejectedGames.push(targetTitle)
            }
            if (!Array.isArray(criteria.dislikedGames)) criteria.dislikedGames = []
            if (!criteria.dislikedGames.includes(targetTitle)) {
                criteria.dislikedGames.push(targetTitle)
            }

            const motives = extractFeedbackMotives(userMessage)
            if (motives.hasMotives) {
                if (motives.rejectedFeatures.length > 0) {
                    for (const f of motives.rejectedFeatures) {
                        if (!criteria.dislikedFeatures.includes(f)) criteria.dislikedFeatures.push(f)
                    }
                }
                if (motives.updatedPacing) {
                    criteria.desiredPacing = motives.updatedPacing
                    if (motives.updatedPacing === "relajado") {
                        criteria.emotionalContext = ["relajante"]
                    }
                }
                if (!Array.isArray(state.feedbackMotives)) state.feedbackMotives = []
                state.feedbackMotives.push({
                    game: targetTitle,
                    type: "rejection",
                    motiveText: motives.explanationText
                })
            }

            if (state.conversationMemory && state.conversationMemory.recommendationFeedback) {
                const rf = state.conversationMemory.recommendationFeedback
                if (!rf.rejectedGames.some(r => r.title === targetTitle)) {
                    rf.rejectedGames.push({
                        title: targetTitle,
                        motive: motives.explanationText || null,
                        isTemporary: /hoy|esta sesion/i.test(motives.explanationText || "") || /hoy/i.test(userMessage),
                        turn: state.turnCount
                    })
                }
            }

            // Recalcular recomendaciones excluyendo rechazados y títulos mostrados
            const excludeList = [...new Set([...(state.shownGameTitles || []), ...(state.rejectedGames || [])])]
            let scoredGames = await evaluateRecommendations(criteria, {
                limit: 3,
                excludeTitles: excludeList,
                minScore: 45
            })

            // Si se agotan excluyendo todos los mostrados, excluir solo los rechazados explícitamente
            if (scoredGames.length === 0 && excludeList.length > state.rejectedGames.length) {
                scoredGames = await evaluateRecommendations(criteria, {
                    limit: 3,
                    excludeTitles: state.rejectedGames,
                    minScore: 45
                })
            }

            if (scoredGames.length > 0) {
                const newRecommendations = scoredGames.map((item) => ({
                    game: item.game,
                    score: item.score,
                    breakdown: item.breakdown,
                    explanation: generateExplanation(item, criteria)
                }))

                const newlyShown = newRecommendations.map((r) => r.game.title)
                state.shownGameTitles = [...new Set([...(state.shownGameTitles || []), ...newlyShown])]
                state.lastRecommendedGames = newlyShown
                state.currentReferencedGame = null

                if (state.conversationMemory && state.conversationMemory.recommendationFeedback) {
                    state.conversationMemory.recommendationFeedback.lastShownGames = newlyShown
                    state.conversationMemory.recommendationFeedback.shownHistory = state.shownGameTitles
                }

                const rejNote = motives.explanationText ? ` respetando tu preferencia de ${motives.explanationText}` : ""
                const reply = `Entendido, descartamos "${targetTitle}"${rejNote}. Conservando tus demás preferencias, aquí tienes nuevas opciones que encajan con tu perfil:\n\n¿Alguna de estas nuevas opciones te llama la atención?`

                return {
                    reply,
                    updatedCriteria: criteria,
                    dialogueState: state,
                    recommendations: newRecommendations,
                    suggestedReplies: [
                        "Me interesa el primero",
                        newlyShown[0] ? `¿De qué trata ${newlyShown[0]}?` : "Quiero saber más",
                        "Buscar alternativas",
                        "Nueva búsqueda"
                    ]
                }
            } else {
                // Alternativas agotadas
                const filterSummary = [
                    criteria.availableTime ? `duración ${criteria.availableTime}` : null,
                    criteria.gameMode ? `modo ${criteria.gameMode}` : null,
                    criteria.preferredGenres?.length ? `género ${criteria.preferredGenres.join(" / ")}` : null
                ].filter(Boolean).join(", ")

                const reply = `Entendido, descartamos "${targetTitle}". Sin embargo, hemos revisado las opciones del catálogo que cumplen con todos tus filtros (${filterSummary}) y no quedan más títulos compatibles sin repetir. Para encontrar más opciones, ¿estarías dispuesto a flexibilizar la duración o abrir la búsqueda a otros géneros?`

                return {
                    reply,
                    updatedCriteria: criteria,
                    dialogueState: state,
                    recommendations: [],
                    suggestedReplies: [
                        "Flexibilizar la duración",
                        "Flexibilizar el género",
                        "Nueva búsqueda"
                    ]
                }
            }
        }
    }

    // 4. Solicitud de alternativas generales ("buscar alternativas", "muéstrame otros juegos", "quiero algo diferente")
    const isRequestingAlternatives =
        /(?:buscar\s+alternativas|mu[eé]strame\s+otros(?:\s+juegos)?|otras\s+opciones|dame\s+otras\s+opciones|m[aá]s\s+alternativas|ver\s+otras\s+opciones|cambiar\s+opciones|algo\s+diferente|quiero\s+algo\s+diferente|diferentes\s+juegos)/i.test(rawClean) ||
        (analysis.wantsAlternatives && !/(?:no\s+me\s+convencen?\s+(?:estas|las|esas)\s+opciones|ningun(?:o|a)\s+me\s+(?:gusta|llama|convence))/i.test(rawClean))

    if (isRequestingAlternatives) {
        const excludeList = [...new Set([...(state.shownGameTitles || []), ...(state.rejectedGames || [])])]
        let scoredGames = await evaluateRecommendations(criteria, {
            limit: 3,
            excludeTitles: excludeList,
            minScore: 45
        })

        if (scoredGames.length > 0) {
            const newRecommendations = scoredGames.map((item) => ({
                game: item.game,
                score: item.score,
                breakdown: item.breakdown,
                explanation: generateExplanation(item, criteria)
            }))

            const newlyShown = newRecommendations.map((r) => r.game.title)
            state.shownGameTitles = [...new Set([...(state.shownGameTitles || []), ...newlyShown])]
            state.lastRecommendedGames = newlyShown
            state.currentReferencedGame = null

            if (state.conversationMemory && state.conversationMemory.recommendationFeedback) {
                state.conversationMemory.recommendationFeedback.lastShownGames = newlyShown
                state.conversationMemory.recommendationFeedback.shownHistory = state.shownGameTitles
            }

            const reply = "¡De acuerdo! Buscando alternativas diferentes para ti. Excluyendo las que ya revisamos, aquí tienes otras opciones que se adaptan a lo que buscas:\n\n¿Alguna de estas nuevas opciones te llama la atención?"

            return {
                reply,
                updatedCriteria: criteria,
                dialogueState: state,
                recommendations: newRecommendations,
                suggestedReplies: [
                    "Me interesa el primero",
                    newlyShown[0] ? `¿De qué trata ${newlyShown[0]}?` : "Quiero saber más",
                    "¿Cuál es más tranquilo?",
                    "Buscar alternativas",
                    "Nueva búsqueda"
                ]
            }
        } else {
            // Alternativas compatibles agotadas (Regla 7 y Escenario 12)
            const filterSummary = [
                criteria.availableTime ? `duración ${criteria.availableTime}` : null,
                criteria.gameMode ? `modo ${criteria.gameMode}` : null,
                criteria.preferredGenres?.length ? `género ${criteria.preferredGenres.join(" / ")}` : null
            ].filter(Boolean).join(", ")

            const reply = `Hemos revisado las opciones del catálogo que cumplen con todos tus filtros (${filterSummary}). Para encontrar más títulos compatibles, ¿estarías dispuesto a flexibilizar la duración o abrir la búsqueda a otros géneros?`

            return {
                reply,
                updatedCriteria: criteria,
                dialogueState: state,
                recommendations: [],
                suggestedReplies: [
                    "Flexibilizar la duración",
                    "Flexibilizar el género",
                    "Nueva búsqueda"
                ]
            }
        }
    }

    // 5. Insatisfacción vaga ("no me convencen estas opciones", "no me gusta ninguno") sin pedir alternativas explícitamente
    const isVagueDissatisfaction =
        /(?:no\s+me\s+convencen?\s+(?:estas|las|esas)\s+opciones|ningun(?:o|a)\s+me\s+(?:gusta|llama|convence)|no\s+me\s+gusta\s+ningun(?:o|a)|no\s+me\s+convence\s+nada|no\s+me\s+llama\s+la\s+atenci[oó]n\s+ningun(?:o|a))/i.test(rawClean)

    if (isVagueDissatisfaction) {
        const reply = "Entiendo que estas opciones no hayan terminado de convencerte. ¿Qué te gustaría cambiar: el tipo de juego (género), el ritmo o la experiencia que ofrecen?"
        return {
            reply,
            updatedCriteria: criteria,
            dialogueState: state,
            recommendations: [],
            suggestedReplies: [
                "Cambiar el género",
                "Cambiar el ritmo o dificultad",
                "La duración de la partida",
                "Buscar otras alternativas directamente"
            ]
        }
    }

    // 6. Modificación de preferencias posterior a la recomendación (ej. cambiar a cooperativo o nuevo género o flexibilizar)
    const isFlexibilizar = /flexibilizar/i.test(rawClean)
    const isModifyingPreferences =
        analysis.isModeModified ||
        analysis.genreModified ||
        analysis.isTimeModified ||
        analysis.isEmotionModified ||
        analysis.isChangingGenre ||
        analysis.isChangingMind ||
        analysis.isTimeIndifferent ||
        analysis.isGenreIndifferent ||
        analysis.isModeIndifferent ||
        isFlexibilizar

    if (isModifyingPreferences) {
        if (analysis.isTimeIndifferent || /flexibilizar.*?(?:duraci[oó]n|tiempo)/i.test(rawClean)) {
            criteria.availableTime = null
            state.timeIndifferent = true
        }
        if (analysis.isGenreIndifferent || /flexibilizar.*?(?:g[eé]nero|estilo)/i.test(rawClean)) {
            criteria.preferredGenres = []
            state.genreIndifferent = true
        }
        if (analysis.isModeIndifferent || /flexibilizar.*?(?:modo|modalidad)/i.test(rawClean)) {
            criteria.gameMode = null
            state.modeIndifferent = true
        }

        let scoredGames = await evaluateRecommendations(criteria, {
            limit: 3,
            excludeTitles: state.rejectedGames || []
        })

        const newRecommendations = scoredGames.map((item) => ({
            game: item.game,
            score: item.score,
            breakdown: item.breakdown,
            explanation: generateExplanation(item, criteria)
        }))

        const newlyShown = newRecommendations.map((r) => r.game.title)
        state.shownGameTitles = [...new Set([...(state.shownGameTitles || []), ...newlyShown])]
        state.lastRecommendedGames = newlyShown
        state.currentReferencedGame = null

        const intro = isFlexibilizar
            ? "¡Perfecto! Hemos flexibilizado ese criterio para ampliar el abanico de opciones. Aquí tienes nuevas recomendaciones:"
            : composeRecommendationIntro(criteria, state, analysis)
        const reply = `${intro}\n\n¿Alguna de estas opciones se adapta mejor a lo que buscas?`

        return {
            reply,
            updatedCriteria: criteria,
            dialogueState: state,
            recommendations: newRecommendations,
            suggestedReplies: [
                "Me interesa el primero",
                newlyShown[0] ? `¿De qué trata ${newlyShown[0]}?` : "Quiero saber más",
                "Buscar alternativas",
                "Nueva búsqueda"
            ]
        }
    }

    return null
}

module.exports = {
    getGameDetails,
    resolveGameReference,
    detectComparisonIntent,
    detectFeedbackIntent,
    extractFeedbackMotives,
    answerGameQuestion,
    compareGames,
    handlePostRecommendationTurn
}
