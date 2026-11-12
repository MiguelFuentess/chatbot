/**
 * Servicio de Memoria Conversacional Ampliada y Contextual (Etapa 6)
 *
 * Responsabilidades:
 * - Mantener y normalizar la estructura `conversationMemory` durante la sesión activa.
 * - Registrar preferencias habituales (géneros, características, ritmo, experiencias).
 * - Registrar necesidades temporales de la sesión actual (emoción de hoy, tiempo, modo).
 * - Distinguir gustos habituales de necesidades puntuales sin contradicciones.
 * - Registrar experiencias previas con videojuegos (disfrutados y rechazados) junto a sus motivos causales.
 * - Conservar el historial de recomendaciones, intereses, descartes y sus motivos.
 * - Gestionar correcciones, cambios de opinión y eliminaciones explícitas ("olvida que...").
 * - Atender consultas directas a la memoria ("¿Recuerdas qué me gustaba de Minecraft?", "¿Cuál era el juego que descarté?").
 * - Aplicar cascada determinista de prioridades para construir `activeCriteria` para el recomendador.
 * - Limpiar íntegramente la memoria al reiniciar la conversación.
 */

const { cleanText, resolveGameTitle, FEATURE_DEFINITIONS, GENRE_PATTERNS } = require("./nlpService")
const {
    FEEDBACK_TYPES,
    FEEDBACK_INTENSITIES,
    FEEDBACK_SENTIMENTS,
    FEEDBACK_SCOPES,
    createFeedbackEvent,
    recordFeedbackEvent,
    classifyFeedbackIntensity
} = require("./feedbackEventService")

/**
 * Crea la estructura inicial en blanco de la memoria conversacional.
 *
 * @returns {Object} Esquema base de memoria
 */
function createInitialMemory() {
    return {
        habitualPreferences: {
            genres: [],
            features: [],
            experiences: [],
            pacing: null,
            dislikedGenres: [],
            dislikedFeatures: []
        },
        currentNeeds: {
            emotion: [],
            availableTime: null,
            gameMode: null,
            desiredPacing: null,
            todayExperience: null,
            preferredGenres: [],
            dislikedGenres: [],
            dislikedFeatures: [],
            // --- NUEVOS EN ETAPA 3 ---
            experiencePreferences: {
                exploration: null,
                narrative: null,
                creativity: null,
                strategy: null,
                combat: null,
                freedom: null,
                complexity: null
            },
            objectiveStylePreference: null,
            desiredDifficulty: null,
            isDifficultyStrict: false,
            pricePreference: null,
            isPriceStrict: false,
            discoveryPreference: null
        },
        pastExperiences: {
            likedGames: [],      // [{ title, motive, features, turn }]
            dislikedGames: [],   // [{ title, motive, features, turn }]
            unverifiedGames: []
        },
        recommendationFeedback: {
            lastShownGames: [],
            shownHistory: [],
            interestedGames: [], // [{ title, motive, turn }]
            rejectedGames: [],   // [{ title, motive, isTemporary, turn }]
            requestedAdjustments: [],
            events: []           // [{ eventId, type, sentiment, intensity, scope, gameTitle, feature, reason, turn, createdAt }]
        },
        memoryLog: []
    }
}

/**
 * Sanitiza e inicializa la memoria garantizando que existan todos los campos requeridos,
 * con resiliencia ante estados malformados o incompletos (Escenario 17).
 *
 * @param {Object} existingMemory Memoria previa recibida
 * @param {Object} fallbackCriteria Criterios existentes de respaldo
 * @param {Object} fallbackDialogueState Estado de diálogo existente
 * @returns {Object} Memoria conversacional válida y normalizada
 */
function initConversationMemory(existingMemory, fallbackCriteria = {}, fallbackDialogueState = {}) {
    const base = createInitialMemory()
    if (!existingMemory || typeof existingMemory !== "object") {
        // Inicializar a partir de criterios previos si existen
        if (fallbackCriteria.habitualTastes && Array.isArray(fallbackCriteria.habitualTastes)) {
            base.habitualPreferences.experiences = [...fallbackCriteria.habitualTastes]
        }
        if (fallbackCriteria.availableTime) base.currentNeeds.availableTime = fallbackCriteria.availableTime
        if (fallbackCriteria.gameMode) base.currentNeeds.gameMode = fallbackCriteria.gameMode
        if (fallbackCriteria.desiredPacing) base.currentNeeds.desiredPacing = fallbackCriteria.desiredPacing
        if (Array.isArray(fallbackCriteria.emotionalContext)) base.currentNeeds.emotion = [...fallbackCriteria.emotionalContext]
        if (Array.isArray(fallbackCriteria.preferredGenres)) base.currentNeeds.preferredGenres = [...fallbackCriteria.preferredGenres]
        if (Array.isArray(fallbackCriteria.dislikedGenres)) base.currentNeeds.dislikedGenres = [...fallbackCriteria.dislikedGenres]
        if (Array.isArray(fallbackCriteria.dislikedFeatures)) base.currentNeeds.dislikedFeatures = [...fallbackCriteria.dislikedFeatures]
        if (fallbackCriteria.experiencePreferences) {
            base.currentNeeds.experiencePreferences = {
                ...base.currentNeeds.experiencePreferences,
                ...fallbackCriteria.experiencePreferences
            }
        }
        if (fallbackCriteria.objectiveStylePreference) base.currentNeeds.objectiveStylePreference = fallbackCriteria.objectiveStylePreference
        if (fallbackCriteria.desiredDifficulty) base.currentNeeds.desiredDifficulty = fallbackCriteria.desiredDifficulty
        if (fallbackCriteria.isDifficultyStrict !== undefined) base.currentNeeds.isDifficultyStrict = fallbackCriteria.isDifficultyStrict
        if (fallbackCriteria.pricePreference !== undefined) {
            base.currentNeeds.pricePreference = fallbackCriteria.pricePreference
            base.currentNeeds.isPriceStrict = fallbackCriteria.isPriceStrict || false
        }

        if (Array.isArray(fallbackCriteria.likedGames)) {
            for (const g of fallbackCriteria.likedGames) {
                base.pastExperiences.likedGames.push({ title: g, motive: null, features: [] })
            }
        }
        if (Array.isArray(fallbackCriteria.dislikedGames)) {
            for (const g of fallbackCriteria.dislikedGames) {
                base.pastExperiences.dislikedGames.push({ title: g, motive: null, features: [] })
            }
        }
        if (Array.isArray(fallbackDialogueState.shownGameTitles)) {
            base.recommendationFeedback.shownHistory = [...fallbackDialogueState.shownGameTitles]
        }
        if (Array.isArray(fallbackDialogueState.lastRecommendedGames)) {
            base.recommendationFeedback.lastShownGames = [...fallbackDialogueState.lastRecommendedGames]
        }
        if (Array.isArray(fallbackDialogueState.interestedGames)) {
            for (const g of fallbackDialogueState.interestedGames) {
                base.recommendationFeedback.interestedGames.push({ title: g, motive: null, turn: 1 })
            }
        }
        if (Array.isArray(fallbackDialogueState.rejectedGames)) {
            for (const g of fallbackDialogueState.rejectedGames) {
                base.recommendationFeedback.rejectedGames.push({ title: g, motive: null, isTemporary: false, turn: 1 })
            }
        }
        return base
    }

    // Normalizar asegurando que cada nodo y arreglo existan
    const mem = {
        habitualPreferences: {
            genres: Array.isArray(existingMemory.habitualPreferences?.genres) ? [...existingMemory.habitualPreferences.genres] : [],
            features: Array.isArray(existingMemory.habitualPreferences?.features) ? [...existingMemory.habitualPreferences.features] : [],
            experiences: Array.isArray(existingMemory.habitualPreferences?.experiences) ? [...existingMemory.habitualPreferences.experiences] : [],
            pacing: existingMemory.habitualPreferences?.pacing || null,
            dislikedGenres: Array.isArray(existingMemory.habitualPreferences?.dislikedGenres) ? [...existingMemory.habitualPreferences.dislikedGenres] : [],
            dislikedFeatures: Array.isArray(existingMemory.habitualPreferences?.dislikedFeatures) ? [...existingMemory.habitualPreferences.dislikedFeatures] : []
        },
        currentNeeds: {
            emotion: Array.isArray(existingMemory.currentNeeds?.emotion) ? [...existingMemory.currentNeeds.emotion] : [],
            availableTime: existingMemory.currentNeeds?.availableTime || null,
            gameMode: existingMemory.currentNeeds?.gameMode || null,
            desiredPacing: existingMemory.currentNeeds?.desiredPacing || null,
            todayExperience: existingMemory.currentNeeds?.todayExperience || null,
            preferredGenres: Array.isArray(existingMemory.currentNeeds?.preferredGenres) ? [...existingMemory.currentNeeds.preferredGenres] : [],
            dislikedGenres: Array.isArray(existingMemory.currentNeeds?.dislikedGenres) ? [...existingMemory.currentNeeds.dislikedGenres] : [],
            dislikedFeatures: Array.isArray(existingMemory.currentNeeds?.dislikedFeatures) ? [...existingMemory.currentNeeds.dislikedFeatures] : []
        },
        pastExperiences: {
            likedGames: Array.isArray(existingMemory.pastExperiences?.likedGames) ? [...existingMemory.pastExperiences.likedGames] : [],
            dislikedGames: Array.isArray(existingMemory.pastExperiences?.dislikedGames) ? [...existingMemory.pastExperiences.dislikedGames] : [],
            unverifiedGames: Array.isArray(existingMemory.pastExperiences?.unverifiedGames) ? [...existingMemory.pastExperiences.unverifiedGames] : []
        },
        recommendationFeedback: {
            lastShownGames: Array.isArray(existingMemory.recommendationFeedback?.lastShownGames) ? [...existingMemory.recommendationFeedback.lastShownGames] : [],
            shownHistory: Array.isArray(existingMemory.recommendationFeedback?.shownHistory) ? [...existingMemory.recommendationFeedback.shownHistory] : [],
            interestedGames: Array.isArray(existingMemory.recommendationFeedback?.interestedGames) ? [...existingMemory.recommendationFeedback.interestedGames] : [],
            rejectedGames: Array.isArray(existingMemory.recommendationFeedback?.rejectedGames) ? [...existingMemory.recommendationFeedback.rejectedGames] : [],
            requestedAdjustments: Array.isArray(existingMemory.recommendationFeedback?.requestedAdjustments) ? [...existingMemory.recommendationFeedback.requestedAdjustments] : [],
            events: Array.isArray(existingMemory.recommendationFeedback?.events) ? [...existingMemory.recommendationFeedback.events] : []
        },
        memoryLog: Array.isArray(existingMemory.memoryLog) ? existingMemory.memoryLog.slice(-15) : []
    }

    return mem
}

