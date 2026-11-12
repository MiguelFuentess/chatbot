const path = require("path")
const dotenv = require("dotenv")

dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const { processDialogueTurn, evaluateRecommendationReadiness } = require("../services/dialogueManager")
const { parseUserMessage } = require("../services/nlpService")
const { evaluateRecommendations } = require("../services/recommendationEngine")

async function runEtapa2PlayerExperiencesTests() {
    console.log("==========================================================================")
    console.log(" ETAPA 2: VALIDACIÓN AUTOMATIZADA DE GUSTOS Y EXPERIENCIAS PREVIAS       ")
    console.log("==========================================================================")
    await connectDB()

    let passed = 0
    const total = 12
    const summary = []

    // =========================================================================
    // ESCENARIO 1: Videojuego disfrutado reconocido del catálogo con motivo explícito
    // =========================================================================
    console.log("\n[ESCENARIO 1] Videojuego disfrutado con motivo explícito")
    const msg1 = "Me encanta Minecraft porque puedo explorar libremente y construir cosas"
    const res1 = await processDialogueTurn({
        userMessage: msg1,
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Mensaje: "${msg1}"`)
    console.log(`  Juegos disfrutados:`, res1.updatedCriteria.likedGames)
    console.log(`  Características detectadas:`, res1.updatedCriteria.likedFeatures)
    console.log(`  Respuesta bot: "${res1.reply}"`)
    console.log(`  Opciones sugeridas:`, res1.suggestedReplies)

    const hasMinecraft1 = res1.updatedCriteria.likedGames.includes("Minecraft")
    const hasFeatures1 =
        res1.updatedCriteria.likedFeatures.includes("exploracion") &&
        res1.updatedCriteria.likedFeatures.includes("construccion_creatividad")
    const notAskingWhyMinecraft = !res1.reply.toLowerCase().includes("qué fue lo que más disfrutaste de él")
    const asksDiscovery1 = res1.dialogueState.stage === "discovery_pref" || res1.reply.toLowerCase().includes("parecido") || res1.reply.toLowerCase().includes("diferente")

    if (hasMinecraft1 && hasFeatures1 && notAskingWhyMinecraft && asksDiscovery1) {
        console.log("  ✓ ESCENARIO 1 PASADO: Reconoció Minecraft con motivos explícitos sin repregunta redundante e indagó preferencia de descubrimiento.")
        passed++
        summary.push({ scenario: "1. Videojuego disfrutado con motivo", status: "PASADO", details: "Minecraft + exploración y construcción; pregunta descubrimiento" })
    } else {
        console.error("  ✗ ESCENARIO 1 FALLIDO.")
        summary.push({ scenario: "1. Videojuego disfrutado con motivo", status: "FALLIDO", details: "No cumplió las condiciones esperadas" })
    }

    // =========================================================================
    // ESCENARIO 2: Videojuego disfrutado sin motivo explícito
    // =========================================================================
    console.log("\n[ESCENARIO 2] Videojuego disfrutado sin motivo explícito")
    const msg2 = "Disfruté mucho Hollow Knight"
    const res2 = await processDialogueTurn({
        userMessage: msg2,
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Mensaje: "${msg2}"`)
    console.log(`  Juegos disfrutados:`, res2.updatedCriteria.likedGames)
    console.log(`  Etapa diálogo:`, res2.dialogueState.stage)
    console.log(`  Pregunta seguimiento: "${res2.reply}"`)
    console.log(`  Opciones sugeridas:`, res2.suggestedReplies)

    const hasHollow2 = res2.updatedCriteria.likedGames.includes("Hollow Knight")
    const asksFollowup2 = res2.dialogueState.stage === "followup_game" && res2.reply.includes("Hollow Knight")
    const hasTailoredOptions2 = res2.suggestedReplies.some((opt) => opt.toLowerCase().includes("exploración") || opt.toLowerCase().includes("desafío") || opt.toLowerCase().includes("atmósfera"))

    if (hasHollow2 && asksFollowup2 && hasTailoredOptions2) {
        console.log("  ✓ ESCENARIO 2 PASADO: Registró Hollow Knight y formuló pregunta de seguimiento adaptada con opciones específicas.")
        passed++
        summary.push({ scenario: "2. Videojuego disfrutado sin motivo", status: "PASADO", details: "Hollow Knight -> Pregunta sobre exploración, secretos o combate" })
    } else {
        console.error("  ✗ ESCENARIO 2 FALLIDO.")
        summary.push({ scenario: "2. Videojuego disfrutado sin motivo", status: "FALLIDO", details: "No indagó seguimiento de Hollow Knight adecuadamente" })
    }

    // =========================================================================
    // ESCENARIO 3: Videojuego rechazado / no disfrutado
    // =========================================================================
    console.log("\n[ESCENARIO 3] Videojuego rechazado / no disfrutado con motivo")
    const msg3 = "No me gustó Elden Ring porque los combates son demasiado difíciles y frustrantes"
    const res3 = await processDialogueTurn({
        userMessage: msg3,
        accumulatedCriteria: {
            availableTime: "corta (< 30 min)",
            gameMode: "individual",
            preferredGenres: ["Acción"]
        },
        dialogueState: { stage: "recommended" }
    })
    console.log(`  Mensaje: "${msg3}"`)
    console.log(`  Juegos rechazados:`, res3.updatedCriteria.dislikedGames)
    console.log(`  Características evitadas:`, res3.updatedCriteria.dislikedFeatures)

    const hasDislikedElden = res3.updatedCriteria.dislikedGames.includes("Elden Ring")
    const hasCombatDificil = res3.updatedCriteria.dislikedFeatures.includes("combate_dificil")

    // Evaluar recomendaciones con estos criterios para verificar exclusión estricta
    const recs3 = await evaluateRecommendations(res3.updatedCriteria, { limit: 5 })
    const recommendedTitles3 = recs3.map((r) => r.game.title)
    console.log(`  Recomendaciones generadas:`, recommendedTitles3)

    const eldenNotRecommended = !recommendedTitles3.includes("Elden Ring")
    const noHardCombat = !recommendedTitles3.includes("Elden Ring") && !recommendedTitles3.includes("Hollow Knight")

    if (hasDislikedElden && hasCombatDificil && eldenNotRecommended && noHardCombat) {
        console.log("  ✓ ESCENARIO 3 PASADO: Elden Ring descartado, combate difícil registrado como evitado y títulos brutales excluidos.")
        passed++
        summary.push({ scenario: "3. Videojuego rechazado", status: "PASADO", details: "Elden Ring + combate difícil descartados del lote" })
    } else {
        console.error("  ✗ ESCENARIO 3 FALLIDO.")
        summary.push({ scenario: "3. Videojuego rechazado", status: "FALLIDO", details: "No descartó títulos o no detectó dislike" })
    }

    // =========================================================================
    // ESCENARIO 4: Videojuego no perteneciente al catálogo
    // =========================================================================
    console.log("\n[ESCENARIO 4] Videojuego no perteneciente al catálogo de PC")
    const msg4 = "Uno de mis juegos favoritos es Zelda Breath of the Wild porque me encanta explorar mundos abiertos"
    const res4 = await processDialogueTurn({
        userMessage: msg4,
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Mensaje: "${msg4}"`)
    console.log(`  Juegos disfrutados:`, res4.updatedCriteria.likedGames)
    console.log(`  Juegos no verificados:`, res4.updatedCriteria.unverifiedGames)
    console.log(`  Características extraídas:`, res4.updatedCriteria.likedFeatures)

    const hasZeldaInLiked = res4.updatedCriteria.likedGames.some((g) => g.toLowerCase().includes("zelda"))
    const hasZeldaInUnverified = res4.updatedCriteria.unverifiedGames.some((g) => g.toLowerCase().includes("zelda"))
    const hasExplorationFeature = res4.updatedCriteria.likedFeatures.includes("exploracion")

    // Verificar que el motor de recomendaciones no aplique relaciones inventadas
    const recs4 = await evaluateRecommendations(res4.updatedCriteria, { limit: 3 })
    const hasNoFictitiousBonus = recs4.every((r) => !r.matchFactors.matchedSimilar.some((s) => s.toLowerCase().includes("zelda")))

    if (hasZeldaInLiked && hasZeldaInUnverified && hasExplorationFeature && hasNoFictitiousBonus) {
        console.log("  ✓ ESCENARIO 4 PASADO: Título no verificado registrado con seguridad sin inventar vínculos y aprovechando la exploración.")
        passed++
        summary.push({ scenario: "4. Juego fuera de catálogo", status: "PASADO", details: "Zelda como no verificado + característica 'exploración' extraída" })
    } else {
        console.error("  ✗ ESCENARIO 4 FALLIDO.")
        summary.push({ scenario: "4. Juego fuera de catálogo", status: "FALLIDO", details: "Fallo en verificación o extracción de características" })
    }

    // =========================================================================
    // ESCENARIO 5: Preferencia de descubrimiento: algo similar
    // =========================================================================
    console.log("\n[ESCENARIO 5] Preferencia de descubrimiento: algo similar")
    const msg5 = "Quiero algo parecido a Terraria"
    const res5 = await processDialogueTurn({
        userMessage: msg5,
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Mensaje: "${msg5}"`)
    console.log(`  Preferencia descubrimiento:`, res5.updatedCriteria.discoveryPreference)
    console.log(`  SimilarTo extraído:`, res5.updatedCriteria.similarTo)

    const isSimilarDiscovery = res5.updatedCriteria.discoveryPreference === "similar"
    const hasTerrariaSimilar = res5.updatedCriteria.similarTo.includes("Terraria")

    const recs5 = await evaluateRecommendations(res5.updatedCriteria, { limit: 3 })
    const recTitles5 = recs5.map((r) => r.game.title)
    console.log(`  Recomendaciones generadas:`, recTitles5)

    // Minecraft o Subnautica tienen afinidad / similarTo con Terraria en el catálogo
    const hasAffinityGame = recTitles5.includes("Minecraft") || recTitles5.includes("Subnautica")

    if (isSimilarDiscovery && hasTerrariaSimilar && hasAffinityGame) {
        console.log("  ✓ ESCENARIO 5 PASADO: Preferencia 'similar' registrada y títulos afines a Terraria priorizados.")
        passed++
        summary.push({ scenario: "5. Descubrimiento: similar", status: "PASADO", details: "discoveryPreference='similar' + Minecraft/Subnautica priorizados" })
    } else {
        console.error("  ✗ ESCENARIO 5 FALLIDO.")
        summary.push({ scenario: "5. Descubrimiento: similar", status: "FALLIDO", details: "No detectó similar o no priorizó afinidad" })
    }

    // =========================================================================
    // ESCENARIO 6: Preferencia de descubrimiento: algo diferente
    // =========================================================================
    console.log("\n[ESCENARIO 6] Preferencia de descubrimiento: algo diferente")
    const msg6 = "Me gustó Stardew Valley, pero hoy quiero probar algo completamente distinto a lo que suelo jugar"
    const res6 = await processDialogueTurn({
        userMessage: msg6,
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Mensaje: "${msg6}"`)
    console.log(`  Juegos disfrutados:`, res6.updatedCriteria.likedGames)
    console.log(`  Preferencia descubrimiento:`, res6.updatedCriteria.discoveryPreference)

    const hasStardewLiked = res6.updatedCriteria.likedGames.includes("Stardew Valley")
    const isDifferentDiscovery = res6.updatedCriteria.discoveryPreference === "diferente"

    const recs6 = await evaluateRecommendations(res6.updatedCriteria, { limit: 5 })
    const recTitles6 = recs6.map((r) => r.game.title)
    console.log(`  Recomendaciones generadas:`, recTitles6)

    const stardewExcluded = !recTitles6.includes("Stardew Valley")
    // Con "diferente", títulos contrastantes (como Hades, Into the Breach, Portal) no deben estar sofocados por granjas
    const hasContrast = recTitles6.some((t) => ["Hades", "Into the Breach", "Portal 2", "Dead Cells", "Celeste", "Outer Wilds"].includes(t))

    if (hasStardewLiked && isDifferentDiscovery && stardewExcluded && hasContrast) {
        console.log("  ✓ ESCENARIO 6 PASADO: Preferencia 'diferente' respetada, Stardew Valley excluido y catálogo orientado a experiencias contrastantes.")
        passed++
        summary.push({ scenario: "6. Descubrimiento: diferente", status: "PASADO", details: "discoveryPreference='diferente' + Stardew excluido y contraste ofrecido" })
    } else {
        console.error("  ✗ ESCENARIO 6 FALLIDO.")
        summary.push({ scenario: "6. Descubrimiento: diferente", status: "FALLIDO", details: "No excluyó Stardew o no detectó 'diferente'" })
    }

    // =========================================================================
    // ESCENARIO 7: Declaración de características sin mencionar juegos concretos
    // =========================================================================
    console.log("\n[ESCENARIO 7] Características sin mencionar videojuegos concretos")
    const msg7 = "Me gustan los juegos con buena historia y acertijos, pero sin combates difíciles"
    const res7 = await processDialogueTurn({
        userMessage: msg7,
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Mensaje: "${msg7}"`)
    console.log(`  Características disfrutadas:`, res7.updatedCriteria.likedFeatures)
    console.log(`  Características evitadas:`, res7.updatedCriteria.dislikedFeatures)

    const hasNarrativa = res7.updatedCriteria.likedFeatures.includes("narrativa_historia")
    const hasPuzzles = res7.updatedCriteria.likedFeatures.includes("puzzles_acertijos")
    const hasNoCombateDificil = res7.updatedCriteria.dislikedFeatures.includes("combate_dificil")

    const recs7 = await evaluateRecommendations(res7.updatedCriteria, { limit: 5 })
    const recTitles7 = recs7.map((r) => r.game.title)
    console.log(`  Recomendaciones orientadas a historia y acertijos:`, recTitles7)

    const favorsStoryAndPuzzles = recTitles7.some((t) => ["Portal 2", "Outer Wilds", "Firewatch", "Disco Elysium - The Final Cut"].includes(t))
    const noBrutalGames = !recTitles7.includes("Elden Ring") && !recTitles7.includes("Dark Souls")

    if (hasNarrativa && hasPuzzles && hasNoCombateDificil && favorsStoryAndPuzzles && noBrutalGames) {
        console.log("  ✓ ESCENARIO 7 PASADO: Características identificadas con precisión y motor priorizó acertijos e historia excluyendo combates difíciles.")
        passed++
        summary.push({ scenario: "7. Características concretas", status: "PASADO", details: "Historia + Puzzles - Combate Difícil -> Portal 2 / Outer Wilds / Firewatch" })
    } else {
        console.error("  ✗ ESCENARIO 7 FALLIDO.")
        summary.push({ scenario: "7. Características concretas", status: "FALLIDO", details: "Fallo en extracción de features o filtrado del motor" })
    }

    // =========================================================================
    // ESCENARIO 8: Salto de la pregunta de experiencias previas
    // =========================================================================
    console.log("\n[ESCENARIO 8] Salto de la pregunta de experiencias previas")
    // Turno 8.1: Asistente pregunta por gustos anteriores
    const res8_1 = await processDialogueTurn({
        userMessage: "Disfruté mucho Hollow Knight",
        accumulatedCriteria: {
            availableTime: "corta (< 30 min)",
            gameMode: "individual",
            preferredGenres: ["Aventura"]
        },
        dialogueState: {}
    })
    console.log(`  Turno 8.1 (Pregunta seguimiento bot): "${res8_1.reply}"`)

    // Turno 8.2: Usuario salta la pregunta y pide recomendación
    const res8_2 = await processDialogueTurn({
        userMessage: "Prefiero saltar esta pregunta, recomiéndame según lo que te dije",
        accumulatedCriteria: res8_1.updatedCriteria,
        dialogueState: res8_1.dialogueState
    })
    console.log(`  Turno 8.2 (Respuesta bot): "${res8_2.reply}"`)
    console.log(`  Recomendaciones devueltas:`, res8_2.recommendations.length)
    console.log(`  Etapa alcanzada:`, res8_2.dialogueState.stage)

    const skippedGracefully = res8_2.dialogueState.pastGamesSkipped === true
    const recommendedWithoutBlock = res8_2.recommendations.length > 0 && res8_2.dialogueState.stage === "recommended"

    if (skippedGracefully && recommendedWithoutBlock) {
        console.log("  ✓ ESCENARIO 8 PASADO: El asistente no insistió, respetó el salto y entregó recomendaciones sin bloquear la sesión.")
        passed++
        summary.push({ scenario: "8. Salto de preguntas previas", status: "PASADO", details: "'Prefiero saltar' respetado inmediatamente sin bloqueo conversacional" })
    } else {
        console.error("  ✗ ESCENARIO 8 FALLIDO.")
        summary.push({ scenario: "8. Salto de preguntas previas", status: "FALLIDO", details: "Bloqueó la recomendación o insistió tras el salto" })
    }

    // =========================================================================
    // ESCENARIO 9: Coexistencia con la decisión de la Etapa 1
    // =========================================================================
    console.log("\n[ESCENARIO 9] Coexistencia con la decisión de la Etapa 1 (no recomendar prematuramente)")
    // Turno 9.1: Menciona juego disfrutado únicamente
    const res9_1 = await processDialogueTurn({
        userMessage: "Me encanta Hollow Knight",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Turno 9.1 (Menciona juego): "${res9_1.reply}"`)
    console.log(`  Recomendaciones T9.1 (debe ser 0):`, res9_1.recommendations.length)

    // Turno 9.2: Responde qué le gustó
    const res9_2 = await processDialogueTurn({
        userMessage: "La exploración y secretos",
        accumulatedCriteria: res9_1.updatedCriteria,
        dialogueState: res9_1.dialogueState
    })
    console.log(`  Turno 9.2 (Responde motivo): "${res9_2.reply}"`)
    console.log(`  Recomendaciones T9.2 (debe ser 0, indaga descubrimiento):`, res9_2.recommendations.length)

    // Turno 9.3: Responde descubrimiento
    const res9_3 = await processDialogueTurn({
        userMessage: "Quiero algo parecido",
        accumulatedCriteria: res9_2.updatedCriteria,
        dialogueState: res9_2.dialogueState
    })
    console.log(`  Turno 9.3 (Responde descubrimiento): "${res9_3.reply}"`)
    console.log(`  Recomendaciones T9.3 (debe ser 0, indaga tiempo):`, res9_3.recommendations.length)

    // Turno 9.4: Responde tiempo y modalidad
    const res9_4 = await processDialogueTurn({
        userMessage: "Tengo unos 45 minutos y jugaré solo",
        accumulatedCriteria: res9_3.updatedCriteria,
        dialogueState: res9_3.dialogueState
    })
    console.log(`  Turno 9.4 (Indaga género restante): "${res9_4.reply}"`)
    console.log(`  Recomendaciones T9.4 (debe ser 0, indaga género):`, res9_4.recommendations.length)

    // Turno 9.5: Responde género (o sin preferencias) -> perfil completo
    const res9_5 = await processDialogueTurn({
        userMessage: "Aventura o sin preferencias",
        accumulatedCriteria: res9_4.updatedCriteria,
        dialogueState: res9_4.dialogueState
    })
    console.log(`  Turno 9.5 (Recomendación con perfil resuelto): "${res9_5.reply.slice(0, 110)}..."`)
    console.log(`  Recomendaciones T9.5:`, res9_5.recommendations.length)

    const noPrematureIn9 =
        res9_1.recommendations.length === 0 &&
        res9_2.recommendations.length === 0 &&
        res9_3.recommendations.length === 0 &&
        res9_4.recommendations.length === 0 &&
        res9_5.recommendations.length > 0

    if (noPrematureIn9) {
        console.log("  ✓ ESCENARIO 9 PASADO: Coexistencia perfecta con Etapa 1: no recomendó prematuramente en turnos 1, 2, 3 ni 4; indagó dimensiones hasta contar con perfil suficiente.")
        passed++
        summary.push({ scenario: "9. Coexistencia con Etapa 1", status: "PASADO", details: "5 turnos adaptativos guiados sin recomendaciones prematuras" })
    } else {
        console.error("  ✗ ESCENARIO 9 FALLIDO.")
        summary.push({ scenario: "9. Coexistencia con Etapa 1", status: "FALLIDO", details: "Recomendó prematuramente en turnos tempranos" })
    }

    // =========================================================================
    // ESCENARIO 10: Solicitud explícita de recomendación
    // =========================================================================
    console.log("\n[ESCENARIO 10] Solicitud explícita de recomendación")
    const msg10 = "Ya sé qué quiero, recomiéndame algo de acción para jugar 30 minutos ya"
    const res10 = await processDialogueTurn({
        userMessage: msg10,
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Mensaje: "${msg10}"`)
    console.log(`  Recomendaciones entregadas de inmediato:`, res10.recommendations.length)
    console.log(`  Etapa alcanzada:`, res10.dialogueState.stage)
    console.log(`  Top 1 recomendado:`, res10.recommendations[0]?.game.title)

    const explicitRespected10 = res10.recommendations.length > 0 && res10.dialogueState.stage === "recommended"

    if (explicitRespected10) {
        console.log("  ✓ ESCENARIO 10 PASADO: Solicitud explícita respetada al instante sin forzar preguntas sobre el pasado.")
        passed++
        summary.push({ scenario: "10. Solicitud explícita directa", status: "PASADO", details: "Recomendó de inmediato en Turno 1 respetando 'recomiéndame ... ya'" })
    } else {
        console.error("  ✗ ESCENARIO 10 FALLIDO.")
        summary.push({ scenario: "10. Solicitud explícita directa", status: "FALLIDO", details: "Forzó preguntas o no entregó recomendaciones" })
    }

    // =========================================================================
    // ESCENARIO 11: Explicación personalizada enriquecida
    // =========================================================================
    console.log("\n[ESCENARIO 11] Explicación personalizada enriquecida")
    const criteria11 = {
        likedGames: ["Minecraft"],
        likedFeatures: ["exploracion", "construccion_creatividad"],
        discoveryPreference: "similar",
        availableTime: "media (30-60 min)",
        gameMode: "individual"
    }
    const recs11 = await evaluateRecommendations(criteria11, { limit: 1 })
    const { generateExplanation } = require("../services/explanationService")
    const expl11 = generateExplanation(recs11[0], criteria11)

    console.log(`  Juego recomendado: ${recs11[0].game.title}`)
    console.log(`  Resumen explicativo: "${expl11.summaryText}"`)
    console.log(`  Lista de motivos:`)
    expl11.reasonsList.forEach((r, i) => console.log(`    ${i + 1}. ${r}`))

    const mentionsFeatures11 =
        expl11.summaryText.toLowerCase().includes("exploración") ||
        expl11.summaryText.toLowerCase().includes("construir") ||
        expl11.reasonsList.some((r) => r.toLowerCase().includes("explorar") || r.toLowerCase().includes("construcción"))
    const mentionsSimilarity11 =
        expl11.summaryText.toLowerCase().includes("minecraft") ||
        expl11.reasonsList.some((r) => r.toLowerCase().includes("minecraft") || r.toLowerCase().includes("recuerdan a"))

    if (mentionsFeatures11 && mentionsSimilarity11) {
        console.log("  ✓ ESCENARIO 11 PASADO: La explicación cita explícitamente las características disfrutadas y la relación verificada con Minecraft.")
        passed++
        summary.push({ scenario: "11. Explicación enriquecida", status: "PASADO", details: "Cita características (exploración/construcción) y similitud con Minecraft" })
    } else {
        console.error("  ✗ ESCENARIO 11 FALLIDO.")
        summary.push({ scenario: "11. Explicación enriquecida", status: "FALLIDO", details: "No citó características o similitud adecuadamente" })
    }

    // =========================================================================
    // ESCENARIO 12: Continuidad post-recomendación
    // =========================================================================
    console.log("\n[ESCENARIO 12] Continuidad conversacional post-recomendación")
    // Partimos de un lote de recomendaciones con perfil de gustos previos
    const res12_initial = await processDialogueTurn({
        userMessage: "Ya puedes recomendarme juegos",
        accumulatedCriteria: {
            likedGames: ["Stardew Valley"],
            likedFeatures: ["construccion_creatividad", "libertad_sandbox"],
            emotionalContext: ["relajante"],
            availableTime: "media (30-60 min)",
            gameMode: "individual"
        },
        dialogueState: { stage: "recommended" }
    })
    const initialTitles12 = res12_initial.recommendations.map((r) => r.game.title)
    console.log(`  Lote inicial:`, initialTitles12)

    // Solicitud de alternativas post-recomendación
    const res12_alternatives = await processDialogueTurn({
        userMessage: "Muéstrame otras alternativas",
        accumulatedCriteria: res12_initial.updatedCriteria,
        dialogueState: res12_initial.dialogueState
    })
    const altTitles12 = res12_alternatives.recommendations.map((r) => r.game.title)
    console.log(`  Lote alternativo:`, altTitles12)

    // Descarte de un título específico post-recomendación
    const topGameToReject = altTitles12[0] || "CURRENT_TOP_GAME"
    const res12_reject = await processDialogueTurn({
        userMessage: `No me gusta ${topGameToReject}, dame otra opción`,
        accumulatedCriteria: res12_alternatives.updatedCriteria,
        dialogueState: res12_alternatives.dialogueState
    })
    const finalTitles12 = res12_reject.recommendations.map((r) => r.game.title)
    console.log(`  Lote tras descartar "${topGameToReject}":`, finalTitles12)

    const preservedProfile12 =
        res12_reject.updatedCriteria.likedGames.includes("Stardew Valley") &&
        res12_reject.updatedCriteria.likedFeatures.includes("construccion_creatividad")
    const excludedRejected12 = !finalTitles12.includes(topGameToReject)
    const noRepeatedInAlt12 = altTitles12.every((t) => !initialTitles12.includes(t))

    if (preservedProfile12 && excludedRejected12 && noRepeatedInAlt12) {
        console.log("  ✓ ESCENARIO 12 PASADO: Continuidad post-recomendación impecable: perfil retenido, alternativas no repetidas y juego descartado excluido.")
        passed++
        summary.push({ scenario: "12. Continuidad post-recomendación", status: "PASADO", details: "Perfil acumulado preservado; alternativas y descartes respetados" })
    } else {
        console.error("  ✗ ESCENARIO 12 FALLIDO.")
        summary.push({ scenario: "12. Continuidad post-recomendación", status: "FALLIDO", details: "Perdió perfil acumulado o repitió títulos descartados" })
    }

    // =========================================================================
    // RESUMEN FINAL
    // =========================================================================
    console.log("\n==========================================================================")
    console.log(" TABLA DE RESULTADOS DE PRUEBAS ETAPA 2 (GUSTOS Y EXPERIENCIAS)           ")
    console.log("==========================================================================")
    console.table(summary)

    console.log(`\n========================================`)
    console.log(`RESULTADOS ETAPA 2: ${passed}/${total} pruebas superadas exitosamente.`)
    console.log(`========================================\n`)

    if (passed < total) {
        process.exit(1)
    } else {
        process.exit(0)
    }
}

runEtapa2PlayerExperiencesTests().catch((err) => {
    console.error("Error ejecutando pruebas Etapa 2:", err)
    process.exit(1)
})
