const path = require("path")
const dotenv = require("dotenv")

dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const { evaluateRecommendations } = require("../services/recommendationEngine")
const { generateExplanation } = require("../services/explanationService")

async function runTests() {
    console.log("=== INICIANDO BATERÍA DE PRUEBAS DEL MOTOR DE RECOMENDACIÓN ===")
    await connectDB()

    let passed = 0
    let total = 4

    // --- TEST 1: Relajación y tiempo corto ---
    console.log("\n[TEST 1] Perfil: Jugador cansado que busca relajarse con poco tiempo (< 30 min)")
    const p1 = {
        emotionalContext: ["cansado", "relajante"],
        availableTime: "corta (< 30 min)",
        desiredPacing: "relajado"
    }
    const r1 = await evaluateRecommendations(p1, { limit: 3 })
    const top1 = r1[0]
    console.log(`Top 1 recomendado: ${top1.game.title} (Score: ${top1.score}%)`)
    const expl1 = generateExplanation(top1, p1)
    console.log(`Justificación: ${expl1.summaryText}`)

    if (top1.score >= 80 && ["Dorfromantik", "A Short Hike", "Gris"].includes(top1.game.title)) {
        console.log("-> TEST 1 PASADO: Título relajante de sesión corta correctamente priorizado.")
        passed++
    } else {
        console.error("-> TEST 1 FALLIDO: Puntuación o selección no esperada.")
    }

    // --- TEST 2: Reto, adrenalina y roguelike ---
    console.log("\n[TEST 2] Perfil: Jugador buscando reto, acción y roguelike en sesiones cortas")
    const p2 = {
        preferredGenres: ["Acción", "Roguelike"],
        emotionalContext: ["desafiante", "estimulante"],
        availableTime: "corta (< 30 min)",
        desiredPacing: "intenso"
    }
    const r2 = await evaluateRecommendations(p2, { limit: 3 })
    const top2 = r2[0]
    console.log(`Top 1 recomendado: ${top2.game.title} (Score: ${top2.score}%)`)
    const expl2 = generateExplanation(top2, p2)
    console.log(`Justificación: ${expl2.summaryText}`)

    if (["Hades", "Dead Cells"].includes(top2.game.title)) {
        console.log("-> TEST 2 PASADO: Hades o Dead Cells posicionado como primer candidato.")
        passed++
    } else {
        console.error("-> TEST 2 FALLIDO.")
    }

    // --- TEST 3: Cooperativo con amigos ---
    console.log("\n[TEST 3] Perfil: Juego para jugar en cooperativo con amigos")
    const p3 = {
        gameMode: "cooperativo",
        emotionalContext: ["amigos", "divertido"]
    }
    const r3 = await evaluateRecommendations(p3, { limit: 5 })
    console.log("Recomendaciones obtenidas:")
    r3.forEach((item, i) => console.log(`  ${i + 1}. ${item.game.title} (Modos: ${item.game.gameModes.join(", ")})`))

    const allCoop = r3.every((item) => item.game.gameModes.includes("cooperativo"))
    if (allCoop && r3.length > 0) {
        console.log("-> TEST 3 PASADO: El 100% de los resultados soporta cooperativo.")
        passed++
    } else {
        console.error("-> TEST 3 FALLIDO: Se incluyeron juegos individuales en solicitud cooperativa.")
    }

    // --- TEST 4: Exclusión estricta de géneros (Dislikes) y similitud ---
    console.log("\n[TEST 4] Perfil: Supervivencia similar a Minecraft, con exclusión de FPS y Shooter")
    const p4 = {
        preferredGenres: ["Supervivencia"],
        dislikedGenres: ["FPS", "Shooter"],
        similarTo: ["Minecraft"]
    }
    const r4 = await evaluateRecommendations(p4, { limit: 5 })
    console.log("Recomendaciones obtenidas:")
    r4.forEach((item, i) => console.log(`  ${i + 1}. ${item.game.title} (Géneros: ${item.game.genres.join(", ")})`))

    const hasNoShooter = r4.every(
        (item) => !item.game.genres.some((g) => ["FPS", "Shooter"].includes(g))
    )
    const hasSimilar = r4.some((item) => item.game.title === "Terraria" || item.game.title === "Subnautica")

    if (hasNoShooter && hasSimilar) {
        console.log("-> TEST 4 PASADO: Filtro de exclusión estricto respetado y títulos afines encontrados.")
        passed++
    } else {
        console.error("-> TEST 4 FALLIDO.")
    }

    console.log(`\n========================================`)
    console.log(`RESULTADOS: ${passed}/${total} pruebas superadas exitosamente.`)
    console.log(`========================================\n`)

    process.exit(passed === total ? 0 : 1)
}

runTests().catch((err) => {
    console.error("Error ejecutando pruebas:", err)
    process.exit(1)
})
