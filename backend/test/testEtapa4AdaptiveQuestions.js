/**
 * Batería de Pruebas Automatizadas de la Etapa 4:
 * Preguntas adaptativas y seguimiento inteligente en RecoGames.
 *
 * Valida los 15 escenarios obligatorios especificados en los requerimientos:
 *  1. Videojuego con seguimiento adaptado (Minecraft sin motivos).
 *  2. Videojuego con motivos ya explicados (Minecraft + exploración -> no repregunta).
 *  3. Característica: narrativa (menciona historia -> profundización en narrativa).
 *  4. Característica: cooperativo (menciona cooperativo -> profundización en cooperación).
 *  5. Característica: desafío (menciona desafío/reto -> profundización en desafíos).
 *  6. Preferencia habitual vs. necesidad actual (contraste difícil vs. tranquilo).
 *  7. Respuesta ambigua / parcial ("No sé" -> aclaración amable).
 *  8. Respuesta flexible ("Me da igual" / "Depende" -> flexible sin bucle).
 *  9. Usuario toma la iniciativa (ignora pregunta y aporta otra dimensión).
 * 10. Corrección de preferencia (cambio de opinión con retención de contexto).
 * 11. Petición explícita ("recomiéndame ya" -> recomendación inmediata).
 * 12. Múltiples criterios simultáneos (perfil completo en un turno).
 * 13. Solicitud de alternativas post-recomendación (nuevas opciones sin repetir).
 * 14. Reinicio de conversación (limpia criterios y estado).
 * 15. Varias respuestas ambiguas consecutivas (aclara 1 vez, flexibiliza en la 2da sin ciclo).
 *
 * Además simula las 4 conversaciones completas de extremo a extremo:
 *  - Conversación A: Minecraft explorador.
 *  - Conversación B: Juegos de estrategia.
 *  - Conversación C: Indeciso ambiguo ("No sé", "Depende").
 *  - Conversación D: Habitual desafiante vs. hoy relajante.
 */

const path = require("path")
const dotenv = require("dotenv")

dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const { processDialogueTurn, evaluateRecommendationReadiness } = require("../services/dialogueManager")
const { selectNextQuestion, initQuestionTracker, markQuestionStatus, isQuestionResolved, FEATURE_FOLLOWUP_CONFIG } = require("../services/questionSelector")
const { evaluateRecommendations } = require("../services/recommendationEngine")
const { cleanText } = require("../services/nlpService")

