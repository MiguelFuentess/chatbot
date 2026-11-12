/**
 * Servicio Centralizado de Composición de Respuestas Conversacionales (Etapa 3)
 *
 * Responsabilidad:
 * - Construir respuestas naturales, variadas, empáticas y contextualmente conectadas.
 * - Aplicar la estructura recomendada:
 *     A. Reconocimiento empático y proporcionado.
 *     B. Conexión contextual con preferencias previas.
 *     C. Continuación y transición fluida a la siguiente pregunta o acción.
 * - Evitar aperturas repetitivas ("¡Perfecto!", "¡Excelente!") mediante rotación controlada.
 * - Redactar síntesis de recomendación en prosa humana sin inventar datos.
 */

// Catálogo de preguntas de seguimiento específicas por videojuego (Etapa 2 & 3)
const GAME_FOLLOWUP_PROMPTS = {
    "stardew valley": {
        question: "¡Stardew Valley es una maravilla! ¿Qué fue lo que más disfrutaste de él? ¿La tranquilidad y relajación, la gestión de la granja, o la libertad para jugar a tu propio ritmo?",
        options: [
            "La tranquilidad y relajación",
            "La gestión y progreso",
            "La libertad para jugar a mi ritmo",
            "Prefiero saltar esta pregunta"
        ]
    },
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

// Conjuntos de aperturas variadas según el contexto del turno
const OPENERS = {
    acknowledgment: [
        "Entendido,",
        "De acuerdo,",
        "Anotado,",
        "Comprendo,",
        "Tiene sentido,"
    ],
    preferenceConfirmed: [
        "Perfecto,",
        "Excelente elección,",
        "Muy bien,",
        "Genial,"
    ],
    changeOfMind: [
        "Claro, podemos cambiar esa preferencia.",
        "Sin problema, ajustamos la búsqueda.",
        "Entendido, modificamos ese punto conservando lo demás.",
        "Ajustamos el criterio manteniendo el resto de tus gustos."
    ],
    undecided: [
        "No necesitas tener todo decidido desde el principio; podemos explorar algunas posibilidades.",
        "Sin prisa, podemos ir descubriendo qué tipo de experiencia te apetece hoy.",
        "Completamente normal; podemos revisar un par de opciones y ver qué te llama más la atención."
    ],
    postRecommendationAlternatives: [
        "Entendido, busquemos otras alternativas manteniendo lo que me indicaste y sin repetir las que ya vimos.",
        "Sin problema, aquí tienes otras opciones diferentes que también encajan con tus criterios:",
        "De acuerdo, exploramos otras alternativas del catálogo conservando tus preferencias:"
    ],
    postRecommendationRejection: [
        "Anotado, dejamos fuera esa opción. Manteniendo el resto de tus preferencias, aquí tienes nuevas alternativas:",
        "Entendido, descartamos ese título y recalculamos opciones acordes a tus gustos:",
        "Sin problema, eliminamos esa recomendación y buscamos alternativas en la misma línea:"
    ]
}

/**
 * Selecciona una apertura rotativa evitando repetir las utilizadas en los turnos recientes.
 */
function pickVariedPhrase(pool = [], recentOpeners = []) {
    if (!pool || pool.length === 0) return ""
    const available = pool.filter((phrase) => !recentOpeners.includes(phrase))
    const candidateList = available.length > 0 ? available : pool
    const selected = candidateList[Math.floor(Math.random() * candidateList.length)]
    return selected
}

/**
 * Registra una apertura utilizada en el estado para evitar repeticiones en turnos inmediatos.
 */
function recordOpenerUsage(dialogueState = {}, phrase = "") {
    if (!phrase) return
    const recents = Array.isArray(dialogueState.recentOpeners) ? [...dialogueState.recentOpeners] : []
    recents.push(phrase)
    if (recents.length > 3) recents.shift()
    dialogueState.recentOpeners = recents
}

/**
 * Genera el snippet de empatía contextual respetuosa ante expresiones emocionales voluntarias,
 * evitando juicios, diagnósticos psicológicos o suposiciones exageradas (Sección 5).
 */
function composeEmpathySnippet(analysis = {}, previousCriteria = {}) {
    const rawText = (analysis.rawText || "").toLowerCase()
    const emotions = analysis.criteria?.emotionalContext || []
    const prevEmotions = previousCriteria.emotionalContext || []
    const newEmotions = emotions.filter((e) => !prevEmotions.includes(e))
    const currentEmo = newEmotions[newEmotions.length - 1] || emotions[emotions.length - 1]

    // 1. Cansancio / Búsqueda de relajación
    if (/cansad|agotad|estresad|largo d[ií]a|pesado|despejar|desconectar|cero estr[eé]s/i.test(rawText) || currentEmo === "relajante") {
        if (/cansad|agotad|largo d[ií]a|pesado/i.test(rawText)) {
            return "parece que hoy te apetece una experiencia tranquila para relajarte sin presiones ni exigencias."
        }
        return "una experiencia tranquila para relajarte y desconectar a tu propio ritmo."
    }

    // 2. Desafío / Reto
    if (currentEmo === "desafiante" || /\b(reto|retos|desaf[ií]os?|desafiante|dif[ií]cil|superaci[oó]n|exigente)\b/i.test(rawText)) {
        return "un reto estimulante que ponga a prueba tu habilidad y paciencia."
    }

    // 3. Emoción / Dinamismo / Acción
    if (currentEmo === "emocionante" || /\b(emoci[oó]n|adrenalina|din[aá]mico)\b/i.test(rawText)) {
        return "una propuesta dinámica y emocionante que te enganche desde el primer minuto."
    }

    // 4. Historia / Narrativa
    if (currentEmo === "buena historia" || /historia|narrativa|trama|inmersi[oó]n/i.test(rawText)) {
        return "una aventura inmersiva con una historia envolvente y buen argumento."
    }

    // 5. Creatividad / Construcción
    if (currentEmo === "creativo" || /creativ|construir|crear/i.test(rawText)) {
        return "libertad para crear, moldear y construir a tu manera."
    }

    return null
}

/**
 * Construye una conexión contextual fluida (Parte B de la estructura)
 * relacionando los datos nuevos con preferencias previamente conocidas.
 */
function composeContextConnection(criteria = {}, dialogueState = {}, targetDimension = null) {
    const connections = []

    // Conexión con características disfrutadas relevantes
    if (criteria.likedFeatures && criteria.likedFeatures.length > 0) {
        if (targetDimension === "mode" && criteria.likedFeatures.includes("exploracion")) {
            connections.push("Y como disfrutas descubrir lugares nuevos,")
        } else if (targetDimension === "time" && criteria.likedFeatures.includes("construccion_creatividad")) {
            connections.push("Pensando en darte espacio para construir y crear,")
        } else if (targetDimension === "genres" && criteria.likedFeatures.includes("narrativa_historia")) {
            connections.push("Buscando mundos con una buena narrativa,")
        }
    }

    // Conexión con juegos que disfrutó
    if (criteria.likedGames && criteria.likedGames.length > 0 && targetDimension === "time" && criteria.discoveryPreference === "similar") {
        const topGame = criteria.likedGames[criteria.likedGames.length - 1]
        connections.push(`Para encontrar algo en la misma línea de lo que disfrutaste en ${topGame},`)
    }

    // Conexión cuando se orienta a partidas cooperativas
    if (criteria.gameMode === "cooperativo" && targetDimension === "time") {
        connections.push("Pensando en coordinar con amigos,")
    }

    return connections.length > 0 ? connections[0] : ""
}

/**
 * Genera la formulación natural y fluida de la siguiente pregunta (Parte C de la estructura).
 */
function composeQuestionTransition(dimensionKey, contextIntro = "") {
    const transitions = {
        experience: {
            standard: "Para empezar, ¿qué tipo de experiencia te gustaría tener hoy?",
            withContext: "¿qué tipo de experiencia te gustaría tener hoy?"
        },
        time: {
            standard: "¿Cuánto tiempo tienes disponible para jugar?",
            withContext: "¿cuánto tiempo tienes disponible para jugar?"
        },
        mode: {
            standard: "¿Cómo prefieres jugar?",
            withContext: "¿cómo prefieres jugar?"
        },
        genres: {
            standard: "¿Hay algún género que te guste especialmente o alguno que prefieras evitar?",
            withContext: "¿hay algún género que te guste especialmente o alguno que prefieras evitar?"
        },
        feature_exploracion: {
            standard: "¿Prefieres descubrir lugares tranquilamente o explorar mientras superas desafíos?",
            withContext: "¿prefieres descubrir lugares tranquilamente o explorar mientras superas desafíos?"
        },
        feature_narrativa: {
            standard: "¿Te interesan más las historias emotivas, los misterios o las aventuras con decisiones?",
            withContext: "¿te interesan más las historias emotivas, los misterios o las aventuras con decisiones?"
        },
        feature_narrativa_historia: {
            standard: "¿Te interesan más las historias emotivas, los misterios o las aventuras con decisiones?",
            withContext: "¿te interesan más las historias emotivas, los misterios o las aventuras con decisiones?"
        },
        feature_construccion: {
            standard: "¿Prefieres construir libremente o tener objetivos que orienten lo que creas?",
            withContext: "¿prefieres construir libremente o tener objetivos que orienten lo que creas?"
        },
        feature_construccion_creatividad: {
            standard: "¿Prefieres construir libremente o tener objetivos que orienten lo que creas?",
            withContext: "¿prefieres construir libremente o tener objetivos que orienten lo que creas?"
        },
        feature_estrategia: {
            standard: "¿Te gusta pensar cada movimiento con calma o tomar decisiones bajo presión?",
            withContext: "¿te gusta pensar cada movimiento con calma o tomar decisiones bajo presión?"
        },
        feature_estrategia_planificacion: {
            standard: "¿Te gusta pensar cada movimiento con calma o tomar decisiones bajo presión?",
            withContext: "¿te gusta pensar cada movimiento con calma o tomar decisiones bajo presión?"
        },
        feature_cooperacion: {
            standard: "¿Prefieres colaborar para alcanzar objetivos o competir con otras personas?",
            withContext: "¿prefieres colaborar para alcanzar objetivos o competir con otras personas?"
        },
        feature_desafio: {
            standard: "¿Te interesan los desafíos de habilidad, los acertijos complejos o la estrategia?",
            withContext: "¿te interesan los desafíos de habilidad, los acertijos complejos o la estrategia?"
        },
        feature_desafio_progresion: {
            standard: "¿Te interesan los desafíos de habilidad, los acertijos complejos o la estrategia?",
            withContext: "¿te interesan los desafíos de habilidad, los acertijos complejos o la estrategia?"
        }
    }

    const config = transitions[dimensionKey]
    if (!config) return ""

    if (contextIntro) {
        return `${contextIntro} ${config.withContext}`
    }

    return config.standard
}

/**
 * Servicio principal: Construye una respuesta empática, contextualizada y variada
 * para un turno conversacional que continuará preguntando o indagando.
 */
function composeTurnReply({
    analysis = {},
    criteria = {},
    previousCriteria = {},
    dialogueState = {},
    nextQuestionKey = null,
    isSkipping = false
}) {
    const parts = []

    // 1. Manejo de salto amigable
    if (isSkipping || analysis.isSkippingPastGames) {
        const skipAck = pickVariedPhrase(
            [
                "Sin problema, no te preocupes por los juegos anteriores.",
                "Entendido, dejamos eso de lado y nos centramos en lo que buscas hoy.",
                "¡De acuerdo! Continuamos con las preferencias que tenemos."
            ],
            dialogueState.recentOpeners || []
        )
        recordOpenerUsage(dialogueState, skipAck)
        parts.push(skipAck)
    }

    // 2. Reconocimiento empático del turno actual (Parte A)
    const empathySnippet = composeEmpathySnippet(analysis, previousCriteria)
    const prevLikedCount = previousCriteria.likedFeatures?.length || 0
    const newLikedFeatures = (criteria.likedFeatures || []).slice(prevLikedCount)

    // Reconocimiento de cambio de opinión (solo cuando ya existía una preferencia previa)
    const hadPrevGenres = previousCriteria.preferredGenres && previousCriteria.preferredGenres.length > 0
    const hadPrevTime = !!previousCriteria.availableTime
    const hadPrevMode = !!previousCriteria.gameMode

    if (analysis.isHabitualVsCurrent) {
        parts.push("Entendido: aunque normalmente te gustan los juegos con desafío, hoy priorizaremos una experiencia tranquila para relajarte.")
    } else if (analysis.isDepende && (analysis.isModeIndifferent || dialogueState.stage === "mode")) {
        parts.push("Entendido, entonces no limitaremos la búsqueda por modalidad.")
    } else if (analysis.isDepende && (analysis.isTimeIndifferent || dialogueState.stage === "time")) {
        parts.push("Entendido, mantendremos flexible el tiempo de juego.")
    } else if (analysis.isDepende && (analysis.isGenreIndifferent || dialogueState.stage === "genres")) {
        parts.push("De acuerdo, no cerraremos la búsqueda a un único género.")
    } else if (analysis.isChangingGenre && criteria.preferredGenres.length > 0 && hadPrevGenres) {
        const changeOpener = pickVariedPhrase(OPENERS.changeOfMind, dialogueState.recentOpeners || [])
        recordOpenerUsage(dialogueState, changeOpener)
        parts.push(`${changeOpener} Enfocamos la búsqueda en ${criteria.preferredGenres.join(" y ")}.`)
    } else if (analysis.isTimeModified && criteria.availableTime && hadPrevTime && previousCriteria.availableTime !== criteria.availableTime) {
        const changeOpener = pickVariedPhrase(OPENERS.changeOfMind, dialogueState.recentOpeners || [])
        recordOpenerUsage(dialogueState, changeOpener)
        parts.push(`${changeOpener} Adaptamos la duración a ${criteria.availableTime}.`)
    } else if (analysis.isModeModified && criteria.gameMode && hadPrevMode && previousCriteria.gameMode !== criteria.gameMode) {
        const changeOpener = pickVariedPhrase(OPENERS.changeOfMind, dialogueState.recentOpeners || [])
        recordOpenerUsage(dialogueState, changeOpener)
        parts.push(`${changeOpener} Pasamos a modalidad ${criteria.gameMode}.`)
    } else if (analysis.referencesPrevious) {
        parts.push("¡Por supuesto! Recordamos lo que me indicaste anteriormente.")
    } else if (empathySnippet && !isSkipping) {
        const opener = pickVariedPhrase(OPENERS.acknowledgment, dialogueState.recentOpeners || [])
        recordOpenerUsage(dialogueState, opener)
        parts.push(`${opener} ${empathySnippet}`)
    } else if (analysis.newLikedGame && !isSkipping) {
        parts.push(`¡Me alegra que hayas disfrutado de ${analysis.newLikedGame}!`)
    } else if (analysis.newDislikedGame && !isSkipping) {
        parts.push(`Anotado sobre ${analysis.newDislikedGame}, lo tendremos muy presente para no sugerir algo similar.`)
    }

    // Reconocimiento sutil de características nuevas declaradas
    if (newLikedFeatures.length > 0 && parts.length === 0) {
        const featLabels = {
            exploracion: "la exploración y el descubrimiento de secretos",
            construccion_creatividad: "la libertad creativa para construir",
            narrativa_historia: "una buena historia y narrativa",
            combate_accion: "el combate y la acción",
            estrategia_planificacion: "la estrategia y planificación",
            puzzles_acertijos: "los acertijos y la lógica",
            libertad_sandbox: "la libertad para jugar a tu ritmo",
            cooperacion: "el juego cooperativo en equipo",
            competencia: "la competencia",
            supervivencia: "la supervivencia y gestión de recursos",
            desafio_progresion: "el reto y la superación"
        }
        const labelList = newLikedFeatures.map((f) => featLabels[f] || f)
        const opener = pickVariedPhrase(OPENERS.acknowledgment, dialogueState.recentOpeners || [])
        recordOpenerUsage(dialogueState, opener)
        parts.push(`${opener} veo que valoras ${labelList.join(" y ")}.`)
    }

    // Reconocimiento de aversiones o exclusiones
    if (analysis.criteria.dislikedFeatures && analysis.criteria.dislikedFeatures.includes("combate_dificil") && !previousCriteria.dislikedFeatures?.includes("combate_dificil")) {
        parts.push("Totalmente comprensible: evitaremos juegos con combates difíciles o frustrantes.")
    }

    // Reconocimiento de tiempo o modo si recién se especificó
    if (analysis.criteria?.availableTime && !previousCriteria.availableTime && parts.length === 0) {
        if (analysis.criteria.availableTime.includes("corta")) {
            parts.push("Perfecto para una partida rápida de menos de 30 minutos.")
        } else if (analysis.criteria.availableTime.includes("media")) {
            parts.push("Excelente, sesiones de entre 30 y 60 minutos.")
        } else if (analysis.criteria.availableTime.includes("larga")) {
            parts.push("Buenísimo, con tiempo suficiente para profundizar.")
        }
    }
    if (analysis.criteria.gameMode && !previousCriteria.gameMode && parts.length === 0) {
        if (analysis.criteria.gameMode === "cooperativo") {
            parts.push("Títulos cooperativos pensados para coordinar con amigos.")
        } else if (analysis.criteria.gameMode === "individual") {
            parts.push("Diseñado para disfrutar en solitario.")
        }
    } else if (analysis.isModeIndifferent && !previousCriteria.gameMode) {
        parts.push("Sin restricción de modalidad.")
    }

    // Reconocimiento de preferencia de descubrimiento
    if (analysis.criteria?.discoveryPreference && previousCriteria.discoveryPreference !== analysis.criteria.discoveryPreference) {
        if (analysis.criteria.discoveryPreference === "similar") {
            parts.push("¡Anotado! Buscaremos títulos en esa misma línea.")
        } else if (analysis.criteria.discoveryPreference === "diferente") {
            parts.push("¡Perfecto! Buscaremos algo fresco y diferente a lo que sueles jugar.")
        } else if (analysis.criteria.discoveryPreference === "indistinto") {
            parts.push("De acuerdo, exploraremos opciones afines sin cerrarnos a novedades.")
        }
    }

    // Reconocimiento de géneros preferidos o excluidos si se acaban de proporcionar
    if ((analysis.criteria?.preferredGenres?.length || 0) > (previousCriteria.preferredGenres?.length || 0) && parts.length === 0) {
        const newGenres = analysis.criteria.preferredGenres.join(" y ")
        parts.push(`Genial, enfocado en el género ${newGenres}.`)
    }
    if ((analysis.criteria?.dislikedGenres?.length || 0) > (previousCriteria.dislikedGenres?.length || 0) && parts.length === 0) {
        parts.push(`Anotado, evitaremos los títulos de ${analysis.criteria.dislikedGenres.join(" y ")}.`)
    }

    // 3. Conexión contextual y formulación de la siguiente pregunta (Partes B y C)
    if (nextQuestionKey) {
        const contextIntro = composeContextConnection(criteria, dialogueState, nextQuestionKey)
        const questionText = composeQuestionTransition(nextQuestionKey, contextIntro)
        parts.push(questionText)
    }

    // Unir con fluidez asegurando un único párrafo cohesivo
    let combined = parts.join(" ").replace(/\s{2,}/g, " ").trim()
    if (!combined && nextQuestionKey) {
        combined = composeQuestionTransition(nextQuestionKey, "")
    }

    return combined
}

/**
 * Genera la introducción conversacional cuando se presentan las recomendaciones finales,
 * sintetizando en prosa natural los criterios reales sin sonar como un volcado de base de datos.
 */
function composeRecommendationIntro(criteria = {}, dialogueState = {}, analysis = {}, gameRejectedTitle = null) {
    // 1. Manejo de descarte puntual de recomendación previa
    if (gameRejectedTitle) {
        const rejOpener = pickVariedPhrase(OPENERS.postRecommendationRejection, dialogueState.recentOpeners || [])
        recordOpenerUsage(dialogueState, rejOpener)
        return `Entendido, descartamos "${gameRejectedTitle}" de las recomendaciones. Conservando tus demás preferencias, aquí tienes nuevas opciones que encajan con tu perfil:`
    }

    // 2. Manejo de solicitud de alternativas
    if (analysis.wantsAlternatives) {
        const altOpener = pickVariedPhrase(OPENERS.postRecommendationAlternatives, dialogueState.recentOpeners || [])
        recordOpenerUsage(dialogueState, altOpener)
        return "¡De acuerdo! Buscando alternativas diferentes para ti. Excluyendo las que ya revisamos, aquí tienes otras opciones que se adaptan a lo que buscas:"
    }

    // 3. Manejo de solicitud explícita inmediata
    if (analysis.wantsRecommendationsNow) {
        const hasCriteria =
            (criteria.preferredGenres && criteria.preferredGenres.length > 0) ||
            criteria.availableTime ||
            criteria.gameMode ||
            (criteria.emotionalContext && criteria.emotionalContext.length > 0)

        if (!hasCriteria) {
            return "Como aún no conozco tus preferencias específicas, he preparado una selección general con algunos de los títulos de PC mejor valorados para que explores:"
        }
        return "¡De acuerdo! Con la información que me has proporcionado hasta el momento, he seleccionado estas recomendaciones para ti:"
    }

    // 4. Modificaciones conservando contexto
    if (analysis.genreModified && analysis.isChangingGenre && criteria.preferredGenres?.length > 0) {
        return `Perfecto, actualizamos tu preferencia al género ${criteria.preferredGenres.join(" y ")} manteniendo tu contexto de juego. Aquí tienes las nuevas recomendaciones:`
    }
    if (analysis.isTimeModified && criteria.availableTime) {
        return `Entendido, adaptamos el tiempo disponible a ${criteria.availableTime} conservando tus demás criterios. Aquí tienes las opciones actualizadas:`
    }
    if (analysis.isModeModified && criteria.gameMode) {
        return `Anotado, cambiamos la modalidad a ${criteria.gameMode} manteniendo tus gustos. Aquí tienes las recomendaciones para ti:`
    }
    if (analysis.isEmotionModified && criteria.emotionalContext?.length > 0) {
        return `Entendido, enfocamos las recomendaciones en una experiencia ${criteria.emotionalContext.join(" / ")}. Aquí tienes las opciones adaptadas:`
    }

    // 5. Síntesis natural en prosa humana de criterios conocidos
    const clauses = []

    // Gustos previos / descubrimiento
    if (criteria.likedGames && criteria.likedGames.length > 0) {
        const gList = criteria.likedGames.join(", ")
        if (criteria.discoveryPreference === "diferente") {
            clauses.push(`buscando algo diferente a ${gList}`)
        } else if (criteria.discoveryPreference === "similar") {
            clauses.push(`en la línea de ${gList}`)
        }
    }

    // Características destacadas
    if (criteria.likedFeatures && criteria.likedFeatures.length > 0) {
        const featureNames = {
            exploracion: "exploración",
            construccion_creatividad: "construcción y creatividad",
            narrativa_historia: "buena historia",
            combate_accion: "combate y acción",
            estrategia_planificacion: "estrategia",
            puzzles_acertijos: "acertijos",
            libertad_sandbox: "libertad de juego",
            cooperacion: "cooperativo",
            competencia: "competencia",
            supervivencia: "supervivencia",
            desafio_progresion: "desafío"
        }
        const readableFeats = criteria.likedFeatures.map((f) => featureNames[f] || f)
        clauses.push(`con énfasis en ${readableFeats.join(" y ")}`)
    }

    // Emoción o experiencia deseada
    if (criteria.emotionalContext && criteria.emotionalContext.length > 0) {
        const emo = criteria.emotionalContext.join(" y ")
        if (emo === "relajante") clauses.push("algo tranquilo para relajarte")
        else if (emo === "desafiante") clauses.push("un reto estimulante y desafiante")
        else if (emo === "emocionante") clauses.push("una experiencia emocionante y dinámica")
        else if (emo === "buena historia") clauses.push("una buena historia para explorar")
        else if (emo === "creativo") clauses.push("libertad para construir y crear")
        else clauses.push(`una experiencia centrada en ${emo}`)
    } else if (dialogueState.isSurpriseMe) {
        clauses.push("opciones variadas y sorprendentes")
    }

    // Tiempo disponible
    if (criteria.availableTime) {
        if (criteria.availableTime.includes("corta")) {
            clauses.push("para partidas de menos de 30 minutos")
        } else if (criteria.availableTime.includes("media")) {
            clauses.push("para jugar aproximadamente una hora")
        } else if (criteria.availableTime.includes("larga")) {
            clauses.push("para sesiones de más de una hora")
        }
    }

    // Modalidad
    if (criteria.gameMode) {
        if (criteria.gameMode === "individual") {
            clauses.push("disfrutar en solitario")
        } else if (criteria.gameMode === "cooperativo") {
            clauses.push("jugar en cooperativo con amigos")
        }
    }

    // Género
    if (criteria.preferredGenres && criteria.preferredGenres.length > 0) {
        clauses.push(`del género ${criteria.preferredGenres.join(" y ")}`)
    }

    // Exclusiones
    if (criteria.dislikedGenres && criteria.dislikedGenres.length > 0) {
        clauses.push(`evitando títulos de ${criteria.dislikedGenres.join(" y ")}`)
    }
    if (criteria.dislikedFeatures && criteria.dislikedFeatures.includes("combate_dificil")) {
        clauses.push("sin combates difíciles")
    }

    if (clauses.length > 0) {
        const opener = pickVariedPhrase(
            [
                "Creo que ya tengo una idea más clara de lo que estás buscando:",
                "Por lo que me has contado, ya tengo una visión clara de lo que buscas:",
                "Teniendo en cuenta tus preferencias,"
            ],
            dialogueState.recentOpeners || []
        )
        recordOpenerUsage(dialogueState, opener)
        return `${opener} ${clauses.join(", ")}. Con eso en mente, encontré algunas opciones que podrían interesarte:`
    }

    return "He evaluado tus preferencias y encontré estas opciones que se adaptan a lo que buscas:"
}

/**
 * Compone la respuesta de clarificación cuando el usuario responde de forma ambigua ("No sé", "ni idea").
 */
function composeClarificationReply(stage, dialogueState = {}) {
    const opener = pickVariedPhrase(OPENERS.undecided, dialogueState.recentOpeners || [])
    recordOpenerUsage(dialogueState, opener)

    let prompt = ""
    let options = []

    if (stage === "experience") {
        prompt = `No te preocupes si tienes dudas. ¿Prefieres una partida para relajarte y desconectar sin presiones, o te llama más un reto estimulante o una buena historia?`
        options = ["Quiero relajarme", "Quiero un desafío", "Explorar una buena historia", "Sorpréndeme"]
    } else if (stage === "time") {
        prompt = `No hay problema si tienes dudas con el tiempo. Para orientarnos: ¿suelen ser partidas rápidas de menos de media hora, o sesiones más largas de más de una hora?`
        options = ["Menos de 30 minutos", "Entre 30 y 60 minutos", "Más de una hora", "No tengo límite de tiempo"]
    } else if (stage === "mode") {
        prompt = `Sin problema si tienes dudas. ¿Sueles disfrutar más jugando en solitario a tu propio ritmo, o prefieres juegos para compartir con amigos?`
        options = ["Prefiero jugar solo", "Quiero jugar con amigos", "Me da igual"]
    } else if (stage === "genres") {
        prompt = `¡Completamente normal tener dudas! Si no tienes un género favorito, dime: ¿hay algún tipo de juego que prefieras evitar, como el terror o los disparos?`
        options = ["Aventura", "RPG", "Estrategia", "No tengo preferencias"]
    } else {
        prompt = `No te preocupes si tienes dudas. ¿Qué tipo de experiencia te gustaría disfrutar hoy?`
        options = ["Quiero relajarme", "Busco algo emocionante", "Quiero un desafío", "Sorpréndeme"]
    }

    return { prompt, options }
}

/**
 * Función auxiliar de reconocimiento conciso para compatibilidad.
 */
function createAcknowledgment(analysis = {}, previousCriteria = {}) {
    const acks = []
    const prevEmoCount = previousCriteria.emotionalContext?.length || 0
    const prevDislikesCount = previousCriteria.dislikedGenres?.length || 0
    const prevLikedFeatCount = previousCriteria.likedFeatures?.length || 0
    const prevDislikedFeatCount = previousCriteria.dislikedFeatures?.length || 0

    if (analysis.isSkippingPastGames) {
        acks.push("¡Sin problema! No te preocupes por los juegos anteriores.")
    }
    if (analysis.referencesPrevious) {
        acks.push("¡Por supuesto! Recordamos lo que me indicaste anteriormente.")
    }
    if (analysis.newLikedGame) {
        acks.push(`¡Me alegra que hayas disfrutado de ${analysis.newLikedGame}!`)
    }
    if (analysis.newDislikedGame) {
        acks.push(`Anotado sobre ${analysis.newDislikedGame}, lo tendremos muy presente.`)
    }
    if (analysis.criteria?.likedFeatures?.length > prevLikedFeatCount) {
        const featureLabels = {
            exploracion: "la exploración y descubrir secretos",
            construccion_creatividad: "la libertad creativa para construir",
            narrativa_historia: "una buena historia y narrativa",
            combate_accion: "el combate dinámico",
            estrategia_planificacion: "la estrategia y planificación",
            puzzles_acertijos: "los acertijos y puzzles",
            libertad_sandbox: "la libertad de jugar a tu ritmo",
            cooperacion: "el juego en equipo",
            competencia: "la competencia",
            supervivencia: "la supervivencia",
            desafio_progresion: "el desafío y la superación"
        }
        const newFeats = analysis.criteria.likedFeatures.slice(prevLikedFeatCount)
        const labels = newFeats.map((f) => featureLabels[f] || f)
        acks.push(`Excelente, priorizaremos títulos con ${labels.join(" y ")}.`)
    }
    if (analysis.criteria?.dislikedFeatures?.length > prevDislikedFeatCount) {
        if (analysis.criteria.dislikedFeatures.includes("combate_dificil")) {
            acks.push("Totalmente comprensible: evitaremos juegos con combates difíciles o frustrantes.")
        } else {
            acks.push("Anotado, evitaremos esas características en las recomendaciones.")
        }
    }
    if (analysis.criteria?.discoveryPreference && previousCriteria.discoveryPreference !== analysis.criteria.discoveryPreference) {
        if (analysis.criteria.discoveryPreference === "similar") {
            acks.push("¡Anotado! Buscaremos títulos en esa misma línea.")
        } else if (analysis.criteria.discoveryPreference === "diferente") {
            acks.push("¡Perfecto! Buscaremos algo fresco y diferente a lo que sueles jugar.")
        } else if (analysis.criteria.discoveryPreference === "indistinto") {
            acks.push("De acuerdo, exploraremos opciones afines sin cerrarnos a novedades.")
        }
    }
    if (analysis.isChangingGenre && analysis.criteria?.preferredGenres?.length > 0) {
        acks.push(`Actualizamos tu preferencia al género ${analysis.criteria.preferredGenres.join(" y ")}.`)
    }
    if (analysis.isTimeModified && previousCriteria.availableTime && previousCriteria.availableTime !== analysis.criteria?.availableTime) {
        acks.push(`Ajustamos el tiempo de sesión a ${analysis.criteria.availableTime}.`)
    }
    if (analysis.isModeModified && previousCriteria.gameMode && previousCriteria.gameMode !== analysis.criteria?.gameMode) {
        acks.push(`Cambiamos la modalidad de juego a ${analysis.criteria.gameMode}.`)
    }
    if (analysis.isSurpriseMe) {
        acks.push("¡Genial, vamos a descubrir opciones interesantes!")
    } else if (analysis.criteria?.emotionalContext?.length > prevEmoCount || analysis.criteria?.emotionalContext?.length > 0) {
        const emo = analysis.criteria.emotionalContext[analysis.criteria.emotionalContext.length - 1]
        if (emo === "relajante") acks.push("Entendido, una experiencia tranquila para relajarte y desconectar.")
        else if (emo === "desafiante") acks.push("¡Excelente! Un buen reto estimulante para poner a prueba tu habilidad.")
        else if (emo === "emocionante") acks.push("¡De acuerdo! Algo dinámico y emocionante con mucha acción.")
        else if (emo === "buena historia") acks.push("Una gran elección: una aventura inmersiva con una buena historia.")
        else if (emo === "creativo") acks.push("Perfecto, libertad para crear y construir a tu propio ritmo.")
    }
    if (analysis.criteria?.availableTime && !previousCriteria.availableTime) {
        if (analysis.criteria.availableTime.includes("corta")) {
            acks.push("Perfecto para una partida rápida de menos de 30 minutos.")
        } else if (analysis.criteria.availableTime.includes("media")) {
            acks.push("Excelente, sesiones de entre 30 y 60 minutos.")
        } else if (analysis.criteria.availableTime.includes("larga")) {
            acks.push("Buenísimo, con tiempo suficiente para profundizar.")
        }
    }
    if (analysis.criteria?.gameMode && !previousCriteria.gameMode) {
        if (analysis.criteria.gameMode === "cooperativo") {
            acks.push("Títulos cooperativos pensados para coordinar con amigos.")
        } else if (analysis.criteria.gameMode === "individual") {
            acks.push("Diseñado para disfrutar en solitario.")
        }
    } else if (analysis.isModeIndifferent) {
        acks.push("Sin restricción de modalidad.")
    }
    if (analysis.criteria?.preferredGenres?.length > (previousCriteria.preferredGenres?.length || 0)) {
        const newGenres = analysis.criteria.preferredGenres.join(" y ")
        acks.push(`Genial, enfocado en el género ${newGenres}.`)
    }
    if (analysis.criteria?.dislikedGenres?.length > prevDislikesCount) {
        acks.push(`Anotado, evitaremos los títulos de ${analysis.criteria.dislikedGenres.join(" y ")}.`)
    }

    return acks.length > 0 ? acks.join(" ") : ""
}

module.exports = {
    composeTurnReply,
    composeRecommendationIntro,
    composeClarificationReply,
    composeEmpathySnippet,
    composeContextConnection,
    composeQuestionTransition,
    createAcknowledgment,
    pickVariedPhrase,
    recordOpenerUsage,
    GAME_FOLLOWUP_PROMPTS,
    getGenericGameFollowup,
    getDislikedGameFollowup,
    DISCOVERY_PROMPT,
    OPENERS
}