/**
 * Extrae motivos causales vinculados a un videojuego a partir de una cláusula explicativa.
 *
 * @param {string} userMessage Texto del usuario
 * @param {string} gameTitle Título del juego mencionado
 * @returns {Object} Motivo textual y características identificadas
 */
function extractGameMotive(userMessage = "", gameTitle = "") {
    const raw = userMessage || ""
    const clean = cleanText(raw)
    const titleClean = cleanText(gameTitle)

    let motiveText = null
    const matchedFeatures = []

    // 1. Buscar cláusula causal posterior a "porque", "por", "ya que", "dado que"
    const motiveMatch = raw.match(/(?:porque|ya\s+que|yaque|dado\s+que|por\s+la\s+raz[oó]n\s+de\s+que|por)\s+([^,.;!?]+)/i)
    if (motiveMatch && motiveMatch[1]) {
        motiveText = motiveMatch[1].trim()
    }

    // 2. Si no encontró causal estándar pero hay mención de estilo o acción
    if (!motiveText) {
        if (/explorar\s+libremente|mundo\s+abierto/i.test(clean)) {
            motiveText = "libertad para explorar el entorno"
        } else if (/construir|crear/i.test(clean)) {
            motiveText = "posibilidad de construir y crear"
        } else if (/buena\s+historia|trama|narrativa/i.test(clean)) {
            motiveText = "su historia y narrativa inmersiva"
        } else if (/demasiado\s+frustrante|dificultad\s+excesiva/i.test(clean)) {
            motiveText = "demasiada frustración y dificultad"
        } else if (/no\s+quiero\s+combates\s+r[aá]pidos/i.test(clean)) {
            motiveText = "evitar combates rápidos en esta sesión"
        }
    }

    // 3. Emparejar características asociadas a la razón
    if (motiveText) {
        const motiveClean = cleanText(motiveText)
        for (const feat of FEATURE_DEFINITIONS) {
            if (feat.patterns.some(p => motiveClean.includes(cleanText(p)))) {
                if (!matchedFeatures.includes(feat.id)) {
                    matchedFeatures.push(feat.id)
                }
            }
        }
        if (/explor/i.test(motiveClean) && !matchedFeatures.includes("exploracion")) {
            matchedFeatures.push("exploracion")
        }
        if (/libremente|libertad/i.test(motiveClean) && !matchedFeatures.includes("libertad_sandbox")) {
            matchedFeatures.push("libertad_sandbox")
        }
        if (/constru/i.test(motiveClean) && !matchedFeatures.includes("construccion_creatividad")) {
            matchedFeatures.push("construccion_creatividad")
        }
        if (/historia|trama/i.test(motiveClean) && !matchedFeatures.includes("narrativa_historia")) {
            matchedFeatures.push("narrativa_historia")
        }
        if (/frustr|dificil|dificultad/i.test(motiveClean) && !matchedFeatures.includes("combate_dificil")) {
            matchedFeatures.push("combate_dificil")
        }
    }

    return {
        motiveText,
        matchedFeatures
    }
}

/**
 * Detecta si el usuario desea modificar, corregir o eliminar explícitamente una preferencia de memoria.
 *
 * @param {string} userMessage Texto ingresado
 * @param {Object} memory Memoria actual
 * @returns {Object|null} Diagnóstico de modificación o null
 */
