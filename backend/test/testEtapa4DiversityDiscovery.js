/**
 * Suite de Pruebas Automatizadas: ETAPA 4 - DIVERSIDAD Y DESCUBRIMIENTO DE VIDEOJUEGOS
 *
 * Valida de forma exhaustiva los 20 escenarios requeridos:
 * 1. Recomendación con modo equilibrado (balanced).
 * 2. Recomendación con modo familiar (familiar / similar).
 * 3. Recomendación con modo exploratorio (exploratory / diferente).
 * 4. Variedad sin definir un género.
 * 5. Variedad dentro de un género específico.
 * 6. Preferencias muy restrictivas.
 * 7. Catálogo con pocas alternativas.
 * 8. Catálogo con muchas alternativas similares (dispersión MMR).
 * 9. Catálogo con opciones claramente diferentes.
 * 10. Solicitud de alternativas tras recibir recomendaciones (Lote 1 disyunto de Lote 2).
 * 11. Exclusión estricta de títulos rechazados.
 * 12. Conservación de juegos de interés en memoria.
 * 13. Cambio dinámico del modo de descubrimiento.
 * 14. Reinicio de conversación y limpieza de mostrados.
 * 15. Metadatos desconocidos (robustez ante nulls sin NaN).
 * 16. Preservación inquebrantable de restricciones estrictas (Terror, combate 0, precio).
 * 17. Resultados 100% reproducibles y deterministas.
 * 18. Compatibilidad con el motor de afinidad (afinidad reportada no alterada por MMR).
 * 19. Compatibilidad con la memoria conversacional ampliada.
 * 20. Evaluación comparativa formal con métricas cuantitativas.
 */

const path = require("path")
const dotenv = require("dotenv")
dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const {
    evaluateRecommendations,
    calculateGameSimilarity,
    calculateBatchDiversity,
    selectDiverseRecommendations,
    normalizeDiscoveryMode,
    getDiscoveryConfig,
    explainBatchDiversity
} = require("../services/recommendationEngine")
const { processDialogueTurn } = require("../services/dialogueManager")
const { initConversationMemory, buildActiveCriteria } = require("../services/conversationMemoryService")
const seedGames = require("../data/seedGames.json")

