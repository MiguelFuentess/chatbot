/**
 * Servicio de Gestión de Diálogo Adaptativo y Progresivo
 * Administra el flujo de conversación, la identificación de criterios faltantes,
 * y la transición hacia la recomendación personalizada.
 */

const { parseUserMessage } = require("./nlpService")
const { evaluateRecommendations } = require("./recommendationEngine")
const { generateExplanation } = require("./explanationService")

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
 * Genera un breve reconocimiento empático sobre lo que el usuario acaba de expresar.
 */
function createAcknowledgment(analysis, previousCriteria = {}) {
    const acks = []
    const prevEmoCount = previousCriteria.emotionalContext?.length || 0
    const prevDislikesCount = previousCriteria.dislikedGenres?.length || 0

    // Reconocimiento de referencia al contexto anterior
    if (analysis.referencesPrevious) {
        acks.push("¡Por supuesto! Recordamos lo que me indicaste anteriormente.")
    }

    // Reconocimiento de cambio o corrección de género
    if (analysis.isChangingGenre && analysis.criteria.preferredGenres.length > 0) {
        acks.push(`Actualizamos tu preferencia al género ${analysis.criteria.preferredGenres.join(" y ")}.`)
    }

    // Reconocimiento de modificación de tiempo
    if (analysis.isTimeModified && previousCriteria.availableTime && previousCriteria.availableTime !== analysis.criteria.availableTime) {
        acks.push(`Ajustamos el tiempo de sesión a ${analysis.criteria.availableTime}.`)
    }

    // Reconocimiento de modificación de modalidad
    if (analysis.isModeModified && previousCriteria.gameMode && previousCriteria.gameMode !== analysis.criteria.gameMode) {
        acks.push(`Cambiamos la modalidad de juego a ${analysis.criteria.gameMode}.`)
    }

    // Reconocimiento de emoción o experiencia
    if (analysis.isSurpriseMe) {
        acks.push("¡Genial, vamos a descubrir opciones interesantes!")
    } else if (analysis.criteria.emotionalContext.length > prevEmoCount || analysis.criteria.emotionalContext.length > 0) {
        const emo = analysis.criteria.emotionalContext[analysis.criteria.emotionalContext.length - 1]
        if (emo === "relajante") acks.push("Entendido, una experiencia tranquila para relajarte y desconectar.")
        else if (emo === "desafiante") acks.push("¡Excelente! Un buen reto estimulante para poner a prueba tu habilidad.")
        else if (emo === "emocionante") acks.push("¡De acuerdo! Algo dinámico y emocionante con mucha acción.")
        else if (emo === "buena historia") acks.push("Una gran elección: una aventura inmersiva con una buena historia.")
        else if (emo === "creativo") acks.push("Perfecto, libertad para crear y construir a tu propio ritmo.")
    }

    // Reconocimiento de tiempo si se acaba de proporcionar
    if (analysis.criteria.availableTime && !previousCriteria.availableTime) {
        if (analysis.criteria.availableTime.includes("corta")) {
            acks.push("Perfecto para una partida rápida de menos de 30 minutos.")
        } else if (analysis.criteria.availableTime.includes("media")) {
            acks.push("Excelente, sesiones de entre 30 y 60 minutos.")
        } else if (analysis.criteria.availableTime.includes("larga")) {
            acks.push("Buenísimo, con tiempo suficiente para profundizar.")
        }
    }

    // Reconocimiento de modo si se acaba de proporcionar
    if (analysis.criteria.gameMode && !previousCriteria.gameMode) {
        if (analysis.criteria.gameMode === "cooperativo") {
            acks.push("Títulos cooperativos pensados para coordinar con amigos.")
        } else if (analysis.criteria.gameMode === "individual") {
            acks.push("Diseñado para disfrutar en solitario.")
        }
    } else if (analysis.isModeIndifferent) {
        acks.push("Sin restricción de modalidad.")
    }

    // Reconocimiento de géneros preferidos si se acaban de proporcionar
    if (analysis.criteria.preferredGenres.length > (previousCriteria.preferredGenres?.length || 0)) {
        const newGenres = analysis.criteria.preferredGenres.join(" y ")
        acks.push(`Genial, enfocado en el género ${newGenres}.`)
    }

    // Reconocimiento de exclusiones (dislikes)
    if (analysis.criteria.dislikedGenres.length > prevDislikesCount) {
        acks.push(`Anotado, evitaremos los títulos de ${analysis.criteria.dislikedGenres.join(" y ")}.`)
    }

    return acks.length > 0 ? acks.join(" ") : ""
}

/**
 * Genera la introducción conversacional cuando se presentan las recomendaciones finales.
 */
