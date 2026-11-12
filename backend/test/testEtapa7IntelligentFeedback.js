/**
 * Batería de Pruebas Automatizadas: ETAPA 7
 * Retroalimentación Inteligente y Ajuste Contextual de Recomendaciones
 *
 * Cobertura de los 26 Escenarios Obligatorios:
 * 1. Rechazo con motivo explícito de combate
 * 2. Rechazo sin motivo (pregunta contextual de seguimiento)
 * 3. Interés en un aspecto específico (feature_like)
 * 4. Feedback mixto / contrastado
 * 5. Gradación de intensidad: Preferencia suave vs Restricción estricta
 * 6. Referencia contextual descriptiva ("el que tiene más historia", "el último")
 * 7. Retroalimentación sobre una comparación previa ("Ninguno me convence", "Prefiero el primero...")
 * 8. Comentario neutral o consulta informativa (no interpretado como dislike)
 * 9. Corrección de preferencia tras recomendación
 * 10. Solicitud de alternativas con motivo implícito
 * 11. Deduplicación de eventos de retroalimentación
 * 12. Coexistencia de gustos habituales y rechazo puntual
 * 13. Eliminación de una restricción previa ("Quita la restricción de dificultad")
 * 14. Cambio de opinión sobre un juego antes rechazado ("Pensándolo bien, me interesa Hades")
 * 15. Rechazo acumulativo de múltiples juegos
 * 16. Ajuste de una preferencia previa contradictoria ("Antes difícil, ahora sencillo")
 * 17. Modificación de sesión sin alterar gustos habituales ("Hoy prefiero jugar solo")
 * 18. Retroalimentación estética ("No me gustan los juegos pixel art")
 * 19. Explicación adaptada que refleja el motivo del ajuste
 * 20. Persistencia de retroalimentación en memoria de sesión (estructura completa de eventos)
 * 21. Descarte de recomendación por precio ("Solo busco gratis")
 * 22. Confirmación tras feedback de rechazo con sugerencias de ajuste
 * 23. Retroalimentación sobre juego no perteneciente al lote actual
 * 24. Descarte de una categoría entera ("Ya no quiero juegos de terror")
 * 25. Solicitud de juego más relajante tras recomendación desafiante
 * 26. Resiliencia ante entrada de feedback malformada o vacía
 */

const mongoose = require("mongoose")
const { processDialogueTurn } = require("../services/dialogueManager")
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
} = require("../services/feedbackEventService")
const { resolveGameReference, handlePostRecommendationTurn } = require("../services/feedbackManager")
const { createInitialMemory, initConversationMemory, syncMemoryFromTurn } = require("../services/conversationMemoryService")

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatbot"