function detectMemoryCorrectionOrDeletion(userMessage = "", memory = {}) {
    const raw = (userMessage || "").trim()
    const clean = cleanText(userMessage)

    // 0. Eliminación directa de restricción de dificultad ("quita la restricción de dificultad")
    if (/(?:quita(?:r)?|elimina(?:r)?|borra(?:r)?|sin|olvida(?:r)?)\s+(?:la\s+)?restricci[oó]n\s+de\s+dificultad/i.test(clean) ||
        /(?:sin|quitar?|eliminar?)\s+l[ií]mite\s+de\s+dificultad/i.test(clean)) {
        return {
            type: "delete_preference",
            field: "difficulty",
            value: "restricción de dificultad",
            rawMatch: raw
        }
    }

    // 0b. Cambio de opinión sobre un juego antes rechazado (Etapa 7, Escenario 14)
    const changeGameOpinionMatch = raw.match(/(?:pens[aá]ndolo\s+bien,?\s+(?:me\s+interesa|dale\s+una\s+oportunidad\s+a)|cambi[eé]\s+de\s+opini[oó]n\s+(?:respecto\s+a|sobre)|ahora\s+s[ií]\s+me\s+interesa)\s+([a-záéíóúñ0-9: \-]+?)(?:[.,;]|$)/i)
    if (changeGameOpinionMatch && changeGameOpinionMatch[1]) {
        const candidateTitle = changeGameOpinionMatch[1].trim()
        const resolved = resolveGameTitle(candidateTitle)
        const finalTitle = resolved?.title || candidateTitle
        return {
            type: "change_game_opinion",
            gameTitle: finalTitle,
            targetState: "interested",
            rawMatch: raw
        }
    }

    // 0c. Ajuste de preferencia contradictoria de dificultad (Etapa 7, Escenario 16)
    const diffTransitionMatch = raw.match(/(?:antes\s+(?:quer[ií]a|ped[ií]|buscaba)\s+.*?(?:dif[ií]cil|desafiante).*?(?:pero|ahora).*?(?:sencillo|f[aá]cil|relajado|tranquilo)|cambia(?:r)?\s+(?:la\s+)?dificultad\s+(?:de\s+alta\s+)?a\s+(?:baja|sencilla|f[aá]cil))/i)
    if (diffTransitionMatch) {
        return {
            type: "correct_difficulty",
            oldValue: "alta",
            newValue: "baja",
            isStrict: false,
            rawMatch: raw
        }
    }

    // 0d. Exclusión de categoría entera (Etapa 7, Escenario 24)
    const excludeCategoryMatch = raw.match(/(?:ya\s+no\s+quiero\s+juegos?\s+de|no\s+me\s+recomiendes\s+(?:m[aá]s\s+)?juegos?\s+de|no\s+quiero\s+m[aá]s\s+juegos?\s+de|excluye\s+(?:los\s+juegos?\s+de|el\s+g[eé]nero)?)\s+([a-záéíóúñ]+)/i)
    if (excludeCategoryMatch && excludeCategoryMatch[1]) {
        const catClean = cleanText(excludeCategoryMatch[1].trim())
        for (const item of GENRE_PATTERNS) {
            if (item.patterns.some(p => catClean.includes(cleanText(p)))) {
                return {
                    type: "exclude_genre",
                    genre: item.genre,
                    rawMatch: raw
                }
            }
        }
    }

    // 1. Eliminación explícita: "Olvida que quería [género/característica]"
    const forgetMatch = raw.match(/(?:olvida\s+que\s+(?:quer[ií]a|dije|ped[ií]|mencion[eé])|elimina(?:\s+de\s+mis\s+gustos)?|quita|borra)\s+(.+?)(?:[.,;]|$)/i)
    if (forgetMatch && forgetMatch[1]) {
        const targetRaw = forgetMatch[1].trim()
        const targetClean = cleanText(targetRaw)

        // Comprobar si es un género
        for (const item of GENRE_PATTERNS) {
            if (item.patterns.some(p => targetClean.includes(cleanText(p)))) {
                return {
                    type: "delete_preference",
                    field: "genre",
                    value: item.genre,
                    rawMatch: targetRaw
                }
            }
        }

        // Comprobar si es una emoción o característica
        if (/terror/i.test(targetClean)) {
            return {
                type: "delete_preference",
                field: "genre",
                value: "Terror",
                rawMatch: targetRaw
            }
        }
        if (/puzzle|acertijo/i.test(targetClean)) {
            return {
                type: "delete_preference",
                field: "genre",
                value: "Puzzle",
                rawMatch: targetRaw
            }
        }
        if (/precio|gratis|gratuito|pago/i.test(targetClean)) {
            return {
                type: "delete_preference",
                field: "price",
                value: "gratuito",
                rawMatch: targetRaw
            }
        }
        if (/dificultad/i.test(targetClean)) {
            return {
                type: "delete_preference",
                field: "difficulty",
                value: "restricción de dificultad",
                rawMatch: targetRaw
            }
        }

        return {
            type: "delete_preference",
            field: "general",
            value: targetRaw,
            rawMatch: targetRaw
        }
    }

    // 2. Corrección explícita de género: "Antes dije [X], pero prefiero [Y]" o "Pensándolo bien, mejor prefiero [Y]"
    const changeGenreMatch = raw.match(/(?:antes\s+dije\s+([a-záéíóúñ]+).*?(?:pero|ahora)\s+prefiero\s+([a-záéíóúñ]+)|cambia\s+([a-záéíóúñ]+)\s+(?:por|a)\s+([a-záéíóúñ]+)|(?:pens[aá]ndolo\s+bien,?\s+)?mejor\s+prefiero\s+([a-záéíóúñ]+))/i)
    if (changeGenreMatch) {
        const oldCandidate = changeGenreMatch[1] || changeGenreMatch[3] || (memory.currentNeeds?.preferredGenres && memory.currentNeeds.preferredGenres[0]) || (memory.habitualPreferences?.genres && memory.habitualPreferences.genres[0]) || null
        const newCandidate = changeGenreMatch[2] || changeGenreMatch[4] || changeGenreMatch[5]

        let oldGenre = null
        let newGenre = null

        for (const item of GENRE_PATTERNS) {
            if (oldCandidate && item.patterns.some(p => cleanText(oldCandidate).includes(cleanText(p)))) {
                oldGenre = item.genre
            }
            if (newCandidate && item.patterns.some(p => cleanText(newCandidate).includes(cleanText(p)))) {
                newGenre = item.genre
            }
        }

        if (newGenre) {
            return {
                type: "correct_genre",
                oldValue: oldGenre || oldCandidate,
                newValue: newGenre
            }
        }
    }

    // 3. Cambio temporal de modalidad: "Hoy ya no quiero jugar con amigos" / "Para hoy prefiero jugar solo"
    if (/(?:hoy\s+)?ya\s+no\s+quiero\s+jugar\s+con\s+amigos|(?:solo\s+)?por\s+hoy\s+prefiero\s+(?:jugar\s+)?solo|hoy\s+quiero\s+jugar\s+solo|prefiero\s+algo\s+individual/i.test(clean)) {
        return {
            type: "correct_mode_temporary",
            newValue: "individual",
            isTemporary: true
        }
    }

    // 4. Mantener o conservar algo: "Mantén lo de la exploración"
    const keepMatch = raw.match(/(?:mant[eé]n(?:er)?|conserva(?:r)?)\s+(?:lo\s+de\s+la\s+|lo\s+de\s+los?\s+|la\s+|el\s+)?([a-záéíóúñ\s]+?)(?:[.,;]|$)/i)
    if (keepMatch && keepMatch[1]) {
        const keepTarget = cleanText(keepMatch[1])
        if (/explor/i.test(keepTarget)) {
            return {
                type: "keep_feature",
                featureId: "exploracion",
                label: "exploración"
            }
        }
        if (/historia|narrativ/i.test(keepTarget)) {
            return {
                type: "keep_feature",
                featureId: "narrativa_historia",
                label: "historia"
            }
        }
    }

    return null
}

/**
 * Atiende preguntas directas dirigidas a la memoria del asistente (Requisito 5).
 * Responde exclusivamente con información verificable existente en la memoria.
 *
 * @param {Object} params
 * @param {Object} params.memory Memoria conversacional actual
 * @param {string} params.userMessage Pregunta del usuario
 * @param {Object} params.dialogueState Estado de diálogo
 * @returns {Object|null} Respuesta directa o null si debe continuar el flujo ordinario
 */
