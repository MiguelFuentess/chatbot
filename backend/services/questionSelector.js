/**
 * Servicio Centralizado de Selección Adaptativa de Preguntas (Etapa 4)
 *
 * Responsabilidad:
 * - Evaluar el estado del diálogo, criterios acumulados, último mensaje e intención.
 * - Determinar la siguiente pregunta adaptativa según:
 *     1. Videojuegos específicos mencionados (profundización basada en atributos reales del juego).
 *     2. Preferencias sobre características concretas (exploración, narrativa, construcción, estrategia, cooperación, desafíos).
 *     3. Preferencias habituales vs. necesidades actuales del jugador.
 *     4. Respuestas ambiguas o parciales ("Depende", "No sé", "Un poco de todo").
 *     5. Relevancia contextual dinámica de las dimensiones pendientes (tiempo, modo, género, experiencia).
 * - Evitar preguntas repetidas o sobre información ya resuelta.
 * - Asegurar que las opciones rápidas correspondan exactamente a la pregunta seleccionada.
 */

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
 * Preguntas de seguimiento contextualizadas para videojuegos populares (Etapa 3 & 4)
 * Basadas en atributos verificables del catálogo.
 */
const GAME_FOLLOWUP_PROMPTS = {
    "minecraft": {
        question: "¿Qué disfrutas más de Minecraft: construir, explorar o sobrevivir?",
        options: [
            "Construir y crear cosas",
            "Explorar el mundo libremente",
            "La supervivencia y recursos",
            "Prefiero saltar esta pregunta"
        ]
    },
    "hollow knight": {
        question: "En Hollow Knight, ¿qué fue lo que más te gustó: la exploración, los secretos o los desafíos?",
        options: [
            "La exploración y secretos",
            "La atmósfera y la historia",
            "El combate y los desafíos",
            "Prefiero saltar esta pregunta"
        ]
    },
    "stardew valley": {
        question: "¿Lo que más disfrutas es organizar tu granja, avanzar a tu ritmo o relacionarte con los personajes?",
        options: [
            "Organizar la granja y progresar",
            "Avanzar a mi ritmo con calma",
            "Relacionarme con personajes",
            "Prefiero saltar esta pregunta"
        ]
    },
    "elden ring": {
        question: "¡Elden Ring es una experiencia titánica! ¿Qué fue lo que más disfrutaste? ¿La exploración de su inmenso mundo abierto, el combate exigente o el reto constante?",
        options: [
            "Explorar el mundo abierto",
            "El combate y los jefes",
            "El reto y la superación",
            "Prefiero saltar esta pregunta"
        ]
    },
    "terraria": {
        question: "¡Terraria tiene muchísimo contenido! ¿Qué disfrutaste más? ¿La exploración y aventura, el combate y los jefes, o la construcción y crafteo?",
        options: [
            "Exploración y aventura",
            "Combate y jefes",
            "Construcción y crafteo",
            "Prefiero saltar esta pregunta"
        ]
    },
    "hades": {
        question: "¡Hades es increíblemente dinámico! ¿Qué fue lo que más te enganchó? ¿El combate rápido y fluido, la historia y diálogos, o la progresión entre intentos?",
        options: [
            "El combate rápido y fluido",
            "La historia y personajes",
            "La progresión y rejugabilidad",
            "Prefiero saltar esta pregunta"
        ]
    },
    "celeste": {
        question: "¡Celeste es memorable! ¿Qué te gustó más? ¿El reto de precisión y plataformas, o su emotiva historia y música?",
        options: [
            "El reto y superación",
            "La historia y la música",
            "Prefiero saltar esta pregunta"
        ]
    },
    "subnautica": {
        question: "¡Subnautica es una experiencia única! ¿Qué te atrapó más? ¿La exploración submarina y misterio, o la supervivencia y construcción de bases?",
        options: [
            "La exploración y misterio",
            "Supervivencia y recursos",
            "Construcción de bases",
            "Prefiero saltar esta pregunta"
        ]
    },
    "outer wilds": {
        question: "¡Outer Wilds es una joya irrepetible! ¿Qué fue lo que más te maravilló? ¿La curiosidad y resolver el misterio, o explorar el sistema solar?",
        options: [
            "Resolver el misterio y la historia",
            "Explorar el sistema solar libremente",
            "Prefiero saltar esta pregunta"
        ]
    },
    "portal": {
        question: "¡Portal es brillante! ¿Qué disfrutaste más? ¿El ingenio de los puzzles con portales o su humor y narrativa?",
        options: [
            "Los puzzles y la física",
            "El humor y la historia",
            "Prefiero saltar esta pregunta"
        ]
    },
    "portal 2": {
        question: "¡Portal 2 es una obra maestra! ¿Qué disfrutaste más? ¿Los puzzles ingeniosos o la historia y personajes?",
        options: [
            "Los puzzles y acertijos",
            "La historia y el humor",
            "El modo cooperativo",
            "Prefiero saltar esta pregunta"
        ]
    }
}