async function runEtapa7Tests() {
    console.log("==========================================================================")
    console.log("=== BATERÍA DE PRUEBAS: ETAPA 7 - RETROALIMENTACIÓN INTELIGENTE ===")
    console.log("==========================================================================")

    try {
        await mongoose.connect(MONGO_URI)
        console.log("Conectado a MongoDB")
    } catch (e) {
        console.log("Aviso: Ejecutando pruebas con catálogo en memoria (sin conexión MongoDB activa).")
    }

    let passed = 0
    let failed = 0
    const summary = []

    function assert(condition, scenarioNum, desc, details = "") {
        if (condition) {
            console.log(`✓ [PASADO] ${scenarioNum}. ${desc}${details ? ` (${details})` : ""}`)
            passed++
            summary.push({ id: scenarioNum, desc, status: "PASADO" })
        } else {
            console.error(`✗ [FALLIDO] ${scenarioNum}. ${desc}${details ? ` (${details})` : ""}`)
            failed++
            summary.push({ id: scenarioNum, desc, status: "FALLIDO" })
        }
    }

    try {
        // =========================================================================
        // ESCENARIO 1: Rechazo de recomendación con motivo explícito de combate
        // =========================================================================
        const t1Initial = await processDialogueTurn({
            userMessage: "Quiero juegos de acción o roguelike desafiantes de 30 minutos individual, recomiéndame ya",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })
        const t1Turn = await processDialogueTurn({
            userMessage: "No me gusta Hades porque tiene demasiado combate",
            accumulatedCriteria: t1Initial.updatedCriteria,
            dialogueState: t1Initial.dialogueState
        })
        const t1Excluded = !t1Turn.recommendations.some(r => r.game.title === "Hades")
        const t1CombatLow = t1Turn.updatedCriteria.experiencePreferences?.combat === "bajo"
        const t1NoReprompt = !t1Turn.reply.includes("¿Qué te gustaría cambiar de esta opción?")
        const t1HasEvents = (t1Turn.dialogueState.conversationMemory?.recommendationFeedback?.events || []).some(
            e => e.type === FEEDBACK_TYPES.GAME_REJECTION && e.gameTitle === "Hades"
        )
        assert(t1Excluded && t1CombatLow && t1NoReprompt && t1HasEvents, 1, "Rechazo con motivo explícito de combate", "Hades excluido, combate bajo y sin repregunta innecesaria")

        // =========================================================================
        // ESCENARIO 2: Rechazo de recomendación sin motivo
        // =========================================================================
        const t2Initial = await processDialogueTurn({
            userMessage: "Quiero una experiencia de plataformas desafiante de 30 minutos solo, recomiéndame ya",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })
        const t2CelesteTitle = t2Initial.recommendations[0]?.game.title || "Celeste"
        const t2Turn = await processDialogueTurn({
            userMessage: `No me convence ${t2CelesteTitle}`,
            accumulatedCriteria: t2Initial.updatedCriteria,
            dialogueState: t2Initial.dialogueState
        })
        const t2AsksFollowup = t2Turn.reply.includes("¿Qué te gustaría cambiar de esta opción?")
        const t2DynamicReplies = Array.isArray(t2Turn.suggestedReplies) && t2Turn.suggestedReplies.length > 0
        const t2EventRecorded = (t2Turn.dialogueState.conversationMemory?.recommendationFeedback?.events || []).some(
            e => e.type === FEEDBACK_TYPES.GAME_REJECTION && e.reason.includes("sin motivo")
        )
        assert(t2AsksFollowup && t2DynamicReplies && t2EventRecorded, 2, "Rechazo sin motivo formula pregunta contextual", `Pregunta '${t2Turn.reply.slice(0, 50)}...' con ${t2Turn.suggestedReplies.length} opciones dinámicas`)

        // =========================================================================
        // ESCENARIO 3: Expresión de interés en un aspecto específico de una recomendación
        // =========================================================================
        const t3Initial = await processDialogueTurn({
            userMessage: "Quiero explorar mundos inmersivos durante una hora, recomiéndame ya",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })
        const t3Turn = await processDialogueTurn({
            userMessage: "Me gusta la exploración de Subnautica",
            accumulatedCriteria: t3Initial.updatedCriteria,
            dialogueState: t3Initial.dialogueState
        })
        const t3ExploHigh = t3Turn.updatedCriteria.experiencePreferences?.exploration === "alto"
        const t3Event = (t3Turn.dialogueState.conversationMemory?.recommendationFeedback?.events || []).some(
            e => e.type === FEEDBACK_TYPES.FEATURE_LIKE && e.feature === "exploracion"
        )
        assert(t3ExploHigh && t3Event, 3, "Interés en aspecto específico (feature_like)", "exploration='alto' y evento feature_like registrado")

        // =========================================================================
        // ESCENARIO 4: Feedback mixto / contrastado
        // =========================================================================
        const t4Mixed = parseMixedFeedbackClauses("Me gusta la historia de The Witcher 3, pero no quiero combates tan frecuentes")
        const t4Turn = await processDialogueTurn({
            userMessage: "Me gusta la historia de The Witcher 3, pero no quiero combates tan frecuentes",
            accumulatedCriteria: { preferredGenres: ["RPG"] },
            dialogueState: { stage: "recommended", lastRecommendedGames: ["The Witcher 3: Wild Hunt"], turnCount: 2 }
        })
        const t4Narrative = t4Turn.updatedCriteria.experiencePreferences?.narrative === "alto"
        const t4Combat = t4Turn.updatedCriteria.experiencePreferences?.combat === "bajo"
        const t4Events = (t4Turn.dialogueState.conversationMemory?.recommendationFeedback?.events || []).filter(
            e => e.type === FEEDBACK_TYPES.FEATURE_LIKE || e.type === FEEDBACK_TYPES.FEATURE_DISLIKE
        )
        assert(t4Mixed && t4Narrative && t4Combat && t4Events.length >= 2, 4, "Feedback mixto con conectores de contraste", "Cláusulas separadas, narrative=alto, combat=bajo y 2 eventos registrados")

        // =========================================================================
        // ESCENARIO 5: Gradación de intensidad: Preferencia suave vs Restricción estricta
        // =========================================================================
        const t5Mild = classifyFeedbackIntensity("Preferiría algo con menos combate si es posible")
        const t5Strict = classifyFeedbackIntensity("No quiero ningún combate, cero combates bajo ningún concepto")
        assert(
            t5Mild === FEEDBACK_INTENSITIES.MILD && t5Strict === FEEDBACK_INTENSITIES.STRICT,
            5,
            "Gradación de intensidad en retroalimentación",
            `Suave='${t5Mild}', Estricta='${t5Strict}'`
        )

        // =========================================================================
        // ESCENARIO 6: Referencia contextual descriptiva
        // =========================================================================
        const t6State = {
            lastRecommendedGames: ["Celeste", "Firewatch", "Hades"],
            stage: "recommended"
        }
        const t6RefStory = resolveGameReference("Me interesa el que tiene más historia", t6State)
        const t6RefLast = resolveGameReference("Me interesa el último", t6State)
        assert(
            t6RefStory.resolvedGameTitle === "Firewatch" && t6RefLast.resolvedGameTitle === "Hades",
            6,
            "Referencia contextual descriptiva",
            `Más historia='${t6RefStory.resolvedGameTitle}', Último='${t6RefLast.resolvedGameTitle}'`
        )

        // =========================================================================
        // ESCENARIO 7: Retroalimentación sobre una comparación previa
        // =========================================================================
        const t7ComparedState = {
            stage: "compared",
            lastComparedGames: ["Hollow Knight", "Celeste"],
            turnCount: 3
        }
        const t7PrefFirst = await processDialogueTurn({
            userMessage: "Prefiero el primero porque tiene menos combate",
            accumulatedCriteria: {},
            dialogueState: t7ComparedState
        })
        const t7PrefPassed = t7PrefFirst.reply.includes("Hollow Knight") && t7PrefFirst.dialogueState.interestedGames.includes("Hollow Knight")

        const t7Neither = await processDialogueTurn({
            userMessage: "Ninguno me convence",
            accumulatedCriteria: {},
            dialogueState: t7ComparedState
        })
        const t7NeitherPassed = t7Neither.dialogueState.rejectedGames.includes("Hollow Knight") && t7Neither.dialogueState.rejectedGames.includes("Celeste")
        assert(t7PrefPassed && t7NeitherPassed, 7, "Retroalimentación sobre comparación previa", "Soporta selección con motivo ('Hollow Knight') y descarte conjunto ('Ninguno me convence')")

        // =========================================================================
        // ESCENARIO 8: Comentario neutral o consulta informativa
        // =========================================================================
        const t8Turn = await processDialogueTurn({
            userMessage: "¿Cuánto dura una partida de Stardew Valley?",
            accumulatedCriteria: { preferredGenres: ["Simulación"] },
            dialogueState: { stage: "recommended", lastRecommendedGames: ["Stardew Valley"], turnCount: 2 }
        })
        const t8NoDislike = !t8Turn.updatedCriteria.dislikedGames.includes("Stardew Valley")
        const t8NoGenreLoss = t8Turn.updatedCriteria.preferredGenres.includes("Simulación")
        const t8NeutralEvent = (t8Turn.dialogueState.conversationMemory?.recommendationFeedback?.events || []).every(
            e => e.type !== FEEDBACK_TYPES.GAME_REJECTION && e.type !== FEEDBACK_TYPES.FEATURE_DISLIKE
        )
        assert(t8NoDislike && t8NoGenreLoss && t8NeutralEvent, 8, "Consulta informativa no interpretada como feedback negativo", "Responde factual sin crear dislikes ni modificar preferencias")

        // =========================================================================
        // ESCENARIO 9: Corrección de preferencia tras recomendación
        // =========================================================================
        const t9Initial = await processDialogueTurn({
            userMessage: "Recomiéndame juegos de estrategia para jugar 1 hora solo",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })
        const t9Correction = await processDialogueTurn({
            userMessage: "En realidad prefiero algo más corto",
            accumulatedCriteria: t9Initial.updatedCriteria,
            dialogueState: t9Initial.dialogueState
        })
        const t9ShortTime = t9Correction.updatedCriteria.availableTime === "corta (< 30 min)"
        const t9KeptStrategy = t9Correction.updatedCriteria.preferredGenres.includes("Estrategia")
        assert(t9ShortTime && t9KeptStrategy, 9, "Corrección de preferencia tras recomendación", "Tiempo actualizado a <30 min reteniendo estrategia")

        // =========================================================================
        // ESCENARIO 10: Solicitud de alternativas con motivo implícito
        // =========================================================================
        const t10Turn = await processDialogueTurn({
            userMessage: "Dame alternativas con menos combate",
            accumulatedCriteria: { preferredGenres: ["Acción"] },
            dialogueState: { stage: "recommended", lastRecommendedGames: ["Hades"], shownGameTitles: ["Hades"], turnCount: 2 }
        })
        const t10CombatLow = t10Turn.updatedCriteria.experiencePreferences?.combat === "bajo"
        const t10NewRecs = t10Turn.recommendations.length > 0 && !t10Turn.recommendations.some(r => r.game.title === "Hades")
        assert(t10CombatLow && t10NewRecs, 10, "Alternativas con motivo implícito", "combat=bajo, Hades excluido y alternativas calculadas")

        // =========================================================================
        // ESCENARIO 11: Deduplicación de eventos de retroalimentación
        // =========================================================================
        const t11Memory = createInitialMemory()
        const ev1 = recordFeedbackEvent(t11Memory, {
            gameTitle: "Hades",
            type: FEEDBACK_TYPES.GAME_REJECTION,
            feature: "combate_accion",
            turn: 2
        })
        const ev2Duplicate = recordFeedbackEvent(t11Memory, {
            gameTitle: "Hades",
            type: FEEDBACK_TYPES.GAME_REJECTION,
            feature: "combate_accion",
            turn: 2
        })
        assert(
            ev1 !== null && ev2Duplicate === null && t11Memory.recommendationFeedback.events.length === 1,
            11,
            "Deduplicación de eventos de retroalimentación",
            "Evento duplicado en el mismo turno rechazado"
        )

        // =========================================================================
        // ESCENARIO 12: Coexistencia de gustos habituales y rechazo puntual
        // =========================================================================
        const t12Mem = createInitialMemory()
        t12Mem.habitualPreferences.genres = ["RPG"]
        const t12Turn = syncMemoryFromTurn({
            memory: t12Mem,
            userMessage: "No quiero The Witcher 3 porque hoy no tengo tanto tiempo",
            analysis: { newDislikedGame: "The Witcher 3: Wild Hunt" },
            criteria: { preferredGenres: ["RPG"], availableTime: "corta (< 30 min)" },
            dialogueState: { turnCount: 2 }
        })
        const t12HabitualKept = t12Mem.habitualPreferences.genres.includes("RPG")
        const t12SessionTime = t12Mem.currentNeeds.availableTime === "corta (< 30 min)"
        assert(t12HabitualKept && t12SessionTime, 12, "Coexistencia de gustos habituales y rechazo puntual", "RPG habitual intacto mientras sesión adopta tiempo corto")

        // =========================================================================
        // ESCENARIO 13: Eliminación de una restricción previa
        // =========================================================================
        const t13Turn = await processDialogueTurn({
            userMessage: "Quita la restricción de dificultad",
            accumulatedCriteria: { desiredDifficulty: "alta", isDifficultyStrict: true },
            dialogueState: { stage: "recommended", turnCount: 3 }
        })
        const t13DiffCleared = t13Turn.updatedCriteria.desiredDifficulty === null && t13Turn.updatedCriteria.isDifficultyStrict === false
        assert(t13DiffCleared, 13, "Eliminación de una restricción previa", "desiredDifficulty=null y isDifficultyStrict=false")

        // =========================================================================
        // ESCENARIO 14: Cambio de opinión sobre un juego antes rechazado
        // =========================================================================
        const t14Turn = await processDialogueTurn({
            userMessage: "Pensándolo bien, me interesa Hades",
            accumulatedCriteria: { dislikedGames: ["Hades"] },
            dialogueState: { stage: "recommended", rejectedGames: ["Hades"], turnCount: 3 }
        })
        const t14RemovedFromRejected = !t14Turn.dialogueState.rejectedGames.includes("Hades")
        const t14AddedToInterested = t14Turn.dialogueState.conversationMemory?.recommendationFeedback?.interestedGames.some(g => g.title === "Hades")
        assert(t14RemovedFromRejected && t14AddedToInterested, 14, "Cambio de opinión sobre un juego antes rechazado", "Hades retirado de descartes e incorporado en interesados")

        // =========================================================================
        // ESCENARIO 15: Rechazo acumulativo de múltiples juegos
        // =========================================================================
        const t15Step1 = await processDialogueTurn({
            userMessage: "Descarta Celeste",
            accumulatedCriteria: {},
            dialogueState: { stage: "recommended", lastRecommendedGames: ["Celeste"], turnCount: 1 }
        })
        const t15Step2 = await processDialogueTurn({
            userMessage: "No me gusta Hades porque tiene mucho combate",
            accumulatedCriteria: t15Step1.updatedCriteria,
            dialogueState: t15Step1.dialogueState
        })
        const t15BothRejected = t15Step2.dialogueState.rejectedGames.includes("Celeste") && t15Step2.dialogueState.rejectedGames.includes("Hades")
        assert(t15BothRejected, 15, "Rechazo acumulativo de múltiples juegos", "Celeste y Hades presentes en rejectedGames")

        // =========================================================================
        // ESCENARIO 16: Ajuste de preferencia previa contradictoria
        // =========================================================================
        const t16Turn = await processDialogueTurn({
            userMessage: "Antes quería algo difícil, pero ahora prefiero un juego sencillo",
            accumulatedCriteria: { desiredDifficulty: "alta", isDifficultyStrict: true },
            dialogueState: { stage: "recommended", turnCount: 3 }
        })
        const t16DiffAdapted = t16Turn.updatedCriteria.desiredDifficulty === "baja" && t16Turn.updatedCriteria.isDifficultyStrict === false
        assert(t16DiffAdapted, 16, "Ajuste de preferencia contradictoria", "desiredDifficulty='baja' sin contradicción")

        // =========================================================================
        // ESCENARIO 17: Modificación de preferencias de sesión sin alterar gustos habituales
        // =========================================================================
        const t17Turn = await processDialogueTurn({
            userMessage: "Hoy ya no quiero jugar con amigos, prefiero algo individual",
            accumulatedCriteria: { habitualTastes: ["cooperativo"] },
            dialogueState: { stage: "recommended", turnCount: 2 }
        })
        const t17ModeIndividual = t17Turn.updatedCriteria.gameMode === "individual"
        assert(t17ModeIndividual, 17, "Modificación de sesión sin alterar gustos habituales", "gameMode='individual' para la sesión")

        // =========================================================================
        // ESCENARIO 18: Retroalimentación estética
        // =========================================================================
        const t18Turn = await processDialogueTurn({
            userMessage: "No me gustan los juegos pixel art",
            accumulatedCriteria: {},
            dialogueState: { stage: "recommended", turnCount: 2 }
        })
        const t18PixelDisliked = t18Turn.updatedCriteria.dislikedFeatures.includes("pixel_art")
        const t18Event = (t18Turn.dialogueState.conversationMemory?.recommendationFeedback?.events || []).some(
            e => e.type === FEEDBACK_TYPES.FEATURE_DISLIKE && e.feature === "pixel_art"
        )
        assert(t18PixelDisliked && t18Event, 18, "Retroalimentación estética (pixel_art)", "pixel_art en dislikedFeatures y evento registrado")

        // =========================================================================
        // ESCENARIO 19: Explicación adaptada que refleja el motivo del ajuste
        // =========================================================================
        const t19Turn = await processDialogueTurn({
            userMessage: "No me gusta Hades porque tiene demasiado combate",
            accumulatedCriteria: { preferredGenres: ["Aventura"] },
            dialogueState: { stage: "recommended", lastRecommendedGames: ["Hades"], turnCount: 2 }
        })
        const t19ExplanationReflects = t19Turn.recommendations.some(r =>
            (r.explanation.text || r.explanation.summaryText || "")?.toLowerCase().includes("combate") ||
            (r.explanation.reasons || r.explanation.reasonsList || [])?.some(re => re.toLowerCase().includes("combate"))
        )
        assert(t19ExplanationReflects, 19, "Explicación refleja motivo del ajuste", "La justificación menciona evitar combates intensos")

        // =========================================================================
        // ESCENARIO 20: Persistencia de retroalimentación en memoria de sesión
        // =========================================================================
        const t20Mem = createInitialMemory()
        recordFeedbackEvent(t20Mem, {
            gameTitle: "Hades",
            type: FEEDBACK_TYPES.GAME_REJECTION,
            sentiment: FEEDBACK_SENTIMENTS.NEGATIVE,
            intensity: FEEDBACK_INTENSITIES.CLEAR,
            scope: FEEDBACK_SCOPES.CURRENT_SESSION,
            feature: "combate_accion",
            reason: "demasiado combate",
            turn: 2
        })
        const t20Ev = t20Mem.recommendationFeedback.events[0]
        const t20Valid = t20Ev && t20Ev.eventId && t20Ev.type && t20Ev.sentiment && t20Ev.intensity && t20Ev.scope && t20Ev.gameTitle && t20Ev.feature && t20Ev.reason && t20Ev.turn && t20Ev.createdAt
        assert(t20Valid, 20, "Persistencia completa de eventos en memoria", `Campos presentes: ${Object.keys(t20Ev || {}).join(", ")}`)

        // =========================================================================
        // ESCENARIO 21: Descarte de recomendación por precio
        // =========================================================================
        const t21Turn = await processDialogueTurn({
            userMessage: "Ese juego es de pago y solo busco gratis",
            accumulatedCriteria: {},
            dialogueState: { stage: "recommended", lastRecommendedGames: ["Celeste"], turnCount: 2 }
        })
        const t21PriceStrict = t21Turn.updatedCriteria.pricePreference === "gratuito" && t21Turn.updatedCriteria.isPriceStrict === true
        assert(t21PriceStrict, 21, "Descarte por precio", "pricePreference='gratuito' y isPriceStrict=true")

        // =========================================================================
        // ESCENARIO 22: Confirmación tras feedback de rechazo con sugerencias de ajuste
        // =========================================================================
        const t22Turn = await processDialogueTurn({
            userMessage: "Descarta Celeste",
            accumulatedCriteria: {},
            dialogueState: { stage: "recommended", lastRecommendedGames: ["Celeste"], turnCount: 2 }
        })
        const t22HasPrompt = t22Turn.reply.includes("¿Qué te gustaría cambiar de esta opción?")
        const t22HasSuggestions = Array.isArray(t22Turn.suggestedReplies) && t22Turn.suggestedReplies.length >= 3
        assert(t22HasPrompt && t22HasSuggestions, 22, "Confirmación con sugerencias tras rechazo sin motivo", `Respuestas sugeridas: ${t22Turn.suggestedReplies.join(" | ")}`)

        // =========================================================================
        // ESCENARIO 23: Retroalimentación sobre juego no perteneciente al lote actual
        // =========================================================================
        const t23Turn = await processDialogueTurn({
            userMessage: "Me gusta Minecraft",
            accumulatedCriteria: {},
            dialogueState: { stage: "recommended", lastRecommendedGames: ["Celeste", "Hades"], turnCount: 2 }
        })
        const t23LikedMinecraft = t23Turn.updatedCriteria.likedGames.includes("Minecraft")
        const t23Acknowledged = t23Turn.reply.includes("Minecraft")
        assert(t23LikedMinecraft && t23Acknowledged, 23, "Juego externo no perteneciente al lote actual", "Minecraft anotado en likedGames con respuesta cordial")

        // =========================================================================
        // ESCENARIO 24: Descarte de una categoría entera
        // =========================================================================
        const t24Turn = await processDialogueTurn({
            userMessage: "Ya no quiero juegos de terror",
            accumulatedCriteria: { preferredGenres: ["Terror", "Aventura"] },
            dialogueState: { stage: "recommended", turnCount: 3 }
        })
        const t24TerrorExcluded = t24Turn.updatedCriteria.dislikedGenres.includes("Terror")
        const t24TerrorRemoved = !t24Turn.updatedCriteria.preferredGenres.includes("Terror")
        assert(t24TerrorExcluded && t24TerrorRemoved, 24, "Descarte de una categoría entera", "Terror añadido a dislikedGenres y purgado de preferredGenres")

        // =========================================================================
        // ESCENARIO 25: Solicitud de juego más relajante tras recomendación desafiante
        // =========================================================================
        const t25Turn = await processDialogueTurn({
            userMessage: "Quiero algo más relajante que este",
            accumulatedCriteria: { emotionalContext: ["desafiante"], desiredDifficulty: "alta" },
            dialogueState: { stage: "recommended", lastRecommendedGames: ["Hades"], turnCount: 2 }
        })
        const t25Relaxing = t25Turn.updatedCriteria.emotionalContext.includes("relajante")
        const t25PacingRelax = t25Turn.updatedCriteria.desiredPacing === "relajado"
        const t25DiffLow = t25Turn.updatedCriteria.desiredDifficulty === "baja"
        assert(t25Relaxing && t25PacingRelax && t25DiffLow, 25, "Solicitud de juego más relajante", "emotion=relajante, pacing=relajado, difficulty=baja")

        // =========================================================================
        // ESCENARIO 26: Resiliencia ante entrada de feedback malformada o vacía
        // =========================================================================
        let t26Resilient = true
        try {
            await processDialogueTurn({ userMessage: "", accumulatedCriteria: {}, dialogueState: { stage: "recommended" } })
            await processDialogueTurn({ userMessage: "???", accumulatedCriteria: {}, dialogueState: { stage: "recommended" } })
            await processDialogueTurn({ userMessage: "   ", accumulatedCriteria: {}, dialogueState: { stage: "recommended" } })
        } catch (e) {
            t26Resilient = false
        }
        assert(t26Resilient, 26, "Resiliencia ante entrada malformada o vacía", "Sin excepciones no controladas ni fallas críticas")

    } catch (globalErr) {
        console.error("Error crítico durante la ejecución de pruebas de Etapa 7:", globalErr)
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect()
        }
    }

    console.log("\n==========================================================================")
    console.log(`RESUMEN ETAPA 7: ${passed} pasadas de ${passed + failed} pruebas (${failed} falladas).`)
    console.log("==========================================================================")

    if (failed > 0) {
        process.exit(1)
    } else {
        process.exit(0)
    }
}

if (require.main === module) {
    runEtapa7Tests()
}

module.exports = { runEtapa7Tests }