function handleMemoryQuery({ memory = {}, userMessage = "", dialogueState = {} }) {
    const raw = (userMessage || "").trim()
    const clean = cleanText(raw)

    // 1. Consulta sobre motivo de un juego disfrutado ("¿Por qué me gustaba Minecraft?" / "¿Recuerdas qué me gustaba de Minecraft?")
    const motiveQueryMatch = raw.match(/(?:recuerdas\s+(?:qu[eé]\s+me\s+gustaba\s+de|por\s+qu[eé]\s+me\s+gustaba)|por\s+qu[eé]\s+me\s+gustaba|qu[eé]\s+(?:es\s+lo\s+que\s+)?me\s+gustaba\s+de)\s+([a-záéíóúñ0-9: \-]+?)\??$/i)
    if (motiveQueryMatch && motiveQueryMatch[1]) {
        const queryGame = motiveQueryMatch[1].trim()
        const cleanQuery = cleanText(queryGame)

        const foundLiked = memory.pastExperiences.likedGames.find(g => cleanText(g.title) === cleanQuery || cleanText(g.title).includes(cleanQuery))

        if (foundLiked) {
            if (foundLiked.motive) {
                return {
                    handled: true,
                    reply: `¡Por supuesto! Recuerdo que me comentaste que te gustaba **${foundLiked.title}** porque ${foundLiked.motive}.`,
                    suggestedReplies: ["Recomiéndame algo parecido", "Buscar alternativas", "Nueva búsqueda"]
                }
            } else {
                return {
                    handled: true,
                    reply: `Recuerdo que mencionaste **${foundLiked.title}** como uno de tus juegos favoritos, aunque no profundizamos en los motivos específicos. ¿Qué fue lo que más disfrutaste de él?`,
                    suggestedReplies: ["La exploración libre", "La historia y trama", "El desafío", "Buscar recomendaciones"]
                }
            }
        } else {
            // El usuario pregunta por un juego que NUNCA mencionó (honestidad, no alucinaciones - Requisito 5)
            return {
                handled: true,
                reply: `No recuerdo que me hayas mencionado **${queryGame}** anteriormente en esta conversación. ¿Qué es lo que disfrutas de ese juego?`,
                suggestedReplies: ["Me gusta su exploración", "Me gusta su historia", "Prefiero buscar recomendaciones"]
            }
        }
    }

    // 2. Consulta sobre juego que despertó interés ("¿Cuál era el juego que me interesó?" / "¿Cuál juego me había llamado la atención?")
    if (/(?:cu[aá]l\s+(?:era|fue)\s+(?:el\s+)?juego\s+que\s+me\s+(?:hab[ií]a\s+)?interes(?:o|aba|ado)|qu[eé]\s+juego\s+me\s+(?:hab[ií]a\s+)?interes(?:o|ado)|cu[aá]l\s+juego\s+me\s+llam[oó]\s+la\s+atenci[oó]n|cu[aá]l\s+me\s+gust[oó]\s+de\s+los\s+que\s+me\s+mostraste)/i.test(clean)) {
        const interested = memory.recommendationFeedback.interestedGames
        if (interested && interested.length > 0) {
            const list = interested.map(item => `**${item.title}**${item.motive ? ` (${item.motive})` : ""}`).join(", ")
            return {
                handled: true,
                reply: `Anteriormente mostraste interés en: ${list}. ¿Te gustaría saber más detalles sobre alguno o prefieres explorar otras opciones?`,
                suggestedReplies: [
                    `Quiero saber más de ${interested[0].title}`,
                    "Buscar alternativas",
                    "Nueva búsqueda"
                ]
            }
        } else {
            return {
                handled: true,
                reply: "Aún no has indicado que te interese ninguna de las recomendaciones mostradas en esta sesión. ¿Hay alguna de las opciones en pantalla que quieras explorar?",
                suggestedReplies: ["Buscar alternativas", "Cambiar preferencias", "Nueva búsqueda"]
            }
        }
    }

    // 3. Consulta sobre juego descartado ("¿Cuál fue el juego que descarté?" / "¿Qué juego había descartado?")
    if (/(?:cu[aá]l\s+(?:era|fue)\s+(?:el\s+)?juego\s+que\s+(?:descart[eé]|rechac[eé]|no\s+me\s+gust[oó])|qu[eé]\s+juego\s+hab[ií]a\s+(?:descartado|rechazado)|cu[aá]l\s+descart[eé])/i.test(clean)) {
        const rejected = memory.recommendationFeedback.rejectedGames
        if (rejected && rejected.length > 0) {
            const list = rejected.map(item => `**${item.title}**${item.motive ? ` (motivo: ${item.motive})` : ""}`).join(", ")
            return {
                handled: true,
                reply: `Habías descartado: ${list}. Estamos teniendo en cuenta esas razones para ofrecerte títulos más acordes a lo que buscas.`,
                suggestedReplies: ["Buscar alternativas", "Recomiéndame según lo hablado", "Nueva búsqueda"]
            }
        } else {
            return {
                handled: true,
                reply: "No has descartado ningún videojuego hasta el momento en esta conversación.",
                suggestedReplies: ["Buscar recomendaciones", "Nueva búsqueda"]
            }
        }
    }

    // 4. Consulta sobre tiempo disponible ("¿Cuánto tiempo te dije que tenía para jugar?" / "No olvides que hoy tengo poco tiempo")
    if (/(?:cu[aá]nto\s+tiempo\s+te\s+dije\s+que\s+ten[ií]a|recuerdas\s+cu[aá]nto\s+tiempo\s+tengo|no\s+olvides\s+que\s+(?:hoy\s+)?tengo\s+poco\s+tiempo)/i.test(clean)) {
        const time = memory.currentNeeds.availableTime
        if (time) {
            let timeLabel = time
            if (time.includes("corta") || time.includes("< 30")) timeLabel = "menos de 30 minutos (sesión corta)"
            else if (time.includes("media") || time.includes("30-60")) timeLabel = "entre 30 y 60 minutos"
            else if (time.includes("larga") || time.includes("> 60")) timeLabel = "más de 60 minutos"

            return {
                handled: true,
                reply: `Lo tengo muy presente: mencionaste que hoy dispones de **${timeLabel}**. Priorizaremos títulos acordes a esa duración.`,
                suggestedReplies: ["Ver recomendaciones", "Cambiar duración", "Nueva búsqueda"]
            }
        } else {
            return {
                handled: true,
                reply: "No me habías indicado cuánto tiempo tienes para jugar hoy. ¿Cuánto tiempo tienes disponible?",
                suggestedReplies: ["Menos de 30 minutos", "Entre 30 y 60 minutos", "Más de una hora"]
            }
        }
    }

    // 5. Consulta sobre gustos habituales ("¿Recuerdas qué suelo jugar?" / "¿Qué me gusta normalmente?")
    if (/(?:qu[eé]\s+(?:es\s+lo\s+que\s+)?suelo\s+jugar|qu[eé]\s+me\s+gusta\s+normalmente|recuerdas\s+qu[eé]\s+me\s+gusta\s+habitualmente|qu[eé]\s+acostumbro\s+a\s+jugar)/i.test(clean)) {
        const habits = []
        if (memory.habitualPreferences.genres.length > 0) habits.push(`géneros como ${memory.habitualPreferences.genres.join(", ")}`)
        if (memory.habitualPreferences.experiences.length > 0) habits.push(`experiencias ${memory.habitualPreferences.experiences.join(", ")}`)
        if (memory.habitualPreferences.pacing) habits.push(`ritmo ${memory.habitualPreferences.pacing}`)

        if (habits.length > 0) {
            const contrast = memory.currentNeeds.emotion.length > 0 ? `, aunque para la sesión de hoy me indicaste que prefieres algo ${memory.currentNeeds.emotion.join(", ")}` : ""
            return {
                handled: true,
                reply: `Recuerdo que habitualmente sueles disfrutar de ${habits.join(" y ")}${contrast}.`,
                suggestedReplies: ["Recomiéndame según lo hablado", "Buscar alternativas", "Nueva búsqueda"]
            }
        } else {
            return {
                handled: true,
                reply: "Hasta el momento no me has comentado qué géneros o experiencias sueles jugar habitualmente. ¿Qué te gusta jugar normalmente?",
                suggestedReplies: ["Juegos de rol y estrategia", "Juegos de acción desafiantes", "Aventuras tranquilas"]
            }
        }
    }

    // 6. Consulta sobre juego favorito no mencionado ("¿Recuerdas si te dije mi juego favorito?")
    if (/(?:recuerdas\s+si\s+te\s+dije\s+mi\s+juego\s+favorito|sabes\s+cu[aá]l\s+es\s+mi\s+juego\s+favorito|te\s+dije\s+mi\s+juego\s+favorito)/i.test(clean)) {
        const liked = memory.pastExperiences.likedGames
        if (liked && liked.length > 0) {
            return {
                handled: true,
                reply: `Mencionaste con especial aprecio a **${liked[0].title}**${liked[0].motive ? ` porque ${liked[0].motive}` : ""}.`,
                suggestedReplies: ["Recomiéndame algo parecido", "Buscar alternativas", "Nueva búsqueda"]
            }
        } else {
            return {
                handled: true,
                reply: "No recuerdo que me hayas mencionado tu juego favorito hasta ahora en esta conversación. ¿Cuál es?",
                suggestedReplies: ["Minecraft", "Hollow Knight", "The Witcher 3: Wild Hunt", "Stardew Valley"]
            }
        }
    }

    // 7. Referencia ambigua: "¿Recuerdas ese juego que mencioné?" cuando se han nombrado varios
    if (/(?:recuerdas\s+ese\s+juego\s+que\s+(?:te\s+)?mencion[eé]|qu[eé]\s+opinas\s+del\s+juego\s+que\s+te\s+dije)/i.test(clean)) {
        const allPast = [...memory.pastExperiences.likedGames, ...memory.pastExperiences.dislikedGames].map(g => g.title)
        const uniqueTitles = [...new Set(allPast)]

        if (uniqueTitles.length >= 2) {
            return {
                handled: true,
                reply: `Mencionaste tanto ${uniqueTitles.join(" como ")}. ¿A cuál de ellos te refieres?`,
                suggestedReplies: uniqueTitles.map(t => `Me refiero a ${t}`)
            }
        } else if (uniqueTitles.length === 1) {
            return {
                handled: true,
                reply: `Recuerdo que mencionaste a **${uniqueTitles[0]}**. ¿Te gustaría buscar algo en esa misma línea?`,
                suggestedReplies: [`Quiero algo parecido a ${uniqueTitles[0]}`, "Buscar alternativas"]
            }
        }
    }

    // 8. Referencia a contexto previo: "Como te dije antes..."
    if (/(?:como\s+te\s+dije\s+antes|recuerda\s+lo\s+que\s+te\s+dije\s+antes|ten\s+en\s+cuenta\s+lo\s+que\s+te\s+dije|recuerda\s+lo\s+anterior)/i.test(clean)) {
        const parts = []
        if (memory.currentNeeds.emotion.length > 0) parts.push(`experiencia ${memory.currentNeeds.emotion.join(", ")}`)
        if (memory.currentNeeds.availableTime) parts.push(`duración ${memory.currentNeeds.availableTime}`)
        if (memory.currentNeeds.gameMode) parts.push(`modo ${memory.currentNeeds.gameMode}`)
        if (memory.currentNeeds.preferredGenres.length > 0) parts.push(`género ${memory.currentNeeds.preferredGenres.join(" / ")}`)

        if (parts.length > 0) {
            return {
                handled: true,
                reply: `¡Por supuesto! Recordamos lo que me indicaste anteriormente: ${parts.join(", ")}. ¿Quieres mantener exactamente este perfil o ajustar algún detalle?`,
                suggestedReplies: ["Recomiéndame según lo hablado", "Cambiar de género", "Nueva búsqueda"]
            }
        }
    }

    return null
}

