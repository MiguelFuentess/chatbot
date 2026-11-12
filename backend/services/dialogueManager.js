/**
 * Servicio de Gestión de Diálogo Adaptativo y Progresivo
 * Administra el flujo de conversación, la identificación de criterios faltantes,
 * y la transición hacia la recomendación personalizada.
 */

const { parseUserMessage } = require("./nlpService")
const { evaluateRecommendations } = require("./recommendationEngine")
const { explainBatchDiversity } = require("./diversityService")
const { generateExplanation } = require("./explanationService")
const {
    composeTurnReply,
    composeRecommendationIntro,
    composeClarificationReply,
    createAcknowledgment,
    GAME_FOLLOWUP_PROMPTS,
    getGenericGameFollowup,
    getDislikedGameFollowup,
    DISCOVERY_PROMPT
} = require("./responseComposer")
const {
    selectNextQuestion,
    initQuestionTracker,
    markQuestionStatus,
    isQuestionResolved,
    FEATURE_FOLLOWUP_CONFIG
} = require("./questionSelector")
const {
    handlePostRecommendationTurn,
    resolveGameReference,
    getGameDetails,
    detectComparisonIntent
} = require("./feedbackManager")
const {
    createInitialMemory,
    initConversationMemory,
    handleMemoryQuery,
    syncMemoryFromTurn,
    buildActiveCriteria,
    detectMemoryCorrectionOrDeletion
} = require("./conversationMemoryService")

const QUESTIONS_CONFIG = {
    experience: {
        id: "experience",
        question: "Para empezar, ¿qué tipo de experiencia te gustaría tener hoy?",
        options: [
            "Quiero relajarme",
            "Busco algo emocionante",
            "Quiero un desafío",
            "Me gustaría explorar una buena historia",
            "Quiero construir o crear algo",
            "No estoy seguro, sorpréndeme"
        ]
    },
    time: {
        id: "time",
        question: "¿Cuánto tiempo tienes disponible para jugar?",
        options: [
            "Menos de 30 minutos",
            "Entre 30 y 60 minutos",
            "Más de una hora",
            "No tengo límite de tiempo"
        ]
    },
    mode: {
        id: "mode",
        question: "¿Cómo prefieres jugar?",
        options: [
            "Prefiero jugar solo",
            "Quiero jugar con amigos",
            "Me da igual"
        ]
    },
    genres: {
        id: "genres",
        question: "¿Hay algún género que te guste especialmente o alguno que prefieras evitar?",
        options: [
            "Aventura",
            "RPG",
            "Acción",
            "Estrategia",
            "Simulación",
            "Roguelike",
            "No tengo preferencias"
        ]
    }
}

/**
 * Wrapper de compatibilidad para la síntesis e introducción de recomendaciones (Etapa 3).
 */
function createRecommendationIntro(criteria = {}, dialogueState = {}, analysis = {}, gameRejectedTitle = null) {
    return composeRecommendationIntro(criteria, dialogueState, analysis, gameRejectedTitle)
}

/**
 * Evalúa si el asistente dispone de suficiente información y si resulta útil continuar preguntando
 * antes de generar recomendaciones, de acuerdo con las políticas de la Etapa 1.
 *
 * Responsabilidad:
 * - Qué información conoce el asistente (knownDimensions).
 * - Qué dimensiones continúan sin resolverse (unresolvedDimensions).
 * - Si las preferencias disponibles son suficientemente claras.
 * - Si una pregunta adicional podría mejorar la recomendación (canAskMore, unaskedDimensions).
 * - Si el usuario solicitó explícitamente recibir recomendaciones (explicitRequest).
 * - Si el sistema debe continuar conversando o recomendar (readyToRecommend, reason).
 *
 * @param {Object} params
 * @param {Object} params.criteria Criterios acumulados del usuario
 * @param {Object} params.dialogueState Estado conversacional actual
 * @param {Object} params.analysis Análisis NLP del mensaje actual
 * @returns {Object} Diagnóstico de suficiencia y decisión explicable
 */