function getGenericGameFollowup(gameTitle) {
    return {
        question: `¡Genial que hayas jugado a ${gameTitle}! Para conocer mejor tus gustos, ¿qué fue lo que más disfrutaste de él? ¿La historia, la exploración, la jugabilidad o el desafío?`,
        options: [
            "La historia y narrativa",
            "La exploración del mundo",
            "El combate y la acción",
            "Los puzzles o estrategia",
            "La creatividad o libertad",
            "Prefiero saltar esta pregunta"
        ]
    }
}

function getDislikedGameFollowup(gameTitle) {
    return {
        question: `Anotado sobre ${gameTitle}. Para evitar recomendarte algo que no disfrutes, ¿qué causó esa mala experiencia? ¿Fue la alta dificultad, el combate exigente o el ritmo del juego?`,
        options: [
            "El combate y dificultad exigente",
            "El ritmo lento o aburrido",
            "La complejidad o gestión",
            "Prefiero saltar esta pregunta"
        ]
    }
}

const DISCOVERY_PROMPT = {
    id: "discovery_pref",
    question: "¿Hoy te gustaría volver a vivir algo en esa misma línea o prefieres descubrir algo completamente diferente a lo que sueles jugar?",
    options: [
        "Quiero algo parecido",
        "Prefiero algo diferente",
        "Me da igual",
        "Recomiéndame ya"
    ]
}

/**
 * Preguntas de seguimiento adaptativas según características preferidas expresadas (Etapa 4, Sección 4).
 * Cada pregunta aterriza en distinciones concretas que impactan la selección y el ranking del catálogo.
 */
const FEATURE_FOLLOWUP_CONFIG = {
    exploracion: {
        id: "feature_exploracion",
        featureId: "exploracion",
        title: "Exploración",
        question: "¿Prefieres descubrir lugares tranquilamente o explorar mientras superas desafíos?",
        options: [
            "Explorar tranquilamente",
            "Explorar con desafíos",
            "Me gustan ambas",
            "Prefiero otra cosa"
        ]
    },
    narrativa_historia: {
        id: "feature_narrativa",
        featureId: "narrativa_historia",
        title: "Narrativa e historia",
        question: "¿Te interesan más las historias emotivas, los misterios o las aventuras con decisiones?",
        options: [
            "Historias emotivas y profundas",
            "Misterios y secretos por resolver",
            "Aventuras con decisiones y rol",
            "Prefiero otra cosa"
        ]
    },
    construccion_creatividad: {
        id: "feature_construccion",
        featureId: "construccion_creatividad",
        title: "Construcción y creatividad",
        question: "¿Prefieres construir libremente o tener objetivos que orienten lo que creas?",
        options: [
            "Construir libremente a mi aire",
            "Tener objetivos que orienten lo que creo",
            "Un balance de ambos",
            "Prefiero otra cosa"
        ]
    },
    estrategia_planificacion: {
        id: "feature_estrategia",
        featureId: "estrategia_planificacion",
        title: "Estrategia",
        question: "¿Te gusta pensar cada movimiento con calma o tomar decisiones bajo presión?",
        options: [
            "Pensar con calma por turnos",
            "Tomar decisiones bajo presión",
            "Me da igual",
            "Prefiero otra cosa"
        ]
    },
    cooperacion: {
        id: "feature_cooperacion",
        featureId: "cooperacion",
        title: "Juego cooperativo",
        question: "¿Prefieres colaborar para alcanzar objetivos o competir con otras personas?",
        options: [
            "Cooperar con amigos",
            "Competir contra otros",
            "Me da igual",
            "Prefiero jugar solo"
        ]
    },
    desafio_progresion: {
        id: "feature_desafio",
        featureId: "desafio_progresion",
        title: "Desafíos",
        question: "¿Te interesan los desafíos de habilidad, los acertijos complejos o la estrategia?",
        options: [
            "Desafíos de habilidad y reflejos",
            "Acertijos complejos",
            "Estrategia profunda",
            "Prefiero otra cosa"
        ]
    }
}