/**
 * Sincroniza e incorpora en la memoria la información extraída en el turno conversacional activo.
 *
 * @param {Object} params
 * @param {Object} params.memory Memoria conversacional normalizada
 * @param {string} params.userMessage Mensaje del usuario
 * @param {Object} params.analysis Análisis generado por NLP
 * @param {Object} params.criteria Criterios actualizados
 * @param {Object} params.dialogueState Estado de diálogo
 * @returns {Object} Memoria sincronizada y enriquecida
 */
function syncMemoryFromTurn({ memory, userMessage = "", analysis = {}, criteria = {}, dialogueState = {} }) {
    const raw = userMessage || ""
    const clean = cleanText(raw)
    const turn = dialogueState.turnCount || 1

    // 1. Manejar correcciones y eliminaciones explícitas (Requisito 6 y Etapa 7)
    const mod = detectMemoryCorrectionOrDeletion(userMessage, memory)
    if (mod) {
        if (mod.type === "delete_preference") {
            if (mod.field === "genre") {
                memory.currentNeeds.preferredGenres = memory.currentNeeds.preferredGenres.filter(g => g !== mod.value)
                memory.habitualPreferences.genres = memory.habitualPreferences.genres.filter(g => g !== mod.value)
                criteria.preferredGenres = criteria.preferredGenres.filter(g => g !== mod.value)
            } else if (mod.field === "price") {
                memory.currentNeeds.pricePreference = null
                memory.currentNeeds.isPriceStrict = false
                criteria.pricePreference = null
                criteria.isPriceStrict = false
            } else if (mod.field === "difficulty") {
                memory.currentNeeds.desiredDifficulty = null
                memory.currentNeeds.isDifficultyStrict = false
                criteria.desiredDifficulty = null
                criteria.isDifficultyStrict = false
            }
            memory.memoryLog.push({ turn, action: "delete_preference", value: mod.value })
            recordFeedbackEvent(memory, {
                type: FEEDBACK_TYPES.PREFERENCE_CORRECTION,
                feature: mod.field,
                sentiment: FEEDBACK_SENTIMENTS.NEUTRAL,
                reason: `Eliminación de ${mod.value}`,
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn
            })
        } else if (mod.type === "correct_genre") {
            memory.currentNeeds.preferredGenres = [mod.newValue]
            criteria.preferredGenres = [mod.newValue]
            if (mod.oldValue && Array.isArray(memory.habitualPreferences.genres)) {
                memory.habitualPreferences.genres = memory.habitualPreferences.genres.filter(g => g.toLowerCase() !== mod.oldValue.toLowerCase())
            }
            memory.memoryLog.push({ turn, action: "correct_genre", old: mod.oldValue, new: mod.newValue })
            recordFeedbackEvent(memory, {
                type: FEEDBACK_TYPES.PREFERENCE_CORRECTION,
                feature: "genero",
                sentiment: FEEDBACK_SENTIMENTS.NEUTRAL,
                reason: `Cambio de género a ${mod.newValue}`,
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn
            })
        } else if (mod.type === "correct_difficulty") {
            memory.currentNeeds.desiredDifficulty = mod.newValue
            memory.currentNeeds.isDifficultyStrict = mod.isStrict || false
            criteria.desiredDifficulty = mod.newValue
            criteria.isDifficultyStrict = mod.isStrict || false
            memory.memoryLog.push({ turn, action: "correct_difficulty", old: mod.oldValue, new: mod.newValue })
            recordFeedbackEvent(memory, {
                type: FEEDBACK_TYPES.PREFERENCE_CORRECTION,
                feature: "dificultad",
                sentiment: FEEDBACK_SENTIMENTS.NEUTRAL,
                reason: `Ajuste de dificultad a ${mod.newValue}`,
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn
            })
        } else if (mod.type === "change_game_opinion") {
            const title = mod.gameTitle
            memory.recommendationFeedback.rejectedGames = (memory.recommendationFeedback.rejectedGames || []).filter(g => cleanText(g.title) !== cleanText(title))
            memory.pastExperiences.dislikedGames = (memory.pastExperiences.dislikedGames || []).filter(g => cleanText(g.title) !== cleanText(title))
            if (Array.isArray(criteria.dislikedGames)) {
                criteria.dislikedGames = criteria.dislikedGames.filter(g => cleanText(g) !== cleanText(title))
            }
            if (Array.isArray(dialogueState.rejectedGames)) {
                dialogueState.rejectedGames = dialogueState.rejectedGames.filter(g => cleanText(g) !== cleanText(title))
            }
            if (!memory.recommendationFeedback.interestedGames.some(g => cleanText(g.title) === cleanText(title))) {
                memory.recommendationFeedback.interestedGames.push({
                    title,
                    motive: "cambio de opinión",
                    turn
                })
            }
            if (Array.isArray(criteria.likedGames) && !criteria.likedGames.some(g => cleanText(g) === cleanText(title))) {
                criteria.likedGames.push(title)
            }
            memory.memoryLog.push({ turn, action: "change_game_opinion", game: title, state: "interested" })
            recordFeedbackEvent(memory, {
                gameTitle: title,
                type: FEEDBACK_TYPES.GAME_INTEREST,
                sentiment: FEEDBACK_SENTIMENTS.POSITIVE,
                reason: "Cambio de opinión sobre el videojuego",
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn
            })
        } else if (mod.type === "exclude_genre") {
            if (!memory.currentNeeds.dislikedGenres.includes(mod.genre)) {
                memory.currentNeeds.dislikedGenres.push(mod.genre)
            }
            if (Array.isArray(criteria.dislikedGenres) && !criteria.dislikedGenres.includes(mod.genre)) {
                criteria.dislikedGenres.push(mod.genre)
            }
            memory.currentNeeds.preferredGenres = memory.currentNeeds.preferredGenres.filter(g => g !== mod.genre)
            if (Array.isArray(criteria.preferredGenres)) {
                criteria.preferredGenres = criteria.preferredGenres.filter(g => g !== mod.genre)
            }
            memory.memoryLog.push({ turn, action: "exclude_genre", genre: mod.genre })
            recordFeedbackEvent(memory, {
                type: FEEDBACK_TYPES.FEATURE_DISLIKE,
                feature: mod.genre,
                sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
                reason: `Exclusión de la categoría ${mod.genre}`,
                intensity: FEEDBACK_INTENSITIES.STRICT,
                turn
            })
        } else if (mod.type === "correct_mode_temporary") {
            memory.currentNeeds.gameMode = mod.newValue
            criteria.gameMode = mod.newValue
            memory.memoryLog.push({ turn, action: "correct_mode_temporary", mode: mod.newValue })
            recordFeedbackEvent(memory, {
                type: FEEDBACK_TYPES.PREFERENCE_CORRECTION,
                feature: "modalidad",
                sentiment: FEEDBACK_SENTIMENTS.NEUTRAL,
                reason: `Ajuste puntual de modo a ${mod.newValue}`,
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn
            })
        } else if (mod.type === "keep_feature") {
            if (!memory.currentNeeds.dislikedFeatures.includes(mod.featureId)) {
                if (!criteria.likedFeatures.includes(mod.featureId)) criteria.likedFeatures.push(mod.featureId)
            }
            memory.memoryLog.push({ turn, action: "keep_feature", feature: mod.featureId })
        }
    }

    // 2. Manejar preferencias habituales vs necesidades actuales (Requisito 4)
    if (analysis.isHabitualVsCurrent) {
        if (analysis.habitualTaste && analysis.habitualTaste.tag) {
            if (!memory.habitualPreferences.experiences.includes(analysis.habitualTaste.tag)) {
                memory.habitualPreferences.experiences.push(analysis.habitualTaste.tag)
            }
            if (analysis.habitualTaste.tag === "desafiante") {
                memory.habitualPreferences.pacing = "intenso"
            }
        }
        if (analysis.currentNeed && analysis.currentNeed.tag) {
            memory.currentNeeds.emotion = [analysis.currentNeed.tag]
            memory.currentNeeds.desiredPacing = "relajado"
        }
        memory.memoryLog.push({ turn, action: "habitual_vs_current" })
    } else {
        // Detectar si el usuario expresó un gusto habitual puro
        if (analysis.isHabitualPure || /(?:normalmente|habitualmente|suelo|acostumbro|por lo general)/i.test(clean)) {
            if (criteria.preferredGenres && criteria.preferredGenres.length > 0) {
                for (const g of criteria.preferredGenres) {
                    if (!memory.habitualPreferences.genres.includes(g)) memory.habitualPreferences.genres.push(g)
                }
            }
            if (/dificil|desafi|reto/i.test(clean)) {
                if (!memory.habitualPreferences.experiences.includes("desafiante")) memory.habitualPreferences.experiences.push("desafiante")
                memory.habitualPreferences.pacing = "intenso"
            }
            if (/rol|rpg/i.test(clean) && !memory.habitualPreferences.genres.includes("RPG")) {
                memory.habitualPreferences.genres.push("RPG")
            }
            if (/estrateg/i.test(clean) && !memory.habitualPreferences.genres.includes("Estrategia")) {
                memory.habitualPreferences.genres.push("Estrategia")
            }
        } else {
            // Necesidades de la sesión actual
            if (criteria.emotionalContext && criteria.emotionalContext.length > 0) {
                memory.currentNeeds.emotion = [...criteria.emotionalContext]
            }
            if (criteria.desiredPacing) {
                memory.currentNeeds.desiredPacing = criteria.desiredPacing
            }
            if (criteria.availableTime) {
                memory.currentNeeds.availableTime = criteria.availableTime
            }
            if (criteria.gameMode) {
                memory.currentNeeds.gameMode = criteria.gameMode
            }
            if (criteria.preferredGenres && criteria.preferredGenres.length > 0) {
                memory.currentNeeds.preferredGenres = [...criteria.preferredGenres]
            }

            // Sincronizar nuevos atributos de experiencia y preferencias (Etapa 3)
            if (criteria.experiencePreferences) {
                memory.currentNeeds.experiencePreferences = {
                    ...memory.currentNeeds.experiencePreferences,
                    ...criteria.experiencePreferences
                }
            }
            if (criteria.objectiveStylePreference) {
                memory.currentNeeds.objectiveStylePreference = criteria.objectiveStylePreference
            }
            if (criteria.desiredDifficulty) {
                memory.currentNeeds.desiredDifficulty = criteria.desiredDifficulty
            }
            if (criteria.isDifficultyStrict !== undefined) {
                memory.currentNeeds.isDifficultyStrict = criteria.isDifficultyStrict
            }
            if (criteria.pricePreference !== undefined) {
                memory.currentNeeds.pricePreference = criteria.pricePreference
                memory.currentNeeds.isPriceStrict = criteria.isPriceStrict || false
            }
            if (criteria.discoveryPreference) {
                memory.currentNeeds.discoveryPreference = criteria.discoveryPreference
            }
        }
    }

    // Exclusiones actuales
    if (criteria.dislikedGenres && criteria.dislikedGenres.length > 0) {
        memory.currentNeeds.dislikedGenres = [...new Set([...memory.currentNeeds.dislikedGenres, ...criteria.dislikedGenres])]
    }
    if (criteria.dislikedFeatures && criteria.dislikedFeatures.length > 0) {
        memory.currentNeeds.dislikedFeatures = [...new Set([...memory.currentNeeds.dislikedFeatures, ...criteria.dislikedFeatures])]
    }

    // 3. Manejo de videojuegos disfrutados y motivos causales (Requisito 3)
    const gamesToProcessLiked = [...new Set([
        ...(criteria.likedGames || []),
        ...(analysis.newLikedGame ? [analysis.newLikedGame] : [])
    ])]
    for (const gameTitle of gamesToProcessLiked) {
        const motiveData = extractGameMotive(userMessage, gameTitle)

        const existing = memory.pastExperiences.likedGames.find(g => cleanText(g.title) === cleanText(gameTitle))
        if (!existing) {
            memory.pastExperiences.likedGames.push({
                title: gameTitle,
                motive: motiveData.motiveText,
                features: motiveData.matchedFeatures,
                turn
            })
        } else if (motiveData.motiveText && !existing.motive) {
            existing.motive = motiveData.motiveText
            existing.features = [...new Set([...existing.features, ...motiveData.matchedFeatures])]
        }

        for (const f of motiveData.matchedFeatures) {
            if (!criteria.likedFeatures.includes(f)) criteria.likedFeatures.push(f)
        }
    }

    // 4. Manejo de videojuegos rechazados y motivos causales
    const gamesToProcessDisliked = [...new Set([
        ...(criteria.dislikedGames || []),
        ...(analysis.newDislikedGame ? [analysis.newDislikedGame] : [])
    ])]
    for (const gameTitle of gamesToProcessDisliked) {
        const motiveData = extractGameMotive(userMessage, gameTitle)

        const existing = memory.pastExperiences.dislikedGames.find(g => cleanText(g.title) === cleanText(gameTitle))
        if (!existing) {
            memory.pastExperiences.dislikedGames.push({
                title: gameTitle,
                motive: motiveData.motiveText,
                features: motiveData.matchedFeatures,
                turn
            })
        } else if (motiveData.motiveText && !existing.motive) {
            existing.motive = motiveData.motiveText
            existing.features = [...new Set([...existing.features, ...motiveData.matchedFeatures])]
        }
    }

    // 5. Sincronización de retroalimentación sobre recomendaciones (Etapa 5)
    if (Array.isArray(dialogueState.lastRecommendedGames) && dialogueState.lastRecommendedGames.length > 0) {
        memory.recommendationFeedback.lastShownGames = [...dialogueState.lastRecommendedGames]
    }
    if (Array.isArray(dialogueState.shownGameTitles)) {
        memory.recommendationFeedback.shownHistory = [...new Set([...memory.recommendationFeedback.shownHistory, ...dialogueState.shownGameTitles])]
    }
    if (Array.isArray(dialogueState.interestedGames)) {
        for (const title of dialogueState.interestedGames) {
            const motiveObj = (dialogueState.feedbackMotives || []).find(m => m.game === title && m.type === "interest")
            if (!memory.recommendationFeedback.interestedGames.some(i => i.title === title)) {
                memory.recommendationFeedback.interestedGames.push({
                    title,
                    motive: motiveObj?.motiveText || null,
                    turn
                })
            }
            recordFeedbackEvent(memory, {
                gameTitle: title,
                type: FEEDBACK_TYPES.GAME_INTEREST,
                sentiment: FEEDBACK_SENTIMENTS.POSITIVE,
                reason: motiveObj?.motiveText || null,
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn
            })
        }
    }
    if (Array.isArray(dialogueState.rejectedGames)) {
        for (const title of dialogueState.rejectedGames) {
            const motiveObj = (dialogueState.feedbackMotives || []).find(m => m.game === title && m.type === "rejection")
            if (!memory.recommendationFeedback.rejectedGames.some(r => r.title === title)) {
                memory.recommendationFeedback.rejectedGames.push({
                    title,
                    motive: motiveObj?.motiveText || null,
                    isTemporary: motiveObj?.motiveText ? /hoy|esta sesion/i.test(motiveObj.motiveText) : false,
                    turn
                })
            }
            recordFeedbackEvent(memory, {
                gameTitle: title,
                type: FEEDBACK_TYPES.GAME_REJECTION,
                sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
                reason: motiveObj?.motiveText || null,
                intensity: FEEDBACK_INTENSITIES.CLEAR,
                turn
            })
        }
    }

    // Limitar log a 15 entradas para evitar fugas de memoria (Escenario 19)
    if (memory.memoryLog.length > 15) {
        memory.memoryLog = memory.memoryLog.slice(-15)
    }

    return memory
}

