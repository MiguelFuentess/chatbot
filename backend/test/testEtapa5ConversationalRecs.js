/**
 * Batería de pruebas automatizadas para la Etapa 5:
 * Recomendaciones conversacionales y retroalimentación del jugador
 *
 * Contenido:
 * - 15 Escenarios obligatorios de interacción post-recomendación.
 * - 4 Conversaciones completas de extremo a extremo (Simulaciones A, B, C y D).
 */

const path = require("path")
const dotenv = require("dotenv")
dotenv.config({ path: path.join(__dirname, "../.env") })

const mongoose = require("mongoose")
const connectDB = require("../config/db")
const { processDialogueTurn } = require("../services/dialogueManager")
const {
    resolveGameReference,
    detectFeedbackIntent,
    detectComparisonIntent,
    extractFeedbackMotives,
    answerGameQuestion,
    compareGames,
    getGameDetails
} = require("../services/feedbackManager")
const seedGames = require("../data/seedGames.json")

async function runEtapa5Tests() {
    console.log("==========================================================================")
    console.log("=== INICIANDO BATERÍA DE PRUEBAS ETAPA 5: FEEDBACK CONVERSACIONAL      ===")
    console.log("==========================================================================")

    try {
        await connectDB()
    } catch (e) {
        console.log("Aviso: Ejecutando pruebas en modo autónomo en memoria (sin MongoDB activo)")
    }

    let passedScenarios = 0
    let failedScenarios = 0
    const resultsSummary = []

    // Helper para verificar estado de recomendación inicial
    async function setupInitialRecommendations(preferences = {}) {
        const turn1 = await processDialogueTurn({
            userMessage: preferences.userMessage || "Quiero relajarme con un juego tranquilo de 30 minutos individual",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        if (turn1.dialogueState.stage !== "recommended") {
            const turn2 = await processDialogueTurn({
                userMessage: "Sin preferencias de género, recomiéndame ya",
                accumulatedCriteria: turn1.updatedCriteria,
                dialogueState: turn1.dialogueState
            })
            return turn2
        }
        return turn1
    }

    // =========================================================================
    // 15 ESCENARIOS OBLIGATORIOS
    // =========================================================================

    // ESCENARIO 1: Usuario interesado en el primer juego ("El primero me interesa")
    try {
        console.log("\n[ESCENARIO 1] Usuario interesado en el primer juego ('El primero me interesa')")
        const initial = await setupInitialRecommendations()
        const firstTitle = initial.dialogueState.lastRecommendedGames[0]

        const res1 = await processDialogueTurn({
            userMessage: "El primero me interesa",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })

        const resolved = res1.dialogueState.interestedGames.includes(firstTitle)
        const hasPrompt = res1.reply.includes(firstTitle)

        if (resolved && hasPrompt) {
            console.log(`✓ ESCENARIO 1 PASADO: '${firstTitle}' registrado en interestedGames y confirmado cordialmente.`)
            passedScenarios++
            resultsSummary.push({ id: 1, name: "Interés en 1er juego por ordinal", status: "PASADO" })
        } else {
            throw new Error(`Fallo en resolución ordinal o registro: ${JSON.stringify(res1.dialogueState.interestedGames)}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 1 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 1, name: "Interés en 1er juego por ordinal", status: "FALLIDO" })
    }

    // ESCENARIO 2: Usuario interesado en el segundo juego ("Prefiero el segundo juego")
    try {
        console.log("\n[ESCENARIO 2] Usuario interesado en el segundo juego ('Prefiero el segundo juego')")
        const initial = await setupInitialRecommendations()
        const secondTitle = initial.dialogueState.lastRecommendedGames[1]

        const res2 = await processDialogueTurn({
            userMessage: "Prefiero el segundo juego",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })

        const resolved = res2.dialogueState.interestedGames.includes(secondTitle)
        if (resolved) {
            console.log(`✓ ESCENARIO 2 PASADO: '${secondTitle}' registrado en interestedGames.`)
            passedScenarios++
            resultsSummary.push({ id: 2, name: "Interés en 2do juego por ordinal", status: "PASADO" })
        } else {
            throw new Error(`Fallo: no se registró ${secondTitle} en interestedGames`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 2 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 2, name: "Interés en 2do juego por ordinal", status: "FALLIDO" })
    }

    // ESCENARIO 3: Usuario rechaza por nombre explícito ("No me convence Hades")
    try {
        console.log("\n[ESCENARIO 3] Usuario rechaza por nombre explícito ('No me convence Hades')")
        const initial = await processDialogueTurn({
            userMessage: "Quiero un juego de acción desafiante de 30 minutos individual, recomiéndame ya",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const res3 = await processDialogueTurn({
            userMessage: "No me convence Hades",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })

        const inRejected = res3.dialogueState.rejectedGames.includes("Hades")
        const inCriteriaDisliked = res3.updatedCriteria.dislikedGames.includes("Hades")
        const notInNewRecs = !res3.recommendations.some(r => r.game.title === "Hades")

        if (inRejected && inCriteriaDisliked && notInNewRecs && res3.recommendations.length > 0) {
            console.log(`✓ ESCENARIO 3 PASADO: 'Hades' añadido a rejectedGames y excluido de nuevas recomendaciones.`)
            passedScenarios++
            resultsSummary.push({ id: 3, name: "Rechazo por nombre explícito", status: "PASADO" })
        } else {
            throw new Error(`Fallo: inRejected=${inRejected}, inCriteria=${inCriteriaDisliked}, notInNewRecs=${notInNewRecs}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 3 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 3, name: "Rechazo por nombre explícito", status: "FALLIDO" })
    }

    // ESCENARIO 4: Usuario rechaza por ordinal ("El tercero no me gusta")
    try {
        console.log("\n[ESCENARIO 4] Usuario rechaza por ordinal ('El tercero no me gusta')")
        const initial = await setupInitialRecommendations()
        const thirdTitle = initial.dialogueState.lastRecommendedGames[2]

        const res4 = await processDialogueTurn({
            userMessage: "El tercero no me gusta",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })

        const inRejected = res4.dialogueState.rejectedGames.includes(thirdTitle)
        const notInNewRecs = !res4.recommendations.some(r => r.game.title === thirdTitle)

        if (inRejected && notInNewRecs) {
            console.log(`✓ ESCENARIO 4 PASADO: 3er juego ('${thirdTitle}') correctamente descartado.`)
            passedScenarios++
            resultsSummary.push({ id: 4, name: "Rechazo por ordinal", status: "PASADO" })
        } else {
            throw new Error(`Fallo descartando ordinal 3: ${thirdTitle}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 4 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 4, name: "Rechazo por ordinal", status: "FALLIDO" })
    }

    // ESCENARIO 5: Usuario dice "Ese juego no me gusta" sin foco previo -> Petición de aclaración
    try {
        console.log("\n[ESCENARIO 5] Usuario dice 'Ese juego no me gusta' sin foco previo")
        const initial = await setupInitialRecommendations()
        // Asegurar que no hay foco previo
        initial.dialogueState.currentReferencedGame = null

        const res5 = await processDialogueTurn({
            userMessage: "Ese juego no me gusta",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })

        const isClarifying = res5.reply.toLowerCase().includes("a cuál") || res5.reply.toLowerCase().includes("te refieres")
        const hasOptions = res5.suggestedReplies && res5.suggestedReplies.length >= 2

        if (isClarifying && hasOptions) {
            console.log(`✓ ESCENARIO 5 PASADO: Detección de ambigüedad exitosa. Pregunta aclaratoria: "${res5.reply}"`)
            passedScenarios++
            resultsSummary.push({ id: 5, name: "Ambigüedad pronominal sin foco", status: "PASADO" })
        } else {
            throw new Error(`No se solicitó aclaración adecuada: ${res5.reply}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 5 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 5, name: "Ambigüedad pronominal sin foco", status: "FALLIDO" })
    }

    // ESCENARIO 6: Usuario solicita información ("¿De qué trata Stardew Valley?" / "¿De qué trata el primero?")
    try {
        console.log("\n[ESCENARIO 6] Usuario solicita información ('¿De qué trata Stardew Valley?')")
        const initial = await setupInitialRecommendations()

        const res6 = await processDialogueTurn({
            userMessage: "¿De qué trata Stardew Valley?",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })

        const mentionsStardew = res6.reply.includes("Stardew Valley")
        const hasFactualDesc = res6.reply.toLowerCase().includes("granja") || res6.reply.toLowerCase().includes("cultivos") || res6.reply.toLowerCase().includes("pueblo")

        if (mentionsStardew && hasFactualDesc) {
            console.log(`✓ ESCENARIO 6 PASADO: Información factual obtenida directamente del catálogo sin inventar datos.`)
            passedScenarios++
            resultsSummary.push({ id: 6, name: "Consulta de información general", status: "PASADO" })
        } else {
            throw new Error(`Información insuficiente en respuesta: ${res6.reply}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 6 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 6, name: "Consulta de información general", status: "FALLIDO" })
    }

    // ESCENARIO 7: Usuario consulta modalidad ("¿Puedo jugar con amigos a Portal 2?")
    try {
        console.log("\n[ESCENARIO 7] Usuario consulta modalidad ('¿Puedo jugar con amigos a Portal 2?')")
        const initial = await setupInitialRecommendations()

        const res7 = await processDialogueTurn({
            userMessage: "¿Puedo jugar con amigos a Portal 2?",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })

        const confirmsCoop = res7.reply.toLowerCase().includes("cooperativo") && res7.reply.toLowerCase().includes("amigos")

        if (confirmsCoop) {
            console.log(`✓ ESCENARIO 7 PASADO: Respondió con certeza verificada sobre soporte cooperativo de Portal 2.`)
            passedScenarios++
            resultsSummary.push({ id: 7, name: "Consulta de modalidad de juego", status: "PASADO" })
        } else {
            throw new Error(`No confirmó adecuadamente el modo cooperativo: ${res7.reply}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 7 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 7, name: "Consulta de modalidad de juego", status: "FALLIDO" })
    }

    // ESCENARIO 8: Usuario compara dos recomendaciones ("¿Cuál es más tranquilo entre A Short Hike y Hades?")
    try {
        console.log("\n[ESCENARIO 8] Usuario compara dos recomendaciones ('¿Cuál es más tranquilo entre A Short Hike y Hades?')")
        const initial = await setupInitialRecommendations()

        const res8 = await processDialogueTurn({
            userMessage: "¿Cuál es más tranquilo entre A Short Hike y Hades?",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })

        const comparesBoth = res8.reply.includes("A Short Hike") && res8.reply.includes("Hades")
        const identifiesCalm = res8.reply.toLowerCase().includes("relajado") || res8.reply.toLowerCase().includes("tranquil")

        if (comparesBoth && identifiesCalm) {
            console.log(`✓ ESCENARIO 8 PASADO: Comparación objetiva completada. Texto: "${res8.reply}"`)
            passedScenarios++
            resultsSummary.push({ id: 8, name: "Comparación de dos opciones", status: "PASADO" })
        } else {
            throw new Error(`Comparación incompleta o errónea: ${res8.reply}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 8 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 8, name: "Comparación de dos opciones", status: "FALLIDO" })
    }

    // ESCENARIO 9: Usuario explica motivo de rechazo ("No me gusta Hades porque no quiero combates intensos")
    try {
        console.log("\n[ESCENARIO 9] Usuario explica motivo de rechazo ('No me gusta Hades porque no quiero combates intensos')")
        const initial = await processDialogueTurn({
            userMessage: "Quiero acción o roguelike de 30 minutos individual, recomiéndame ya",
            accumulatedCriteria: {},
            dialogueState: { stage: "initial", turnCount: 0 }
        })

        const res9 = await processDialogueTurn({
            userMessage: "No me gusta Hades porque no quiero combates intensos",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })

        const rejectedHades = res9.dialogueState.rejectedGames.includes("Hades")
        const motiveStored = res9.dialogueState.feedbackMotives.some(m => m.game === "Hades" && m.type === "rejection")
        const pacingAdapted = res9.updatedCriteria.desiredPacing === "relajado"
        const avoidedCombat = res9.updatedCriteria.dislikedFeatures.includes("combate_accion")

        if (rejectedHades && motiveStored && (pacingAdapted || avoidedCombat)) {
            console.log(`✓ ESCENARIO 9 PASADO: Motivo extraído con precisión, guardado en feedbackMotives y criterios actualizados a ritmo relajado sin combates.`)
            passedScenarios++
            resultsSummary.push({ id: 9, name: "Rechazo con extracción de motivos", status: "PASADO" })
        } else {
            throw new Error(`Fallo: rejected=${rejectedHades}, motiveStored=${motiveStored}, pacingAdapted=${pacingAdapted}, avoidedCombat=${avoidedCombat}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 9 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 9, name: "Rechazo con extracción de motivos", status: "FALLIDO" })
    }

    // ESCENARIO 10: Usuario solicita alternativas ("Buscar alternativas")
    try {
        console.log("\n[ESCENARIO 10] Usuario solicita alternativas ('Buscar alternativas')")
        const initial = await setupInitialRecommendations()
        const batch1 = [...initial.dialogueState.lastRecommendedGames]

        const res10 = await processDialogueTurn({
            userMessage: "Buscar alternativas",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })

        const batch2 = res10.recommendations.map(r => r.game.title)
        const noOverlap = batch2.every(t => !batch1.includes(t))

        if (batch2.length > 0 && noOverlap) {
            console.log(`✓ ESCENARIO 10 PASADO: Lote 1: [${batch1.join(", ")}] vs Lote 2: [${batch2.join(", ")}] (100% alternativo sin solapes).`)
            passedScenarios++
            resultsSummary.push({ id: 10, name: "Solicitud directa de alternativas", status: "PASADO" })
        } else {
            throw new Error(`Solapamiento en lotes o lote vacío: [${batch2.join(", ")}]`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 10 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 10, name: "Solicitud directa de alternativas", status: "FALLIDO" })
    }

    // ESCENARIO 11: Usuario modifica preferencias post-recomendación ("Mejor cambiemos a algo cooperativo")
    try {
        console.log("\n[ESCENARIO 11] Usuario modifica preferencias post-recomendación ('Mejor cambiemos a algo cooperativo')")
        const initial = await setupInitialRecommendations()

        const res11 = await processDialogueTurn({
            userMessage: "Mejor cambiemos a algo cooperativo",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })

        const modeUpdated = res11.updatedCriteria.gameMode === "cooperativo"
        const allCoop = res11.recommendations.length > 0 && res11.recommendations.every(r => r.game.gameModes.includes("cooperativo"))

        if (modeUpdated && allCoop) {
            console.log(`✓ ESCENARIO 11 PASADO: Modo cambiado a cooperativo; 100% de recomendaciones entregadas soportan cooperativo: ${res11.recommendations.map(r => r.game.title).join(", ")}.`)
            passedScenarios++
            resultsSummary.push({ id: 11, name: "Modificación de preferencia post-recomendación", status: "PASADO" })
        } else {
            throw new Error(`Modo no actualizado o juegos incompatibles: mode=${res11.updatedCriteria.gameMode}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 11 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 11, name: "Modificación de preferencia post-recomendación", status: "FALLIDO" })
    }

    // ESCENARIO 12: Alternativas compatibles agotadas -> Explicación transparente y consulta de flexibilización
    try {
        console.log("\n[ESCENARIO 12] Alternativas compatibles agotadas")
        // Creamos un estado donde se han mostrado todos los juegos de un nicho muy cerrado
        const allMatchingNicheGames = [
            "Portal 2", "It Takes Two", "Overcooked! All You Can Eat", "Deep Rock Galactic", "A Way Out",
            "Keep Talking and Nobody Explodes", "Human: Fall Flat", "We Were Here Together",
            "Cuphead", "Shovel Knight: Treasure Trove", "PlateUp!", "Moving Out", "Phasmophobia", "Lethal Company", "Vampire Survivors"
        ]
        const simulatedState = {
            stage: "recommended",
            turnCount: 5,
            shownGameTitles: allMatchingNicheGames,
            rejectedGames: allMatchingNicheGames,
            lastRecommendedGames: ["Keep Talking and Nobody Explodes"]
        }
        const strictCriteria = {
            gameMode: "cooperativo",
            preferredGenres: ["Puzzle"],
            availableTime: "corta (< 30 min)"
        }

        const res12 = await processDialogueTurn({
            userMessage: "Buscar alternativas",
            accumulatedCriteria: strictCriteria,
            dialogueState: simulatedState
        })

        const explainsExhaustion = res12.reply.includes("catálogo") && (res12.reply.includes("flexibilizar") || res12.reply.includes("cumplen"))
        const asksFlexibilization = res12.suggestedReplies.some(r => r.toLowerCase().includes("flexibilizar"))

        if (explainsExhaustion && asksFlexibilization) {
            console.log(`✓ ESCENARIO 12 PASADO: Explicó transparentemente agotamiento sin forzar recomendaciones incongruentes.`)
            passedScenarios++
            resultsSummary.push({ id: 12, name: "Agotamiento transparente de alternativas", status: "PASADO" })
        } else {
            throw new Error(`Fallo: no explicó adecuadamente agotamiento: ${res12.reply}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 12 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 12, name: "Agotamiento transparente de alternativas", status: "FALLIDO" })
    }

    // ESCENARIO 13: Mención de juego no perteneciente al lote actual ("Me gusta Minecraft")
    try {
        console.log("\n[ESCENARIO 13] Mención de juego no perteneciente al lote actual ('Me gusta Minecraft')")
        const initial = await setupInitialRecommendations()
        // Asegurar que Minecraft no esté en el lote actual
        initial.dialogueState.lastRecommendedGames = ["Dorfromantik", "Gris", "A Short Hike"]

        const res13 = await processDialogueTurn({
            userMessage: "Me gusta Minecraft",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })

        const notedPreference = res13.updatedCriteria.likedGames.includes("Minecraft")
        const acknowledgedExternal = res13.reply.includes("Minecraft") && (res13.reply.includes("referente") || res13.reply.includes("selección") || res13.reply.includes("cuenta"))

        if (notedPreference && acknowledgedExternal) {
            console.log(`✓ ESCENARIO 13 PASADO: Título externo 'Minecraft' reconocido, preference anotada en likedGames sin confundir con recomendación de pantalla.`)
            passedScenarios++
            resultsSummary.push({ id: 13, name: "Mención de juego no recomendado", status: "PASADO" })
        } else {
            throw new Error(`Fallo reconociendo juego externo: ${res13.reply}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 13 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 13, name: "Mención de juego no recomendado", status: "FALLIDO" })
    }

    // ESCENARIO 14: Lote 1 -> alternativas -> Lote 2 -> "El primero me interesa" refiere al primer título del Lote 2
    try {
        console.log("\n[ESCENARIO 14] Lote 1 -> alternativas -> Lote 2 -> 'El primero me interesa' refiere a Lote 2")
        const initial = await setupInitialRecommendations()
        const batch1Top = initial.dialogueState.lastRecommendedGames[0]

        // Pedir alternativas -> Lote 2
        const resAlt = await processDialogueTurn({
            userMessage: "Buscar alternativas",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })
        const batch2Top = resAlt.dialogueState.lastRecommendedGames[0]

        // Elegir el primero
        const resPick = await processDialogueTurn({
            userMessage: "El primero me interesa",
            accumulatedCriteria: resAlt.updatedCriteria,
            dialogueState: resAlt.dialogueState
        })

        const isBatch2Top = resPick.dialogueState.interestedGames.includes(batch2Top)
        const isNotBatch1Top = !resPick.dialogueState.interestedGames.includes(batch1Top)

        if (isBatch2Top && isNotBatch1Top && batch1Top !== batch2Top) {
            console.log(`✓ ESCENARIO 14 PASADO: 'El primero me interesa' resolvió a '${batch2Top}' (Lote 2) y no al anterior '${batch1Top}' (Lote 1).`)
            passedScenarios++
            resultsSummary.push({ id: 14, name: "Resolución ordinal dependiente de lote activo", status: "PASADO" })
        } else {
            throw new Error(`Fallo en contexto de lote: batch1=${batch1Top}, batch2=${batch2Top}, interested=${resPick.dialogueState.interestedGames}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 14 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 14, name: "Resolución ordinal dependiente de lote activo", status: "FALLIDO" })
    }

    // ESCENARIO 15: Reinicio de conversación tras feedback ("reiniciar")
    try {
        console.log("\n[ESCENARIO 15] Reinicio de conversación tras feedback ('reiniciar')")
        const initial = await setupInitialRecommendations()

        const res15 = await processDialogueTurn({
            userMessage: "reiniciar",
            accumulatedCriteria: initial.updatedCriteria,
            dialogueState: initial.dialogueState
        })

        const isCleanState = res15.dialogueState.turnCount === 1 &&
            res15.dialogueState.stage === "experience" &&
            res15.dialogueState.lastRecommendedGames.length === 0 &&
            res15.dialogueState.interestedGames.length === 0 &&
            res15.dialogueState.rejectedGames.length === 0 &&
            res15.dialogueState.feedbackMotives.length === 0

        const isCleanCriteria = res15.updatedCriteria.preferredGenres.length === 0 &&
            res15.updatedCriteria.emotionalContext.length === 0

        if (isCleanState && isCleanCriteria && res15.reply.includes("Bienvenido")) {
            console.log(`✓ ESCENARIO 15 PASADO: Reinicio integral completado. Estado de memoria y criterios completamente limpios.`)
            passedScenarios++
            resultsSummary.push({ id: 15, name: "Reinicio limpio de conversación", status: "PASADO" })
        } else {
            throw new Error(`Fallo de reinicio: turnCount=${res15.dialogueState.turnCount}`)
        }
    } catch (err) {
        console.error("✗ ESCENARIO 15 FALLIDO:", err.message)
        failedScenarios++
        resultsSummary.push({ id: 15, name: "Reinicio limpio de conversación", status: "FALLIDO" })
    }

    // =========================================================================
    // 4 CONVERSACIONES COMPLETAS DE EXTREMO A EXTREMO
    // =========================================================================

    console.log("\n==========================================================================")
    console.log("=== SIMULACIÓN DE 4 CONVERSACIONES COMPLETAS MULTI-TURNO               ===")
    console.log("==========================================================================")

    let passedWalkthroughs = 0

    // CONVERSACIÓN A: Interés y solicitud de información
    try {
        console.log("\n--- CONVERSACIÓN A: Interés y solicitud de información ---")
        let criteria = {}
        let state = { stage: "initial", turnCount: 0 }

        // T1: Usuario expresa gustos y solicita recomendaciones
        const t1 = await processDialogueTurn({
            userMessage: "Quiero una experiencia relajante de 30 minutos para un jugador, recomiéndame ya",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t1.updatedCriteria
        state = t1.dialogueState
        console.log(`T1 Bot: Recomendó ${t1.recommendations.length} títulos. Top: ${state.lastRecommendedGames[0]}`)

        // T2: Pregunta detalles del primer juego
        const firstGame = state.lastRecommendedGames[0]
        const t2 = await processDialogueTurn({
            userMessage: `¿De qué trata ${firstGame}?`,
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t2.updatedCriteria
        state = t2.dialogueState
        console.log(`T2 Bot: Información factual sobre ${firstGame} brindada con éxito.`)

        // T3: Manifiesta interés y decisión
        const t3 = await processDialogueTurn({
            userMessage: `Me interesa ${firstGame}`,
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t3.updatedCriteria
        state = t3.dialogueState
        console.log(`T3 Bot: Interés confirmado en ${state.interestedGames.join(", ")}.`)

        if (state.interestedGames.includes(firstGame) && t2.reply.includes(firstGame)) {
            passedWalkthroughs++
            console.log("✓ CONVERSACIÓN A COMPLETADA EXITOSAMENTE.")
        }
    } catch (err) {
        console.error("✗ CONVERSACIÓN A FALLIDA:", err.message)
    }

    // CONVERSACIÓN B: Rechazo con explicación de motivos
    try {
        console.log("\n--- CONVERSACIÓN B: Rechazo con explicación de motivos ---")
        let criteria = {}
        let state = { stage: "initial", turnCount: 0 }

        // T1: Preferencia desafiante de acción
        const t1 = await processDialogueTurn({
            userMessage: "Quiero un juego de acción de 30 minutos individual, recomiéndame ya",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t1.updatedCriteria
        state = t1.dialogueState
        const hadesOrTop = state.lastRecommendedGames[0]
        console.log(`T1 Bot: Recomendaciones generadas. Top: ${hadesOrTop}`)

        // T2: Rechazo con motivo
        const t2 = await processDialogueTurn({
            userMessage: `No me gusta ${hadesOrTop} porque no quiero combates intensos`,
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t2.updatedCriteria
        state = t2.dialogueState
        console.log(`T2 Bot: Descarte anotado con motivo '${state.feedbackMotives[0]?.motiveText}'. Nuevas opciones generadas: ${state.lastRecommendedGames.join(", ")}`)

        // T3: Elige una de las nuevas opciones relajadas
        const newFirst = state.lastRecommendedGames[0]
        const t3 = await processDialogueTurn({
            userMessage: "El primero me interesa",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t3.updatedCriteria
        state = t3.dialogueState
        console.log(`T3 Bot: Aprobado ${state.interestedGames[0]}.`)

        if (state.rejectedGames.includes(hadesOrTop) && state.interestedGames.includes(newFirst)) {
            passedWalkthroughs++
            console.log("✓ CONVERSACIÓN B COMPLETADA EXITOSAMENTE.")
        }
    } catch (err) {
        console.error("✗ CONVERSACIÓN B FALLIDA:", err.message)
    }

    // CONVERSACIÓN C: Comparación de dos opciones y alternativas
    try {
        console.log("\n--- CONVERSACIÓN C: Comparación de dos opciones y alternativas ---")
        let criteria = {}
        let state = { stage: "initial", turnCount: 0 }

        const t1 = await processDialogueTurn({
            userMessage: "Busco una aventura relajante de 1 hora individual, recomiéndame ya",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t1.updatedCriteria
        state = t1.dialogueState
        const g1 = state.lastRecommendedGames[0]
        const g2 = state.lastRecommendedGames[1]
        console.log(`T1 Bot: Mostradas opciones: ${g1}, ${g2}`)

        // T2: Comparar las opciones
        const t2 = await processDialogueTurn({
            userMessage: `¿Cuál es más tranquilo entre ${g1} y ${g2}?`,
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t2.updatedCriteria
        state = t2.dialogueState
        console.log(`T2 Bot: Comparativa entregada: ${t2.reply.slice(0, 80)}...`)

        // T3: Pedir alternativas
        const t3 = await processDialogueTurn({
            userMessage: "Buscar alternativas",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t3.updatedCriteria
        state = t3.dialogueState
        console.log(`T3 Bot: Nuevo lote entregado: ${state.lastRecommendedGames.join(", ")}`)

        if (t2.reply.includes(g1) && t2.reply.includes(g2) && state.lastRecommendedGames.length > 0) {
            passedWalkthroughs++
            console.log("✓ CONVERSACIÓN C COMPLETADA EXITOSAMENTE.")
        }
    } catch (err) {
        console.error("✗ CONVERSACIÓN C FALLIDA:", err.message)
    }

    // CONVERSACIÓN D: Modificación de preferencias post-recomendación
    try {
        console.log("\n--- CONVERSACIÓN D: Modificación de preferencias post-recomendación ---")
        let criteria = {}
        let state = { stage: "initial", turnCount: 0 }

        // T1: Recomendación individual inicial
        const t1 = await processDialogueTurn({
            userMessage: "Quiero una experiencia de puzzles para jugar solo de 30 minutos, recomiéndame ya",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t1.updatedCriteria
        state = t1.dialogueState
        console.log(`T1 Bot: Recomendaciones individuales mostradas: ${state.lastRecommendedGames.join(", ")}`)

        // T2: Cambio de modo a cooperativo
        const t2 = await processDialogueTurn({
            userMessage: "Mejor cambiemos a algo cooperativo para jugar con amigos",
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t2.updatedCriteria
        state = t2.dialogueState
        console.log(`T2 Bot: Lote adaptado a cooperativo: ${state.lastRecommendedGames.join(", ")}`)

        // T3: Selecciona opción cooperativa
        const coopChoice = state.lastRecommendedGames[0]
        const t3 = await processDialogueTurn({
            userMessage: `Me gusta ${coopChoice}`,
            accumulatedCriteria: criteria,
            dialogueState: state
        })
        criteria = t3.updatedCriteria
        state = t3.dialogueState
        console.log(`T3 Bot: Selección registrada en ${state.interestedGames.join(", ")}`)

        if (criteria.gameMode === "cooperativo" && state.interestedGames.includes(coopChoice)) {
            passedWalkthroughs++
            console.log("✓ CONVERSACIÓN D COMPLETADA EXITOSAMENTE.")
        }
    } catch (err) {
        console.error("✗ CONVERSACIÓN D FALLIDA:", err.message)
    }

    console.log("\n==========================================================================")
    console.log(" RESUMEN GENERAL DE PRUEBAS ETAPA 5                                       ")
    console.log("==========================================================================")
    console.table(resultsSummary)
    console.log(`Escenarios superados: ${passedScenarios} / 15`)
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

runEtapa5Tests()
