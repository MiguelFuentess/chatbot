const path = require("path")
const dotenv = require("dotenv")

dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const { parseUserMessage } = require("../services/nlpService")
const { evaluateRecommendations } = require("../services/recommendationEngine")

async function runNLPTests() {
    console.log("=== INICIANDO PRUEBAS DE NLP Y CONVERSACIÓN ===")
    await connectDB()

    let passed = 0
    let total = 5

    // --- TEST 1: Saludo ---
    console.log("\n[TEST 1] Saludo inicial: 'Hola, buenas tardes'")
    const greetingRes = parseUserMessage("Hola, buenas tardes")
    console.log(`Intent: ${greetingRes.intent}`)
    console.log(`Respuesta: ${greetingRes.reply}`)
    if (greetingRes.intent === "greeting" && greetingRes.reply.includes("¡Hola!")) {
        console.log("-> TEST 1 PASADO: Saludo reconocido y respondido cordialmente.")
        passed++
    } else {
        console.error("-> TEST 1 FALLIDO.")
    }

    // --- TEST 2: Solicitud ambigua / vaga ---
    console.log("\n[TEST 2] Solicitud ambigua: 'Quiero jugar algo'")
    const ambigRes = parseUserMessage("Quiero jugar algo")
    console.log(`isAmbiguous: ${ambigRes.isAmbiguous}`)
    console.log(`Clarification Prompt: ${ambigRes.clarificationPrompt}`)
    if (ambigRes.isAmbiguous && ambigRes.clarificationPrompt) {
        console.log("-> TEST 2 PASADO: Solicitud ambigua detectada con pregunta aclaratoria.")
        passed++
    } else {
        console.error("-> TEST 2 FALLIDO.")
    }

    // --- TEST 3: Extracción en lenguaje natural rico ---
    console.log("\n[TEST 3] Frase rica: 'Hoy estuve agotado en el trabajo, solo tengo 30 minutos y quiero relajarme jugando solo'")
    const richRes = parseUserMessage("Hoy estuve agotado en el trabajo, solo tengo 30 minutos y quiero relajarme jugando solo")
    console.log("Criterios extraídos:", JSON.stringify(richRes.criteria, null, 2))

    const hasRelax = richRes.criteria.emotionalContext.includes("relajante")
    const hasShortTime = richRes.criteria.availableTime === "corta (< 30 min)"
    const hasSolo = richRes.criteria.gameMode === "individual"

    if (hasRelax && hasShortTime && hasSolo) {
        const recs = await evaluateRecommendations(richRes.criteria, { limit: 2 })
        console.log(`Top 1 obtenido: ${recs[0]?.game?.title} (${recs[0]?.score}%)`)
        console.log("-> TEST 3 PASADO: Emoción, tiempo y modo individual correctamente interpretados.")
        passed++
    } else {
        console.error("-> TEST 3 FALLIDO: Criterios no extraídos adecuadamente.")
    }

    // --- TEST 4: Diálogo multi-turno (acumulación de contexto) ---
    console.log("\n[TEST 4] Multi-turno: Turno 1 'Busco un cooperativo para jugar con amigos' -> Turno 2 'Pero nada de disparos'")
    const turn1 = parseUserMessage("Busco un cooperativo para jugar con amigos")
    console.log("Turno 1 Criterios:", JSON.stringify(turn1.criteria))

    const turn2 = parseUserMessage("Pero nada de disparos", turn1.criteria)
    console.log("Turno 2 Criterios acumulados:", JSON.stringify(turn2.criteria))

    const retainsCoop = turn2.criteria.gameMode === "cooperativo"
    const hasDislikeShooter = turn2.criteria.dislikedGenres.includes("FPS")

    if (retainsCoop && hasDislikeShooter) {
        console.log("-> TEST 4 PASADO: Contexto preservado y exclusión agregada entre turnos.")
        passed++
    } else {
        console.error("-> TEST 4 FALLIDO.")
    }

    // --- TEST 5: Detección de juego de referencia (similarTo) ---
    console.log("\n[TEST 5] Referencia: 'Quiero algo parecido a Minecraft'")
    const simRes = parseUserMessage("Quiero algo parecido a Minecraft")
    console.log("SimilarTo detectado:", simRes.criteria.similarTo)

    if (simRes.criteria.similarTo.includes("Minecraft")) {
        console.log("-> TEST 5 PASADO: Referencia a Minecraft extraída correctamente.")
        passed++
    } else {
        console.error("-> TEST 5 FALLIDO.")
    }

    console.log(`\n========================================`)
    console.log(`RESULTADOS NLP: ${passed}/${total} pruebas superadas exitosamente.`)
    console.log(`========================================\n`)

    process.exit(passed === total ? 0 : 1)
}

runNLPTests().catch((err) => {
    console.error("Error en pruebas NLP:", err)
    process.exit(1)
})