/**
 * Construye los criterios activos para el recomendador aplicando la cascada de prioridades determinista (Requisito 8):
 * 1. Corrección explícita más reciente.
 * 2. Restricciones explícitas actuales (exclusiones de género y características evitadas).
 * 3. Necesidades actuales de la sesión (emoción de hoy, tiempo disponible, modo).
 * 4. Preferencias habituales (géneros habituales si no hay conflicto actual).
 * 5. Preferencias inferidas.
 *
 * @param {Object} memory Memoria conversacional
 * @param {Object} baseCriteria Criterios base existentes
 * @returns {Object} Criterios activos listos para recommendationEngine
 */
function buildActiveCriteria(memory, baseCriteria = {}) {
    const active = {
        preferredGenres: [...(baseCriteria.preferredGenres || [])],
        dislikedGenres: [...(baseCriteria.dislikedGenres || [])],
        emotionalContext: [...(baseCriteria.emotionalContext || [])],
        availableTime: baseCriteria.availableTime || null,
        gameMode: baseCriteria.gameMode || null,
        desiredPacing: baseCriteria.desiredPacing || null,
        similarTo: [...(baseCriteria.similarTo || [])],
        likedGames: [...(baseCriteria.likedGames || [])],
        dislikedGames: [...(baseCriteria.dislikedGames || [])],
        unverifiedGames: [...(baseCriteria.unverifiedGames || [])],
        likedFeatures: [...(baseCriteria.likedFeatures || [])],
        dislikedFeatures: [...(baseCriteria.dislikedFeatures || [])],
        discoveryPreference: memory.currentNeeds?.discoveryPreference || baseCriteria.discoveryPreference || null,
        habitualTastes: [...(baseCriteria.habitualTastes || [])],
        // --- ETAPA 3: Atributos de experiencia y filtros ampliados ---
        experiencePreferences: {
            exploration: baseCriteria.experiencePreferences?.exploration || null,
            narrative: baseCriteria.experiencePreferences?.narrative || null,
            creativity: baseCriteria.experiencePreferences?.creativity || null,
            strategy: baseCriteria.experiencePreferences?.strategy || null,
            combat: baseCriteria.experiencePreferences?.combat || null,
            freedom: baseCriteria.experiencePreferences?.freedom || null,
            complexity: baseCriteria.experiencePreferences?.complexity || null
        },
        objectiveStylePreference: baseCriteria.objectiveStylePreference || null,
        desiredDifficulty: baseCriteria.desiredDifficulty || null,
        isDifficultyStrict: baseCriteria.isDifficultyStrict || false,
        pricePreference: baseCriteria.pricePreference || null,
        isPriceStrict: baseCriteria.isPriceStrict || false
    }

    if (!memory) return active

    // Sincronizar atributos de Etapa 3 desde la memoria activa
    if (memory.currentNeeds.experiencePreferences) {
        active.experiencePreferences = {
            ...active.experiencePreferences,
            ...memory.currentNeeds.experiencePreferences
        }
    }
    if (memory.currentNeeds.objectiveStylePreference) {
        active.objectiveStylePreference = memory.currentNeeds.objectiveStylePreference
    }
    if (memory.currentNeeds.desiredDifficulty) {
        active.desiredDifficulty = memory.currentNeeds.desiredDifficulty
    }
    if (memory.currentNeeds.isDifficultyStrict !== undefined) {
        active.isDifficultyStrict = memory.currentNeeds.isDifficultyStrict
    }
    if (memory.currentNeeds.pricePreference !== undefined) {
        active.pricePreference = memory.currentNeeds.pricePreference
        active.isPriceStrict = memory.currentNeeds.isPriceStrict || false
    }

    // 1. Prioridad: Exclusiones actuales
    if (memory.currentNeeds.dislikedGenres && memory.currentNeeds.dislikedGenres.length > 0) {
        active.dislikedGenres = [...new Set([...active.dislikedGenres, ...memory.currentNeeds.dislikedGenres])]
        // Eliminar de preferidos si está excluido
        active.preferredGenres = active.preferredGenres.filter(g => !active.dislikedGenres.includes(g))
    }
    if (memory.currentNeeds.dislikedFeatures && memory.currentNeeds.dislikedFeatures.length > 0) {
        active.dislikedFeatures = [...new Set([...active.dislikedFeatures, ...memory.currentNeeds.dislikedFeatures])]
        active.likedFeatures = active.likedFeatures.filter(f => !active.dislikedFeatures.includes(f))
    }

    // 2. Prioridad: Necesidades actuales de la sesión
    if (memory.currentNeeds.availableTime !== undefined && memory.currentNeeds.availableTime !== null) {
        active.availableTime = memory.currentNeeds.availableTime
    }
    if (memory.currentNeeds.gameMode !== undefined && memory.currentNeeds.gameMode !== null) {
        active.gameMode = memory.currentNeeds.gameMode
    }
    if (Array.isArray(memory.currentNeeds.emotion) && memory.currentNeeds.emotion.length > 0) {
        active.emotionalContext = [...memory.currentNeeds.emotion]
    }
    if (memory.currentNeeds.desiredPacing) {
        active.desiredPacing = memory.currentNeeds.desiredPacing
    } else if (active.emotionalContext.includes("relajante")) {
        active.desiredPacing = "relajado"
    } else if (active.emotionalContext.includes("desafiante")) {
        active.desiredPacing = "intenso"
    }

    if (memory.currentNeeds.preferredGenres && memory.currentNeeds.preferredGenres.length > 0) {
        active.preferredGenres = [...memory.currentNeeds.preferredGenres]
    } else if (memory.habitualPreferences.genres && memory.habitualPreferences.genres.length > 0 && active.preferredGenres.length === 0) {
        // 3. Prioridad: Gustos habituales si no se especificaron géneros actuales
        active.preferredGenres = [...memory.habitualPreferences.genres]
    }

    if (memory.habitualPreferences.experiences.length > 0) {
        active.habitualTastes = [...memory.habitualPreferences.experiences]
    }

    return active
}