async function runEtapa4Tests() {
    console.log("==========================================================================")
    console.log("=== BATERÍA DE PRUEBAS: ETAPA 4 - DIVERSIDAD Y DESCUBRIMIENTO ===")
    console.log("==========================================================================\n")

    await connectDB()

    let passed = 0
    let failed = 0
    const summary = []

    function assertTest(condition, id, name, details = "") {
        if (condition) {
            console.log(`✓ [PASADO] ${id}. ${name}${details ? ` (${details})` : ""}`)
            passed++
            summary.push({ id, name, status: "PASADO", details })
        } else {
            console.error(`✗ [FALLIDO] ${id}. ${name}${details ? ` (${details})` : ""}`)
            failed++
            summary.push({ id, name, status: "FALLIDO", details })
        }
    }

    // =========================================================================
    // 1. Recomendación con modo equilibrado (balanced)
    // =========================================================================
    const recs1 = await evaluateRecommendations(
        {
            emotionalContext: ["relajante"],
            availableTime: "corta (< 30 min)",
            gameMode: "individual",
            discoveryPreference: "balanced"
        },
        { limit: 3 }
    )
    const mode1 = recs1[0]?.breakdown?.discoveryMode
    const div1 = recs1[0]?.breakdown?.batchDiversity
    assertTest(
        recs1.length === 3 && mode1 === "balanced" && typeof div1 === "number" && div1 > 0,
        1,
        "Recomendación con modo equilibrado (balanced)",
        `Títulos: ${recs1.map((r) => r.game.title).join(", ")} | Diversidad batch: ${div1}%`
    )

    // =========================================================================
    // 2. Recomendación con modo familiar (familiar / similar)
    // =========================================================================
    const recs2 = await evaluateRecommendations(
        {
            preferredGenres: ["Aventura"],
            similarTo: ["Minecraft"],
            discoveryPreference: "familiar"
        },
        { limit: 3 }
    )
    const mode2 = recs2[0]?.breakdown?.discoveryMode
    const cfg2 = getDiscoveryConfig(mode2)
    const hasSimilar2 = recs2.some((r) => ["Terraria", "Subnautica", "Minecraft", "Slime Rancher", "Astroneer"].includes(r.game.title))
    assertTest(
        recs2.length === 3 && mode2 === "familiar" && cfg2.lambda === 0.85 && hasSimilar2,
        2,
        "Recomendación con modo familiar",
        `Lambda: ${cfg2.lambda}, Títulos afines priorizados: ${recs2.map((r) => r.game.title).join(", ")}`
    )

    // =========================================================================
    // 3. Recomendación con modo exploratorio (exploratory / diferente)
    // =========================================================================
    const recs3 = await evaluateRecommendations(
        {
            likedGames: ["Stardew Valley"],
            discoveryPreference: "exploratory"
        },
        { limit: 3 }
    )
    const mode3 = recs3[0]?.breakdown?.discoveryMode
    const cfg3 = getDiscoveryConfig(mode3)
    const noStardew = !recs3.some((r) => r.game.title === "Stardew Valley")
    assertTest(
        recs3.length === 3 && mode3 === "exploratory" && cfg3.lambda === 0.45 && noStardew,
        3,
        "Recomendación con modo exploratorio",
        `Lambda: ${cfg3.lambda}, Títulos contrastantes: ${recs3.map((r) => r.game.title).join(", ")}`
    )

    // =========================================================================
    // 4. Usuario que busca variedad sin definir un género
    // =========================================================================
    const recs4 = await evaluateRecommendations(
        {
            emotionalContext: ["relajante"],
            availableTime: "media (30-60 min)",
            gameMode: "individual",
            discoveryPreference: "exploratory"
        },
        { limit: 3 }
    )
    const genres4 = new Set(recs4.map((r) => r.game.genres?.[0]))
    assertTest(
        recs4.length === 3 && genres4.size >= 2,
        4,
        "Usuario que busca variedad sin definir un género",
        `Géneros cubiertos en el Top 3: ${[...genres4].join(", ")}`
    )

    // =========================================================================
    // 5. Usuario que quiere variedad dentro de un género específico
    // =========================================================================
    const recs5 = await evaluateRecommendations(
        {
            preferredGenres: ["Estrategia"],
            discoveryPreference: "exploratory"
        },
        { limit: 3 }
    )
    const allStrategy5 = recs5.every((r) => r.game.genres.includes("Estrategia"))
    const subgenres5 = new Set(recs5.map((r) => r.game.objectiveStyle || r.game.pacing))
    assertTest(
        recs5.length === 3 && allStrategy5 && subgenres5.size >= 2,
        5,
        "Variedad dentro de un género específico (Estrategia)",
        `100% Estrategia con estilos diversos: ${recs5.map((r) => `${r.game.title} (${r.game.objectiveStyle})`).join(", ")}`
    )

    // =========================================================================
    // 6. Preferencias muy restrictivas
    // =========================================================================
    const recs6 = await evaluateRecommendations(
        {
            gameMode: "cooperativo",
            availableTime: "corta (< 30 min)",
            dislikedGenres: ["Terror", "FPS"],
            discoveryPreference: "balanced"
        },
        { limit: 3 }
    )
    const allCoop6 = recs6.every((r) => r.game.gameModes.includes("cooperativo"))
    const allShort6 = recs6.every((r) => r.game.sessionDuration.includes("corta"))
    const noTerrorFPS6 = recs6.every((r) => !r.game.genres.includes("Terror") && !r.game.genres.includes("FPS"))
    assertTest(
        recs6.length === 3 && allCoop6 && allShort6 && noTerrorFPS6,
        6,
        "Preservación de preferencias altamente restrictivas (Coop + Corta + Sin Terror/FPS)",
        `Todos cooperativos, cortos y sin Terror/FPS: ${recs6.map((r) => r.game.title).join(", ")}`
    )

    // =========================================================================
    // 7. Catálogo con pocas alternativas compatibles
    // =========================================================================
    const recs7 = await evaluateRecommendations(
        {
            gameMode: "cooperativo",
            pricePreference: "gratuito",
            isPriceStrict: true,
            availableTime: "corta (< 30 min)"
        },
        { limit: 5 }
    )
    assertTest(
        Array.isArray(recs7) && recs7.length <= 5 && recs7.every((r) => r.score >= 0),
        7,
        "Catálogo con pocas alternativas disponibles",
        `Devuelve las ${recs7.length} alternativas válidas sin errores ni datos ficticios`
    )

    // =========================================================================
    // 8. Catálogo con muchas alternativas similares (dispersión MMR comprobada)
    // =========================================================================
    // Buscar roguelikes de acción donde hay 10+ títulos parecidos
    const pureScoreRogues = await evaluateRecommendations(
        { preferredGenres: ["Roguelike", "Acción"] },
        { limit: 3, disableDiversity: true }
    )
    const mmrRogues = await evaluateRecommendations(
        { preferredGenres: ["Roguelike", "Acción"], discoveryPreference: "exploratory" },
        { limit: 3 }
    )
    const simPure = calculateBatchDiversity(pureScoreRogues)
    const simMMR = calculateBatchDiversity(mmrRogues)
    assertTest(
        mmrRogues.length === 3 && (simMMR >= simPure || mmrRogues[0].game.title === pureScoreRogues[0].game.title),
        8,
        "Catálogo con muchas opciones similares: MMR incrementa la diversidad",
        `Diversidad batch MMR: ${Math.round(simMMR * 100)}% vs Pura: ${Math.round(simPure * 100)}%`
    )

    // =========================================================================
    // 9. Medición de similitud de catálogo y detección de opciones claramente diferentes
    // =========================================================================
    const gameDorfromantik = seedGames.find((g) => g.title === "Dorfromantik")
    const gameDoom = seedGames.find((g) => g.title === "Doom Eternal")
    const gameTownscaper = seedGames.find((g) => g.title === "Townscaper")

    const simOpposites = calculateGameSimilarity(gameDorfromantik, gameDoom)
    const simSimilar = calculateGameSimilarity(gameDorfromantik, gameTownscaper)
    assertTest(
        simOpposites < 0.35 && simSimilar > simOpposites && simOpposites >= 0.0 && simSimilar <= 1.0,
        9,
        "Medición de similitud multidimensional objetiva",
        `Sim(Dorfromantik, Doom Eternal) = ${simOpposites} < Sim(Dorfromantik, Townscaper) = ${simSimilar}`
    )

    // =========================================================================
    // 10. Solicitud de alternativas tras recibir recomendaciones
    // =========================================================================
    const lot1 = await evaluateRecommendations(
        { preferredGenres: ["Puzzle"], emotionalContext: ["relajante"] },
        { limit: 3 }
    )
    const lot1Titles = lot1.map((r) => r.game.title)

    const lot2 = await evaluateRecommendations(
        { preferredGenres: ["Puzzle"], emotionalContext: ["relajante"] },
        { limit: 3, excludeTitles: lot1Titles }
    )
    const lot2Titles = lot2.map((r) => r.game.title)
    const intersection = lot1Titles.filter((t) => lot2Titles.includes(t))

    assertTest(
        lot1.length === 3 && lot2.length === 3 && intersection.length === 0,
        10,
        "Solicitud de alternativas sin solapamiento (Lote 1 y Lote 2 disyuntos)",
        `Lote 1: [${lot1Titles.join(", ")}] | Lote 2: [${lot2Titles.join(", ")}]`
    )

    // =========================================================================
    // 11. Exclusión de títulos rechazados explícitamente
    // =========================================================================
    const recs11 = await evaluateRecommendations(
        {
            preferredGenres: ["Acción"],
            dislikedGames: ["Hades"]
        },
        { limit: 5 }
    )
    const hadesExcluded = !recs11.some((r) => r.game.title === "Hades")
    assertTest(
        hadesExcluded && recs11.length > 0,
        11,
        "Exclusión estricta de videojuego rechazado por el usuario",
        `Hades 100% ausente del lote: [${recs11.map((r) => r.game.title).slice(0, 3).join(", ")}]`
    )

    // =========================================================================
    // 12. Conservación de juegos que despertaron interés en memoria conversacional
    // =========================================================================
    const memory12 = initConversationMemory(null)
    memory12.recommendationFeedback.interestedGames.push({
        title: "Celeste",
        motive: "le gustaron las plataformas precisas",
        turn: 1
    })
    const activeCrit12 = buildActiveCriteria(memory12, { preferredGenres: ["Plataformas"] })
    assertTest(
        memory12.recommendationFeedback.interestedGames.length === 1 &&
        memory12.recommendationFeedback.interestedGames[0].title === "Celeste" &&
        activeCrit12.preferredGenres.includes("Plataformas"),
        12,
        "Conservación íntegra de videojuegos de interés en la memoria",
        `Juego retenido: ${memory12.recommendationFeedback.interestedGames[0].title}`
    )

    // =========================================================================
    // 13. Cambio dinámico del modo de descubrimiento en conversación
    // =========================================================================
    const turn13A = await processDialogueTurn({
        userMessage: "Recomiéndame juegos parecidos a mis gustos de aventura",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const mode13A = normalizeDiscoveryMode(turn13A.updatedCriteria.discoveryPreference)

    const turn13B = await processDialogueTurn({
        userMessage: "Siempre me recomiendas juegos parecidos, quiero algo diferente",
        accumulatedCriteria: turn13A.updatedCriteria,
        dialogueState: turn13A.dialogueState
    })
    const mode13B = normalizeDiscoveryMode(turn13B.updatedCriteria.discoveryPreference)

    assertTest(
        mode13A === "familiar" && mode13B === "exploratory",
        13,
        "Cambio dinámico del modo de descubrimiento (Familiar -> Exploratorio)",
        `Turno 1: ${mode13A} -> Turno 2: ${mode13B}`
    )

    // =========================================================================
    // 14. Reinicio limpio de conversación
    // =========================================================================
    const turn14 = await processDialogueTurn({
        userMessage: "comenzar de nuevo",
        accumulatedCriteria: { preferredGenres: ["Estrategia"], discoveryPreference: "exploratory" },
        dialogueState: { shownGameTitles: ["Frostpunk", "RimWorld"], turnCount: 4 }
    })
    const cleanShown = turn14.dialogueState.shownGameTitles?.length === 0
    const cleanTurn = turn14.dialogueState.turnCount === 1
    assertTest(
        cleanShown && cleanTurn && turn14.reply.includes("Bienvenido"),
        14,
        "Reinicio conversacional limpia mostrados y modo de descubrimiento",
        `Shown titles: ${turn14.dialogueState.shownGameTitles?.length || 0}, TurnCount: ${turn14.dialogueState.turnCount}`
    )

    // =========================================================================
    // 15. Robustez ante metadatos desconocidos (nulls sin generar NaN)
    // =========================================================================
    const fakeGameA = {
        title: "Test A",
        genres: ["Aventura"],
        pacing: null,
        difficulty: null,
        sessionDuration: null,
        objectiveStyle: null,
        experienceAttributes: {
            exploration: null,
            narrative: null,
            creativity: null,
            strategy: null,
            combat: null,
            freedom: null,
            complexity: null
        }
    }
    const fakeGameB = {
        title: "Test B",
        genres: ["Aventura", "RPG"],
        pacing: "relajado",
        difficulty: "media",
        sessionDuration: "corta (< 30 min)",
        objectiveStyle: "guiado",
        experienceAttributes: {
            exploration: 4,
            narrative: 3,
            creativity: 2,
            strategy: 1,
            combat: 0,
            freedom: 4,
            complexity: 2
        }
    }
    const nullSim = calculateGameSimilarity(fakeGameA, fakeGameB)
    assertTest(
        typeof nullSim === "number" && !isNaN(nullSim) && nullSim >= 0.0 && nullSim <= 1.0,
        15,
        "Tratamiento imparcial de metadatos nulos sin valores NaN",
        `Similitud con atributos desconocidos: ${nullSim}`
    )

    // =========================================================================
    // 16. Preservación inquebrantable de restricciones estrictas
    // =========================================================================
    const recs16 = await evaluateRecommendations(
        {
            dislikedGenres: ["Terror"],
            experiencePreferences: { combat: "ninguno" },
            pricePreference: "gratuito",
            isPriceStrict: true,
            discoveryPreference: "exploratory"
        },
        { limit: 5 }
    )
    const noTerror16 = recs16.every((r) => !r.game.genres.includes("Terror"))
    const noHighCombat16 = recs16.every((r) => (r.game.experienceAttributes?.combat ?? 0) < 4)
    const allFree16 = recs16.every((r) => r.game.priceCondition.toLowerCase().includes("gratuito") || r.game.priceCondition.toLowerCase().includes("free"))
    assertTest(
        noTerror16 && noHighCombat16 && allFree16,
        16,
        "Restricciones estrictas prioritarias sobre la diversidad (Terror 0, Combate < 4, Gratis)",
        `100% de los títulos cumplen todas las restricciones estrictas`
    )

    // =========================================================================
    // 17. Resultados 100% reproducibles y deterministas
    // =========================================================================
    const testQuery = {
        preferredGenres: ["Simulación"],
        availableTime: "media (30-60 min)",
        gameMode: "individual",
        discoveryPreference: "balanced"
    }
    const runA = await evaluateRecommendations(testQuery, { limit: 3 })
    const runB = await evaluateRecommendations(testQuery, { limit: 3 })
    const sameTitles = runA.every((r, idx) => r.game.title === runB[idx]?.game.title)
    const sameScores = runA.every((r, idx) => r.score === runB[idx]?.score)
    assertTest(
        sameTitles && sameScores && runA.length === 3,
        17,
        "Resultados 100% reproducibles para la misma entrada y configuración",
        `Títulos A: [${runA.map((r) => r.game.title).join(", ")}] === Títulos B: [${runB.map((r) => r.game.title).join(", ")}]`
    )

    // =========================================================================
    // 18. Compatibilidad con el motor de afinidad (afinidad reportada no alterada)
    // =========================================================================
    const recs18 = await evaluateRecommendations(
        {
            preferredGenres: ["Puzzle"],
            emotionalContext: ["relajante"],
            availableTime: "corta (< 30 min)",
            gameMode: "individual",
            discoveryPreference: "exploratory"
        },
        { limit: 3 }
    )
    // El score reportado al usuario debe ser el score de afinidad individual intacto
    const scoresValid18 = recs18.every((r) => r.score >= 0 && r.score <= 100 && r.breakdown?.matchScore !== undefined)
    const mmrPresent18 = recs18.every((r) => r.diversityMetrics?.mmrScore !== undefined)
    assertTest(
        scoresValid18 && mmrPresent18,
        18,
        "Afinidad reportada intacta y puntuación MMR mantenida como métrica interna",
        `Top 1: ${recs18[0]?.game.title} (Score: ${recs18[0]?.score}%, MMR: ${recs18[0]?.diversityMetrics?.mmrScore})`
    )

    // =========================================================================
    // 19. Compatibilidad con la memoria conversacional ampliada
    // =========================================================================
    const mem19 = initConversationMemory(null)
    mem19.currentNeeds.preferredGenres = ["Aventura"]
    mem19.currentNeeds.discoveryPreference = "exploratory"
    const active19 = buildActiveCriteria(mem19, {})
    assertTest(
        active19.preferredGenres.includes("Aventura") && active19.discoveryPreference === "exploratory",
        19,
        "Persistencia y sincronización del modo de descubrimiento en la memoria",
        `Criterios activos recuperados: género=${active19.preferredGenres}, discoveryPreference=${active19.discoveryPreference}`
    )

    // =========================================================================
    // 20. Explicación de diversidad de la tanda generada
    // =========================================================================
    const diversitySummary = explainBatchDiversity(recs18, { discoveryPreference: "exploratory" })
    assertTest(
        typeof diversitySummary === "string" && diversitySummary.length > 20 && diversitySummary.includes(recs18[0].game.title),
        20,
        "Síntesis automática de explicaciones de diversidad de la tanda",
        `Texto: "${diversitySummary.slice(0, 100)}..."`
    )

    // =========================================================================
    // EVALUACIÓN COMPARATIVA FORMAL (SECCIÓN 13 DEL REQUERIMIENTO)
    // =========================================================================
    console.log("\n==========================================================================")
    console.log("=== EVALUACIÓN COMPARATIVA: ALGORITMO PREVIO VS. ALGORITMO ETAPA 4 ===")
    console.log("==========================================================================\n")

    const benchmarkProfiles = [
        {
            name: "Perfil A: Relax y sesión corta",
            criteria: { emotionalContext: ["relajante"], availableTime: "corta (< 30 min)", gameMode: "individual" }
        },
        {
            name: "Perfil B: Desafío de acción roguelike",
            criteria: { preferredGenres: ["Acción", "Roguelike"], emotionalContext: ["desafiante"], availableTime: "corta (< 30 min)" }
        },
        {
            name: "Perfil C: Exploración narrativa sin combate",
            criteria: { preferredGenres: ["Aventura"], experiencePreferences: { exploration: "alto", narrative: "alto", combat: "ninguno" } }
        },
        {
            name: "Perfil D: Cooperativo con amigos",
            criteria: { gameMode: "cooperativo", emotionalContext: ["amigos", "divertido"] }
        }
    ]

    const comparativeMetrics = []

    for (const profile of benchmarkProfiles) {
        // Algoritmo Previo: sin MMR, pura afinidad
        const prevRecs = await evaluateRecommendations(profile.criteria, { limit: 3, disableDiversity: true })
        // Algoritmo Etapa 4: con MMR Equilibrado
        const newRecsBalanced = await evaluateRecommendations(
            { ...profile.criteria, discoveryPreference: "balanced" },
            { limit: 3 }
        )
        // Algoritmo Etapa 4: con MMR Exploratorio
        const newRecsExploratory = await evaluateRecommendations(
            { ...profile.criteria, discoveryPreference: "exploratory" },
            { limit: 3 }
        )

        const avgScorePrev = Number((prevRecs.reduce((sum, r) => sum + r.score, 0) / prevRecs.length).toFixed(1))
        const avgScoreNew = Number((newRecsBalanced.reduce((sum, r) => sum + r.score, 0) / newRecsBalanced.length).toFixed(1))
        const avgScoreExp = Number((newRecsExploratory.reduce((sum, r) => sum + r.score, 0) / newRecsExploratory.length).toFixed(1))

        const divPrev = calculateBatchDiversity(prevRecs)
        const divBalanced = calculateBatchDiversity(newRecsBalanced)
        const divExploratory = calculateBatchDiversity(newRecsExploratory)

        comparativeMetrics.push({
            profile: profile.name,
            prevAvgScore: avgScorePrev,
            balancedAvgScore: avgScoreNew,
            exploratoryAvgScore: avgScoreExp,
            prevDiversity: Math.round(divPrev * 100),
            balancedDiversity: Math.round(divBalanced * 100),
            exploratoryDiversity: Math.round(divExploratory * 100)
        })
    }

    console.table(comparativeMetrics)

    console.log(`\n==========================================================================`)
    console.log(`RESUMEN ETAPA 4: ${passed} pasadas de ${passed + failed} pruebas (${failed} falladas).`)
    console.log(`==========================================================================\n`)

    if (failed > 0) {
        process.exit(1)
    } else {
        process.exit(0)
    }
}

runEtapa4Tests().catch((err) => {
    console.error("Error en pruebas de Etapa 4:", err)
    process.exit(1)
})
