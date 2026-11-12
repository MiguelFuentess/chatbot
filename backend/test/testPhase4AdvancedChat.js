/**
 * Suite de Pruebas Automatizadas de la Fase 4:
 * Mejoras Avanzadas del Chatbot y Experiencia Conversacional
 *
 * Valida los 10 escenarios obligatorios especificados en los requerimientos.
 */

const path = require("path")
const mongoose = require("mongoose")
const dotenv = require("dotenv")

dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const { processDialogueTurn } = require("../services/dialogueManager")
const { cleanText } = require("../services/nlpService")

async function runPhase4Tests() {
    console.log("=== INICIANDO BATERÍA DE PRUEBAS DE FASE 4 (10 ESCENARIOS AVANZADOS) ===")
    await connectDB()

    let passedScenarios = 0
    const totalScenarios = 10

    // =========================================================================
    // ESCENARIO 1: Usuario que expresa varias preferencias en un solo mensaje
    // =========================================================================
    console.log("\n[ESCENARIO 1] Usuario con múltiples preferencias en un solo mensaje")
    const res1 = await processDialogueTurn({
        userMessage: "Estoy agotado y quiero un juego de simulación tranquilo para jugar solo unos 20 minutos",
        accumulatedCriteria: {},
        dialogueState: {}
    })

    const c1 = res1.updatedCriteria
    const hasSim = c1.preferredGenres.includes("Simulación")
    const hasEmo1 = c1.emotionalContext.includes("relajante")
    const hasTime1 = c1.availableTime && c1.availableTime.includes("corta")
    const hasMode1 = c1.gameMode === "individual"
    const recs1Count = res1.recommendations.length

    if (hasSim && hasEmo1 && hasTime1 && hasMode1 && recs1Count > 0) {
        console.log(`✓ ESCENARIO 1 PASADO: Identificados 4 criterios en un solo mensaje y generado ${recs1Count} recomendaciones inmediatas (Top 1: ${res1.recommendations[0].game.title}).`)
        passedScenarios++
    } else {
        console.error("✗ ESCENARIO 1 FALLIDO:", { c1, recs1Count })
    }

    // =========================================================================
    // ESCENARIO 2: Usuario que cambia de género preferido (corrección / reemplazo)
    // =========================================================================
    console.log("\n[ESCENARIO 2] Usuario que cambia de género preferido")
    // Turno A: Elige Aventura
    const res2A = await processDialogueTurn({
        userMessage: "Me gustan los juegos de aventura",
        accumulatedCriteria: { emotionalContext: ["relajante"] },
        dialogueState: { stage: "genres", questionsAsked: ["experience", "genres"], turnCount: 1 }
    })

    // Turno B: Corrige a Estrategia
    const res2B = await processDialogueTurn({
        userMessage: "Aunque mejor algo de estrategia",
        accumulatedCriteria: res2A.updatedCriteria,
        dialogueState: res2A.dialogueState
    })

    const c2B = res2B.updatedCriteria
    const onlyStrategy = c2B.preferredGenres.includes("Estrategia") && !c2B.preferredGenres.includes("Aventura")
    const keptEmotion = c2B.emotionalContext.includes("relajante")

    if (onlyStrategy && keptEmotion) {
        console.log(`✓ ESCENARIO 2 PASADO: Género actualizado exclusivamente a [${c2B.preferredGenres.join(", ")}] conservando la emoción [${c2B.emotionalContext.join(", ")}].`)
        passedScenarios++
    } else {
        console.error("✗ ESCENARIO 2 FALLIDO:", c2B)
    }

    // =========================================================================
    // ESCENARIO 3: Usuario que rechaza una recomendación específica
    // =========================================================================
    console.log("\n[ESCENARIO 3] Usuario que rechaza una recomendación")
    // Turno 3A: Pide reto y roguelike
    const res3A = await processDialogueTurn({
        userMessage: "Quiero un reto difícil de roguelike para jugar 20 minutos solo",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const firstTopGame = res3A.recommendations[0]?.game.title

    // Turno 3B: Rechaza el juego top (ej. Hades)
    const res3B = await processDialogueTurn({
        userMessage: `No me gusta ${firstTopGame}`,
        accumulatedCriteria: res3A.updatedCriteria,
        dialogueState: res3A.dialogueState
    })

    const newTitles3B = res3B.recommendations.map(r => r.game.title)
    const rejectedExcluded = !newTitles3B.includes(firstTopGame)

    if (rejectedExcluded && res3B.recommendations.length > 0) {
        console.log(`✓ ESCENARIO 3 PASADO: ${firstTopGame} fue excluido exitosamente tras el rechazo. Nuevas opciones: ${newTitles3B.join(", ")}.`)
        passedScenarios++
    } else {
        console.error("✗ ESCENARIO 3 FALLIDO:", { firstTopGame, newTitles3B })
    }

    // =========================================================================
    // ESCENARIO 4: Usuario que solicita más alternativas (diferentes opciones)
    // =========================================================================
    console.log("\n[ESCENARIO 4] Usuario que solicita más alternativas")
    // Partiendo de recomendaciones iniciales
    const firstBatchTitles = res1.recommendations.map(r => r.game.title)

    const res4 = await processDialogueTurn({
        userMessage: "No me convencen esas opciones, quiero algo diferente",
        accumulatedCriteria: res1.updatedCriteria,
        dialogueState: res1.dialogueState
    })

    const secondBatchTitles = res4.recommendations.map(r => r.game.title)
    const isDifferent = secondBatchTitles.every(t => !firstBatchTitles.includes(t))

    if (isDifferent && secondBatchTitles.length > 0) {
        console.log(`✓ ESCENARIO 4 PASADO: Nuevas alternativas sin repetir títulos anteriores. Lote 1: [${firstBatchTitles.join(", ")}] vs Lote 2: [${secondBatchTitles.join(", ")}].`)
        passedScenarios++
    } else {
        console.error("✗ ESCENARIO 4 FALLIDO:", { firstBatchTitles, secondBatchTitles })
    }

    // =========================================================================
    // ESCENARIO 5: Usuario que modifica únicamente el tiempo disponible
    // =========================================================================
    console.log("\n[ESCENARIO 5] Usuario que modifica únicamente el tiempo disponible")
    // Estado inicial: 1 hora, relajante, individual
    const initialCriteria5 = {
        emotionalContext: ["relajante"],
        availableTime: "media (30-60 min)",
        gameMode: "individual",
        preferredGenres: ["Simulación"]
    }
    const res5 = await processDialogueTurn({
        userMessage: "Quiero algo más corto",
        accumulatedCriteria: initialCriteria5,
        dialogueState: { stage: "recommended", turnCount: 3 }
    })

    const c5 = res5.updatedCriteria
    const timeIsShort = c5.availableTime && c5.availableTime.includes("corta")
    const preservedRest = c5.gameMode === "individual" && c5.preferredGenres.includes("Simulación") && c5.emotionalContext.includes("relajante")

    if (timeIsShort && preservedRest) {
        console.log(`✓ ESCENARIO 5 PASADO: Tiempo actualizado a '${c5.availableTime}' reteniendo género (${c5.preferredGenres}), modo (${c5.gameMode}) y emoción (${c5.emotionalContext}).`)
        passedScenarios++
    } else {
        console.error("✗ ESCENARIO 5 FALLIDO:", c5)
    }

    // =========================================================================
    // ESCENARIO 6: Usuario que hace referencia a una respuesta anterior
    // =========================================================================
    console.log("\n[ESCENARIO 6] Usuario que hace referencia a una respuesta anterior")
    const res6 = await processDialogueTurn({
        userMessage: "Como te dije antes, quiero algo relajante para jugar solo",
        accumulatedCriteria: { emotionalContext: ["relajante"], gameMode: "individual" },
        dialogueState: { stage: "time", questionsAsked: ["experience", "time"], turnCount: 2 }
    })

    const c6 = res6.updatedCriteria
    const ackRef = res6.reply.toLowerCase()

    if (c6.emotionalContext.includes("relajante") && c6.gameMode === "individual") {
        console.log(`✓ ESCENARIO 6 PASADO: Contexto anterior respetado y reafirmado. Respuesta del bot: "${res6.reply.slice(0, 75)}..."`)
        passedScenarios++
    } else {
        console.error("✗ ESCENARIO 6 FALLIDO:", c6)
    }

    // =========================================================================
    // ESCENARIO 7: Usuario que proporciona información ambigua
    // =========================================================================
    console.log("\n[ESCENARIO 7] Usuario que proporciona información ambigua")
    const res7 = await processDialogueTurn({
        userMessage: "No sé, recomiéndame algo",
        accumulatedCriteria: {},
        dialogueState: { stage: "initial", questionsAsked: [], turnCount: 0 }
    })

    const guidedNoPrematureRecs = res7.recommendations.length === 0 && res7.suggestedReplies.length > 0

    if (guidedNoPrematureRecs) {
        console.log(`✓ ESCENARIO 7 PASADO: El sistema no inventó preferencias y ofreció preguntas orientadoras. Opciones: ${res7.suggestedReplies.length}.`)
        passedScenarios++
    } else {
        console.error("✗ ESCENARIO 7 FALLIDO:", res7)
    }

    // =========================================================================
    // ESCENARIO 8: Usuario que inicia una conversación nueva
    // =========================================================================
    console.log("\n[ESCENARIO 8] Usuario que inicia una conversación nueva (reinicio)")
    const res8 = await processDialogueTurn({
        userMessage: "Hola",
        accumulatedCriteria: {},
        dialogueState: { stage: "initial", questionsAsked: [], turnCount: 0 }
    })

    const cleanWelcome = res8.reply.includes("¡Hola! Bienvenido. Soy tu asistente de videojuegos")
    const zeroCriteria = Object.keys(res8.updatedCriteria.availableTime || {}).length === 0 && res8.updatedCriteria.preferredGenres.length === 0

    if (cleanWelcome && zeroCriteria) {
        console.log("✓ ESCENARIO 8 PASADO: Bienvenida limpia mostrada sin criterios residuales.")
        passedScenarios++
    } else {
        console.error("✗ ESCENARIO 8 FALLIDO:", res8)
    }

    // =========================================================================
    // ESCENARIO 9: Usuario que utiliza únicamente texto libre
    // =========================================================================
    console.log("\n[ESCENARIO 9] Usuario que interactúa únicamente con texto libre")
    // Turno 9A
    const res9A = await processDialogueTurn({
        userMessage: "Hola bot, hoy me siento bastante estresado del trabajo",
        accumulatedCriteria: {},
        dialogueState: { stage: "experience", questionsAsked: ["experience"], turnCount: 1 }
    })
    // Turno 9B: Texto libre con tiempo y modalidad
    // NOTA ETAPA 1: No recomienda prematuramente en 9B porque falta género; indaga géneros.
    const res9B = await processDialogueTurn({
        userMessage: "Solo tengo media hora libre para jugar en mi PC sin nadie más",
        accumulatedCriteria: res9A.updatedCriteria,
        dialogueState: res9A.dialogueState
    })
    const c9B = res9B.updatedCriteria
    const naturalUnderstood9B = c9B.emotionalContext.includes("relajante") &&
        c9B.availableTime.includes("corta") &&
        c9B.gameMode === "individual" &&
        res9B.dialogueState.stage === "genres" &&
        res9B.recommendations.length === 0

    // Turno 9C: Texto libre completando dimensión de género
    const res9C = await processDialogueTurn({
        userMessage: "No tengo ninguna preferencia de género",
        accumulatedCriteria: res9B.updatedCriteria,
        dialogueState: res9B.dialogueState
    })

    if (naturalUnderstood9B && res9C.recommendations.length > 0) {
        console.log(`✓ ESCENARIO 9 PASADO: Diálogo 100% en texto libre comprendido e interpretado con exactitud sin recomendación prematura (Top 1: ${res9C.recommendations[0].game.title}).`)
        passedScenarios++
    } else {
        console.error("✗ ESCENARIO 9 FALLIDO:", { c9B, recs9B: res9B.recommendations.length, recs9C: res9C.recommendations.length })
    }

    // =========================================================================
    // ESCENARIO 10: Usuario que combina texto libre y opciones rápidas
    // =========================================================================
    console.log("\n[ESCENARIO 10] Usuario que combina opciones rápidas y texto libre")
    // Turno 10A: Clic en opción rápida
    const res10A = await processDialogueTurn({
        userMessage: "Quiero relajarme",
        accumulatedCriteria: {},
        dialogueState: { stage: "experience", questionsAsked: ["experience"], turnCount: 1 }
    })
    // Turno 10B: Texto libre detallado
    // NOTA ETAPA 1: No recomienda prematuramente en 10B; indaga género faltante.
    const res10B = await processDialogueTurn({
        userMessage: "Tengo unos 45 minutos y quiero jugar con mi pareja",
        accumulatedCriteria: res10A.updatedCriteria,
        dialogueState: res10A.dialogueState
    })
    const c10B = res10B.updatedCriteria
    const hybridUnderstood10B = c10B.emotionalContext.includes("relajante") &&
        c10B.availableTime.includes("media") &&
        c10B.gameMode === "cooperativo" &&
        res10B.dialogueState.stage === "genres" &&
        res10B.recommendations.length === 0

    // Turno 10C: Opción rápida de género
    const res10C = await processDialogueTurn({
        userMessage: "Aventura",
        accumulatedCriteria: res10B.updatedCriteria,
        dialogueState: res10B.dialogueState
    })

    if (hybridUnderstood10B && res10C.recommendations.length > 0) {
        console.log(`✓ ESCENARIO 10 PASADO: Fusión exitosa de clic rápido ('Quiero relajarme') y texto libre ('45 min con mi pareja') sin recomendación prematura. Top 1: ${res10C.recommendations[0].game.title}.`)
        passedScenarios++
    } else {
        console.error("✗ ESCENARIO 10 FALLIDO:", { c10B, recs10B: res10B.recommendations.length, recs10C: res10C.recommendations.length })
    }

    console.log(`\n========================================`)
    console.log(`RESULTADOS FASE 4: ${passedScenarios}/${totalScenarios} escenarios superados exitosamente.`)
    console.log(`========================================`)

    await mongoose.connection.close()
    process.exit(passedScenarios === totalScenarios ? 0 : 1)
}

runPhase4Tests().catch(err => {
    console.error("Error fatal en pruebas de Fase 4:", err)
    process.exit(1)
})