/**
 * Aplica una actualización estructurada de preferencias desde el perfil temporal del jugador (Etapa 5).
 * Valida el cambio, resuelve contradicciones y sincroniza tanto la memoria como los criterios activos.
 *
 * @param {Object} params
 * @param {Object} params.memory Memoria conversacional de la sesión
 * @param {Object} params.criteria Criterios acumulados activos
 * @param {Object} params.dialogueState Estado actual del diálogo
 * @param {Object} params.updateAction Acción estructurada { type, field, value, operation }
 * @returns {Object} { memory, criteria, dialogueState }
 */
function applyProfileUpdate({ memory, criteria = {}, dialogueState = {}, updateAction = {} }) {
    const mem = initConversationMemory(memory, criteria, dialogueState)
    const turn = dialogueState.turnCount || 1
    const { type, field, value, operation = "replace" } = updateAction

    switch (type) {
        case "change_genre":
            if (value) {
                if (operation === "add") {
                    if (!mem.currentNeeds.preferredGenres.includes(value)) {
                        mem.currentNeeds.preferredGenres.push(value)
                    }
                    if (Array.isArray(criteria.preferredGenres) && !criteria.preferredGenres.includes(value)) {
                        criteria.preferredGenres.push(value)
                    }
                } else {
                    // Sustitución directa
                    mem.currentNeeds.preferredGenres = [value]
                    if (Array.isArray(criteria.preferredGenres)) {
                        criteria.preferredGenres = [value]
                    }
                }
                // Resolución de contradicciones: retirar de exclusiones si existía
                mem.currentNeeds.dislikedGenres = mem.currentNeeds.dislikedGenres.filter((g) => g.toLowerCase() !== value.toLowerCase())
                mem.habitualPreferences.dislikedGenres = mem.habitualPreferences.dislikedGenres.filter((g) => g.toLowerCase() !== value.toLowerCase())
                if (Array.isArray(criteria.dislikedGenres)) {
                    criteria.dislikedGenres = criteria.dislikedGenres.filter((g) => g.toLowerCase() !== value.toLowerCase())
                }
            }
            break

        case "delete_genre":
            if (value) {
                mem.currentNeeds.preferredGenres = mem.currentNeeds.preferredGenres.filter((g) => g.toLowerCase() !== value.toLowerCase())
                mem.habitualPreferences.genres = mem.habitualPreferences.genres.filter((g) => g.toLowerCase() !== value.toLowerCase())
                if (Array.isArray(criteria.preferredGenres)) {
                    criteria.preferredGenres = criteria.preferredGenres.filter((g) => g.toLowerCase() !== value.toLowerCase())
                }
            }
            break

        case "change_time":
            mem.currentNeeds.availableTime = value || null
            if (criteria) criteria.availableTime = value || null
            break

        case "change_mode":
            mem.currentNeeds.gameMode = value || null
            if (criteria) criteria.gameMode = value || null
            break

        case "change_difficulty":
            mem.currentNeeds.desiredDifficulty = value || null
            if (criteria) criteria.desiredDifficulty = value || null
            break

        case "change_discovery":
            mem.currentNeeds.discoveryPreference = value || null
            if (criteria) criteria.discoveryPreference = value || null
            break

        case "add_exclusion":
            if (value) {
                if (!mem.currentNeeds.dislikedGenres.includes(value)) {
                    mem.currentNeeds.dislikedGenres.push(value)
                }
                if (Array.isArray(criteria.dislikedGenres) && !criteria.dislikedGenres.includes(value)) {
                    criteria.dislikedGenres.push(value)
                }
                // Resolución de contradicciones: retirar de géneros preferidos si existía
                mem.currentNeeds.preferredGenres = mem.currentNeeds.preferredGenres.filter((g) => g.toLowerCase() !== value.toLowerCase())
                mem.habitualPreferences.genres = mem.habitualPreferences.genres.filter((g) => g.toLowerCase() !== value.toLowerCase())
                if (Array.isArray(criteria.preferredGenres)) {
                    criteria.preferredGenres = criteria.preferredGenres.filter((g) => g.toLowerCase() !== value.toLowerCase())
                }
            }
            break

        case "remove_exclusion":
            if (value) {
                mem.currentNeeds.dislikedGenres = mem.currentNeeds.dislikedGenres.filter((g) => g.toLowerCase() !== value.toLowerCase())
                mem.habitualPreferences.dislikedGenres = mem.habitualPreferences.dislikedGenres.filter((g) => g.toLowerCase() !== value.toLowerCase())
                if (Array.isArray(criteria.dislikedGenres)) {
                    criteria.dislikedGenres = criteria.dislikedGenres.filter((g) => g.toLowerCase() !== value.toLowerCase())
                }
            }
            break

        case "remove_feature":
            if (value) {
                mem.habitualPreferences.features = mem.habitualPreferences.features.filter((f) => f !== value)
                if (Array.isArray(criteria.likedFeatures)) {
                    criteria.likedFeatures = criteria.likedFeatures.filter((f) => f !== value)
                }
            }
            break

        case "remove_disliked_feature":
            if (value) {
                mem.currentNeeds.dislikedFeatures = mem.currentNeeds.dislikedFeatures.filter((f) => f !== value)
                mem.habitualPreferences.dislikedFeatures = mem.habitualPreferences.dislikedFeatures.filter((f) => f !== value)
            }
            break

        case "change_experience_attr":
            if (field && mem.currentNeeds.experiencePreferences) {
                mem.currentNeeds.experiencePreferences[field] = value || null
            }
            break

        default:
            break
    }

    // Registrar en el log de auditoría interna de la memoria
    mem.memoryLog.push({
        turn,
        action: "profile_update",
        updateType: type,
        value,
        timestamp: new Date().toISOString()
    })

    // Reconstruir los criterios activos sincronizados determinísticamente
    const activeCriteria = buildActiveCriteria(mem, criteria)

    return {
        memory: mem,
        criteria: activeCriteria,
        dialogueState: {
            ...dialogueState,
            conversationMemory: mem
        }
    }
}

module.exports = {
    createInitialMemory,
    initConversationMemory,
    extractGameMotive,
    detectMemoryCorrectionOrDeletion,
    handleMemoryQuery,
    syncMemoryFromTurn,
    buildActiveCriteria,
    applyProfileUpdate
}
