const path = require("path")
const dotenv = require("dotenv")

dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const { processDialogueTurn } = require("../services/dialogueManager")
const { cleanText } = require("../services/nlpService")

async function runAdaptiveDialogueTests() {
    console.log("=== INICIANDO PRUEBAS DE DIÁLOGO ADAPTATIVO (ESCENARIOS A - G) ===")
    await connectDB()

    let passed = 0
    let total = 7

    // ==========================================
    // ESCENARIO A: Usuario que necesita orientación
    // ==========================================
    console.log("\n[ESCENARIO A] Usuario que necesita orientación: 'Quiero jugar algo'")
    const resA = await processDialogueTurn({
        userMessage: "Quiero jugar algo",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`Respuesta: "${resA.reply}"`)
    console.log(`Recomendaciones devueltas: ${resA.recommendations.length}`)
    console.log(`Opciones sugeridas: ${resA.suggestedReplies.length}`)

    const passedA =
        resA.recommendations.length === 0 &&
        resA.suggestedReplies.length > 0 &&
        cleanText(resA.reply).includes("experiencia")
    if (passedA) {
        console.log("-> ESCENARIO A PASADO: El asistente inició diálogo guiado sin recomendar prematuramente.")
        passed++
    } else {
        console.error("-> ESCENARIO A FALLIDO.")
    }

    // ==========================================
    // ESCENARIO B: Usuario con contexto emocional y tiempo
    // ==========================================
    console.log("\n[ESCENARIO B] Usuario con contexto emocional y tiempo: 'Estoy cansado y quiero algo tranquilo para jugar 20 minutos'")
    const resB1 = await processDialogueTurn({
        userMessage: "Estoy cansado y quiero algo tranquilo para jugar 20 minutos",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`Criterios extraídos B1:`, JSON.stringify(resB1.updatedCriteria))
    console.log(`Pregunta B1: "${resB1.reply}"`)

    const knowsEmotionAndTime =
        resB1.updatedCriteria.emotionalContext.includes("relajante") &&
        resB1.updatedCriteria.availableTime === "corta (< 30 min)"
    const cleanReplyB1 = cleanText(resB1.reply)
    const asksModeNotTime =
        resB1.dialogueState.stage === "mode" &&
        !cleanReplyB1.includes("cuanto tiempo") &&
        cleanReplyB1.includes("como prefieres jugar")

    // Turno 2: Responde la modalidad
    const resB2 = await processDialogueTurn({
        userMessage: "Prefiero jugar solo",
        accumulatedCriteria: resB1.updatedCriteria,
        dialogueState: resB1.dialogueState
    })
    console.log(`Respuesta final B2: "${resB2.reply}"`)
    console.log(`Recomendaciones B2: ${resB2.recommendations.length} juegos (Top 1: ${resB2.recommendations[0]?.game.title})`)

    const passedB =
        knowsEmotionAndTime &&
        asksModeNotTime &&
        resB2.recommendations.length > 0 &&
        ["Dorfromantik", "A Short Hike", "Gris"].includes(resB2.recommendations[0]?.game.title)

    if (passedB) {
        console.log("-> ESCENARIO B PASADO: Reconoció emoción y tiempo, preguntó solo la modalidad y recomendó con precisión.")
        passed++
    } else {
        console.error("-> ESCENARIO B FALLIDO.")
    }

    // ==========================================
    // ESCENARIO C: Usuario que proporciona varios criterios
    // ==========================================
    console.log("\n[ESCENARIO C] Usuario con varios criterios: 'Quiero un juego cooperativo de aventura para jugar con mis amigos'")
    const resC1 = await processDialogueTurn({
        userMessage: "Quiero un juego cooperativo de aventura para jugar con mis amigos",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`Criterios C1:`, JSON.stringify(resC1.updatedCriteria))
    console.log(`Pregunta C1: "${resC1.reply}"`)

    const knowsGenreAndMode =
        resC1.updatedCriteria.preferredGenres.includes("Aventura") &&
        resC1.updatedCriteria.gameMode === "cooperativo"
    const asksTime = resC1.dialogueState.stage === "time"

    const resC2 = await processDialogueTurn({
        userMessage: "Entre 30 y 60 minutos",
        accumulatedCriteria: resC1.updatedCriteria,
        dialogueState: resC1.dialogueState
    })
    console.log(`Recomendaciones C2 (Top 1: ${resC2.recommendations[0]?.game.title})`)

    const passedC =
        knowsGenreAndMode &&
        asksTime &&
        resC2.recommendations.length > 0 &&
        resC2.recommendations.every((r) => r.game.gameModes.includes("cooperativo"))

    if (passedC) {
        console.log("-> ESCENARIO C PASADO: Aprovechó género y modo cooperativo, indagó tiempo y generó opciones cooperativas.")
        passed++
    } else {
        console.error("-> ESCENARIO C FALLIDO.")
    }

    // ==========================================
    // ESCENARIO D: Usuario con preferencias negativas
    // ==========================================
    console.log("\n[ESCENARIO D] Preferencias negativas: 'Quiero algo de aventura, pero no me gustan los shooters'")
    const resD1 = await processDialogueTurn({
        userMessage: "Quiero algo de aventura, pero no me gustan los shooters",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`Criterios D1:`, JSON.stringify(resD1.updatedCriteria))

    const hasDislikeShooter = resD1.updatedCriteria.dislikedGenres.includes("FPS")

    const resD2 = await processDialogueTurn({
        userMessage: "Quiero jugar con amigos durante 1 hora",
        accumulatedCriteria: resD1.updatedCriteria,
        dialogueState: resD1.dialogueState
    })

    const noShooterRecommended = resD2.recommendations.every(
        (r) => !r.game.genres.includes("FPS") && !r.game.genres.includes("Shooter")
    )

    const passedD = hasDislikeShooter && noShooterRecommended && resD2.recommendations.length > 0
    if (passedD) {
        console.log("-> ESCENARIO D PASADO: Conservó la exclusión estricta y ningún shooter fue recomendado.")
        passed++
    } else {
        console.error("-> ESCENARIO D FALLIDO.")
    }

    // ==========================================
    // ESCENARIO E: Usuario que cambia de opinión
    // ==========================================
    console.log("\n[ESCENARIO E] Cambio de opinión: 'Mejor quiero algo más desafiante'")
    const baseCriteriaE = {
        emotionalContext: ["relajante"],
        desiredPacing: "relajado",
        availableTime: "corta (< 30 min)",
        gameMode: "individual",
        preferredGenres: [],
        dislikedGenres: [],
        similarTo: []
    }
    const baseStateE = {
        stage: "mode",
        questionsAsked: ["experience", "time", "mode"],
        turnCount: 3
    }

    const resE = await processDialogueTurn({
        userMessage: "Mejor quiero algo más desafiante",
        accumulatedCriteria: baseCriteriaE,
        dialogueState: baseStateE
    })
    console.log(`Criterios E actualizados:`, JSON.stringify(resE.updatedCriteria))
    console.log(`Recomendaciones E (Top 1: ${resE.recommendations[0]?.game.title})`)

    const switchedToChallenging =
        resE.updatedCriteria.emotionalContext.includes("desafiante") &&
        !resE.updatedCriteria.emotionalContext.includes("relajante") &&
        resE.updatedCriteria.desiredPacing === "intenso"
    const retainedTimeAndMode =
        resE.updatedCriteria.availableTime === "corta (< 30 min)" &&
        resE.updatedCriteria.gameMode === "individual"
    const topIsChallenging = ["Hades", "Dead Cells"].includes(resE.recommendations[0]?.game.title)

    const passedE = switchedToChallenging && retainedTimeAndMode && topIsChallenging
    if (passedE) {
        console.log("-> ESCENARIO E PASADO: Actualizó la emoción a desafiante reteniendo tiempo y modo, recomendando Hades/Dead Cells.")
        passed++
    } else {
        console.error("-> ESCENARIO E FALLIDO.")
    }

    // ==========================================
    // ESCENARIO F: Reinicio
    // ==========================================
    console.log("\n[ESCENARIO F] Reinicio de conversación")
    const resF = await processDialogueTurn({
        userMessage: "Hola",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`Respuesta F: "${resF.reply}"`)

    const passedF =
        resF.updatedCriteria.emotionalContext.length === 0 &&
        resF.updatedCriteria.availableTime === null &&
        resF.updatedCriteria.gameMode === null &&
        resF.dialogueState.stage === "experience" &&
        resF.suggestedReplies.length === 6

    if (passedF) {
        console.log("-> ESCENARIO F PASADO: Estado completamente limpio y reiniciado a la bienvenida inicial.")
        passed++
    } else {
        console.error("-> ESCENARIO F FALLIDO.")
    }

    // ==========================================
    // ESCENARIO G: Respuesta libre vs opciones rápidas
    // ==========================================
    console.log("\n[ESCENARIO G] Equivalencia entre opción rápida y texto libre")
    const optionRun = await processDialogueTurn({
        userMessage: "Menos de 30 minutos",
        accumulatedCriteria: {},
        dialogueState: { stage: "time", questionsAsked: ["experience"] }
    })
    const freeTextRun = await processDialogueTurn({
        userMessage: "tengo poco tiempo, como 20 minutos nada mas",
        accumulatedCriteria: {},
        dialogueState: { stage: "time", questionsAsked: ["experience"] }
    })

    const passedG =
        optionRun.updatedCriteria.availableTime === "corta (< 30 min)" &&
        freeTextRun.updatedCriteria.availableTime === "corta (< 30 min)"

    if (passedG) {
        console.log("-> ESCENARIO G PASADO: Opción rápida y texto libre producen la misma extracción semántica.")
        passed++
    } else {
        console.error("-> ESCENARIO G FALLIDO.")
    }

    console.log(`\n========================================`)
    console.log(`RESULTADOS DIÁLOGO ADAPTATIVO: ${passed}/${total} escenarios superados exitosamente.`)
    console.log(`========================================\n`)

    process.exit(passed === total ? 0 : 1)
}

runAdaptiveDialogueTests().catch((err) => {
    console.error("Error en pruebas de diálogo adaptativo:", err)
    process.exit(1)
})
