/**
 * Batería de Pruebas Automatizadas para la Etapa 6:
 * Memoria conversacional ampliada y contextual en RecoGames.
 *
 * Contenido:
 * - 20 Escenarios obligatorios de memoria conversacional.
 * - 4 Conversaciones completas de extremo a extremo (Simulaciones A, B, C y D).
 */

const path = require("path")
const dotenv = require("dotenv")
dotenv.config({ path: path.join(__dirname, "../.env") })

const mongoose = require("mongoose")
const connectDB = require("../config/db")
const { processDialogueTurn } = require("../services/dialogueManager")
const {
    createInitialMemory,
    initConversationMemory,
    handleMemoryQuery,
    syncMemoryFromTurn,
    buildActiveCriteria,
    detectMemoryCorrectionOrDeletion,
    extractGameMotive
} = require("../services/conversationMemoryService")
const { selectNextQuestion, isQuestionResolved } = require("../services/questionSelector")

async function runEtapa6Tests() {
    console.log("==========================================================================")
    console.log("=== INICIANDO BATERÍA DE PRUEBAS ETAPA 6: MEMORIA CONVERSACIONAL       ===")
    console.log("==========================================================================")

    try {
        await connectDB()
    } catch (e) {
        console.log("Aviso: Ejecutando en modo autónomo en memoria")
    }

    let passedScenarios = 0
    let failedScenarios = 0
    const resultsSummary = []

    // Helper para recomendaciones directas
    async function setupInitialRecommendations(preferences = {}) {
        return await processDialogueTurn({
            userMessage: preferences.userMessage || "Quiero relajarme con un juego tranquilo de 30 minutos individual, recomiéndame ya",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })
    }

    // =========================================================================
    // 20 ESCENARIOS OBLIGATORIOS
    // =========================================================================

    // ESCENARIO 1: Registro de una preferencia habitual
    try {
        console.log("\n[ESCENARIO 1] Registro de una preferencia habitual")
        const res1 = await processDialogueTurn({
            userMessage: "Normalmente me gustan los juegos de rol y estrategia",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const mem = res1.dialogueState.conversationMemory
        const hasRPG = mem.habitualPreferences.genres.includes("RPG")
        const hasStrategy = mem.habitualPreferences.genres.includes("Estrategia")

        if (hasRPG && hasStrategy) {
            console.log(`✓ ESCENARIO 1 PASADO: Preferencia habitual registrada exitosamente: [${mem.habitualPreferences.genres.join(", ")}].`)
            passedScenarios++
            resultsSummary.push({ id: 1, name: "Registro de preferencia habitual", status: "PASADO" })
        } else {
            throw new Error(`Fallo en habitualPreferences.genres: ${JSON.stringify(mem?.habitualPreferences?.genres)}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 1 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 1, name: "Registro de preferencia habitual", status: "FALLIDO" })
    }

    // ESCENARIO 2: Registro de una necesidad temporal
    try {
        console.log("\n[ESCENARIO 2] Registro de una necesidad temporal")
        const res2 = await processDialogueTurn({
            userMessage: "Hoy solo tengo 30 minutos y estoy cansado para jugar",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const mem = res2.dialogueState.conversationMemory
        const isTimeShort = mem.currentNeeds.availableTime === "corta (< 30 min)"
        const isRelaxing = mem.currentNeeds.emotion.includes("relajante")

        if (isTimeShort && isRelaxing) {
            console.log(`✓ ESCENARIO 2 PASADO: Necesidad temporal registrada: tiempo='${mem.currentNeeds.availableTime}', emoción='${mem.currentNeeds.emotion.join(", ")}'.`)
            passedScenarios++
            resultsSummary.push({ id: 2, name: "Registro de necesidad temporal", status: "PASADO" })
        } else {
            throw new Error(`Fallo en currentNeeds: tiempo=${mem.currentNeeds.availableTime}, emocion=${mem.currentNeeds.emotion}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 2 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 2, name: "Registro de necesidad temporal", status: "FALLIDO" })
    }

    // ESCENARIO 3: Coexistencia de preferencias habituales y actuales diferentes
    try {
        console.log("\n[ESCENARIO 3] Coexistencia de preferencias habituales y actuales diferentes")
        const res3 = await processDialogueTurn({
            userMessage: "Normalmente me gustan los juegos difíciles, pero hoy quiero algo tranquilo",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const mem = res3.dialogueState.conversationMemory
        const habitualChallenging = mem.habitualPreferences.experiences.includes("desafiante")
        const currentRelaxing = mem.currentNeeds.emotion.includes("relajante")
        const activePacingRelaxed = res3.updatedCriteria.desiredPacing === "relajado"

        if (habitualChallenging && currentRelaxing && activePacingRelaxed) {
            console.log(`✓ ESCENARIO 3 PASADO: Coexistencia validada. Habitual='desafiante', Actual='relajante'. Criterio activo priorizó necesidad de hoy ('${res3.updatedCriteria.desiredPacing}').`)
            passedScenarios++
            resultsSummary.push({ id: 3, name: "Coexistencia habitual vs actual", status: "PASADO" })
        } else {
            throw new Error(`Fallo en coexistencia: habitual=${habitualChallenging}, actual=${currentRelaxing}, activePacing=${activePacingRelaxed}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 3 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 3, name: "Coexistencia habitual vs actual", status: "FALLIDO" })
    }

    // ESCENARIO 4: Registro de un juego disfrutado y su motivo causal
    try {
        console.log("\n[ESCENARIO 4] Registro de un juego disfrutado y su motivo causal")
        const res4 = await processDialogueTurn({
            userMessage: "Me gusta Minecraft porque puedo explorar libremente",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const mem = res4.dialogueState.conversationMemory
        const found = mem.pastExperiences.likedGames.find(g => g.title === "Minecraft")
        const hasExploration = found && (found.motive.includes("explorar") || found.features.includes("exploracion"))

        if (found && hasExploration) {
            console.log(`✓ ESCENARIO 4 PASADO: Juego '${found.title}' registrado con motivo '${found.motive}' y características [${found.features.join(", ")}].`)
            passedScenarios++
            resultsSummary.push({ id: 4, name: "Juego disfrutado con motivo causal", status: "PASADO" })
        } else {
            throw new Error(`Fallo registrando Minecraft y motivo: ${JSON.stringify(found)}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 4 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 4, name: "Juego disfrutado con motivo causal", status: "FALLIDO" })
    }

    // ESCENARIO 5: Registro de un juego rechazado y su motivo causal
    try {
        console.log("\n[ESCENARIO 5] Registro de un juego rechazado y su motivo causal")
        const res5 = await processDialogueTurn({
            userMessage: "No me gustó Dark Souls porque es demasiado frustrante",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const mem = res5.dialogueState.conversationMemory
        const found = mem.pastExperiences.dislikedGames.find(g => g.title.toLowerCase().includes("dark souls"))
        const hasFrustration = found && (found.motive.includes("frustr") || found.features.includes("combate_dificil"))

        if (found && hasFrustration) {
            console.log(`✓ ESCENARIO 5 PASADO: Juego rechazado '${found.title}' registrado con motivo '${found.motive}'.`)
            passedScenarios++
            resultsSummary.push({ id: 5, name: "Juego rechazado con motivo causal", status: "PASADO" })
        } else {
            throw new Error(`Fallo registrando Dark Souls y motivo: ${JSON.stringify(found)}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 5 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 5, name: "Juego rechazado con motivo causal", status: "FALLIDO" })
    }

    // ESCENARIO 6: Recuperación de una preferencia mencionada varios turnos atrás
    try {
        console.log("\n[ESCENARIO 6] Recuperación de una preferencia mencionada varios turnos atrás")
        const t1 = await processDialogueTurn({
            userMessage: "Tengo menos de 30 minutos disponibles hoy",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const t2 = await processDialogueTurn({
            userMessage: "Me gustan los puzzles",
            accumulatedCriteria: t1.updatedCriteria,
            dialogueState: t1.dialogueState
        })

        const t3 = await processDialogueTurn({
            userMessage: "¿Cuánto tiempo te dije que tenía para jugar?",
            accumulatedCriteria: t2.updatedCriteria,
            dialogueState: t2.dialogueState
        })

        const recallsTime = t3.reply.toLowerCase().includes("30 minutos") || t3.reply.toLowerCase().includes("menos de 30")

        if (recallsTime) {
            console.log(`✓ ESCENARIO 6 PASADO: El bot recuperó con éxito la preferencia temporal expresada 2 turnos atrás: "${t3.reply}"`)
            passedScenarios++
            resultsSummary.push({ id: 6, name: "Recuperación de preferencia previa", status: "PASADO" })
        } else {
            throw new Error(`Fallo recuperando tiempo: ${t3.reply}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 6 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 6, name: "Recuperación de preferencia previa", status: "FALLIDO" })
    }

    // ESCENARIO 7: Recuperación del motivo por el que disfrutó un videojuego
    try {
        console.log("\n[ESCENARIO 7] Recuperación del motivo por el que disfrutó un videojuego")
        const t1 = await processDialogueTurn({
            userMessage: "Me gusta Minecraft porque puedo explorar libremente",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const t2 = await processDialogueTurn({
            userMessage: "¿Recuerdas qué me gustaba de Minecraft?",
            accumulatedCriteria: t1.updatedCriteria,
            dialogueState: t1.dialogueState
        })

        const recallsMotive = t2.reply.includes("Minecraft") && (t2.reply.includes("explorar libremente") || t2.reply.includes("explorar"))

        if (recallsMotive) {
            console.log(`✓ ESCENARIO 7 PASADO: Motivo recuperado textualmente: "${t2.reply}"`)
            passedScenarios++
            resultsSummary.push({ id: 7, name: "Recuperación de motivo causal", status: "PASADO" })
        } else {
            throw new Error(`Fallo en recuperación de motivo: ${t2.reply}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 7 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 7, name: "Recuperación de motivo causal", status: "FALLIDO" })
    }

    // ESCENARIO 8: Referencia a un videojuego que anteriormente despertó interés
    try {
        console.log("\n[ESCENARIO 8] Referencia a un videojuego que anteriormente despertó interés")
        const t1 = await setupInitialRecommendations()
        const topGame = t1.dialogueState.lastRecommendedGames[0]

        const t2 = await processDialogueTurn({
            userMessage: `Me interesa ${topGame}`,
            accumulatedCriteria: t1.updatedCriteria,
            dialogueState: t1.dialogueState
        })

        const t3 = await processDialogueTurn({
            userMessage: "¿Cuál era el juego que me había interesado?",
            accumulatedCriteria: t2.updatedCriteria,
            dialogueState: t2.dialogueState
        })

        const recallsInterest = t3.reply.includes(topGame)

        if (recallsInterest) {
            console.log(`✓ ESCENARIO 8 PASADO: El bot recordó que '${topGame}' fue el título de interés.`)
            passedScenarios++
            resultsSummary.push({ id: 8, name: "Recuperación de juego de interés", status: "PASADO" })
        } else {
            throw new Error(`Fallo recuperando juego de interés: ${t3.reply}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 8 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 8, name: "Recuperación de juego de interés", status: "FALLIDO" })
    }

    // ESCENARIO 9: Corrección de género sin perder otros criterios
    try {
        console.log("\n[ESCENARIO 9] Corrección de género sin perder otros criterios")
        const t1 = await processDialogueTurn({
            userMessage: "Quiero una experiencia relajante de 30 minutos de aventura para un jugador",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const t2 = await processDialogueTurn({
            userMessage: "Antes dije aventura, pero prefiero estrategia",
            accumulatedCriteria: t1.updatedCriteria,
            dialogueState: t1.dialogueState
        })

        const hasStrategy = t2.updatedCriteria.preferredGenres.includes("Estrategia")
        const notAdventure = !t2.updatedCriteria.preferredGenres.includes("Aventura")
        const keptTime = t2.updatedCriteria.availableTime === "corta (< 30 min)"
        const keptEmotion = t2.updatedCriteria.emotionalContext.includes("relajante")

        if (hasStrategy && notAdventure && keptTime && keptEmotion) {
            console.log(`✓ ESCENARIO 9 PASADO: Género corregido a [Estrategia] reteniendo tiempo ('${t2.updatedCriteria.availableTime}') y emoción ('${t2.updatedCriteria.emotionalContext}').`)
            passedScenarios++
            resultsSummary.push({ id: 9, name: "Corrección de género con retención", status: "PASADO" })
        } else {
            throw new Error(`Fallo en corrección: strategy=${hasStrategy}, notAdv=${notAdventure}, time=${keptTime}, emo=${keptEmotion}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 9 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 9, name: "Corrección de género con retención", status: "FALLIDO" })
    }

    // ESCENARIO 10: Cambio de modalidad actual sin alterar gustos habituales
    try {
        console.log("\n[ESCENARIO 10] Cambio de modalidad actual")
        const t1 = await processDialogueTurn({
            userMessage: "Normalmente juego en cooperativo con amigos",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const t2 = await processDialogueTurn({
            userMessage: "Hoy ya no quiero jugar con amigos",
            accumulatedCriteria: t1.updatedCriteria,
            dialogueState: t1.dialogueState
        })

        const currentModeIndividual = t2.updatedCriteria.gameMode === "individual"
        const mem = t2.dialogueState.conversationMemory

        if (currentModeIndividual && mem.currentNeeds.gameMode === "individual") {
            console.log(`✓ ESCENARIO 10 PASADO: Modalidad de la sesión actualizada a individual ('${t2.updatedCriteria.gameMode}').`)
            passedScenarios++
            resultsSummary.push({ id: 10, name: "Cambio de modalidad de sesión", status: "PASADO" })
        } else {
            throw new Error(`Fallo en cambio de modalidad: ${t2.updatedCriteria.gameMode}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 10 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 10, name: "Cambio de modalidad de sesión", status: "FALLIDO" })
    }

    // ESCENARIO 11: Eliminación explícita de una preferencia ("Olvida que...")
    try {
        console.log("\n[ESCENARIO 11] Eliminación explícita de una preferencia ('Olvida que...')")
        const t1 = await processDialogueTurn({
            userMessage: "Me gustan los juegos de terror y estrategia",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const t2 = await processDialogueTurn({
            userMessage: "Olvida que quería terror",
            accumulatedCriteria: t1.updatedCriteria,
            dialogueState: t1.dialogueState
        })

        const noTerrorInCriteria = !t2.updatedCriteria.preferredGenres.includes("Terror")
        const noTerrorInMem = !t2.dialogueState.conversationMemory.currentNeeds.preferredGenres.includes("Terror")
        const confirmsDeletion = t2.reply.toLowerCase().includes("eliminado") && t2.reply.includes("Terror")

        if (noTerrorInCriteria && noTerrorInMem && confirmsDeletion) {
            console.log(`✓ ESCENARIO 11 PASADO: Preferencia 'Terror' eliminada íntegramente de memoria y criterios activos.`)
            passedScenarios++
            resultsSummary.push({ id: 11, name: "Eliminación explícita de preferencia", status: "PASADO" })
        } else {
            throw new Error(`Fallo eliminando terror: inCrit=${noTerrorInCriteria}, inMem=${noTerrorInMem}, reply=${t2.reply}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 11 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 11, name: "Eliminación explícita de preferencia", status: "FALLIDO" })
    }

    // ESCENARIO 12: Solicitud de recordar información que nunca se proporcionó
    try {
        console.log("\n[ESCENARIO 12] Solicitud de recordar información que nunca se proporcionó")
        const res12 = await processDialogueTurn({
            userMessage: "¿Recuerdas si te dije mi juego favorito?",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const acknowledgesNeverMentioned = res12.reply.toLowerCase().includes("no recuerdo") || res12.reply.toLowerCase().includes("no me has mencionado")

        if (acknowledgesNeverMentioned) {
            console.log(`✓ ESCENARIO 12 PASADO: El bot reconoció con honestidad que el dato no fue proporcionado sin inventar nada: "${res12.reply}"`)
            passedScenarios++
            resultsSummary.push({ id: 12, name: "Honestidad ante información no compartida", status: "PASADO" })
        } else {
            throw new Error(`Fallo: inventó o no reconoció ausencia: ${res12.reply}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 12 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 12, name: "Honestidad ante información no compartida", status: "FALLIDO" })
    }

    // ESCENARIO 13: Referencia ambigua que requiere aclaración
    try {
        console.log("\n[ESCENARIO 13] Referencia ambigua que requiere aclaración")
        const t1 = await processDialogueTurn({
            userMessage: "He jugado a Minecraft y a Terraria",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const t2 = await processDialogueTurn({
            userMessage: "¿Recuerdas ese juego que mencioné?",
            accumulatedCriteria: t1.updatedCriteria,
            dialogueState: t1.dialogueState
        })

        const clarifiesAmbiguity = t2.reply.includes("Minecraft") && t2.reply.includes("Terraria") && t2.reply.toLowerCase().includes("a cuál")

        if (clarifiesAmbiguity) {
            console.log(`✓ ESCENARIO 13 PASADO: Detección de ambigüedad exitosa: "${t2.reply}"`)
            passedScenarios++
            resultsSummary.push({ id: 13, name: "Aclaración ante referencia ambigua", status: "PASADO" })
        } else {
            throw new Error(`Fallo aclarando ambigüedad: ${t2.reply}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 13 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 13, name: "Aclaración ante referencia ambigua", status: "FALLIDO" })
    }

    // ESCENARIO 14: Evitar preguntas sobre información ya conocida en la memoria
    try {
        console.log("\n[ESCENARIO 14] Evitar preguntas sobre información ya conocida")
        const initialMem = createInitialMemory()
        initialMem.currentNeeds.availableTime = "corta (< 30 min)"
        initialMem.currentNeeds.gameMode = "individual"

        const stateWithMemory = {
            stage: "experience",
            questionsAsked: ["experience"],
            turnCount: 2,
            conversationMemory: initialMem
        }

        const decision = selectNextQuestion({
            criteria: { availableTime: "corta (< 30 min)", gameMode: "individual" },
            dialogueState: stateWithMemory,
            userMessage: "Quiero relajarme",
            readiness: { unaskedDimensions: ["genres"], dimensionsCount: 3 }
        })

        const didNotAskTimeOrMode = decision.questionKey !== "time" && decision.questionKey !== "mode"

        if (didNotAskTimeOrMode) {
            console.log(`✓ ESCENARIO 14 PASADO: El selector omitió preguntas redundantes de tiempo y modo, seleccionando '${decision.questionKey}'.`)
            passedScenarios++
            resultsSummary.push({ id: 14, name: "Omisión de preguntas sobre datos conocidos", status: "PASADO" })
        } else {
            throw new Error(`Fallo: preguntó sobre dimensión ya conocida: ${decision.questionKey}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 14 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 14, name: "Omisión de preguntas sobre datos conocidos", status: "FALLIDO" })
    }

    // ESCENARIO 15: Solicitud de nuevas recomendaciones usando el contexto en memoria
    try {
        console.log("\n[ESCENARIO 15] Solicitud de recomendaciones usando contexto en memoria")
        const t1 = await processDialogueTurn({
            userMessage: "Tengo 30 minutos y quiero jugar solo algo relajante",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const t2 = await processDialogueTurn({
            userMessage: "Recomiéndame según lo que hemos hablado",
            accumulatedCriteria: t1.updatedCriteria,
            dialogueState: t1.dialogueState
        })

        const deliveredRecs = t2.recommendations && t2.recommendations.length > 0
        const isRelaxingTop = t2.recommendations[0]?.game?.pacing === "relajado"

        if (deliveredRecs && isRelaxingTop) {
            console.log(`✓ ESCENARIO 15 PASADO: Recomendaciones generadas usando el contexto en memoria (Top 1: ${t2.recommendations[0].game.title}).`)
            passedScenarios++
            resultsSummary.push({ id: 15, name: "Recomendación contextual acumulada", status: "PASADO" })
        } else {
            throw new Error(`Fallo recomendando por contexto: recs=${t2.recommendations?.length}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 15 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 15, name: "Recomendación contextual acumulada", status: "FALLIDO" })
    }

    // ESCENARIO 16: Reinicio y limpieza completa de memoria
    try {
        console.log("\n[ESCENARIO 16] Reinicio y limpieza completa de memoria")
        const t1 = await setupInitialRecommendations()

        const tReset = await processDialogueTurn({
            userMessage: "reiniciar",
            accumulatedCriteria: t1.updatedCriteria,
            dialogueState: t1.dialogueState
        })

        const mem = tReset.dialogueState.conversationMemory
        const isMemClean = mem.pastExperiences.likedGames.length === 0 &&
            mem.pastExperiences.dislikedGames.length === 0 &&
            mem.recommendationFeedback.interestedGames.length === 0 &&
            mem.currentNeeds.preferredGenres.length === 0 &&
            mem.memoryLog.length === 0

        if (isMemClean && tReset.dialogueState.turnCount === 1) {
            console.log(`✓ ESCENARIO 16 PASADO: Limpieza integral de memoria completada tras reinicio.`)
            passedScenarios++
            resultsSummary.push({ id: 16, name: "Limpieza completa de memoria", status: "PASADO" })
        } else {
            throw new Error(`Fallo en reinicio de memoria: turnCount=${tReset.dialogueState.turnCount}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 16 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 16, name: "Limpieza completa de memoria", status: "FALLIDO" })
    }

    // ESCENARIO 17: Estado de memoria incompleto o malformado
    try {
        console.log("\n[ESCENARIO 17] Estado de memoria incompleto o malformado")
        const malformedMemory = {
            habitualPreferences: null,
            currentNeeds: { emotion: "not-an-array" },
            pastExperiences: undefined
        }

        const normalized = initConversationMemory(malformedMemory)
        const isSafe = Array.isArray(normalized.habitualPreferences.genres) &&
            Array.isArray(normalized.currentNeeds.emotion) &&
            Array.isArray(normalized.pastExperiences.likedGames)

        if (isSafe) {
            console.log(`✓ ESCENARIO 17 PASADO: Memoria malformada normalizada con salvaguardas robustas sin excepciones.`)
            passedScenarios++
            resultsSummary.push({ id: 17, name: "Resiliencia ante memoria malformada", status: "PASADO" })
        } else {
            throw new Error("Fallo en normalización de memoria malformada")
        }
    } catch (err) {
        console.error("✗ ESCENARIO 17 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 17, name: "Resiliencia ante memoria malformada", status: "FALLIDO" })
    }

    // ESCENARIO 18: Conversación larga con múltiples correcciones
    try {
        console.log("\n[ESCENARIO 18] Conversación larga con múltiples correcciones")
        let criteria = {}
        let state = { stage: "initial", turnCount: 0 }

        // T1: Acción individual
        const t1 = await processDialogueTurn({ userMessage: "Quiero acción para jugar solo", accumulatedCriteria: criteria, dialogueState: state })
        criteria = t1.updatedCriteria; state = t1.dialogueState

        // T2: Cambio de género a Aventura
        const t2 = await processDialogueTurn({ userMessage: "Aunque mejor algo de aventura", accumulatedCriteria: criteria, dialogueState: state })
        criteria = t2.updatedCriteria; state = t2.dialogueState

        // T3: Agrega tiempo
        const t3 = await processDialogueTurn({ userMessage: "Tengo menos de 30 minutos", accumulatedCriteria: criteria, dialogueState: state })
        criteria = t3.updatedCriteria; state = t3.dialogueState

        // T4: Cambio de modo a cooperativo
        const t4 = await processDialogueTurn({ userMessage: "Mejor cambiemos a cooperativo para jugar con amigos", accumulatedCriteria: criteria, dialogueState: state })
        criteria = t4.updatedCriteria; state = t4.dialogueState

        // T5: Recomendar
        const t5 = await processDialogueTurn({ userMessage: "Recomiéndame ya", accumulatedCriteria: criteria, dialogueState: state })

        const finalMode = t5.updatedCriteria.gameMode === "cooperativo"
        const finalTime = t5.updatedCriteria.availableTime === "corta (< 30 min)"
        const hasRecs = t5.recommendations.length > 0

        if (finalMode && finalTime && hasRecs) {
            console.log(`✓ ESCENARIO 18 PASADO: Diálogo extendido coherente. Modo='${t5.updatedCriteria.gameMode}', tiempo='${t5.updatedCriteria.availableTime}'. Recs: ${t5.recommendations.length}.`)
            passedScenarios++
            resultsSummary.push({ id: 18, name: "Conversación larga multicorrección", status: "PASADO" })
        } else {
            throw new Error(`Inconsistencia final: mode=${t5.updatedCriteria.gameMode}, time=${t5.updatedCriteria.availableTime}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 18 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 18, name: "Conversación larga multicorrección", status: "FALLIDO" })
    }

    // ESCENARIO 19: Ausencia de duplicados o crecimiento innecesario de memoria
    try {
        console.log("\n[ESCENARIO 19] Ausencia de duplicados o crecimiento innecesario")
        let criteria = {}
        let state = { stage: "initial", turnCount: 0 }

        // Mensajes repetidos sobre Minecraft
        for (let i = 0; i < 5; i++) {
            const step = await processDialogueTurn({
                userMessage: "Me gusta Minecraft porque puedo explorar libremente",
                accumulatedCriteria: criteria,
                dialogueState: state
            })
            criteria = step.updatedCriteria
            state = step.dialogueState
        }

        const mem = state.conversationMemory
        const minecraftEntries = mem.pastExperiences.likedGames.filter(g => g.title === "Minecraft")
        const logCapped = mem.memoryLog.length <= 15

        if (minecraftEntries.length === 1 && logCapped) {
            console.log(`✓ ESCENARIO 19 PASADO: Cero duplicados en títulos registrados (entradas de Minecraft: ${minecraftEntries.length}) y memoryLog acotado (longitud: ${mem.memoryLog.length}).`)
            passedScenarios++
            resultsSummary.push({ id: 19, name: "Control de tamaño y duplicados", status: "PASADO" })
        } else {
            throw new Error(`Fallo: duplicados=${minecraftEntries.length}, logSize=${mem.memoryLog.length}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 19 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 19, name: "Control de tamaño y duplicados", status: "FALLIDO" })
    }

    // ESCENARIO 20: Compatibilidad global con las etapas anteriores
    try {
        console.log("\n[ESCENARIO 20] Compatibilidad global con las etapas anteriores")
        const t1 = await setupInitialRecommendations()
        const top1 = t1.dialogueState.lastRecommendedGames[0]

        // Preguntar detalles de modo (Etapa 5)
        const t2 = await processDialogueTurn({
            userMessage: `¿Puedo jugar con amigos a ${top1}?`,
            accumulatedCriteria: t1.updatedCriteria,
            dialogueState: t1.dialogueState
        })

        const answersMode = t2.reply.toLowerCase().includes("modo") || t2.reply.toLowerCase().includes("jugador") || t2.reply.toLowerCase().includes("cooperativo")

        if (answersMode && t2.dialogueState.conversationMemory) {
            console.log(`✓ ESCENARIO 20 PASADO: Integración armónica entre feedback de Etapa 5 y memoria de Etapa 6.`)
            passedScenarios++
            resultsSummary.push({ id: 20, name: "Compatibilidad global de etapas", status: "PASADO" })
        } else {
            throw new Error(`Fallo en compatibilidad: ${t2.reply}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 20 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 20, name: "Compatibilidad global de etapas", status: "FALLIDO" })
    }

    // =========================================================================
    // 4 CONVERSACIONES COMPLETAS DE EXTREMO A EXTREMO
    // =========================================================================

    console.log("\n==========================================================================")
    console.log("=== SIMULACIÓN DE 4 CONVERSACIONES COMPLETAS MULTI-TURNO               ===")
    console.log("==========================================================================")

    let passedWalkthroughs = 0

    // CONVERSACIÓN A: Explica por qué le gusta Minecraft y luego solicita recordar ese motivo
    try {
        console.log("\n--- CONVERSACIÓN A: Motivo de Minecraft y recuperación posterior ---")
        let criteria = {}
        let state = { stage: "initial", turnCount: 0 }

        // T1: Explicar gusto y motivo
        const t1 = await processDialogueTurn({
            userMessage: "Me gusta Minecraft porque puedo explorar libremente",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t1.updatedCriteria; state = t1.dialogueState
        console.log(`T1 Bot: ${t1.reply.slice(0, 70)}...`)

        // T2: Pregunta sobre duración
        const t2 = await processDialogueTurn({
            userMessage: "Tengo 45 minutos para jugar solo",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t2.updatedCriteria; state = t2.dialogueState
        console.log(`T2 Bot: ${t2.reply.slice(0, 70)}...`)

        // T3: Solicitar recordar el motivo de Minecraft
        const t3 = await processDialogueTurn({
            userMessage: "¿Recuerdas qué me gustaba de Minecraft?",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t3.updatedCriteria; state = t3.dialogueState
        console.log(`T3 Bot: "${t3.reply}"`)

        if (t3.reply.includes("Minecraft") && (t3.reply.includes("explorar libremente") || t3.reply.includes("explorar"))) {
            passedWalkthroughs++
            console.log("✓ CONVERSACIÓN A COMPLETADA EXITOSAMENTE.")
        }
    } catch (err) {
        console.error("✗ CONVERSACIÓN A FALLIDA:", err.message)
    }

    // CONVERSACIÓN B: Disfruta habitualmente desafíos, pero hoy quiere algo relajante
    try {
        console.log("\n--- CONVERSACIÓN B: Desafíos habituales vs relax para hoy ---")
        let criteria = {}
        let state = { stage: "initial", turnCount: 0 }

        const t1 = await processDialogueTurn({
            userMessage: "Normalmente me gustan los juegos difíciles y con combate rápido, pero hoy estoy agotado y quiero algo tranquilo para desconectar",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t1.updatedCriteria; state = t1.dialogueState
        console.log(`T1 Bot: ${t1.reply.slice(0, 70)}...`)

        const t2 = await processDialogueTurn({
            userMessage: "¿Recuerdas qué suelo jugar normalmente?",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t2.updatedCriteria; state = t2.dialogueState
        console.log(`T2 Bot: "${t2.reply}"`)

        const recallsHabitual = t2.reply.toLowerCase().includes("desafiante") || t2.reply.toLowerCase().includes("dificil")
        const mentionsContrast = t2.reply.toLowerCase().includes("tranquil") || t2.reply.toLowerCase().includes("relaj")

        if (recallsHabitual && mentionsContrast) {
            passedWalkthroughs++
            console.log("✓ CONVERSACIÓN B COMPLETADA EXITOSAMENTE.")
        }
    } catch (err) {
        console.error("✗ CONVERSACIÓN B FALLIDA:", err.message)
    }

    // CONVERSACIÓN C: Rechaza recomendación, pide alternativas y pregunta qué descartó
    try {
        console.log("\n--- CONVERSACIÓN C: Rechazo, alternativas y consulta de descarte ---")
        let criteria = {}
        let state = { stage: "initial", turnCount: 0 }

        const t1 = await processDialogueTurn({
            userMessage: "Quiero un juego de acción de 30 minutos individual, recomiéndame ya",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t1.updatedCriteria; state = t1.dialogueState
        const rejectedTarget = state.lastRecommendedGames[0]
        console.log(`T1 Bot: Recomendaciones generadas. Top: ${rejectedTarget}`)

        const t2 = await processDialogueTurn({
            userMessage: `No me gusta ${rejectedTarget} porque no quiero combates intensos`,
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t2.updatedCriteria; state = t2.dialogueState
        console.log(`T2 Bot: Descarte procesado. Nuevas opciones: ${state.lastRecommendedGames.join(", ")}`)

        const t3 = await processDialogueTurn({
            userMessage: "¿Cuál fue el juego que descarté?",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t3.updatedCriteria; state = t3.dialogueState
        console.log(`T3 Bot: "${t3.reply}"`)

        if (t3.reply.includes(rejectedTarget)) {
            passedWalkthroughs++
            console.log("✓ CONVERSACIÓN C COMPLETADA EXITOSAMENTE.")
        }
    } catch (err) {
        console.error("✗ CONVERSACIÓN C FALLIDA:", err.message)
    }

    // CONVERSACIÓN D: Cambia de opinión varias veces y solicita recomendaciones con criterios válidos
    try {
        console.log("\n--- CONVERSACIÓN D: Múltiples cambios y recomendación coherente ---")
        let criteria = {}
        let state = { stage: "initial", turnCount: 0 }

        // 1. Aventura 30 min
        const t1 = await processDialogueTurn({ userMessage: "Busco aventura de 30 minutos individual", accumulatedCriteria: criteria, dialogueState: state })
        criteria = t1.updatedCriteria; state = t1.dialogueState

        // 2. Corrige género a Puzzle
        const t2 = await processDialogueTurn({ userMessage: "Antes dije aventura, pero prefiero puzzle", accumulatedCriteria: criteria, dialogueState: state })
        criteria = t2.updatedCriteria; state = t2.dialogueState

        // 3. Olvida una restricción y pide recomendar
        const t3 = await processDialogueTurn({ userMessage: "Recomiéndame según lo que hemos hablado", accumulatedCriteria: criteria, dialogueState: state })
        criteria = t3.updatedCriteria; state = t3.dialogueState
        console.log(`T3 Bot: Entregó ${t3.recommendations.length} recomendaciones: ${state.lastRecommendedGames.join(", ")}`)

        const isPuzzleOrLogic = t3.recommendations.some(r => r.game.genres.includes("Puzzle") || r.game.genres.includes("Indie"))

        if (t3.recommendations.length > 0 && isPuzzleOrLogic) {
            passedWalkthroughs++
            console.log("✓ CONVERSACIÓN D COMPLETADA EXITOSAMENTE.")
        }
    } catch (err) {
        console.error("✗ CONVERSACIÓN D FALLIDA:", err.message)
    }

    console.log("\n==========================================================================")
    console.log(" RESUMEN GENERAL DE PRUEBAS ETAPA 6                                       ")
    console.log("==========================================================================")
    console.table(resultsSummary)
    console.log(`Escenarios superados: ${passedScenarios} / 20`)
    console.log(`Simulaciones completas superadas: ${passedWalkthroughs} / 4`)

    if (mongoose.connection && mongoose.connection.readyState === 1) {
        await mongoose.disconnect()
    }

    if (failedScenarios > 0 || passedWalkthroughs < 4) {
        process.exit(1)
    } else {
        process.exit(0)
    }
}

runEtapa6Tests()