function evaluateRecommendationReadiness({ criteria = {}, dialogueState = {}, analysis = {} }) {
    const knownDimensions = []
    const unresolvedDimensions = []

    // 1. Experiencia deseada o contexto emocional expresado voluntariamente
    const hasEmotion = Array.isArray(criteria.emotionalContext) && criteria.emotionalContext.length > 0
    const hasPacing = criteria.desiredPacing != null
    const isSurprise = !!dialogueState.isSurpriseMe
    const hasGameExperience = criteria.discoveryPreference != null && (criteria.likedGames?.length > 0 || criteria.similarTo?.length > 0)

    const hasExperience = hasEmotion || hasPacing || isSurprise || hasGameExperience
    if (hasExperience) {
        knownDimensions.push({
            id: "experience",
            name: "Experiencia o emoción",
            value: hasEmotion
                ? criteria.emotionalContext
                : isSurprise
                ? "sorpréndeme"
                : hasGameExperience
                ? `similar a ${criteria.likedGames?.[0] || criteria.similarTo?.[0]}`
                : criteria.desiredPacing,
            type: isSurprise ? "indifference" : "preference"
        })
    } else {
        unresolvedDimensions.push("experience")
    }

    // 2. Tiempo disponible
    const hasTimeValue = criteria.availableTime != null
    const isTimeIndiff = !!dialogueState.timeIndifferent
    const hasTime = hasTimeValue || isTimeIndiff
    if (hasTime) {
        knownDimensions.push({
            id: "time",
            name: "Tiempo disponible",
            value: hasTimeValue ? criteria.availableTime : "indiferente",
            type: isTimeIndiff ? "indifference" : "preference"
        })
    } else {
        unresolvedDimensions.push("time")
    }

    // 3. Modalidad de juego
    const hasModeValue = criteria.gameMode != null
    const isModeIndiff = !!dialogueState.modeIndifferent
    const hasMode = hasModeValue || isModeIndiff
    if (hasMode) {
        knownDimensions.push({
            id: "mode",
            name: "Modalidad de juego",
            value: hasModeValue ? criteria.gameMode : "indiferente",
            type: isModeIndiff ? "indifference" : "preference"
        })
    } else {
        unresolvedDimensions.push("mode")
    }

    // 4. Géneros preferidos o rechazados
    const hasPreferredGenres = Array.isArray(criteria.preferredGenres) && criteria.preferredGenres.length > 0
    const hasDislikedGenres = Array.isArray(criteria.dislikedGenres) && criteria.dislikedGenres.length > 0
    const isGenreIndiff = !!dialogueState.genreIndifferent
    const hasGenre = hasPreferredGenres || hasDislikedGenres || isGenreIndiff
    if (hasGenre) {
        knownDimensions.push({
            id: "genres",
            name: "Géneros o exclusiones",
            value: {
                preferred: criteria.preferredGenres || [],
                disliked: criteria.dislikedGenres || [],
                indifferent: isGenreIndiff
            },
            type: isGenreIndiff ? "indifference" : "preference"
        })
    } else {
        unresolvedDimensions.push("genres")
    }

    // 5. Videojuegos disfrutados o rechazados y características (Etapa 2)
    if (Array.isArray(criteria.likedGames) && criteria.likedGames.length > 0) {
        knownDimensions.push({
            id: "likedGames",
            name: "Juegos disfrutados",
            value: criteria.likedGames,
            type: "preference"
        })
    }
    if (Array.isArray(criteria.dislikedGames) && criteria.dislikedGames.length > 0) {
        knownDimensions.push({
            id: "dislikedGames",
            name: "Juegos rechazados",
            value: criteria.dislikedGames,
            type: "preference"
        })
    }
    if (Array.isArray(criteria.likedFeatures) && criteria.likedFeatures.length > 0) {
        knownDimensions.push({
            id: "likedFeatures",
            name: "Características disfrutadas",
            value: criteria.likedFeatures,
            type: "preference"
        })
    }
    if (Array.isArray(criteria.dislikedFeatures) && criteria.dislikedFeatures.length > 0) {
        knownDimensions.push({
            id: "dislikedFeatures",
            name: "Características evitadas",
            value: criteria.dislikedFeatures,
            type: "preference"
        })
    }
    if (criteria.discoveryPreference != null) {
        knownDimensions.push({
            id: "discoveryPreference",
            name: "Preferencia de descubrimiento",
            value: criteria.discoveryPreference,
            type: criteria.discoveryPreference === "indistinto" ? "indifference" : "preference"
        })
    }

    // 6. Atributos de experiencia y preferencias específicas (Etapa 3)
    const activeExp = Object.entries(criteria.experiencePreferences || {}).filter(([_, v]) => v != null)
    if (activeExp.length > 0) {
        knownDimensions.push({
            id: "experiencePreferences",
            name: "Atributos de experiencia",
            value: activeExp.map(([k, v]) => `${k}: ${v}`).join(", "),
            type: "preference"
        })
    }
    if (criteria.objectiveStylePreference) {
        knownDimensions.push({
            id: "objectiveStyle",
            name: "Estilo de objetivos",
            value: criteria.objectiveStylePreference,
            type: "preference"
        })
    }
    if (criteria.desiredDifficulty) {
        knownDimensions.push({
            id: "difficulty",
            name: "Dificultad deseada",
            value: criteria.desiredDifficulty,
            type: "preference"
        })
    }
    if (criteria.pricePreference) {
        knownDimensions.push({
            id: "price",
            name: "Condición de precio",
            value: criteria.pricePreference,
            type: "preference"
        })
    }

    // Dimensiones pendientes que aún no se han formulado
    const questionsAsked = Array.isArray(dialogueState.questionsAsked) ? dialogueState.questionsAsked : []
    const unaskedDimensions = unresolvedDimensions.filter((dim) => !questionsAsked.includes(dim))
    const canAskMore = unaskedDimensions.length > 0

    // Solicitud explícita de recomendaciones (Regla D)
    const explicitRequest = !!analysis.wantsRecommendationsNow

    // Interacciones post-recomendación (Regla F)
    const isPostRecommendation =
        dialogueState.stage === "recommended" &&
        (analysis.genreModified ||
            analysis.isTimeModified ||
            analysis.isModeModified ||
            analysis.isEmotionModified ||
            analysis.wantsRecommendationsNow ||
            analysis.wantsAlternatives ||
            !!analysis.rejectedGame)

    const isAlternativesOrRejection = !!analysis.wantsAlternatives || !!analysis.rejectedGame

    // Decisión de recomendación explicable
    let readyToRecommend = false
    let reason = ""

    if (isAlternativesOrRejection) {
        readyToRecommend = true
        reason = analysis.wantsAlternatives
            ? "El usuario solicitó alternativas diferentes; se recalculan recomendaciones excluyendo títulos previos."
            : "El usuario descartó una recomendación previa; se recalculan opciones respetando el descarte."
    } else if (isPostRecommendation) {
        readyToRecommend = true
        reason = "El usuario ajustó sus preferencias tras la recomendación inicial; se actualiza el lote de juegos."
    } else if (explicitRequest) {
        readyToRecommend = true
        reason = knownDimensions.length > 0
            ? `El usuario solicitó recomendaciones explícitamente; se procede con las preferencias conocidas (${knownDimensions.map((d) => d.name).join(", ")}).`
            : "El usuario solicitó recomendaciones explícitamente sin criterios previos; se ofrecen títulos variados y destacados del catálogo general."
    } else if (unresolvedDimensions.length === 0) {
        readyToRecommend = true
        reason = "Información completa: se resolvieron las 4 dimensiones evaluadas (experiencia, tiempo, modalidad y género)."
    } else if (!canAskMore) {
        readyToRecommend = true
        reason = `No quedan preguntas relevantes sin formular para las dimensiones faltantes (${unresolvedDimensions.join(", ")}). Se recomienda con las ${knownDimensions.length} dimensiones conocidas para evitar redundancia o fatiga.`
    } else {
        readyToRecommend = false
        const nextTarget = unaskedDimensions[0]
        reason = `Información insuficiente: existen ${unresolvedDimensions.length} dimensión(es) sin resolver (${unresolvedDimensions.join(", ")}). Formular una pregunta sobre '${nextTarget}' mejorará sustancialmente la recomendación.`
    }

    const coreDimensionsCount = [hasExperience, hasTime, hasMode, hasGenre].filter(Boolean).length

    return {
        readyToRecommend,
        reason,
        knownDimensions,
        unresolvedDimensions,
        unaskedDimensions,
        dimensionsCount: coreDimensionsCount,
        coreDimensionsCount,
        knownDimensionsCount: knownDimensions.length,
        hasExperience,
        hasTime,
        hasMode,
        hasGenre,
        explicitRequest,
        canAskMore
    }
}