/**
 * Inicializa y normaliza el rastreador de preguntas para evitar repeticiones y bucles.
 */
function initQuestionTracker(state = {}) {
    if (!state.questionTracker || typeof state.questionTracker !== "object") {
        state.questionTracker = {}
    }
    const defaultKeys = [
        "experience",
        "time",
        "mode",
        "genres",
        "followup_game",
        "followup_disliked",
        "discovery_pref",
        "feature_exploracion",
        "feature_narrativa",
        "feature_construccion",
        "feature_estrategia",
        "feature_cooperacion",
        "feature_desafio"
    ]
    for (const key of defaultKeys) {
        if (!state.questionTracker[key]) {
            state.questionTracker[key] = {
                status: state.questionsAsked?.includes(key) ? "asked" : "unasked",
                answersCount: 0
            }
        }
    }
    return state.questionTracker
}

/**
 * Actualiza el estado de una pregunta en el rastreador.
 */
function markQuestionStatus(state = {}, questionKey, status = "resolved", details = {}) {
    initQuestionTracker(state)
    if (!state.questionTracker[questionKey]) {
        state.questionTracker[questionKey] = { status: "unasked", answersCount: 0 }
    }
    state.questionTracker[questionKey] = {
        ...state.questionTracker[questionKey],
        status,
        updatedAtTurn: state.turnCount || 1,
        ...details
    }
    if (!Array.isArray(state.questionsAsked)) {
        state.questionsAsked = []
    }
    if (!state.questionsAsked.includes(questionKey) && status === "asked") {
        state.questionsAsked.push(questionKey)
    }
}

/**
 * Determina si una pregunta ya fue formulada o resuelta.
 */
function isQuestionResolved(state = {}, questionKey) {
    initQuestionTracker(state)
    const tracker = state.questionTracker[questionKey]
    if (!tracker) return false
    return (
        tracker.status === "resolved" ||
        tracker.status === "resolved_flexible" ||
        tracker.status === "skipped"
    )
}

/**
 * Función central de Selección Adaptativa de Preguntas (Etapa 4).
 *
 * Determina cuál es la siguiente pregunta más relevante y valiosa en función de:
 * 1. Petición explícita de recomendaciones o post-recomendaciones (recomendar).
 * 2. Suficiencia de criterios (Etapa 1).
 * 3. Indagación sobre videojuego mencionado recientemente (Etapa 2 & 3).
 * 4. Preferencia de descubrimiento ("similar" vs "diferente").
 * 5. Indagación profunda sobre características preferidas expresadas (Etapa 4).
 * 6. Dimensiones faltantes priorizadas contextualmente (no lineales).
 *
 * @param {Object} params
 * @param {Object} params.criteria Criterios acumulados del usuario
 * @param {Object} params.dialogueState Estado de la conversación
 * @param {Object} params.analysis Análisis NLP del último turno
 * @param {Object} params.readiness Evaluación de suficiencia de la Etapa 1
 * @param {string} params.userMessage Mensaje en texto libre del usuario
 * @returns {Object} Decisión estructurada: { action: "recommend" | "ask", questionKey, config, reason }
 */
