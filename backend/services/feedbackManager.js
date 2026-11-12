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
const {
    FEEDBACK_TYPES,
    FEEDBACK_INTENSITIES,
    FEEDBACK_SENTIMENTS,
    FEEDBACK_SCOPES,
    createFeedbackEvent,
    recordFeedbackEvent,
    parseMixedFeedbackClauses,
    resolveDescriptiveGameReference,
    classifyFeedbackIntensity
} = require("./feedbackEventService")

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

    // 0. Detección descriptiva o superlativa ("el que tiene más historia", "el que tiene menos combate", "el último")
    if (lastRecs.length > 0) {
        if (/(?:\b(?:el\s+)?(?:[uú]ltim[oa]|final)(?:\s+juego|\s+opci[oó]n)?\b)/i.test(clean)) {
            const lastTitle = lastRecs[lastRecs.length - 1]
            return {
                resolvedGameTitle: lastTitle,
                resolvedFrom: "descriptive_last",
                ordinalIndex: lastRecs.length - 1,
                isAmbiguous: false,
                isNotRecommended: false
            }
        }

        const moreMatch = clean.match(/(?:el\s+que\s+tiene\s+m[aá]s|el\s+de\s+m[aá]s|con\s+m[aá]s)\s+([a-z]+)/i)
        const lessMatch = clean.match(/(?:el\s+que\s+tiene\s+menos|el\s+de\s+menos|con\s+menos)\s+([a-z]+)/i)
        if (moreMatch || lessMatch) {
            const isMore = !!moreMatch
            const targetWord = (moreMatch && moreMatch[1]) || (lessMatch && lessMatch[1])
            let attrKey = null
            if (/historia|narrativ|trama|guion/i.test(targetWord)) attrKey = "narrative"
            else if (/combate|pelea|accion/i.test(targetWord)) attrKey = "combat"
            else if (/explor/i.test(targetWord)) attrKey = "exploration"
            else if (/creativ|constru/i.test(targetWord)) attrKey = "creativity"
            else if (/estrateg|tactica|gestion/i.test(targetWord)) attrKey = "strategy"
            else if (/libertad|abierto/i.test(targetWord)) attrKey = "freedom"
            else if (/complej|dificil/i.test(targetWord)) attrKey = "complexity"

            if (attrKey) {
                const candidatesWithData = lastRecs.map((title) => {
                    const sg = seedGames.find((g) => cleanText(g.title) === cleanText(title))
                    const val = sg?.experienceAttributes?.[attrKey] ?? 0
                    return { title, val }
                })
                candidatesWithData.sort((a, b) => isMore ? b.val - a.val : a.val - b.val)
                const best = candidatesWithData[0]?.title
                if (best) {
                    return {
                        resolvedGameTitle: best,
                        resolvedFrom: "descriptive_attribute",
                        ordinalIndex: lastRecs.indexOf(best),
                        isAmbiguous: false,
                        isNotRecommended: false
                    }
                }
            }
        }
    }

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
        if (dialogueState.lastComparedGames && dialogueState.lastComparedGames.length >= 2 && dialogueState.stage === "compared") {
            if (dialogueState.lastComparedGames[ordinalIndex]) {
                return {
                    resolvedGameTitle: dialogueState.lastComparedGames[ordinalIndex],
                    resolvedFrom: "compared_ordinal",
                    ordinalIndex,
                    isAmbiguous: false,
                    isNotRecommended: false
                }
            }
        }
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

    // Descartar expresiones de rango temporal ("entre 30 y 60 minutos", etc.)
    const isTimeRange = /\b(?:minutos?|horas?|sesi[oó]n|partidas?)\b/i.test(clean)
    if (isTimeRange && !/(?:comparar?|diferencia\s+entre|\bvs\b)/i.test(clean)) {
        return null
    }

    const isComparisonQuery =
        /(?:comparar?|comparaci[oó]n|diferencia|cu[aá]l\s+(?:de\s+los\s+dos\s+)?es\s+m[aá]s|cu[aá]l\s+(?:de\s+estos|de\s+ambos|es\s+mejor)|cu[aá]l\s+tiene\s+m[aá]s|cu[aá]l\s+tiene\s+menos)/i.test(clean)

    if (!isComparisonQuery && !dialogueState.pendingComparisonGame) return null

    const lastRecs = Array.isArray(dialogueState.lastRecommendedGames) ? dialogueState.lastRecommendedGames : []
    const lastCompared = Array.isArray(dialogueState.lastComparedGames) ? dialogueState.lastComparedGames : []
    const targets = []

    // 1. Identificar si menciona títulos directamente
    const candidatePool = [
        ...new Set([
            ...lastRecs,
            ...lastCompared,
            ...seedGames.map((g) => g.title)
        ])
    ].sort((a, b) => b.length - a.length)

    for (const title of candidatePool) {
        const cleanTitle = cleanText(title)
        const regex = new RegExp(`\\b${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
        if (regex.test(clean)) {
            if (!targets.some((t) => cleanText(t) === cleanTitle)) {
                targets.push(title)
            }
        }
    }

    // 2. Identificar si menciona ordinales ("el primero y el segundo", "compara los dos")
    const activeRefList = lastRecs.length >= 2 ? lastRecs : (lastCompared.length >= 2 ? lastCompared : [])
    if (targets.length < 2 && activeRefList.length >= 2) {
        if (/primer/i.test(clean) && /segund/i.test(clean)) {
            targets.length = 0
            targets.push(activeRefList[0], activeRefList[1])
        } else if (/primer/i.test(clean) && /tercer/i.test(clean) && activeRefList[2]) {
            targets.length = 0
            targets.push(activeRefList[0], activeRefList[2])
        } else if (/segund/i.test(clean) && /tercer/i.test(clean) && activeRefList[2]) {
            targets.length = 0
            targets.push(activeRefList[1], activeRefList[2])
        } else if (targets.length === 0 && /(?:cu[aá]l\s+(?:de\s+los\s+dos\s+)?es\s+m[aá]s|compara(?:r)?\s+(?:las|ambas|las\s+dos|estos\s+dos)\s+opciones|compara\s+(?:estos|esos)\s+dos\s+juegos|qu[eé]\s+diferencia\s+hay\s+entre\s+los\s+dos|cu[aá]l\s+tiene\s+(?:m[aá]s|menos))/i.test(clean)) {
            targets.push(activeRefList[0], activeRefList[1])
        }
    }

    // 3. Si había un juego pendiente para comparar de un turno previo
    if (targets.length === 1 && dialogueState.pendingComparisonGame) {
        if (cleanText(dialogueState.pendingComparisonGame) !== cleanText(targets[0])) {
            targets.unshift(dialogueState.pendingComparisonGame)
        }
    }

    // Identificar el aspecto específico a contrastar
    let aspect = "general"
    if (/explor/i.test(clean)) {
        aspect = "exploracion"
    } else if (/combate|pelea|acci[oó]n|violencia/i.test(clean)) {
        aspect = "combate"
    } else if (/historia|narrativa|trama|lore|guion/i.test(clean)) {
        aspect = "narrativa"
    } else if (/creativ|construc|crafteo/i.test(clean)) {
        aspect = "creatividad"
    } else if (/tranquil|relaj|calm|paz|desconexion/i.test(clean)) {
        aspect = "tranquilidad"
    } else if (/dificil|complej|exigente|reto|desafio/i.test(clean)) {
        aspect = "dificultad"
    } else if (/cort|duraci[oó]n|larg|tiempo/i.test(clean)) {
        aspect = "duracion"
    } else if (/amigos|coop|solo|jugador|modalidad/i.test(clean)) {
        aspect = "modalidad"
    }

    if (targets.length === 1) {
        return {
            singleGame: targets[0],
            aspect
        }
    }

    if (targets.length >= 2) {
        return {
            gameA: targets[0],
            gameB: targets[1],
            aspect
        }
    }

    // Manejo de títulos libres o no identificados con patrón "compara X con Y"
    const explicitPairMatch = clean.match(/(?:compara|diferencia\s+entre|qu[eé]\s+diferencia\s+hay\s+entre)\s+([a-z0-9\s]+?)\s+(?:con|y)\s+([a-z0-9\s]+?)(?:[.,;?!]|$)/i)
    if (explicitPairMatch && explicitPairMatch[1] && explicitPairMatch[2]) {
        const itemA = explicitPairMatch[1].trim()
        const itemB = explicitPairMatch[2].trim()
        if (!/^\d+$/.test(itemA) && !/^\d+$/.test(itemB)) {
            return {
                gameA: itemA,
                gameB: itemB,
                aspect
            }
        }
    }

    return null
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

    // 0. Retroalimentación mixta con conectores de contraste (Etapa 7, Escenario 4)
    const mixed = parseMixedFeedbackClauses(userMessage)
    if (mixed) {
        return {
            type: "mixed_feedback",
            targetGame: resolvedRef.resolvedGameTitle,
            mixedData: mixed
        }
    }

    // 0b. Descarte por precio (Etapa 7, Escenario 21)
    const isPriceRejection = /(?:es\s+de\s+pago|no\s+quiero\s+pagar|solo\s+(?:busco|quiero)\s+gratis|solo\s+gratuitos|solo\s+gratis)/i.test(clean)
    if (isPriceRejection) {
        return { type: "price_rejection", targetGame: resolvedRef.resolvedGameTitle }
    }

    // 0c. Aversión a estética (Etapa 7, Escenario 18)
    if (/pixel\s*art|retro|pixelado/i.test(clean) && /(?:no\s+me\s+gusta|sin|odio|detesto|nada\s+de)/i.test(clean)) {
        return { type: "aesthetic_dislike", feature: "pixel_art", targetGame: resolvedRef.resolvedGameTitle }
    }

    // 0d. Solicitud de juego más relajante (Etapa 7, Escenario 25)
    if (/(?:m[aá]s\s+relajante\s+que|m[aá]s\s+tranquilo\s+que)/i.test(clean)) {
        return { type: "more_relaxing_request", targetGame: resolvedRef.resolvedGameTitle }
    }

    // 0e. Interés en un aspecto específico de una recomendación (Etapa 7, Escenario 3)
    const isFeatureLike =
        /(?:me\s+gusta|me\s+interesa|me\s+llama|me\s+encanta|valoro|prefiero)\s+(?:la\s+|el\s+|los\s+|las\s+)?([a-záéíóúñ\s]+?)\s+(?:de|en)\s+/i.test(clean) ||
        (/(?:me\s+gusta|me\s+interesa|me\s+llama)\s+(?:la\s+)?(?:exploraci[oó]n|historia|narrativa|creatividad|libertad|construcci[oó]n)/i.test(clean) && !/(?:no\s+me\s+gusta|pero\s+no|sin)/i.test(clean))

    if (isFeatureLike) {
        let feat = "exploracion"
        if (/historia|narrativ|trama|lore|guion/i.test(clean)) feat = "narrativa_historia"
        else if (/explor|descubrir/i.test(clean)) feat = "exploracion"
        else if (/creativ|constru|crafteo/i.test(clean)) feat = "construccion_creatividad"
        else if (/estrateg|tactica|gestion/i.test(clean)) feat = "estrategia_planificacion"
        else if (/libertad|ritmo/i.test(clean)) feat = "libertad_sandbox"
        return {
            type: "feature_like",
            targetGame: resolvedRef.resolvedGameTitle,
            targetFeature: feat
        }
    }

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
    // Salvaguarda ante entradas vacías o malformadas (Escenario 26)
    if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) {
        return null
    }

    const { evaluateRecommendations } = require("./recommendationEngine")
    const { generateExplanation } = require("./explanationService")
    const { composeRecommendationIntro } = require("./responseComposer")

    const rawClean = cleanText(userMessage)
    const state = dialogueState

    // 0. Manejo de respuesta tras pregunta de seguimiento de descarte sin motivo (Etapa 7, Escenario 2 & 22)
    if (state.stage === "feedback_rejection_followup") {
        const rejectedGame = state.pendingRejectionGame || (state.rejectedGames && state.rejectedGames[state.rejectedGames.length - 1]) || null
        let appliedFeature = null
        let explanationReason = null

        if (/(?:menos\s+combate|sin\s+combate|evitar\s+combate)/i.test(rawClean)) {
            criteria.experiencePreferences.combat = "bajo"
            criteria.likedFeatures = criteria.likedFeatures.filter(f => f !== "combate_accion")
            appliedFeature = "combate_accion"
            explanationReason = "reducir el combate"
        } else if (/(?:menor\s+dificultad|m[aá]s\s+f[aá]cil|menos\s+dif[ií]cil|sin\s+frustraci[oó]n)/i.test(rawClean)) {
            criteria.desiredDifficulty = "baja"
            criteria.isDifficultyStrict = false
            appliedFeature = "dificultad"
            explanationReason = "reducir la dificultad a nivel relajado"
        } else if (/(?:m[aá]s\s+historia|mejor\s+narrativa|trama)/i.test(rawClean)) {
            criteria.experiencePreferences.narrative = "alto"
            if (!criteria.likedFeatures.includes("narrativa_historia")) criteria.likedFeatures.push("narrativa_historia")
            appliedFeature = "narrativa_historia"
            explanationReason = "mayor énfasis en la historia"
        } else if (/(?:m[aá]s\s+relajante|algo\s+m[aá]s\s+tranquilo|relajarme)/i.test(rawClean)) {
            criteria.emotionalContext = ["relajante"]
            criteria.desiredPacing = "relajado"
            criteria.desiredDifficulty = "baja"
            appliedFeature = "relajante"
            explanationReason = "ritmo más relajado y tranquilo"
        } else if (/(?:partidas?\s+m[aá]s\s+cortas?|menos\s+tiempo|poco\s+tiempo)/i.test(rawClean)) {
            criteria.availableTime = "corta (< 30 min)"
            appliedFeature = "duracion"
            explanationReason = "partidas más cortas"
        } else if (/(?:menos\s+plataformas?|sin\s+saltos)/i.test(rawClean)) {
            if (!criteria.dislikedGenres.includes("Plataformas")) criteria.dislikedGenres.push("Plataformas")
            criteria.preferredGenres = criteria.preferredGenres.filter(g => g !== "Plataformas")
            appliedFeature = "plataformas"
            explanationReason = "evitar juegos de plataformas"
        }

        if (appliedFeature) {
            recordFeedbackEvent(state.conversationMemory, {
                gameTitle: rejectedGame,
                type: FEEDBACK_TYPES.FEATURE_DISLIKE,
                feature: appliedFeature,
                sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
                reason: explanationReason,
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn: state.turnCount
            })
        }

        state.pendingRejectionGame = null
        state.stage = "recommended"

        const excludeList = [...new Set([...(state.shownGameTitles || []), ...(state.rejectedGames || [])])]
        let scoredGames = await evaluateRecommendations(criteria, {
            limit: 3,
            excludeTitles: excludeList,
            minScore: 45
        })

        if (scoredGames.length === 0) {
            scoredGames = await evaluateRecommendations(criteria, {
                limit: 3,
                excludeTitles: state.rejectedGames || [],
                minScore: 40
            })
        }

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

        const adjustNote = explanationReason ? ` teniendo en cuenta tu preferencia de ${explanationReason}` : ""
        const reply = `¡Perfecto! Hemos actualizado tus filtros${adjustNote}. Aquí tienes nuevas recomendaciones acordes:\n\n¿Alguna de estas nuevas opciones te llama la atención?`

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

    // 0b. Manejo de retroalimentación en comparativa activa (Etapa 7, Escenario 7)
    if (state.stage === "compared" && Array.isArray(state.lastComparedGames) && state.lastComparedGames.length >= 2) {
        const [compA, compB] = state.lastComparedGames

        // Sub-caso: "Ninguno me convence"
        if (/(?:ningun(?:o|a)\s+me\s+(?:convence|gusta|llama)|no\s+me\s+gusta\s+ningun(?:o|a)|no\s+me\s+convence\s+ningun(?:o|a)|ninguno\b)/i.test(rawClean)) {
            if (!state.rejectedGames) state.rejectedGames = []
            if (!state.rejectedGames.includes(compA)) state.rejectedGames.push(compA)
            if (!state.rejectedGames.includes(compB)) state.rejectedGames.push(compB)
            if (!criteria.dislikedGames) criteria.dislikedGames = []
            if (!criteria.dislikedGames.includes(compA)) criteria.dislikedGames.push(compA)
            if (!criteria.dislikedGames.includes(compB)) criteria.dislikedGames.push(compB)

            recordFeedbackEvent(state.conversationMemory, {
                gameTitle: compA,
                type: FEEDBACK_TYPES.GAME_REJECTION,
                sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
                reason: "Descarte conjunto tras comparación",
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn: state.turnCount
            })
            recordFeedbackEvent(state.conversationMemory, {
                gameTitle: compB,
                type: FEEDBACK_TYPES.GAME_REJECTION,
                sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
                reason: "Descarte conjunto tras comparación",
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn: state.turnCount
            })

            return {
                reply: `Entendido, descartamos tanto **${compA}** como **${compB}**. ¿Qué te gustaría cambiar para las siguientes recomendaciones: el tipo de juego (género), el ritmo o la duración?`,
                updatedCriteria: criteria,
                dialogueState: state,
                recommendations: [],
                suggestedReplies: [
                    "Cambiar el género",
                    "Cambiar el ritmo o dificultad",
                    "Buscar otras alternativas directamente",
                    "Nueva búsqueda"
                ]
            }
        }

        // Sub-caso: "Prefiero el primero porque tiene menos combate" / "Prefiero el segundo..."
        const isPrefFirst = /(?:prefiero\s+el\s+primer(?:o)?|me\s+quedo\s+con\s+el\s+primer(?:o)?|me\s+gusta\s+m[aá]s\s+el\s+primer(?:o)?)/i.test(rawClean)
        const isPrefSecond = /(?:prefiero\s+el\s+segund(?:o)?|me\s+quedo\s+con\s+el\s+segund(?:o)?|me\s+gusta\s+m[aá]s\s+el\s+segund(?:o)?)/i.test(rawClean)

        if (isPrefFirst || isPrefSecond) {
            const chosen = isPrefFirst ? compA : compB
            const motives = extractFeedbackMotives(userMessage)
            if (motives.hasMotives && motives.rejectedFeatures.includes("combate_accion")) {
                criteria.experiencePreferences.combat = "bajo"
                criteria.likedFeatures = criteria.likedFeatures.filter(f => f !== "combate_accion")
            }
            if (!state.interestedGames) state.interestedGames = []
            if (!state.interestedGames.includes(chosen)) state.interestedGames.push(chosen)
            if (!criteria.likedGames) criteria.likedGames = []
            if (!criteria.likedGames.includes(chosen)) criteria.likedGames.push(chosen)

            recordFeedbackEvent(state.conversationMemory, {
                gameTitle: chosen,
                type: FEEDBACK_TYPES.GAME_INTEREST,
                sentiment: FEEDBACK_SENTIMENTS.POSITIVE,
                reason: motives.explanationText || "Elegido en comparación",
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn: state.turnCount
            })
            if (motives.rejectedFeatures.length > 0) {
                for (const f of motives.rejectedFeatures) {
                    recordFeedbackEvent(state.conversationMemory, {
                        type: FEEDBACK_TYPES.FEATURE_DISLIKE,
                        feature: f,
                        sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
                        reason: motives.explanationText,
                        intensity: classifyFeedbackIntensity(userMessage),
                        turn: state.turnCount
                    })
                }
            }

            const game = await getGameDetails(chosen)
            const reasonNote = motives.explanationText ? ` por ${motives.explanationText}` : ""
            return {
                reply: `¡Excelente elección! Te has decantado por **${chosen}**${reasonNote}. ${game?.description || ""}\n\n¿Deseas conocer más detalles de este título o prefieres buscar alternativas?`,
                updatedCriteria: criteria,
                dialogueState: state,
                recommendations: [],
                suggestedReplies: [
                    `Saber más sobre ${chosen}`,
                    "Buscar alternativas",
                    "Nueva búsqueda"
                ]
            }
        }
    }

    // 1. Detección de intención de comparación entre dos títulos
    const comp = detectComparisonIntent(userMessage, state)
    if (comp) {
        if (comp.singleGame) {
            state.pendingComparisonGame = comp.singleGame
            return {
                reply: `He seleccionado **${comp.singleGame}** para comparar. ¿Con qué otro videojuego te gustaría contrastarlo?`,
                updatedCriteria: criteria,
                dialogueState: state,
                recommendations: [],
                suggestedReplies: (state.lastRecommendedGames || [])
                    .filter((t) => t !== comp.singleGame)
                    .slice(0, 3)
                    .map((t) => `Comparar con ${t}`)
            }
        }

        const { compareGamesData } = require("./comparisonService")
        const compResult = await compareGamesData({
            titleA: comp.gameA,
            titleB: comp.gameB,
            criteria,
            aspect: comp.aspect
        })

        if (compResult.error === "same_game") {
            return {
                reply: "Por favor selecciona dos videojuegos diferentes. No es posible comparar un título consigo mismo.",
                updatedCriteria: criteria,
                dialogueState: state,
                recommendations: [],
                suggestedReplies: ["Comparar opciones recomendadas", "Buscar alternativas", "Nueva búsqueda"]
            }
        }

        if (compResult.error === "game_not_found") {
            return {
                reply: `No pude encontrar el videojuego "${compResult.missingGame}" en el catálogo de PC para realizar la comparación. Puedes elegir otro título o comparar entre los recomendados.`,
                updatedCriteria: criteria,
                dialogueState: state,
                recommendations: [],
                suggestedReplies: (state.lastRecommendedGames || []).slice(0, 2).map((t) => `Comparar ${t}`)
            }
        }

        state.lastComparedGames = [compResult.gameA.title, compResult.gameB.title]
        state.currentReferencedGame = compResult.gameA.title
        state.pendingComparisonGame = null
        state.stage = "compared"

        return {
            reply: compResult.explanation,
            comparisonData: compResult,
            updatedCriteria: criteria,
            dialogueState: state,
            recommendations: [],
            suggestedReplies: [
                `Me interesa ${compResult.gameA.title}`,
                `Me interesa ${compResult.gameB.title}`,
                `¿Cuál tiene menos combate?`,
                `Buscar alternativas a ambos`
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

    // 2b. Retroalimentación mixta / contrastada (Etapa 7, Escenario 4)
    const mixed = parseMixedFeedbackClauses(userMessage)
    if (mixed) {
        const targetTitle = resolvedRef.resolvedGameTitle || state.currentReferencedGame || null
        if (targetTitle) {
            state.currentReferencedGame = targetTitle
        }
        for (const feat of mixed.positiveFeatures) {
            if (!criteria.likedFeatures.includes(feat)) criteria.likedFeatures.push(feat)
            if (feat === "narrativa_historia") criteria.experiencePreferences.narrative = "alto"
            else if (feat === "exploracion") criteria.experiencePreferences.exploration = "alto"
            else if (feat === "construccion_creatividad") criteria.experiencePreferences.creativity = "alto"
            else if (feat === "estrategia_planificacion") criteria.experiencePreferences.strategy = "alto"
            recordFeedbackEvent(state.conversationMemory, {
                gameTitle: targetTitle,
                type: FEEDBACK_TYPES.FEATURE_LIKE,
                feature: feat,
                sentiment: FEEDBACK_SENTIMENTS.POSITIVE,
                reason: `Interés positivo en ${feat}`,
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn: state.turnCount
            })
        }
        for (const feat of mixed.negativeFeatures) {
            if (feat === "combate_accion") {
                criteria.experiencePreferences.combat = "bajo"
                criteria.likedFeatures = criteria.likedFeatures.filter(f => f !== "combate_accion")
            } else if (feat === "combate_dificil") {
                if (!criteria.dislikedFeatures.includes("combate_dificil")) criteria.dislikedFeatures.push("combate_dificil")
                criteria.desiredDifficulty = "baja"
            } else {
                if (!criteria.dislikedFeatures.includes(feat)) criteria.dislikedFeatures.push(feat)
                criteria.likedFeatures = criteria.likedFeatures.filter(f => f !== feat)
            }
            recordFeedbackEvent(state.conversationMemory, {
                gameTitle: targetTitle,
                type: FEEDBACK_TYPES.FEATURE_DISLIKE,
                feature: feat,
                sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
                reason: `Aversión hacia ${feat}`,
                intensity: classifyFeedbackIntensity(userMessage),
                turn: state.turnCount
            })
        }

        const excludeList = [...new Set([...(state.shownGameTitles || []), ...(state.rejectedGames || [])])]
        let scoredGames = await evaluateRecommendations(criteria, {
            limit: 3,
            excludeTitles: excludeList,
            minScore: 45
        })
        if (scoredGames.length === 0) {
            scoredGames = await evaluateRecommendations(criteria, {
                limit: 3,
                excludeTitles: state.rejectedGames || [],
                minScore: 40
            })
        }

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
        state.stage = "recommended"

        if (state.conversationMemory && state.conversationMemory.recommendationFeedback) {
            state.conversationMemory.recommendationFeedback.lastShownGames = newlyShown
            state.conversationMemory.recommendationFeedback.shownHistory = state.shownGameTitles
        }

        const posNames = mixed.positiveFeatures.map(f => f.replace("_", " ")).join(", ")
        const negNames = mixed.negativeFeatures.map(f => f.replace("_", " ")).join(", ")
        const reply = `¡Anotado! Potenciaremos los aspectos que te gustan (como ${posNames}) y reduciremos los elementos que prefieres evitar (como ${negNames}). Aquí tienes recomendaciones adaptadas a ese balance:\n\n¿Alguna de estas opciones se ajusta mejor a lo que buscas?`

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

    // 2c. Interés específico en un aspecto (Etapa 7, Escenario 3)
    const fbIntentEarly = detectFeedbackIntent(userMessage, state, resolvedRef)
    if (fbIntentEarly.type === "feature_like") {
        const feat = fbIntentEarly.targetFeature || "exploracion"
        const targetTitle = fbIntentEarly.targetGame || resolvedRef.resolvedGameTitle || null
        if (!criteria.likedFeatures.includes(feat)) criteria.likedFeatures.push(feat)
        if (feat === "exploracion") criteria.experiencePreferences.exploration = "alto"
        else if (feat === "narrativa_historia") criteria.experiencePreferences.narrative = "alto"
        else if (feat === "construccion_creatividad") criteria.experiencePreferences.creativity = "alto"
        else if (feat === "estrategia_planificacion") criteria.experiencePreferences.strategy = "alto"

        recordFeedbackEvent(state.conversationMemory, {
            gameTitle: targetTitle,
            type: FEEDBACK_TYPES.FEATURE_LIKE,
            feature: feat,
            sentiment: FEEDBACK_SENTIMENTS.POSITIVE,
            reason: `Interés específico en ${feat}`,
            intensity: FEEDBACK_INTENSITIES.CLEAR,
            turn: state.turnCount
        })

        const excludeList = [...new Set([...(state.shownGameTitles || []), ...(state.rejectedGames || [])])]
        let scoredGames = await evaluateRecommendations(criteria, {
            limit: 3,
            excludeTitles: excludeList,
            minScore: 45
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
        state.stage = "recommended"

        const gameMention = targetTitle ? ` como en **${targetTitle}**` : ""
        const reply = `¡Anotado! Priorizaremos videojuegos con un gran componente de ${feat.replace("_", " ")}${gameMention}. Aquí tienes nuevas opciones que destacan especialmente en ese aspecto:\n\n¿Alguna de estas opciones te llama la atención?`

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

    // 2d. Descarte por precio (Etapa 7, Escenario 21)
    if (fbIntentEarly.type === "price_rejection") {
        criteria.pricePreference = "gratuito"
        criteria.isPriceStrict = true
        const targetTitle = resolvedRef.resolvedGameTitle || null
        if (targetTitle) {
            if (!state.rejectedGames) state.rejectedGames = []
            if (!state.rejectedGames.includes(targetTitle)) state.rejectedGames.push(targetTitle)
            if (!criteria.dislikedGames) criteria.dislikedGames = []
            if (!criteria.dislikedGames.includes(targetTitle)) criteria.dislikedGames.push(targetTitle)
            recordFeedbackEvent(state.conversationMemory, {
                gameTitle: targetTitle,
                type: FEEDBACK_TYPES.GAME_REJECTION,
                sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
                reason: "Rechazado por ser de pago (se busca gratuito)",
                intensity: FEEDBACK_INTENSITIES.STRICT,
                turn: state.turnCount
            })
        }

        const excludeList = [...new Set([...(state.shownGameTitles || []), ...(state.rejectedGames || [])])]
        let scoredGames = await evaluateRecommendations(criteria, {
            limit: 3,
            excludeTitles: excludeList,
            minScore: 35
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
        state.stage = "recommended"

        const reply = "Entendido. A partir de ahora filtraremos exclusivamente videojuegos gratuitos (free-to-play) para PC. Aquí tienes opciones gratuitas que se adaptan a lo que buscas:\n\n¿Alguna de estas opciones gratuitas te llama la atención?"

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

    // 2e. Aversión estética (Etapa 7, Escenario 18)
    if (fbIntentEarly.type === "aesthetic_dislike" || (/pixel\s*art|pixelado/i.test(rawClean) && /(?:no\s+me\s+gusta|sin|odio|detesto|nada\s+de)/i.test(rawClean))) {
        if (!criteria.dislikedFeatures.includes("pixel_art")) {
            criteria.dislikedFeatures.push("pixel_art")
        }
        criteria.likedFeatures = criteria.likedFeatures.filter(f => f !== "pixel_art")

        recordFeedbackEvent(state.conversationMemory, {
            type: FEEDBACK_TYPES.FEATURE_DISLIKE,
            feature: "pixel_art",
            sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
            reason: "Aversión a estética pixel art",
            intensity: FEEDBACK_INTENSITIES.STRICT,
            turn: state.turnCount
        })

        const excludeList = [...new Set([...(state.shownGameTitles || []), ...(state.rejectedGames || [])])]
        let scoredGames = await evaluateRecommendations(criteria, {
            limit: 3,
            excludeTitles: excludeList,
            minScore: 45
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
        state.stage = "recommended"

        const reply = "Entendido, evitaremos videojuegos con estética pixel art en nuestras recomendaciones. Aquí tienes opciones con otros estilos visuales que encajan con tu búsqueda:\n\n¿Alguna de estas opciones te atrae?"

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

    // 2f. Petición de juego más relajante (Etapa 7, Escenario 25)
    if (fbIntentEarly.type === "more_relaxing_request" || /(?:m[aá]s\s+relajante\s+que|m[aá]s\s+tranquilo\s+que)/i.test(rawClean)) {
        const targetTitle = resolvedRef.resolvedGameTitle || state.currentReferencedGame || null
        if (targetTitle) {
            if (!state.rejectedGames) state.rejectedGames = []
            if (!state.rejectedGames.includes(targetTitle)) state.rejectedGames.push(targetTitle)
            if (!criteria.dislikedGames) criteria.dislikedGames = []
            if (!criteria.dislikedGames.includes(targetTitle)) criteria.dislikedGames.push(targetTitle)
        }
        criteria.emotionalContext = ["relajante"]
        criteria.desiredPacing = "relajado"
        criteria.desiredDifficulty = "baja"
        criteria.likedFeatures = criteria.likedFeatures.filter(f => f !== "combate_accion" && f !== "desafio_progresion")

        recordFeedbackEvent(state.conversationMemory, {
            gameTitle: targetTitle,
            type: FEEDBACK_TYPES.PREFERENCE_CORRECTION,
            feature: "relajante",
            sentiment: FEEDBACK_SENTIMENTS.POSITIVE,
            reason: "Petición de experiencia más relajante y tranquila",
            intensity: FEEDBACK_INTENSITIES.CLEAR,
            turn: state.turnCount
        })

        const excludeList = [...new Set([...(state.shownGameTitles || []), ...(state.rejectedGames || [])])]
        let scoredGames = await evaluateRecommendations(criteria, {
            limit: 3,
            excludeTitles: excludeList,
            minScore: 45
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
        state.stage = "recommended"

        const reply = "Entendido, buscamos una experiencia notablemente más relajante, con ritmo tranquilo y sin presiones. Aquí tienes nuevas opciones ideales para desconectar:\n\n¿Alguna de estas opciones relajantes te llama la atención?"

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

    // 3. Si hay un juego resuelto (por nombre, ordinal, descriptivo o foco previo)
    if (resolvedRef.resolvedGameTitle) {
        const targetTitle = resolvedRef.resolvedGameTitle
        state.currentReferencedGame = targetTitle
        const fbIntent = fbIntentEarly

        // Caso 3.1: Solicitud de información detallada (Escenario 8: comentario neutral / consulta informativa)
        if (fbIntent.type.startsWith("info_")) {
            const game = await getGameDetails(targetTitle)
            const answer = answerGameQuestion(game, fbIntent.type)
            recordFeedbackEvent(state.conversationMemory, {
                gameTitle: targetTitle,
                type: FEEDBACK_TYPES.NEUTRAL_COMMENT,
                sentiment: FEEDBACK_SENTIMENTS.NEUTRAL,
                reason: "Consulta de información sin modificación de preferencias",
                turn: state.turnCount
            })
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
            if (!Array.isArray(criteria.likedGames)) criteria.likedGames = []
            if (!criteria.likedGames.includes(targetTitle)) {
                criteria.likedGames.push(targetTitle)
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

            recordFeedbackEvent(state.conversationMemory, {
                gameTitle: targetTitle,
                type: FEEDBACK_TYPES.GAME_INTEREST,
                sentiment: FEEDBACK_SENTIMENTS.POSITIVE,
                reason: motives.explanationText || "Interés en el juego",
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn: state.turnCount
            })

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
            const motives = extractFeedbackMotives(userMessage)

            // Sub-caso A: Rechazo SIN motivo (Etapa 7, Escenario 2 & 22)
            if (!motives.hasMotives && !/(?:combate|dificil|historia|tiempo|largo|corto|pixel|precio|gratis)/i.test(rawClean)) {
                if (!Array.isArray(state.rejectedGames)) state.rejectedGames = []
                if (!state.rejectedGames.includes(targetTitle)) {
                    state.rejectedGames.push(targetTitle)
                }
                if (!Array.isArray(criteria.dislikedGames)) criteria.dislikedGames = []
                if (!criteria.dislikedGames.includes(targetTitle)) {
                    criteria.dislikedGames.push(targetTitle)
                }

                recordFeedbackEvent(state.conversationMemory, {
                    gameTitle: targetTitle,
                    type: FEEDBACK_TYPES.GAME_REJECTION,
                    sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
                    reason: "Rechazo sin motivo especificado",
                    intensity: FEEDBACK_INTENSITIES.CLEAR,
                    turn: state.turnCount
                })

                state.pendingRejectionGame = targetTitle
                state.stage = "feedback_rejection_followup"

                // Sugerencias dinámicas según características reales del videojuego rechazado
                const game = await getGameDetails(targetTitle)
                const dynamicReplies = []
                if (game?.experienceAttributes?.combat >= 3 || game?.genres?.includes("Acción")) {
                    dynamicReplies.push("Menos combate")
                }
                if (game?.difficulty === "alta" || /desafiante/i.test(game?.difficulty || "")) {
                    dynamicReplies.push("Menor dificultad")
                }
                if (game?.genres?.includes("Plataformas")) {
                    dynamicReplies.push("Menos plataformas")
                }
                if ((game?.experienceAttributes?.narrative || 0) < 3) {
                    dynamicReplies.push("Más historia")
                }
                if (game?.pacing === "intenso") {
                    dynamicReplies.push("Algo más relajante")
                }
                if (game?.sessionDuration?.includes("larga")) {
                    dynamicReplies.push("Partidas más cortas")
                }
                dynamicReplies.push("Buscar alternativas directamente")

                const excludeList = [...new Set([...(state.shownGameTitles || []), ...(state.rejectedGames || [])])]
                let scoredGames = await evaluateRecommendations(criteria, {
                    limit: 3,
                    excludeTitles: excludeList,
                    minScore: 40
                })

                if (scoredGames.length === 0 && excludeList.length > state.rejectedGames.length) {
                    scoredGames = await evaluateRecommendations(criteria, {
                        limit: 3,
                        excludeTitles: state.rejectedGames,
                        minScore: 40
                    })
                }

                const newRecommendations = scoredGames.map((item) => ({
                    game: item.game,
                    score: item.score,
                    breakdown: item.breakdown,
                    explanation: generateExplanation(item, criteria)
                }))

                const newlyShown = newRecommendations.map((r) => r.game.title)
                state.shownGameTitles = [...new Set([...(state.shownGameTitles || []), ...newlyShown])]
                state.lastRecommendedGames = newlyShown

                const reply = `Entendido, descartamos **${targetTitle}**. ¿Qué te gustaría cambiar de esta opción? Mientras tanto, aquí tienes nuevas opciones que encajan con tu búsqueda:\n\n¿Alguna de estas nuevas opciones te llama la atención?`

                return {
                    reply,
                    updatedCriteria: criteria,
                    dialogueState: state,
                    recommendations: newRecommendations,
                    suggestedReplies: dynamicReplies.slice(0, 4)
                }
            }

            // Sub-caso B: Rechazo CON motivo explícito (Etapa 7, Escenario 1)
            if (!Array.isArray(state.rejectedGames)) state.rejectedGames = []
            if (!state.rejectedGames.includes(targetTitle)) {
                state.rejectedGames.push(targetTitle)
            }
            if (!Array.isArray(criteria.dislikedGames)) criteria.dislikedGames = []
            if (!criteria.dislikedGames.includes(targetTitle)) {
                criteria.dislikedGames.push(targetTitle)
            }

            const intensity = classifyFeedbackIntensity(userMessage)

            if (motives.rejectedFeatures.includes("combate_accion")) {
                if (intensity === FEEDBACK_INTENSITIES.STRICT) {
                    criteria.experiencePreferences.combat = "ninguno"
                    if (!criteria.dislikedFeatures.includes("combate_accion")) criteria.dislikedFeatures.push("combate_accion")
                    criteria.preferredGenres = criteria.preferredGenres.filter(g => g !== "Acción")
                } else {
                    criteria.experiencePreferences.combat = "bajo"
                    if (!criteria.dislikedFeatures.includes("combate_accion")) criteria.dislikedFeatures.push("combate_accion")
                }
                criteria.likedFeatures = criteria.likedFeatures.filter(f => f !== "combate_accion")
            }

            if (motives.rejectedFeatures.includes("combate_dificil")) {
                criteria.desiredDifficulty = "baja"
                criteria.isDifficultyStrict = false
                if (!criteria.dislikedFeatures.includes("combate_dificil")) criteria.dislikedFeatures.push("combate_dificil")
                criteria.likedFeatures = criteria.likedFeatures.filter(f => f !== "desafio_progresion")
            }

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

            recordFeedbackEvent(state.conversationMemory, {
                gameTitle: targetTitle,
                type: FEEDBACK_TYPES.GAME_REJECTION,
                sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
                reason: motives.explanationText || "Rechazo con motivo",
                intensity,
                turn: state.turnCount
            })

            for (const f of motives.rejectedFeatures) {
                recordFeedbackEvent(state.conversationMemory, {
                    gameTitle: targetTitle,
                    type: FEEDBACK_TYPES.FEATURE_DISLIKE,
                    feature: f,
                    sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
                    reason: motives.explanationText,
                    intensity,
                    turn: state.turnCount
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
                minScore: 40
            })

            if (scoredGames.length === 0 && excludeList.length > state.rejectedGames.length) {
                scoredGames = await evaluateRecommendations(criteria, {
                    limit: 3,
                    excludeTitles: state.rejectedGames,
                    minScore: 40
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
                state.stage = "recommended"

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
        /(?:dame\s+alternativas|buscar\s+alternativas|alternativas|mu[eé]strame\s+otros(?:\s+juegos)?|otras\s+opciones|dame\s+otras\s+opciones|m[aá]s\s+alternativas|ver\s+otras(?:\s+opciones)?|cambiar\s+opciones|algo\s+diferente|quiero\s+algo\s+diferente|diferentes\s+juegos)/i.test(rawClean) ||
        (analysis.wantsAlternatives && !/(?:no\s+me\s+convencen?\s+(?:estas|las|esas)\s+opciones|ningun(?:o|a)\s+me\s+(?:gusta|llama|convence))/i.test(rawClean))

    if (isRequestingAlternatives) {
        // Soporte para alternativas con motivo implícito (Etapa 7, Escenario 10)
        if (/menos\s+combate/i.test(rawClean)) {
            criteria.experiencePreferences.combat = "bajo"
            criteria.likedFeatures = criteria.likedFeatures.filter(f => f !== "combate_accion")
            recordFeedbackEvent(state.conversationMemory, {
                type: FEEDBACK_TYPES.FEATURE_DISLIKE,
                feature: "combate_accion",
                sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
                reason: "Alternativas con menos combate",
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn: state.turnCount
            })
        }

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
            state.stage = "recommended"

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
                    "Quiero algo diferente",
                    "Algo parecido a mis gustos",
                    "Muéstrame más alternativas"
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
            excludeTitles: state.rejectedGames || [],
            minScore: 40
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
        state.stage = "recommended"

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