/**
 * Procesa un turno conversacional adaptativo.
 *
 * @param {Object} params
 * @param {string} params.userMessage Mensaje del usuario
 * @param {Object} params.accumulatedCriteria Criterios previos acumulados
 * @param {Object} params.dialogueState Estado conversacional previo
 * @returns {Promise<Object>} Respuesta, criterios actualizados, nuevo estado y recomendaciones si aplica
 */
async function processDialogueTurn({ userMessage = "", accumulatedCriteria = {}, dialogueState = {} }) {
    const safeDialogueState = dialogueState || {}
    const safeCriteria = accumulatedCriteria || {}

    // 1. Clonar estado y criterios con salvaguardas
    const state = {
        stage: safeDialogueState.stage || "initial",
        questionsAsked: Array.isArray(safeDialogueState.questionsAsked) ? [...safeDialogueState.questionsAsked] : [],
        turnCount: (safeDialogueState.turnCount || 0) + 1,
        modeIndifferent: !!safeDialogueState.modeIndifferent,
        genreIndifferent: !!safeDialogueState.genreIndifferent,
        timeIndifferent: !!safeDialogueState.timeIndifferent,
        isSurpriseMe: !!safeDialogueState.isSurpriseMe,
        discoveryAsked: !!safeDialogueState.discoveryAsked,
        pastGamesSkipped: !!safeDialogueState.pastGamesSkipped,
        followupGameTarget: safeDialogueState.followupGameTarget || null,
        followupDislikedTarget: safeDialogueState.followupDislikedTarget || null,
        shownGameTitles: Array.isArray(safeDialogueState.shownGameTitles) ? [...safeDialogueState.shownGameTitles] : [],
        lastRecommendedGames: Array.isArray(safeDialogueState.lastRecommendedGames) ? [...safeDialogueState.lastRecommendedGames] : [],
        currentReferencedGame: safeDialogueState.currentReferencedGame || null,
        interestedGames: Array.isArray(safeDialogueState.interestedGames) ? [...safeDialogueState.interestedGames] : [],
        rejectedGames: Array.isArray(safeDialogueState.rejectedGames) ? [...safeDialogueState.rejectedGames] : [],
        feedbackMotives: Array.isArray(safeDialogueState.feedbackMotives) ? [...safeDialogueState.feedbackMotives] : [],
        clarifiedStages: Array.isArray(safeDialogueState.clarifiedStages) ? [...safeDialogueState.clarifiedStages] : [],
        recentOpeners: Array.isArray(safeDialogueState.recentOpeners) ? [...safeDialogueState.recentOpeners] : [],
        lastComparedGames: Array.isArray(safeDialogueState.lastComparedGames) ? [...safeDialogueState.lastComparedGames] : [],
        pendingComparisonGame: safeDialogueState.pendingComparisonGame || null,
        pendingRejectionGame: safeDialogueState.pendingRejectionGame || null,
        questionTracker: safeDialogueState.questionTracker ? JSON.parse(JSON.stringify(safeDialogueState.questionTracker)) : {}
    }
    initQuestionTracker(state)

    // 1b. Inicializar y normalizar memoria conversacional estructurada (Etapa 6)
    const conversationMemory = initConversationMemory(
        safeDialogueState.conversationMemory,
        safeCriteria,
        safeDialogueState
    )
    state.conversationMemory = conversationMemory

    // 2. Procesar el texto mediante el servicio NLP
    const analysis = parseUserMessage(userMessage, safeCriteria, state)
    const criteria = analysis.criteria

    if (analysis.isSurpriseMe) state.isSurpriseMe = true
    if (analysis.isModeIndifferent) state.modeIndifferent = true
    if (analysis.isGenreIndifferent) state.genreIndifferent = true
    if (analysis.isTimeIndifferent) state.timeIndifferent = true

    // Manejo de rechazo de videojuego específico
    let gameRejectedTitle = null
    if (analysis.rejectedGame) {
        if (analysis.rejectedGame === "CURRENT_TOP_GAME") {
            gameRejectedTitle = state.shownGameTitles[state.shownGameTitles.length - 1] || "la opción anterior"
        } else {
            gameRejectedTitle = analysis.rejectedGame
        }
        if (!state.rejectedGames.includes(gameRejectedTitle)) {
            state.rejectedGames.push(gameRejectedTitle)
        }
        if (!state.shownGameTitles.includes(gameRejectedTitle)) {
            state.shownGameTitles.push(gameRejectedTitle)
        }
    }

    // 3. Caso especial: Reinicio explícito de conversación
    const isResetIntent = /^(reiniciar|nueva b[uú]squeda|empezar de nuevo|reset|comenzar de nuevo)$/i.test(userMessage.trim())
    if (isResetIntent) {
        return {
            reply: "¡Hola! Bienvenido. Soy tu asistente de videojuegos. Estoy aquí para ayudarte a encontrar un juego que se adapte a lo que buscas hoy.\n\nPara empezar, ¿qué tipo de experiencia te gustaría tener?",
            updatedCriteria: {
                preferredGenres: [],
                dislikedGenres: [],
                emotionalContext: [],
                availableTime: null,
                gameMode: null,
                desiredPacing: null,
                similarTo: [],
                likedGames: [],
                dislikedGames: [],
                unverifiedGames: [],
                likedFeatures: [],
                dislikedFeatures: [],
                discoveryPreference: null,
                habitualTastes: [],
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
                isPriceStrict: false
            },
            dialogueState: {
                stage: "experience",
                questionsAsked: ["experience"],
                turnCount: 1,
                modeIndifferent: false,
                genreIndifferent: false,
                timeIndifferent: false,
                isSurpriseMe: false,
                discoveryAsked: false,
                pastGamesSkipped: false,
                followupGameTarget: null,
                followupDislikedTarget: null,
                shownGameTitles: [],
                lastRecommendedGames: [],
                currentReferencedGame: null,
                interestedGames: [],
                rejectedGames: [],
                feedbackMotives: [],
                clarifiedStages: [],
                recentOpeners: [],
                questionTracker: initQuestionTracker({}),
                conversationMemory: createInitialMemory()
            },
            conversationMemory: createInitialMemory(),
            recommendations: [],
            suggestedReplies: QUESTIONS_CONFIG.experience.options
        }
    }

    // 4. Caso especial: Saludo puro inicial sin criterios
    if (analysis.intent === "greeting" && state.turnCount === 1) {
        return {
            reply: "¡Hola! Bienvenido. Soy tu asistente de videojuegos. Estoy aquí para ayudarte a encontrar un juego que se adapte a lo que buscas hoy.\n\nPara empezar, ¿qué tipo de experiencia te gustaría tener?",
            updatedCriteria: criteria,
            dialogueState: {
                ...state,
                stage: "experience",
                questionsAsked: ["experience"],
                conversationMemory
            },
            conversationMemory,
            recommendations: [],
            suggestedReplies: QUESTIONS_CONFIG.experience.options
        }
    }

    // 4a. Consultas directas a la memoria conversacional (Etapa 6 - Requisito 5)
    const memoryQueryResult = handleMemoryQuery({
        memory: conversationMemory,
        userMessage,
        dialogueState: state
    })
    if (memoryQueryResult && memoryQueryResult.handled) {
        state.conversationMemory = conversationMemory
        return {
            reply: memoryQueryResult.reply,
            updatedCriteria: criteria,
            dialogueState: {
                ...state,
                conversationMemory
            },
            conversationMemory,
            recommendations: [],
            suggestedReplies: memoryQueryResult.suggestedReplies || [
                "Recomiéndame según lo hablado",
                "Buscar alternativas",
                "Nueva búsqueda"
            ]
        }
    }

    // 4b. Eliminaciones o modificaciones explícitas de preferencias ("Olvida que...", etc. - Requisito 6)
    const memMod = detectMemoryCorrectionOrDeletion(userMessage, conversationMemory)
    if (memMod) {
        if (memMod.type === "delete_preference") {
            syncMemoryFromTurn({ memory: conversationMemory, userMessage, analysis, criteria, dialogueState: state })
            const activeCriteria = buildActiveCriteria(conversationMemory, criteria)
            Object.assign(criteria, activeCriteria)
            state.conversationMemory = conversationMemory

            if (memMod.field === "difficulty") {
                return {
                    reply: "De acuerdo, he eliminado la restricción de dificultad. Ahora consideraremos títulos con cualquier nivel de desafío sin exigencia estricta. ¿Te gustaría ver nuevas recomendaciones?",
                    updatedCriteria: criteria,
                    dialogueState: {
                        ...state,
                        conversationMemory
                    },
                    conversationMemory,
                    recommendations: [],
                    suggestedReplies: ["Recomiéndame según lo hablado", "Buscar alternativas", "Nueva búsqueda"]
                }
            }

            return {
                reply: `De acuerdo, he eliminado "${memMod.value}" de tus preferencias para esta búsqueda. ¿Qué otro género o estilo te gustaría explorar?`,
                updatedCriteria: criteria,
                dialogueState: {
                    ...state,
                    stage: "genres",
                    conversationMemory
                },
                conversationMemory,
                recommendations: [],
                suggestedReplies: QUESTIONS_CONFIG.genres.options
            }
        } else if (memMod.type === "correct_mode_temporary") {
            syncMemoryFromTurn({ memory: conversationMemory, userMessage, analysis, criteria, dialogueState: state })
            const activeCriteria = buildActiveCriteria(conversationMemory, criteria)
            Object.assign(criteria, activeCriteria)
            state.conversationMemory = conversationMemory

            return {
                reply: "Entendido, para la sesión de hoy nos enfocaremos en jugar en solitario (modo individual), conservando tus preferencias anteriores. ¿Deseas que busquemos recomendaciones ahora o hay algún género específico que prefieras?",
                updatedCriteria: criteria,
                dialogueState: {
                    ...state,
                    conversationMemory
                },
                conversationMemory,
                recommendations: [],
                suggestedReplies: ["Recomiéndame ya", ...QUESTIONS_CONFIG.genres.options.slice(0, 4)]
            }
        } else if (memMod.type === "change_game_opinion") {
            syncMemoryFromTurn({ memory: conversationMemory, userMessage, analysis, criteria, dialogueState: state })
            const activeCriteria = buildActiveCriteria(conversationMemory, criteria)
            Object.assign(criteria, activeCriteria)
            state.conversationMemory = conversationMemory

            return {
                reply: `¡Excelente! He actualizado tu perfil para darle una oportunidad a **${memMod.gameTitle}**, retirándolo de tus descartes y sumándolo a tus títulos de interés. ¿Te gustaría saber más sobre él o buscar recomendaciones similares?`,
                updatedCriteria: criteria,
                dialogueState: {
                    ...state,
                    conversationMemory
                },
                conversationMemory,
                recommendations: [],
                suggestedReplies: [`Saber más sobre ${memMod.gameTitle}`, `Juegos parecidos a ${memMod.gameTitle}`, "Ver recomendaciones"]
            }
        } else if (memMod.type === "correct_difficulty") {
            syncMemoryFromTurn({ memory: conversationMemory, userMessage, analysis, criteria, dialogueState: state })
            const activeCriteria = buildActiveCriteria(conversationMemory, criteria)
            Object.assign(criteria, activeCriteria)
            state.conversationMemory = conversationMemory

            return {
                reply: `Entendido, he actualizado tu preferencia de dificultad a ${memMod.newValue === "baja" ? "sencilla / baja" : memMod.newValue}, sustituyendo la solicitud anterior para evitar contradicciones. ¿Quieres que busquemos recomendaciones acordes?`,
                updatedCriteria: criteria,
                dialogueState: {
                    ...state,
                    conversationMemory
                },
                conversationMemory,
                recommendations: [],
                suggestedReplies: ["Recomiéndame ya", "Buscar alternativas", "Nueva búsqueda"]
            }
        } else if (memMod.type === "exclude_genre") {
            syncMemoryFromTurn({ memory: conversationMemory, userMessage, analysis, criteria, dialogueState: state })
            const activeCriteria = buildActiveCriteria(conversationMemory, criteria)
            Object.assign(criteria, activeCriteria)
            state.conversationMemory = conversationMemory

            return {
                reply: `Entendido, he excluido los juegos de **${memMod.genre}** de tus preferencias. No te mostraremos títulos de esa categoría. ¿Quieres ver nuevas opciones adaptadas?`,
                updatedCriteria: criteria,
                dialogueState: {
                    ...state,
                    conversationMemory
                },
                conversationMemory,
                recommendations: [],
                suggestedReplies: ["Recomiéndame ya", "Buscar alternativas", "Nueva búsqueda"]
            }
        }
    }

    // Sincronizar memoria conversacional con la intervención actual (Etapa 6)
    syncMemoryFromTurn({ memory: conversationMemory, userMessage, analysis, criteria, dialogueState: state })
    const activeCriteria = buildActiveCriteria(conversationMemory, criteria)
    Object.assign(criteria, activeCriteria)
    state.conversationMemory = conversationMemory

    // Prevenir preguntas redundantes sobre dimensiones ya conocidas en memoria (Requisito 9 & Escenario 14)
    if (conversationMemory.currentNeeds.availableTime && !isQuestionResolved(state, "time")) {
        markQuestionStatus(state, "time", "resolved")
    }
    if (conversationMemory.currentNeeds.gameMode && !isQuestionResolved(state, "mode")) {
        markQuestionStatus(state, "mode", "resolved")
    }
    if ((conversationMemory.currentNeeds.preferredGenres.length > 0 || conversationMemory.habitualPreferences.genres.length > 0) && !isQuestionResolved(state, "genres")) {
        markQuestionStatus(state, "genres", "resolved")
    }
    if ((conversationMemory.currentNeeds.emotion.length > 0 || conversationMemory.habitualPreferences.experiences.length > 0) && !isQuestionResolved(state, "experience")) {
        markQuestionStatus(state, "experience", "resolved")
    }

    // 4. Manejo de respuestas ambiguas o inciertas a preguntas previas (Escenario 7)
    const isUncertainOrAmbiguousAnswer =
        analysis.isUncertain ||
        (analysis.isAmbiguous && !analysis.wantsRecommendationsNow && !analysis.wantsAlternatives && !analysis.isGreeting)

    if (isUncertainOrAmbiguousAnswer && state.stage !== "recommended" && state.stage !== "initial") {
        const currentStage = state.stage
        const alreadyClarified = state.clarifiedStages.includes(currentStage)

        if (!alreadyClarified) {
            state.clarifiedStages.push(currentStage)
            const clarification = composeClarificationReply(currentStage, state)

            return {
                reply: clarification.prompt,
                updatedCriteria: criteria,
                dialogueState: state,
                recommendations: [],
                suggestedReplies: clarification.options
            }
        } else {
            // Protección contra ciclos (Regla E): marcar flexible/indiferente si vuelve a responder de forma ambigua
            if (currentStage === "experience") state.isSurpriseMe = true
            else if (currentStage === "time") state.timeIndifferent = true
            else if (currentStage === "mode") state.modeIndifferent = true
            else if (currentStage === "genres") state.genreIndifferent = true
            markQuestionStatus(state, currentStage, "resolved_flexible")
        }
    }

    // 4b. Manejo de retroalimentación e interacciones conversacionales post-recomendación o comparación (Etapas 5 y 6)
    const isComparison = detectComparisonIntent(userMessage, state)
    if (safeDialogueState.stage === "recommended" || safeDialogueState.stage === "compared" || safeDialogueState.stage === "feedback_rejection_followup" || isComparison) {
        const postRecResult = await handlePostRecommendationTurn({
            userMessage,
            criteria,
            dialogueState: state,
            analysis
        })
        if (postRecResult) {
            return postRecResult
        }
    }

    // 5. Actualización del rastreador de preguntas según lo respondido en este turno
    const prevStage = safeDialogueState.stage
    if (prevStage && prevStage !== "initial" && prevStage !== "recommended") {
        if (prevStage === "experience") {
            if (analysis.isSurpriseMe || state.isSurpriseMe) {
                markQuestionStatus(state, "experience", "resolved_flexible")
            } else if (analysis.emotionalContext?.length > 0 || analysis.desiredPacing) {
                markQuestionStatus(state, "experience", "resolved")
            }
        } else if (prevStage === "time") {
            if (analysis.isTimeIndifferent || state.timeIndifferent) {
                markQuestionStatus(state, "time", "resolved_flexible")
            } else if (analysis.availableTime) {
                markQuestionStatus(state, "time", "resolved")
            }
        } else if (prevStage === "mode") {
            if (analysis.isModeIndifferent || state.modeIndifferent) {
                markQuestionStatus(state, "mode", "resolved_flexible")
            } else if (analysis.gameMode) {
                markQuestionStatus(state, "mode", "resolved")
            }
        } else if (prevStage === "genres") {
            if (analysis.isGenreIndifferent || state.genreIndifferent) {
                markQuestionStatus(state, "genres", "resolved_flexible")
            } else if (analysis.preferredGenres?.length > 0 || analysis.dislikedGenres?.length > 0) {
                markQuestionStatus(state, "genres", "resolved")
            }
        } else if (prevStage === "followup_game") {
            if (analysis.isSkippingPastGames) {
                markQuestionStatus(state, "followup_game", "skipped")
            } else {
                markQuestionStatus(state, "followup_game", "resolved")
            }
        } else if (prevStage === "followup_disliked") {
            if (analysis.isSkippingPastGames) {
                markQuestionStatus(state, "followup_disliked", "skipped")
            } else {
                markQuestionStatus(state, "followup_disliked", "resolved")
            }
        } else if (prevStage === "discovery_pref") {
            if (analysis.isSkippingPastGames) {
                markQuestionStatus(state, "discovery_pref", "skipped")
            } else if (criteria.discoveryPreference != null) {
                markQuestionStatus(state, "discovery_pref", "resolved")
            }
        } else if (prevStage.startsWith("feature_")) {
            if (analysis.isSkippingPastGames) {
                markQuestionStatus(state, prevStage, "skipped")
            } else {
                markQuestionStatus(state, prevStage, "resolved")
            }
        }
    }

    // Registrar dimensiones resueltas espontáneamente
    if (criteria.emotionalContext?.length > 0 || criteria.desiredPacing || state.isSurpriseMe) {
        if (!isQuestionResolved(state, "experience")) {
            markQuestionStatus(state, "experience", state.isSurpriseMe ? "resolved_flexible" : "resolved")
        }
    }
    if (criteria.availableTime || state.timeIndifferent) {
        if (!isQuestionResolved(state, "time")) {
            markQuestionStatus(state, "time", state.timeIndifferent ? "resolved_flexible" : "resolved")
        }
    }
    if (criteria.gameMode || state.modeIndifferent) {
        if (!isQuestionResolved(state, "mode")) {
            markQuestionStatus(state, "mode", state.modeIndifferent ? "resolved_flexible" : "resolved")
        }
    }
    if (criteria.preferredGenres?.length > 0 || criteria.dislikedGenres?.length > 0 || state.genreIndifferent) {
        if (!isQuestionResolved(state, "genres")) {
            markQuestionStatus(state, "genres", state.genreIndifferent ? "resolved_flexible" : "resolved")
        }
    }
    if (/amigos|pareja|novio|novia|con alguien|competir|versus|pvp/i.test(userMessage || "")) {
        markQuestionStatus(state, "feature_cooperacion", "resolved")
    }

    if (analysis.isSkippingPastGames) {
        state.pastGamesSkipped = true
    }

    // 6. Evaluar la decisión de recomendación mediante la lógica de la Etapa 1
    const readiness = evaluateRecommendationReadiness({
        criteria,
        dialogueState: state,
        analysis
    })
    state.readiness = readiness

    // 7. Seleccionar la siguiente acción o pregunta adaptativa mediante el selector centralizado (Etapa 4)
    const decision = selectNextQuestion({
        criteria,
        dialogueState: state,
        analysis,
        readiness,
        userMessage
    })
    state.selectedReason = decision.reason

    // --- RAMA 1: LISTO PARA RECOMENDAR ---
    if (decision.action === "recommend" || readiness.readyToRecommend) {
        const excludeList = analysis.wantsAlternatives || !!gameRejectedTitle
            ? state.shownGameTitles
            : state.rejectedGames

        let scoredGames = await evaluateRecommendations(criteria, {
            limit: 3,
            excludeTitles: excludeList
        })

        // Si se agotaron las opciones con exclusión total, usar solo los rechazados explícitamente
        if (scoredGames.length === 0 && excludeList.length > state.rejectedGames.length) {
            scoredGames = await evaluateRecommendations(criteria, {
                limit: 3,
                excludeTitles: state.rejectedGames
            })
        }

        const recommendations = scoredGames.map((item) => ({
            game: item.game,
            score: item.score,
            breakdown: item.breakdown,
            explanation: generateExplanation(item, criteria)
        }))

        // Registrar los títulos mostrados para evitar repeticiones al pedir alternativas
        const newlyShown = recommendations.map((r) => r.game.title)
        state.shownGameTitles = [...new Set([...state.shownGameTitles, ...newlyShown])]
        state.lastRecommendedGames = newlyShown
        state.currentReferencedGame = null

        if (conversationMemory && conversationMemory.recommendationFeedback) {
            conversationMemory.recommendationFeedback.lastShownGames = newlyShown
            conversationMemory.recommendationFeedback.shownHistory = state.shownGameTitles
        }
        state.conversationMemory = conversationMemory

        let replyIntro = ""
        if (recommendations.length === 0) {
            replyIntro = "No se encontraron videojuegos que coincidan con todos los filtros y restricciones indicadas. Puedes probar relajando algún criterio o iniciando una nueva búsqueda."
        } else {
            replyIntro = composeRecommendationIntro(criteria, state, analysis, gameRejectedTitle)
            const diversityExp = explainBatchDiversity(recommendations, criteria)
            if (diversityExp && recommendations.length > 1) {
                replyIntro += `\n\n${diversityExp}`
            }
            if (!replyIntro.includes("¿Alguna") && !replyIntro.includes("¿Qué te parecen") && !replyIntro.includes("¿Te llama")) {
                replyIntro += "\n\nEstas son algunas opciones que podrían encajar con lo que buscas. ¿Alguna te llamó especialmente la atención o quieres explorar alternativas?"
            }
        }

        const topGame = newlyShown[0]
        return {
            reply: replyIntro,
            updatedCriteria: criteria,
            dialogueState: {
                ...state,
                stage: "recommended",
                readyToRecommend: true,
                conversationMemory
            },
            conversationMemory,
            recommendations,
            suggestedReplies: [
                "Me interesa el primero",
                topGame ? `¿De qué trata ${topGame}?` : "Quiero saber más",
                "Quiero algo diferente",
                "Algo parecido a mis gustos",
                "Muéstrame más alternativas"
            ]
        }
    }

    // --- RAMA 2: CONTINUAR DIÁLOGO ADAPTATIVO (PREGUNTA SELECCIONADA POR questionSelector) ---
    const nextKey = decision.questionKey
    state.stage = nextKey
    markQuestionStatus(state, nextKey, "asked", { config: decision.config })
    state.conversationMemory = conversationMemory

    if (nextKey === "followup_game") {
        state.followupGameTarget = decision.target
        return {
            reply: decision.config.question,
            updatedCriteria: criteria,
            dialogueState: state,
            conversationMemory,
            recommendations: [],
            suggestedReplies: decision.config.options
        }
    }

    if (nextKey === "followup_disliked") {
        state.followupDislikedTarget = decision.target
        return {
            reply: decision.config.question,
            updatedCriteria: criteria,
            dialogueState: state,
            conversationMemory,
            recommendations: [],
            suggestedReplies: decision.config.options
        }
    }

    if (nextKey === "discovery_pref") {
        state.discoveryAsked = true
        const ack = createAcknowledgment(analysis, safeCriteria)
        const reply = ack ? `${ack} ${decision.config.question}` : decision.config.question
        return {
            reply,
            updatedCriteria: criteria,
            dialogueState: state,
            conversationMemory,
            recommendations: [],
            suggestedReplies: decision.config.options
        }
    }

    // Preguntas sobre características preferidas o dimensiones principales
    const turnReply = composeTurnReply({
        analysis,
        criteria,
        previousCriteria: safeCriteria,
        dialogueState: state,
        nextQuestionKey: nextKey
    })

    return {
        reply: turnReply,
        updatedCriteria: criteria,
        dialogueState: state,
        conversationMemory,
        recommendations: [],
        suggestedReplies: decision.config.options
    }
}

module.exports = {
    processDialogueTurn,
    evaluateRecommendationReadiness,
    QUESTIONS_CONFIG,
    GAME_FOLLOWUP_PROMPTS,
    FEATURE_FOLLOWUP_CONFIG,
    DISCOVERY_PROMPT,
    createAcknowledgment,
    createRecommendationIntro,
    selectNextQuestion,
    initQuestionTracker,
    markQuestionStatus,
    isQuestionResolved,
    handlePostRecommendationTurn,
    resolveGameReference,
    getGameDetails
}