function selectNextQuestion({
    criteria = {},
    dialogueState = {},
    analysis = {},
    readiness = {},
    userMessage = ""
}) {
    initQuestionTracker(dialogueState)

    // 1. Solicitud explícita de recomendación inmediata o interacciones post-recomendación
    if (analysis.wantsRecommendationsNow || analysis.wantsAlternatives || analysis.rejectedGame) {
        return {
            action: "recommend",
            reason: analysis.wantsAlternatives
                ? "El usuario solicitó alternativas diferentes."
                : analysis.rejectedGame
                ? "El usuario descartó una recomendación previa."
                : "El usuario solicitó recomendaciones explícitamente."
        }
    }

    // 2. Si las 4 dimensiones están completas y no hay preguntas prioritarias pendientes
    if (readiness.readyToRecommend) {
        return {
            action: "recommend",
            reason: readiness.reason || "Criterios suficientes para recomendar sin redundancia."
        }
    }

    // 3. Seguimiento de videojuego disfrutado nuevo (Caso A de Etapa 2)
    if (analysis.newLikedGame && !dialogueState.pastGamesSkipped) {
        const cleanTarget = analysis.newLikedGame.toLowerCase()
        const hasFeaturesJustProvided = (criteria.likedFeatures?.length || 0) > 0 &&
            analysis.rawText &&
            /(?:porque|ya que|por|me gusta|encanta|disfruto)/i.test(analysis.rawText)

        // Si no explicó aún por qué le gustó el juego y no está resuelto
        if (!hasFeaturesJustProvided && !isQuestionResolved(dialogueState, "followup_game")) {
            const followupConfig = GAME_FOLLOWUP_PROMPTS[cleanTarget] || getGenericGameFollowup(analysis.newLikedGame)
            return {
                action: "ask",
                questionKey: "followup_game",
                target: analysis.newLikedGame,
                config: followupConfig,
                reason: `Profundizar en qué aspectos disfrutó el usuario de ${analysis.newLikedGame}`
            }
        }

        // Si ya explicó el motivo, indagar si busca algo similar o diferente si aún no lo ha dicho
        if (criteria.discoveryPreference == null && !isQuestionResolved(dialogueState, "discovery_pref")) {
            return {
                action: "ask",
                questionKey: "discovery_pref",
                config: DISCOVERY_PROMPT,
                reason: "Determinar si hoy desea revivir algo similar al juego disfrutado o explorar algo diferente"
            }
        }
    }

    // 4. Seguimiento de videojuego no disfrutado nuevo (Caso B de Etapa 2)
    if (analysis.newDislikedGame && !dialogueState.pastGamesSkipped && !isQuestionResolved(dialogueState, "followup_disliked")) {
        const hasDislikedFeatures = (criteria.dislikedFeatures?.length || 0) > 0
        if (!hasDislikedFeatures) {
            const followupConfig = getDislikedGameFollowup(analysis.newDislikedGame)
            return {
                action: "ask",
                questionKey: "followup_disliked",
                target: analysis.newDislikedGame,
                config: followupConfig,
                reason: `Indagar motivo de descontento con ${analysis.newDislikedGame} para evitar títulos análogos`
            }
        }
    }

    // 5. Si acabamos de responder el seguimiento de un juego y falta la preferencia de descubrimiento
    if (dialogueState.stage === "followup_game" && criteria.discoveryPreference == null && !isQuestionResolved(dialogueState, "discovery_pref") && !dialogueState.pastGamesSkipped) {
        return {
            action: "ask",
            questionKey: "discovery_pref",
            config: DISCOVERY_PROMPT,
            reason: "Consultar si hoy busca una experiencia similar o diferente tras conocer sus gustos en el juego previo"
        }
    }

    // 6. Seguimiento inteligente según características preferidas expresadas (Etapa 4, Sección 4)
    // Se indaga la característica si el usuario la acaba de expresar o la tiene entre sus gustos,
    // y aún no ha sido profundizada ni omitida.
    const activeLikedFeatures = criteria.likedFeatures || []
    const rawTextLower = (userMessage || "").toLowerCase()

    // Orden de prioridad según lo que el usuario acaba de mencionar explícitamente en el turno
    const candidateFeatureKeys = [
        "exploracion",
        "narrativa_historia",
        "construccion_creatividad",
        "estrategia_planificacion",
        "cooperacion",
        "desafio_progresion"
    ]

    // Buscar si alguna característica fue mencionada directamente en el mensaje actual
    let targetFeatureFollowup = null
    for (const featId of candidateFeatureKeys) {
        const featConfig = FEATURE_FOLLOWUP_CONFIG[featId]
        if (!featConfig) continue

        const questionKey = featConfig.id || `feature_${featId}`
        if (isQuestionResolved(dialogueState, questionKey)) continue
        if (dialogueState.questionsAsked?.includes(questionKey)) continue

        const isFeatureInCriteria = activeLikedFeatures.includes(featId)
        const isMentionedInMessage =
            (featId === "exploracion" && /explor|mundo abierto|descubrir/i.test(rawTextLower)) ||
            (featId === "narrativa_historia" && /historia|narrativ|trama|guion/i.test(rawTextLower)) ||
            (featId === "construccion_creatividad" && /constru|crear|creativ|sandbox/i.test(rawTextLower)) ||
            (featId === "estrategia_planificacion" && (/estrateg|tactico|planific|gestion/i.test(rawTextLower) || (criteria.preferredGenres && criteria.preferredGenres.includes("Estrategia")))) ||
            (featId === "cooperacion" && (/coop|amigos|equipo|colabor/i.test(rawTextLower) || criteria.gameMode === "cooperativo")) ||
            (featId === "desafio_progresion" && (/desafi|reto|dificil|superar/i.test(rawTextLower) || (criteria.emotionalContext && criteria.emotionalContext.includes("desafiante"))))

        if (isFeatureInCriteria || isMentionedInMessage) {
            // Verificar si el usuario ya respondió implícitamente a este matiz específico (Etapa 3 & 4)
            if (featId === "exploracion" && (criteria.objectiveStylePreference || /abierto|lineal|guiad|pasillero/i.test(rawTextLower))) continue
            if (featId === "narrativa_historia" && (/emotiv|misteri|decision|eleccion/i.test(rawTextLower) || dialogueState.narrativeTypeAnswered)) continue
            if (featId === "construccion_creatividad" && (criteria.objectiveStylePreference || /libre|guiad|objetivo|mision/i.test(rawTextLower))) continue
            if (featId === "estrategia_planificacion" && (dialogueState.strategyPacingAnswered || /turno|tiempo real|pausa|calma|presion/i.test(rawTextLower))) continue
            if (featId === "cooperacion" && (/amigos|pareja|novi|compet|colabor|versus|pvp/i.test(rawTextLower) || dialogueState.coopGoalAnswered)) continue
            if (featId === "desafio_progresion" && (/habilidad|reflejo|acertijo|puzzle|estrateg/i.test(rawTextLower) || dialogueState.challengeTypeAnswered)) continue

            targetFeatureFollowup = {
                key: questionKey,
                featId,
                config: featConfig
            }
            break
        }
    }

    if (targetFeatureFollowup && !dialogueState.pastGamesSkipped && readiness.dimensionsCount < 4) {
        return {
            action: "ask",
            questionKey: targetFeatureFollowup.key,
            target: targetFeatureFollowup.featId,
            config: targetFeatureFollowup.config,
            reason: `Profundizar en el matiz de '${targetFeatureFollowup.config.title}' para personalizar el catálogo`
        }
    }

    // 7. Selección dinámica de dimensiones principales pendientes (sin orden rígido)
    const unasked = (readiness.unaskedDimensions || []).filter(
        (dim) => !dialogueState.questionsAsked?.includes(dim) && !isQuestionResolved(dialogueState, dim)
    )

    if (unasked.length === 0) {
        return {
            action: "recommend",
            reason: "Todas las dimensiones evaluables han sido exploradas o resueltas."
        }
    }

    // Priorización heurística adaptativa según la última información recibida
    let selectedDimension = null
    let selectionReason = ""

    // Heurística A: Si el usuario habló de jugar con amigos/coop, indagar tiempo o géneros compatibles
    if (criteria.gameMode === "cooperativo" || /amigos|cooperativo|pareja/i.test(rawTextLower)) {
        if (unasked.includes("time")) {
            selectedDimension = "time"
            selectionReason = "Contexto cooperativo detectado: preguntar tiempo para coordinar sesiones con amigos."
        } else if (unasked.includes("genres")) {
            selectedDimension = "genres"
            selectionReason = "Contexto cooperativo detectado: preguntar género adecuado para jugar en grupo."
        }
    }

    // Heurística B: Si el usuario acaba de indicar tiempo disponible, preguntar modo o experiencia
    if (!selectedDimension && criteria.availableTime && /minuto|hora|rato|tiempo/i.test(rawTextLower)) {
        if (unasked.includes("mode")) {
            selectedDimension = "mode"
            selectionReason = "Tiempo definido: indagar modalidad de juego (solo o con amigos)."
        } else if (unasked.includes("genres")) {
            selectedDimension = "genres"
            selectionReason = "Tiempo definido: indagar géneros preferidos compatibles con la duración."
        }
    }

    // Heurística C: Si el usuario acaba de indicar género, indagar tiempo disponible o modalidad
    if (!selectedDimension && (criteria.preferredGenres?.length || 0) > 0 && /aventura|rpg|accion|estrategia|puzzle|simulacion/i.test(rawTextLower)) {
        if (unasked.includes("time")) {
            selectedDimension = "time"
            selectionReason = "Género preferido conocido: indagar tiempo disponible para ajustar el ritmo."
        } else if (unasked.includes("mode")) {
            selectedDimension = "mode"
            selectionReason = "Género preferido conocido: indagar si prefiere jugarlo en solitario o cooperativo."
        }
    }

    // Heurística D: Si aún no se conoce la experiencia / emoción y está pendiente
    if (!selectedDimension && !readiness.hasExperience && unasked.includes("experience")) {
        selectedDimension = "experience"
        selectionReason = "Explorar el contexto emocional y el tipo de experiencia deseada para hoy."
    }

    // Heurística E: Si aún no se ha seleccionado, tomar la primera dimensión pendiente
    if (!selectedDimension && unasked.length > 0) {
        selectedDimension = unasked[0]
        selectionReason = `Indagar dimensión pendiente '${selectedDimension}' para completar el perfil del jugador.`
    }

    const questionConfig = QUESTIONS_CONFIG[selectedDimension]
    if (!questionConfig) {
        return {
            action: "recommend",
            reason: "Dimensiones agotadas, procediendo a recomendación."
        }
    }

    return {
        action: "ask",
        questionKey: selectedDimension,
        config: questionConfig,
        reason: selectionReason
    }
}

module.exports = {
    selectNextQuestion,
    initQuestionTracker,
    markQuestionStatus,
    isQuestionResolved,
    QUESTIONS_CONFIG,
    GAME_FOLLOWUP_PROMPTS,
    FEATURE_FOLLOWUP_CONFIG,
    DISCOVERY_PROMPT,
    getGenericGameFollowup,
    getDislikedGameFollowup
}