async function runEtapa4Tests() {
    console.log("==========================================================================")
    console.log(" ETAPA 4: VALIDACIÓN AUTOMATIZADA DE PREGUNTAS ADAPTATIVAS Y SEGUIMIENTO ")
    console.log("==========================================================================")

    await connectDB()

    let passedCount = 0
    const totalScenarios = 15
    const summary = []

    // =========================================================================
    // ESCENARIO 1: Videojuego con seguimiento adaptado (Minecraft sin motivos)
    // =========================================================================
    console.log("\n[ESCENARIO 1] Videojuego con seguimiento adaptado: 'Me gusta Minecraft'")
    const res1 = await processDialogueTurn({
        userMessage: "Me gusta Minecraft",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Respuesta bot: "${res1.reply}"`)
    console.log(`  Etapa: ${res1.dialogueState.stage}`)
    console.log(`  Opciones:`, res1.suggestedReplies)

    const pass1 =
        res1.dialogueState.stage === "followup_game" &&
        res1.reply.includes("construir, explorar o sobrevivir") &&
        res1.suggestedReplies.some((opt) => opt.includes("Construir") || opt.includes("Explorar"))

    if (pass1) {
        console.log("  ✓ ESCENARIO 1 PASADO: Pregunta de seguimiento sobre Minecraft basada en atributos verificables.")
        passedCount++
        summary.push({ id: 1, name: "Seguimiento Minecraft", status: "PASADO", details: "Pregunta específica: construir, explorar o sobrevivir" })
    } else {
        console.error("  ✗ ESCENARIO 1 FALLIDO.")
        summary.push({ id: 1, name: "Seguimiento Minecraft", status: "FALLIDO", details: "No formuló la pregunta adaptada de Minecraft" })
    }

    // =========================================================================
    // ESCENARIO 2: Videojuego con motivos ya explicados (no repreguntar)
    // =========================================================================
    console.log("\n[ESCENARIO 2] Videojuego con motivos ya explicados: 'Me encanta Minecraft porque me gusta explorar'")
    const res2 = await processDialogueTurn({
        userMessage: "Me encanta Minecraft porque me gusta explorar mundos abiertos",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Respuesta bot: "${res2.reply}"`)
    console.log(`  Etapa: ${res2.dialogueState.stage}`)
    console.log(`  Características:`, res2.updatedCriteria.likedFeatures)

    const pass2 =
        !res2.reply.includes("construir, explorar o sobrevivir") &&
        res2.updatedCriteria.likedFeatures.includes("exploracion") &&
        (res2.dialogueState.stage === "discovery_pref" || res2.reply.includes("parecido") || res2.reply.includes("diferente"))

    if (pass2) {
        console.log("  ✓ ESCENARIO 2 PASADO: No repitió pregunta sobre qué le gustó de Minecraft e indagó descubrimiento.")
        passedCount++
        summary.push({ id: 2, name: "Motivos ya explicados", status: "PASADO", details: "Omitió pregunta redundante y avanzó a descubrimiento" })
    } else {
        console.error("  ✗ ESCENARIO 2 FALLIDO.")
        summary.push({ id: 2, name: "Motivos ya explicados", status: "FALLIDO", details: "Repitió pregunta o no reconoció motivo" })
    }

    // =========================================================================
    // ESCENARIO 3: Característica preferida: Narrativa
    // =========================================================================
    console.log("\n[ESCENARIO 3] Característica preferida: 'Busco un juego con buena historia y narrativa'")
    const res3 = await processDialogueTurn({
        userMessage: "Busco un juego con buena historia y narrativa",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Respuesta bot: "${res3.reply}"`)
    console.log(`  Etapa: ${res3.dialogueState.stage}`)
    console.log(`  Opciones:`, res3.suggestedReplies)

    const pass3 =
        res3.dialogueState.stage === "feature_narrativa" &&
        res3.reply.includes("historias emotivas") &&
        res3.suggestedReplies.some((opt) => opt.includes("emotivas") || opt.includes("Misterios"))

    if (pass3) {
        console.log("  ✓ ESCENARIO 3 PASADO: Profundización en narrativa (historias emotivas, misterios o decisiones).")
        passedCount++
        summary.push({ id: 3, name: "Profundización narrativa", status: "PASADO", details: "Pregunta de seguimiento adaptada a narrativa e historia" })
    } else {
        console.error("  ✗ ESCENARIO 3 FALLIDO.")
        summary.push({ id: 3, name: "Profundización narrativa", status: "FALLIDO", details: "No activó seguimiento de narrativa" })
    }

    // =========================================================================
    // ESCENARIO 4: Característica preferida: Cooperativo
    // =========================================================================
    console.log("\n[ESCENARIO 4] Característica preferida: 'Me interesa el juego cooperativo'")
    const res4 = await processDialogueTurn({
        userMessage: "Me interesa el juego cooperativo",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Respuesta bot: "${res4.reply}"`)
    console.log(`  Etapa: ${res4.dialogueState.stage}`)
    console.log(`  Opciones:`, res4.suggestedReplies)

    const pass4 =
        res4.dialogueState.stage === "feature_cooperacion" &&
        res4.reply.includes("colaborar") &&
        res4.suggestedReplies.some((opt) => opt.includes("Cooperar") || opt.includes("Competir"))

    if (pass4) {
        console.log("  ✓ ESCENARIO 4 PASADO: Profundización en cooperación (colaborar vs. competir).")
        passedCount++
        summary.push({ id: 4, name: "Profundización cooperación", status: "PASADO", details: "Pregunta adaptada: colaborar para objetivos o competir" })
    } else {
        console.error("  ✗ ESCENARIO 4 FALLIDO.")
        summary.push({ id: 4, name: "Profundización cooperación", status: "FALLIDO", details: "No activó seguimiento de cooperación" })
    }

    // =========================================================================
    // ESCENARIO 5: Característica preferida: Desafíos
    // =========================================================================
    console.log("\n[ESCENARIO 5] Característica preferida: 'Quiero un buen reto o desafío'")
    const res5 = await processDialogueTurn({
        userMessage: "Quiero un buen reto o desafío",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Respuesta bot: "${res5.reply}"`)
    console.log(`  Etapa: ${res5.dialogueState.stage}`)
    console.log(`  Opciones:`, res5.suggestedReplies)

    const pass5 =
        res5.dialogueState.stage === "feature_desafio" &&
        res5.reply.includes("desafíos de habilidad") &&
        res5.suggestedReplies.some((opt) => opt.includes("habilidad") || opt.includes("Acertijos") || opt.includes("Estrategia"))

    if (pass5) {
        console.log("  ✓ ESCENARIO 5 PASADO: Profundización en desafíos (habilidad, acertijos o estrategia).")
        passedCount++
        summary.push({ id: 5, name: "Profundización desafíos", status: "PASADO", details: "Pregunta adaptada: habilidad, acertijos o estrategia" })
    } else {
        console.error("  ✗ ESCENARIO 5 FALLIDO.")
        summary.push({ id: 5, name: "Profundización desafíos", status: "FALLIDO", details: "No activó seguimiento de desafíos" })
    }

    // =========================================================================
    // ESCENARIO 6: Preferencia habitual vs. Necesidad actual
    // =========================================================================
    console.log("\n[ESCENARIO 6] Preferencia habitual vs. necesidad actual: 'Me gustan los juegos difíciles, pero hoy quiero algo tranquilo'")
    const res6_t1 = await processDialogueTurn({
        userMessage: "Me gustan los juegos difíciles, pero hoy quiero algo tranquilo",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Respuesta T1: "${res6_t1.reply}"`)
    console.log(`  Gusto habitual:`, res6_t1.updatedCriteria.habitualTastes)
    console.log(`  Emoción actual:`, res6_t1.updatedCriteria.emotionalContext)

    // Turno 2: Completa con tiempo, modo y género
    const res6_t2 = await processDialogueTurn({
        userMessage: "Tengo menos de 30 minutos, juego solo y prefiero puzzles",
        accumulatedCriteria: res6_t1.updatedCriteria,
        dialogueState: res6_t1.dialogueState
    })
    console.log(`  Recomendaciones generadas:`, res6_t2.recommendations.map((r) => r.game.title))

    const topGame6 = res6_t2.recommendations[0]?.game.title
    const pass6 =
        res6_t1.updatedCriteria.habitualTastes.includes("desafiante") &&
        res6_t1.updatedCriteria.emotionalContext.includes("relajante") &&
        !res6_t1.updatedCriteria.emotionalContext.includes("desafiante") &&
        res6_t1.reply.toLowerCase().includes("desafío") &&
        res6_t1.reply.toLowerCase().includes("tranquila") &&
        res6_t2.recommendations.length > 0 &&
        ["Dorfromantik", "Gris", "A Short Hike", "Slime Rancher"].includes(topGame6)

    if (pass6) {
        console.log("  ✓ ESCENARIO 6 PASADO: Reconoció contraste difícil vs. tranquilo, priorizó necesidad actual en recomendaciones y conservó gusto habitual.")
        passedCount++
        summary.push({ id: 6, name: "Habitual vs. actual", status: "PASADO", details: "Priorizó relax para hoy (Dorfromantik/Gris) y retuvo gusto habitual" })
    } else {
        console.error("  ✗ ESCENARIO 6 FALLIDO.")
        summary.push({ id: 6, name: "Habitual vs. actual", status: "FALLIDO", details: "No diferenció habitual vs. actual adecuadamente" })
    }

    // =========================================================================
    // ESCENARIO 7: Respuesta ambigua o parcial ("No sé")
    // =========================================================================
    console.log("\n[ESCENARIO 7] Respuesta ambigua: 'No sé'")
    const res7_t1 = await processDialogueTurn({
        userMessage: "Hola",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const res7_t2 = await processDialogueTurn({
        userMessage: "No sé",
        accumulatedCriteria: res7_t1.updatedCriteria,
        dialogueState: res7_t1.dialogueState
    })
    console.log(`  Respuesta aclaratoria: "${res7_t2.reply}"`)
    console.log(`  Opciones:`, res7_t2.suggestedReplies)

    const pass7 =
        res7_t2.recommendations.length === 0 &&
        (res7_t2.reply.toLowerCase().includes("dudas") || res7_t2.reply.toLowerCase().includes("prefieres") || res7_t2.reply.toLowerCase().includes("tranquila")) &&
        res7_t2.suggestedReplies.length > 0

    if (pass7) {
        console.log("  ✓ ESCENARIO 7 PASADO: Respuesta ambigua gestionada con aclaración orientadora sin bloquear la sesión.")
        passedCount++
        summary.push({ id: 7, name: "Respuesta ambigua (No sé)", status: "PASADO", details: "Aclaración amable con opciones orientadoras" })
    } else {
        console.error("  ✗ ESCENARIO 7 FALLIDO.")
        summary.push({ id: 7, name: "Respuesta ambigua (No sé)", status: "FALLIDO", details: "Bloqueó o no aclaró la incertidumbre" })
    }

    // =========================================================================
    // ESCENARIO 8: Respuesta flexible ("Me da igual" / "Depende")
    // =========================================================================
    console.log("\n[ESCENARIO 8] Respuesta flexible: 'Depende'")
    const res8_t1 = await processDialogueTurn({
        userMessage: "Quiero relajarme",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    // Preguntó sobre tiempo -> responde "Depende"
    const res8_t2 = await processDialogueTurn({
        userMessage: "Depende",
        accumulatedCriteria: res8_t1.updatedCriteria,
        dialogueState: res8_t1.dialogueState
    })
    console.log(`  Respuesta T2: "${res8_t2.reply}"`)
    console.log(`  Etapa T2: ${res8_t2.dialogueState.stage}`)
    console.log(`  Time flexible:`, res8_t2.dialogueState.timeIndifferent)

    const pass8 =
        res8_t2.dialogueState.timeIndifferent === true &&
        res8_t2.dialogueState.stage !== "time" &&
        (res8_t2.reply.toLowerCase().includes("flexible") || res8_t2.reply.toLowerCase().includes("tiempo") || res8_t2.dialogueState.stage === "mode")

    if (pass8) {
        console.log("  ✓ ESCENARIO 8 PASADO: 'Depende' interpretado como flexibilidad; avanzó a la siguiente dimensión sin bucle.")
        passedCount++
        summary.push({ id: 8, name: "Respuesta flexible (Depende)", status: "PASADO", details: "Registró dimensión flexible y continuó a la siguiente pregunta" })
    } else {
        console.error("  ✗ ESCENARIO 8 FALLIDO.")
        summary.push({ id: 8, name: "Respuesta flexible (Depende)", status: "FALLIDO", details: "No marcó flexibilidad o quedó en bucle" })
    }

    // =========================================================================
    // ESCENARIO 9: Usuario toma la iniciativa (ignora pregunta y da otra dimensión)
    // =========================================================================
    console.log("\n[ESCENARIO 9] Usuario toma iniciativa: se le pregunta tiempo pero responde modalidad")
    const res9_t1 = await processDialogueTurn({
        userMessage: "Quiero relajarme",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    // Bot preguntó tiempo en T1; usuario responde sobre modalidad
    const res9_t2 = await processDialogueTurn({
        userMessage: "Prefiero jugar con amigos",
        accumulatedCriteria: res9_t1.updatedCriteria,
        dialogueState: res9_t1.dialogueState
    })
    console.log(`  Criterios T2:`, JSON.stringify(res9_t2.updatedCriteria))
    console.log(`  Respuesta T2: "${res9_t2.reply}"`)
    console.log(`  Etapa T2: ${res9_t2.dialogueState.stage}`)

    const pass9 =
        res9_t2.updatedCriteria.gameMode === "cooperativo" &&
        res9_t2.dialogueState.stage !== "mode" &&
        (res9_t2.dialogueState.stage === "time" || res9_t2.dialogueState.stage === "genres")

    if (pass9) {
        console.log("  ✓ ESCENARIO 9 PASADO: Asistente aceptó la iniciativa del usuario, extrajo el modo cooperativo y adaptó el siguiente paso.")
        passedCount++
        summary.push({ id: 9, name: "Iniciativa del usuario", status: "PASADO", details: "Aceptó modalidad no solicitada y formuló siguiente pregunta lógica" })
    } else {
        console.error("  ✗ ESCENARIO 9 FALLIDO.")
        summary.push({ id: 9, name: "Iniciativa del usuario", status: "FALLIDO", details: "No extrajo la dimensión o repitió pregunta" })
    }

    // =========================================================================
    // ESCENARIO 10: Corrección de preferencia (cambio de opinión con retención)
    // =========================================================================
    console.log("\n[ESCENARIO 10] Corrección de preferencia: 'Mejor prefiero estrategia'")
    const res10_t1 = await processDialogueTurn({
        userMessage: "Me gustan los juegos de acción",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const res10_t2 = await processDialogueTurn({
        userMessage: "Pensándolo bien, mejor prefiero estrategia",
        accumulatedCriteria: res10_t1.updatedCriteria,
        dialogueState: res10_t1.dialogueState
    })
    console.log(`  Géneros antes:`, res10_t1.updatedCriteria.preferredGenres)
    console.log(`  Géneros después:`, res10_t2.updatedCriteria.preferredGenres)
    console.log(`  Respuesta bot: "${res10_t2.reply}"`)

    const pass10 =
        res10_t2.updatedCriteria.preferredGenres.includes("Estrategia") &&
        !res10_t2.updatedCriteria.preferredGenres.includes("Acción") &&
        (res10_t2.reply.toLowerCase().includes("cambia") || res10_t2.reply.toLowerCase().includes("enfocamos") || res10_t2.reply.toLowerCase().includes("estrategia"))

    if (pass10) {
        console.log("  ✓ ESCENARIO 10 PASADO: Actualizó género a Estrategia reemplazando Acción con acuse de recibo explícito.")
        passedCount++
        summary.push({ id: 10, name: "Corrección de preferencia", status: "PASADO", details: "Actualizó de Acción a Estrategia y reconoció cambio" })
    } else {
        console.error("  ✗ ESCENARIO 10 FALLIDO.")
        summary.push({ id: 10, name: "Corrección de preferencia", status: "FALLIDO", details: "No actualizó género o conservó el anterior" })
    }

    // =========================================================================
    // ESCENARIO 11: Petición explícita ("recomiéndame ya")
    // =========================================================================
    console.log("\n[ESCENARIO 11] Petición explícita: 'Recomiéndame ya'")
    const res11 = await processDialogueTurn({
        userMessage: "Quiero relajarme jugando solo, recomiéndame ya",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Recomendaciones inmediatas:`, res11.recommendations.length)
    console.log(`  Etapa: ${res11.dialogueState.stage}`)

    const pass11 =
        res11.recommendations.length > 0 &&
        res11.dialogueState.stage === "recommended"

    if (pass11) {
        console.log("  ✓ ESCENARIO 11 PASADO: 'Recomiéndame ya' respetado de inmediato sin formular preguntas adicionales.")
        passedCount++
        summary.push({ id: 11, name: "Petición explícita inmediata", status: "PASADO", details: "Recomendó de inmediato con criterios conocidos" })
    } else {
        console.error("  ✗ ESCENARIO 11 FALLIDO.")
        summary.push({ id: 11, name: "Petición explícita inmediata", status: "FALLIDO", details: "No recomendó de inmediato" })
    }

    // =========================================================================
    // ESCENARIO 12: Múltiples criterios simultáneos (perfil completo)
    // =========================================================================
    console.log("\n[ESCENARIO 12] Múltiples criterios simultáneos en 1 turno")
    const res12 = await processDialogueTurn({
        userMessage: "Hoy quiero relajarme jugando solo durante 30 minutos a algo de puzzle",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Recomendaciones entregadas:`, res12.recommendations.length)
    console.log(`  Top 1:`, res12.recommendations[0]?.game.title)

    const pass12 =
        res12.recommendations.length > 0 &&
        res12.dialogueState.stage === "recommended" &&
        ["Dorfromantik", "Gris", "A Short Hike"].includes(res12.recommendations[0]?.game.title)

    if (pass12) {
        console.log("  ✓ ESCENARIO 12 PASADO: Procesó las 4 dimensiones en 1 solo mensaje y recomendó sin preguntas innecesarias.")
        passedCount++
        summary.push({ id: 12, name: "Múltiples criterios en 1 turno", status: "PASADO", details: "4 dimensiones resueltas en 1 mensaje -> recomendación directa" })
    } else {
        console.error("  ✗ ESCENARIO 12 FALLIDO.")
        summary.push({ id: 12, name: "Múltiples criterios en 1 turno", status: "FALLIDO", details: "No resolvió o insistió en preguntar" })
    }

    // =========================================================================
    // ESCENARIO 13: Solicitud de alternativas post-recomendación
    // =========================================================================
    console.log("\n[ESCENARIO 13] Solicitud de alternativas post-recomendación")
    const res13_t1 = await processDialogueTurn({
        userMessage: "Quiero relajarme jugando solo durante 30 minutos a puzzle, recomiéndame ya",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const firstBatchTitles = res13_t1.recommendations.map((r) => r.game.title)

    const res13_t2 = await processDialogueTurn({
        userMessage: "Muéstrame otras opciones diferentes",
        accumulatedCriteria: res13_t1.updatedCriteria,
        dialogueState: res13_t1.dialogueState
    })
    const secondBatchTitles = res13_t2.recommendations.map((r) => r.game.title)
    console.log(`  Lote 1:`, firstBatchTitles)
    console.log(`  Lote 2:`, secondBatchTitles)

    const hasNoOverlap = secondBatchTitles.every((t) => !firstBatchTitles.includes(t))
    const pass13 =
        res13_t2.recommendations.length > 0 &&
        hasNoOverlap &&
        res13_t2.dialogueState.stage === "recommended"

    if (pass13) {
        console.log("  ✓ ESCENARIO 13 PASADO: Entregó alternativas frescas sin repetir ningún juego del lote previo.")
        passedCount++
        summary.push({ id: 13, name: "Solicitud de alternativas", status: "PASADO", details: "Lote 2 sin solapamiento con Lote 1" })
    } else {
        console.error("  ✗ ESCENARIO 13 FALLIDO.")
        summary.push({ id: 13, name: "Solicitud de alternativas", status: "FALLIDO", details: "Repitió juegos o no devolvió alternativas" })
    }

    // =========================================================================
    // ESCENARIO 14: Reinicio de conversación
    // =========================================================================
    console.log("\n[ESCENARIO 14] Reinicio de conversación: 'reiniciar'")
    const res14 = await processDialogueTurn({
        userMessage: "reiniciar",
        accumulatedCriteria: {
            preferredGenres: ["RPG"],
            emotionalContext: ["desafiante"],
            availableTime: "corta (< 30 min)"
        },
        dialogueState: {
            stage: "recommended",
            turnCount: 5
        }
    })
    console.log(`  TurnCount: ${res14.dialogueState.turnCount}`)
    console.log(`  Stage: ${res14.dialogueState.stage}`)
    console.log(`  Géneros limpios:`, res14.updatedCriteria.preferredGenres)

    const pass14 =
        res14.dialogueState.turnCount === 1 &&
        res14.dialogueState.stage === "experience" &&
        res14.updatedCriteria.preferredGenres.length === 0 &&
        res14.updatedCriteria.emotionalContext.length === 0 &&
        res14.recommendations.length === 0

    if (pass14) {
        console.log("  ✓ ESCENARIO 14 PASADO: Reinicio limpio de conversación con criterios vacíos y etapa inicial.")
        passedCount++
        summary.push({ id: 14, name: "Reinicio de conversación", status: "PASADO", details: "TurnCount: 1, memoria limpia, mensaje de bienvenida" })
    } else {
        console.error("  ✗ ESCENARIO 14 FALLIDO.")
        summary.push({ id: 14, name: "Reinicio de conversación", status: "FALLIDO", details: "No limpió estado o conservó criterios" })
    }

    // =========================================================================
    // ESCENARIO 15: Varias respuestas ambiguas consecutivas (anti-bucle)
    // =========================================================================
    console.log("\n[ESCENARIO 15] Varias respuestas ambiguas consecutivas: 'No sé' -> 'Tal vez no sé'")
    const res15_t1 = await processDialogueTurn({
        userMessage: "Quiero jugar algo",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    // 1ra respuesta ambigua: debe aclarar amablemente
    const res15_t2 = await processDialogueTurn({
        userMessage: "No sé",
        accumulatedCriteria: res15_t1.updatedCriteria,
        dialogueState: res15_t1.dialogueState
    })
    console.log(`  T2 (1ra aclaración): "${res15_t2.reply}"`)
    console.log(`  T2 Etapa: ${res15_t2.dialogueState.stage}`)

    // 2da respuesta ambigua consecutiva: debe flexibilizar y avanzar a la siguiente dimensión sin bucle
    const res15_t3 = await processDialogueTurn({
        userMessage: "Tal vez no sé",
        accumulatedCriteria: res15_t2.updatedCriteria,
        dialogueState: res15_t2.dialogueState
    })
    console.log(`  T3 (avanza sin bucle): "${res15_t3.reply}"`)
    console.log(`  T3 Etapa: ${res15_t3.dialogueState.stage}`)

    const pass15 =
        res15_t2.recommendations.length === 0 &&
        res15_t3.dialogueState.stage !== res15_t2.dialogueState.stage &&
        (res15_t3.dialogueState.stage === "time" || res15_t3.dialogueState.stage === "mode" || res15_t3.dialogueState.isSurpriseMe)

    if (pass15) {
        console.log("  ✓ ESCENARIO 15 PASADO: Aclaró una vez, y ante segunda ambigüedad flexibilizó y avanzó sin bucle.")
        passedCount++
        summary.push({ id: 15, name: "Respuestas ambiguas consecutivas", status: "PASADO", details: "Aclaró en T2 y avanzó a otra dimensión en T3 sin ciclo" })
    } else {
        console.error("  ✗ ESCENARIO 15 FALLIDO.")
        summary.push({ id: 15, name: "Respuestas ambiguas consecutivas", status: "FALLIDO", details: "Quedó atrapado en bucle de aclaraciones" })
    }

    // =========================================================================
    // SIMULACIONES DE CONVERSACIONES COMPLETAS (A, B, C, D)
    // =========================================================================
    console.log("\n==========================================================================")
    console.log(" SIMULACIÓN DE LAS 4 CONVERSACIONES COMPLETAS MULTITURNO                  ")
    console.log("==========================================================================")

    // -------------------------------------------------------------------------
    // CONVERSACIÓN A: Minecraft explorador
    // -------------------------------------------------------------------------
    console.log("\n--- CONVERSACIÓN A: Minecraft explorador ---")
    const convATranscript = []
    let stateA = {}
    let critA = {}

    const stepsA = [
        "Me gusta mucho Minecraft",
        "Explorar el mundo libremente",
        "Quiero algo parecido",
        "Tengo más de una hora disponible y prefiero jugar solo",
        "Aventura o sin preferencias"
    ]

    for (let i = 0; i < stepsA.length; i++) {
        const userMsg = stepsA[i]
        const turnRes = await processDialogueTurn({
            userMessage: userMsg,
            accumulatedCriteria: critA,
            dialogueState: stateA
        })
        critA = turnRes.updatedCriteria
        stateA = turnRes.dialogueState
        convATranscript.push({
            Turno: i + 1,
            Usuario: userMsg,
            Chatbot: turnRes.reply.replace(/\n+/g, " ").slice(0, 75) + "...",
            Etapa: turnRes.dialogueState.stage,
            Recomendaciones: turnRes.recommendations.length > 0 ? turnRes.recommendations.map((r) => r.game.title).join(", ") : "0"
        })
    }
    console.table(convATranscript)
    const passConvA = stateA.stage === "recommended" && stateA.turnCount === 5

    // -------------------------------------------------------------------------
    // CONVERSACIÓN B: Juegos de estrategia
    // -------------------------------------------------------------------------
    console.log("\n--- CONVERSACIÓN B: Juegos de estrategia ---")
    const convBTranscript = []
    let stateB = {}
    let critB = {}

    const stepsB = [
        "Busco un buen juego de estrategia",
        "Pensar con calma por turnos",
        "Tengo más de una hora para jugar",
        "Prefiero jugar solo",
        "Quiero un desafío"
    ]

    for (let i = 0; i < stepsB.length; i++) {
        const userMsg = stepsB[i]
        const turnRes = await processDialogueTurn({
            userMessage: userMsg,
            accumulatedCriteria: critB,
            dialogueState: stateB
        })
        critB = turnRes.updatedCriteria
        stateB = turnRes.dialogueState
        convBTranscript.push({
            Turno: i + 1,
            Usuario: userMsg,
            Chatbot: turnRes.reply.replace(/\n+/g, " ").slice(0, 75) + "...",
            Etapa: turnRes.dialogueState.stage,
            Recomendaciones: turnRes.recommendations.length > 0 ? turnRes.recommendations.map((r) => r.game.title).join(", ") : "0"
        })
    }
    console.table(convBTranscript)
    const passConvB = stateB.stage === "recommended"

    // -------------------------------------------------------------------------
    // CONVERSACIÓN C: Indeciso ambiguo ("No sé", "Depende")
    // -------------------------------------------------------------------------
    console.log("\n--- CONVERSACIÓN C: Indeciso ambiguo ---")
    const convCTranscript = []
    let stateC = {}
    let critC = {}

    const stepsC = [
        "Hola",
        "La verdad no sé qué me apetece hoy",
        "Depende del día, me da igual",
        "Unos 30 minutos y jugaré solo",
        "Cualquiera, sorpréndeme"
    ]

    for (let i = 0; i < stepsC.length; i++) {
        const userMsg = stepsC[i]
        const turnRes = await processDialogueTurn({
            userMessage: userMsg,
            accumulatedCriteria: critC,
            dialogueState: stateC
        })
        critC = turnRes.updatedCriteria
        stateC = turnRes.dialogueState
        convCTranscript.push({
            Turno: i + 1,
            Usuario: userMsg,
            Chatbot: turnRes.reply.replace(/\n+/g, " ").slice(0, 75) + "...",
            Etapa: turnRes.dialogueState.stage,
            Recomendaciones: turnRes.recommendations.length > 0 ? turnRes.recommendations.map((r) => r.game.title).join(", ") : "0"
        })
    }
    console.table(convCTranscript)
    const passConvC = stateC.stage === "recommended"

    // -------------------------------------------------------------------------
    // CONVERSACIÓN D: Habitual desafiante vs. Hoy relajante
    // -------------------------------------------------------------------------
    console.log("\n--- CONVERSACIÓN D: Habitual desafiante vs. Hoy relajante ---")
    const convDTranscript = []
    let stateD = {}
    let critD = {}

    const stepsD = [
        "Me gustan los juegos difíciles, pero hoy quiero algo tranquilo para relajarme",
        "Tengo menos de 30 minutos",
        "Prefiero jugar solo",
        "Me gustan los juegos de puzzle o simulación"
    ]

    for (let i = 0; i < stepsD.length; i++) {
        const userMsg = stepsD[i]
        const turnRes = await processDialogueTurn({
            userMessage: userMsg,
            accumulatedCriteria: critD,
            dialogueState: stateD
        })
        critD = turnRes.updatedCriteria
        stateD = turnRes.dialogueState
        convDTranscript.push({
            Turno: i + 1,
            Usuario: userMsg,
            Chatbot: turnRes.reply.replace(/\n+/g, " ").slice(0, 75) + "...",
            Etapa: turnRes.dialogueState.stage,
            Recomendaciones: turnRes.recommendations.length > 0 ? turnRes.recommendations.map((r) => r.game.title).join(", ") : "0"
        })
    }
    console.table(convDTranscript)
    const passConvD = stateD.stage === "recommended"

    // =========================================================================
    // RESUMEN FINAL
    // =========================================================================
    console.log("\n==========================================================================")
    console.log(" TABLA RESUMEN DE PRUEBAS ETAPA 4 (15 ESCENARIOS + 4 SIMULACIONES)       ")
    console.log("==========================================================================")
    console.table(summary)

    console.log(`\nSimulaciones completas:`)
    console.log(`  Conversación A (Minecraft explorador): ${passConvA ? "PASADA" : "FALLIDA"}`)
    console.log(`  Conversación B (Estrategia):            ${passConvB ? "PASADA" : "FALLIDA"}`)
    console.log(`  Conversación C (Indeciso ambiguo):      ${passConvC ? "PASADA" : "FALLIDA"}`)
    console.log(`  Conversación D (Habitual vs. actual):   ${passConvD ? "PASADA" : "FALLIDA"}`)

    const allSimulationsPassed = passConvA && passConvB && passConvC && passConvD

    console.log(`\n========================================`)
    console.log(`RESULTADOS ETAPA 4: ${passedCount}/${totalScenarios} escenarios superados.`)
    console.log(`SIMULACIONES COMPLETAS: ${allSimulationsPassed ? "4/4 superadas" : "Algunas fallaron"}.`)
    console.log(`========================================\n`)

    if (passedCount === totalScenarios && allSimulationsPassed) {
        process.exit(0)
    } else {
        process.exit(1)
    }
}

runEtapa4Tests().catch((err) => {
    console.error("Error crítico ejecutando pruebas de la Etapa 4:", err)
    process.exit(1)
})