function createRecommendationIntro(criteria = {}) {
    const details = []

    if (criteria.emotionalContext && criteria.emotionalContext.length > 0) {
        details.push(`una experiencia enfocada en ${criteria.emotionalContext.join(", ")}`)
    }

    if (criteria.availableTime) {
        details.push(`para sesiones de ${criteria.availableTime}`)
    }

    if (criteria.gameMode) {
        details.push(`en modalidad ${criteria.gameMode}`)
    }

    if (criteria.preferredGenres && criteria.preferredGenres.length > 0) {
        details.push(`del género ${criteria.preferredGenres.join(" / ")}`)
    }

    if (criteria.dislikedGenres && criteria.dislikedGenres.length > 0) {
        details.push(`evitando ${criteria.dislikedGenres.join(" y ")}`)
    }

    if (details.length > 0) {
        return `¡Perfecto! Teniendo en cuenta que buscas ${details.join(" y ")}, he seleccionado estas 3 recomendaciones para ti:`
    }

    return "He evaluado tus preferencias y encontré estas 3 opciones que se adaptan a lo que buscas:"
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
    // 1. Clonar estado y criterios
    const state = {
        stage: dialogueState.stage || "initial",
        questionsAsked: Array.isArray(dialogueState.questionsAsked) ? [...dialogueState.questionsAsked] : [],
        turnCount: (dialogueState.turnCount || 0) + 1,
        modeIndifferent: !!dialogueState.modeIndifferent,
        genreIndifferent: !!dialogueState.genreIndifferent,
        isSurpriseMe: !!dialogueState.isSurpriseMe,
        shownGameTitles: Array.isArray(dialogueState.shownGameTitles) ? [...dialogueState.shownGameTitles] : [],
        rejectedGames: Array.isArray(dialogueState.rejectedGames) ? [...dialogueState.rejectedGames] : []
    }

    // 2. Procesar el texto mediante el servicio NLP
    const analysis = parseUserMessage(userMessage, accumulatedCriteria, state)
    const criteria = analysis.criteria

    if (analysis.isSurpriseMe) state.isSurpriseMe = true
    if (analysis.isModeIndifferent) state.modeIndifferent = true
    if (analysis.isGenreIndifferent) state.genreIndifferent = true

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

    // 3. Caso especial: Saludo puro inicial sin criterios
    if (analysis.intent === "greeting" && state.turnCount === 1) {
        return {
            reply: "¡Hola! Bienvenido. Soy tu asistente de videojuegos. Estoy aquí para ayudarte a encontrar un juego que se adapte a lo que buscas hoy.\n\nPara empezar, ¿qué tipo de experiencia te gustaría tener?",
            updatedCriteria: criteria,
            dialogueState: {
                ...state,
                stage: "experience",
                questionsAsked: ["experience"]
            },
            recommendations: [],
            suggestedReplies: QUESTIONS_CONFIG.experience.options
        }
    }

    // 4. Evaluar dimensiones conocidas
    const hasExperience = criteria.emotionalContext.length > 0 || criteria.desiredPacing != null || state.isSurpriseMe
    const hasTime = criteria.availableTime != null
    const hasMode = criteria.gameMode != null || state.modeIndifferent
    const hasGenre = criteria.preferredGenres.length > 0 || criteria.dislikedGenres.length > 0 || state.genreIndifferent

    const dimensionsCount =
        (hasExperience ? 1 : 0) +
        (hasTime ? 1 : 0) +
        (hasMode ? 1 : 0) +
        (hasGenre ? 1 : 0)

    // 5. Decidir si estamos listos para recomendar
    let readyToRecommend = false

    const isPostRecommendationModification =
        state.stage === "recommended" &&
        (analysis.genreModified ||
            analysis.isTimeModified ||
            analysis.isModeModified ||
            analysis.isEmotionModified ||
            analysis.wantsRecommendationsNow ||
            analysis.wantsAlternatives ||
            !!gameRejectedTitle)

    // A: Solicitud de alternativas o rechazo de recomendación
    if (analysis.wantsAlternatives || !!gameRejectedTitle || isPostRecommendationModification) {
        readyToRecommend = true
    }
    // B: Solicitud explícita de recomendaciones teniendo al menos 1 dimensión
    else if (analysis.wantsRecommendationsNow && dimensionsCount >= 1) {
        readyToRecommend = true
    }
    // C: Mensaje rico en una sola frase que aportó 3 dimensiones (ej. "Aventura cooperativa de 1 hora con amigos")
    else if (dimensionsCount >= 3) {
        readyToRecommend = true
    }
    // D: Si ya tenemos experiencia + tiempo + modo
    else if (hasExperience && hasTime && hasMode) {
        readyToRecommend = true
    }
    // E: Si ya se hicieron al menos 2 preguntas y contamos con al menos 2 dimensiones sólidas
    else if (state.questionsAsked.length >= 2 && dimensionsCount >= 2) {
        readyToRecommend = true
    }
    // F: Límite superior de preguntas formuladas (evitar fatiga de diálogo)
    else if (state.questionsAsked.length >= 3 && dimensionsCount >= 1) {
        readyToRecommend = true
    }

    // --- RAMA 1: LISTO PARA RECOMENDAR ---
    if (readyToRecommend) {
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

        let replyIntro = ""
        if (gameRejectedTitle) {
            replyIntro = `Entendido, descartamos "${gameRejectedTitle}" de las recomendaciones. Conservando tus demás preferencias, aquí tienes nuevas opciones que encajan con tu perfil:`
        } else if (analysis.wantsAlternatives) {
            replyIntro = "¡De acuerdo! Buscando alternativas diferentes para ti. Excluyendo las que ya revisamos, aquí tienes otras opciones que se adaptan a lo que buscas:"
        } else if (analysis.genreModified && analysis.isChangingGenre) {
            replyIntro = `Perfecto, actualizamos tu preferencia al género ${criteria.preferredGenres.join(" y ")} manteniendo tu contexto de juego. Aquí tienes las nuevas recomendaciones:`
        } else if (analysis.isTimeModified && state.stage === "recommended") {
            replyIntro = `Entendido, adaptamos el tiempo disponible a ${criteria.availableTime} conservando tus demás criterios. Aquí tienes las opciones actualizadas:`
        } else if (analysis.isModeModified && state.stage === "recommended") {
            replyIntro = `Anotado, cambiamos la modalidad a ${criteria.gameMode} manteniendo tus gustos. Aquí tienes las recomendaciones para ti:`
        } else if (analysis.isEmotionModified && state.stage === "recommended") {
            replyIntro = `Entendido, enfocamos las recomendaciones en una experiencia ${criteria.emotionalContext.join(" / ")}. Aquí tienes las opciones adaptadas:`
        } else {
            replyIntro = createRecommendationIntro(criteria)
        }

        return {
            reply: replyIntro,
            updatedCriteria: criteria,
            dialogueState: {
                ...state,
                stage: "recommended",
                readyToRecommend: true
            },
            recommendations,
            suggestedReplies: [
                "Muéstrame otros juegos",
                "Quiero algo más corto",
                "Prefiero jugar con amigos",
                "Cambiar a algo más desafiante",
                "Nueva búsqueda"
            ]
        }
    }

    // --- RAMA 2: CONTINUAR DIÁLOGO ADAPTATIVO (PREGUNTAS PROGRESIVAS) ---
    // Determinar la siguiente pregunta faltante más relevante
    let nextQuestionKey = null

    // Si no sabemos ni experiencia ni género, preguntar experiencia
    if (!hasExperience && !hasGenre && !state.questionsAsked.includes("experience")) {
        nextQuestionKey = "experience"
    }
    // Si ya tenemos experiencia o género, priorizar tiempo
    else if (!hasTime && !state.questionsAsked.includes("time")) {
        nextQuestionKey = "time"
    }
    // Luego priorizar modo de juego
    else if (!hasMode && !state.questionsAsked.includes("mode")) {
        nextQuestionKey = "mode"
    }
    // Luego indagar géneros si no se conocen
    else if (!hasGenre && !state.questionsAsked.includes("genres")) {
        nextQuestionKey = "genres"
    }
    // Si aún falta experiencia
    else if (!hasExperience && !state.questionsAsked.includes("experience")) {
        nextQuestionKey = "experience"
    } else {
        // Recomendar con lo disponible
        const scoredGames = await evaluateRecommendations(criteria, {
            limit: 3,
            excludeTitles: state.rejectedGames
        })
        const recommendations = scoredGames.map((item) => ({
            game: item.game,
            score: item.score,
            breakdown: item.breakdown,
            explanation: generateExplanation(item, criteria)
        }))

        const newlyShown = recommendations.map((r) => r.game.title)
        state.shownGameTitles = [...new Set([...state.shownGameTitles, ...newlyShown])]

        return {
            reply: createRecommendationIntro(criteria),
            updatedCriteria: criteria,
            dialogueState: {
                ...state,
                stage: "recommended",
                readyToRecommend: true
            },
            recommendations,
            suggestedReplies: [
                "Muéstrame otros juegos",
                "Quiero algo más corto",
                "Prefiero jugar con amigos",
                "Cambiar a algo más desafiante",
                "Nueva búsqueda"
            ]
        }
    }

    const nextConfig = QUESTIONS_CONFIG[nextQuestionKey]
    state.questionsAsked.push(nextQuestionKey)
    state.stage = nextQuestionKey

    const ack = createAcknowledgment(analysis, accumulatedCriteria)
    const combinedReply = ack ? `${ack} ${nextConfig.question}` : nextConfig.question

    return {
        reply: combinedReply,
        updatedCriteria: criteria,
        dialogueState: state,
        recommendations: [],
        suggestedReplies: nextConfig.options
    }
}

module.exports = {
    processDialogueTurn,
    QUESTIONS_CONFIG,
    createAcknowledgment,
    createRecommendationIntro
}
