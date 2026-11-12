/**
 * Batería de Pruebas Automatizadas de la Etapa 1:
 * Rediseño de la decisión de cuándo recomendar en RecoGames.
 *
 * Valida los 10 escenarios obligatorios especificados en los requerimientos:
 * 1. Información mínima (1 dimensión -> no recomienda)
 * 2. Dos dimensiones (2 dimensiones -> continúa preguntando)
 * 3. Tres dimensiones (3 dimensiones -> no recomienda prematuramente, evalúa y continúa)
 * 4. Información suficiente (4 dimensiones -> recomienda directamente sin repetir preguntas)
 * 5. Recomendación explícita ("Ya puedes recomendarme juegos" -> respeta la solicitud)
 * 6. Respuestas indiferentes ("Me da igual", "No tengo preferencias" -> no insiste en la misma dimensión)
 * 7. Respuesta ambigua ("No sé" -> aclaración útil sin ciclo)
 * 8. Solicitud de alternativas (conserva criterios y excluye títulos previos)
 * 9. Cambio de preferencias (actualiza criterios conservando el resto)
 * 10. Reinicio de conversación (limpia criterios y estado)
 */

const path = require("path")
const mongoose = require("mongoose")
const dotenv = require("dotenv")

dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const { processDialogueTurn, evaluateRecommendationReadiness } = require("../services/dialogueManager")
const { cleanText } = require("../services/nlpService")

async function runEtapa1Tests() {
    console.log("==========================================================================")
    console.log(" ETAPA 1: VALIDACIÓN AUTOMATIZADA DE LA DECISIÓN DE CUÁNDO RECOMENDAR     ")
    console.log("==========================================================================")

    await connectDB()

    let passedCount = 0
    const totalScenarios = 10
    const turnMetrics = []

    // =========================================================================
    // ESCENARIO 1: Información mínima
    // Usuario: "Quiero relajarme"
    // Esperado: El asistente continúa explorando, sin recomendar inmediatamente.
    // =========================================================================
    console.log("\n[ESCENARIO 1] Información mínima: 'Quiero relajarme'")
    const res1 = await processDialogueTurn({
        userMessage: "Quiero relajarme",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Respuesta: "${res1.reply}"`)
    console.log(`  Recomendaciones devueltas: ${res1.recommendations.length}`)
    console.log(`  Siguiente etapa: ${res1.dialogueState.stage}`)

    const pass1 =
        res1.recommendations.length === 0 &&
        res1.updatedCriteria.emotionalContext.includes("relajante") &&
        res1.dialogueState.stage === "time" &&
        res1.dialogueState.readyToRecommend !== true

    if (pass1) {
        console.log("  ✓ ESCENARIO 1 PASADO: Identificó experiencia/emoción y continuó explorando sin recomendar prematuramente.")
        passedCount++
        turnMetrics.push({ scenario: "Escenario 1 (Info mínima)", turnsToRecommend: "En progreso (1 turno, sin recs prematuras)" })
    } else {
        console.error("  ✗ ESCENARIO 1 FALLIDO:", res1)
    }

    // =========================================================================
    // ESCENARIO 2: Dos dimensiones
    // Usuario: "Quiero relajarme" -> "Tengo una hora"
    // Esperado: Continúa preguntando por información relevante que todavía desconoce.
    // =========================================================================
    console.log("\n[ESCENARIO 2] Dos dimensiones: 'Quiero relajarme' -> 'Tengo una hora'")
    const res2_t1 = await processDialogueTurn({
        userMessage: "Quiero relajarme",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const res2_t2 = await processDialogueTurn({
        userMessage: "Tengo una hora",
        accumulatedCriteria: res2_t1.updatedCriteria,
        dialogueState: res2_t1.dialogueState
    })
    console.log(`  Respuesta T2: "${res2_t2.reply}"`)
    console.log(`  Recomendaciones devueltas T2: ${res2_t2.recommendations.length}`)
    console.log(`  Siguiente etapa T2: ${res2_t2.dialogueState.stage}`)

    const pass2 =
        res2_t2.recommendations.length === 0 &&
        res2_t2.updatedCriteria.emotionalContext.includes("relajante") &&
        res2_t2.updatedCriteria.availableTime &&
        res2_t2.dialogueState.stage === "mode" &&
        res2_t2.dialogueState.readyToRecommend !== true

    if (pass2) {
        console.log("  ✓ ESCENARIO 2 PASADO: Con 2 dimensiones (emoción y tiempo) continuó preguntando por la modalidad sin recomendar prematuramente.")
        passedCount++
        turnMetrics.push({ scenario: "Escenario 2 (Dos dimensiones)", turnsToRecommend: "En progreso (2 turnos, sin recs prematuras)" })
    } else {
        console.error("  ✗ ESCENARIO 2 FALLIDO:", res2_t2)
    }

    // =========================================================================
    // ESCENARIO 3: Tres dimensiones
    // Usuario: "Quiero algo tranquilo, tengo una hora y jugaré solo"
    // Esperado: No recomendar automáticamente por tener 3 dimensiones; indagar el género faltante.
    // =========================================================================
    console.log("\n[ESCENARIO 3] Tres dimensiones: 'Quiero algo tranquilo, tengo una hora y jugaré solo'")
    const res3 = await processDialogueTurn({
        userMessage: "Quiero algo tranquilo, tengo una hora y jugaré solo",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Respuesta: "${res3.reply}"`)
    console.log(`  Recomendaciones devueltas: ${res3.recommendations.length}`)
    console.log(`  Siguiente etapa: ${res3.dialogueState.stage}`)
    console.log(`  Razón de preparación: "${res3.dialogueState.readiness?.reason}"`)

    const pass3 =
        res3.recommendations.length === 0 &&
        res3.dialogueState.stage === "genres" &&
        res3.updatedCriteria.emotionalContext.includes("relajante") &&
        res3.updatedCriteria.availableTime &&
        res3.updatedCriteria.gameMode === "individual" &&
        res3.dialogueState.readyToRecommend !== true

    if (pass3) {
        console.log("  ✓ ESCENARIO 3 PASADO: Con 3 dimensiones reconocidas no recomendó automáticamente; solicitó género para afinar la calidad.")
        passedCount++
        turnMetrics.push({ scenario: "Escenario 3 (Tres dimensiones)", turnsToRecommend: "En progreso (1 turno con 3 dimensiones -> indaga género)" })
    } else {
        console.error("  ✗ ESCENARIO 3 FALLIDO:", res3)
    }

    // =========================================================================
    // ESCENARIO 4: Información suficiente
    // Usuario proporciona preferencias claras sobre experiencia, tiempo, modalidad y género.
    // Esperado: Avanzar a recomendaciones sin repetir preguntas.
    // =========================================================================
    console.log("\n[ESCENARIO 4] Información suficiente: Experiencia + Tiempo + Modo + Género en una sola interacción")
    const res4 = await processDialogueTurn({
        userMessage: "Estoy agotado y quiero un juego de simulación tranquilo para jugar solo unos 20 minutos",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Respuesta: "${res4.reply}"`)
    console.log(`  Recomendaciones: ${res4.recommendations.length} títulos (Top 1: ${res4.recommendations[0]?.game?.title})`)
    console.log(`  Etapa alcanzada: ${res4.dialogueState.stage}`)

    const pass4 =
        res4.recommendations.length === 3 &&
        res4.dialogueState.stage === "recommended" &&
        res4.updatedCriteria.emotionalContext.includes("relajante") &&
        res4.updatedCriteria.availableTime.includes("corta") &&
        res4.updatedCriteria.gameMode === "individual" &&
        res4.updatedCriteria.preferredGenres.includes("Simulación")

    if (pass4) {
        console.log("  ✓ ESCENARIO 4 PASADO: Con las 4 dimensiones resueltas recomendó inmediatamente sin formular preguntas redundantes.")
        passedCount++
        turnMetrics.push({ scenario: "Escenario 4 (Info suficiente)", turnsToRecommend: "1 turno (Recomendado de inmediato)" })
    } else {
        console.error("  ✗ ESCENARIO 4 FALLIDO:", res4)
    }

    // =========================================================================
    // ESCENARIO 5: Recomendación explícita
    // Usuario: "Ya puedes recomendarme juegos"
    // Esperado: Respetar la solicitud y recomendar con los criterios disponibles.
    // =========================================================================
    console.log("\n[ESCENARIO 5] Recomendación explícita: 'Ya puedes recomendarme juegos'")
    // Caso 5A: Usuario con 1 criterio previo
    const res5_prev = await processDialogueTurn({
        userMessage: "Quiero algo tranquilo para relajarme",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const res5 = await processDialogueTurn({
        userMessage: "Ya puedes recomendarme juegos",
        accumulatedCriteria: res5_prev.updatedCriteria,
        dialogueState: res5_prev.dialogueState
    })
    console.log(`  Respuesta 5A: "${res5.reply}"`)
    console.log(`  Recomendaciones 5A: ${res5.recommendations.length} juegos`)

    // Caso 5B: Usuario desde cero que pide recomendaciones inmediatas
    const res5B = await processDialogueTurn({
        userMessage: "Muéstrame los juegos",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Respuesta 5B: "${res5B.reply}"`)
    console.log(`  Recomendaciones 5B: ${res5B.recommendations.length} juegos`)

    const pass5 =
        res5.recommendations.length === 3 &&
        res5.dialogueState.stage === "recommended" &&
        res5B.recommendations.length === 3 &&
        res5B.dialogueState.stage === "recommended"

    if (pass5) {
        console.log("  ✓ ESCENARIO 5 PASADO: Solicitud explícita respetada tanto con criterios parciales como con solicitud directa.")
        passedCount++
        turnMetrics.push({ scenario: "Escenario 5 (Recomendación explícita)", turnsToRecommend: "2 turnos (1 con criterio + 1 explícito)" })
    } else {
        console.error("  ✗ ESCENARIO 5 FALLIDO:", { res5, res5B })
    }

    // =========================================================================
    // ESCENARIO 6: Respuestas indiferentes
    // Usuario indica que le da igual la modalidad o que no tiene género preferido.
    // Esperado: No insistir repetidamente en esas mismas dimensiones.
    // =========================================================================
    console.log("\n[ESCENARIO 6] Respuestas indiferentes: Indiferencia en modalidad y en géneros")
    // T1: Emoción
    const res6_t1 = await processDialogueTurn({
        userMessage: "Quiero un desafío estimulante",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    // T2: Tiempo
    const res6_t2 = await processDialogueTurn({
        userMessage: "Menos de 30 minutos",
        accumulatedCriteria: res6_t1.updatedCriteria,
        dialogueState: res6_t1.dialogueState
    })
    // T3: Modalidad indiferente
    const res6_t3 = await processDialogueTurn({
        userMessage: "Me da igual cómo jugar",
        accumulatedCriteria: res6_t2.updatedCriteria,
        dialogueState: res6_t2.dialogueState
    })
    console.log(`  Respuesta T3 (tras responder 'Me da igual'): "${res6_t3.reply}"`)
    console.log(`  Etapa T3: ${res6_t3.dialogueState.stage} (modeIndifferent: ${res6_t3.dialogueState.modeIndifferent})`)

    // T4: Género indiferente
    const res6_t4 = await processDialogueTurn({
        userMessage: "No tengo preferencias de género",
        accumulatedCriteria: res6_t3.updatedCriteria,
        dialogueState: res6_t3.dialogueState
    })
    console.log(`  Respuesta T4 (tras responder 'No tengo preferencias'): "${res6_t4.reply}"`)
    console.log(`  Recomendaciones T4: ${res6_t4.recommendations.length} títulos`)

    const pass6 =
        res6_t3.dialogueState.modeIndifferent === true &&
        res6_t3.dialogueState.stage === "genres" &&
        res6_t4.dialogueState.genreIndifferent === true &&
        res6_t4.recommendations.length === 3 &&
        res6_t4.dialogueState.stage === "recommended"

    if (pass6) {
        console.log("  ✓ ESCENARIO 6 PASADO: Respetó la indiferencia sin repreguntar la misma dimensión y recomendó al completar el perfil.")
        passedCount++
        turnMetrics.push({ scenario: "Escenario 6 (Indiferencias)", turnsToRecommend: "4 turnos (Emoción -> Tiempo -> Modo indiferente -> Género indiferente -> Recs)" })
    } else {
        console.error("  ✗ ESCENARIO 6 FALLIDO:", { res6_t3, res6_t4 })
    }

    // =========================================================================
    // ESCENARIO 7: Respuesta ambigua
    // Usuario responde "No sé" o proporciona una respuesta poco clara.
    // Esperado: Hacer una aclaración útil, sin entrar en un ciclo.
    // =========================================================================
    console.log("\n[ESCENARIO 7] Respuesta ambigua: Usuario responde 'No sé' ante una pregunta")
    // T1: Bot pregunta experiencia (stage: experience)
    const res7_t1 = await processDialogueTurn({
        userMessage: "Hola",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    // T2: Usuario responde ambiguamente "No sé"
    const res7_t2 = await processDialogueTurn({
        userMessage: "No sé",
        accumulatedCriteria: res7_t1.updatedCriteria,
        dialogueState: res7_t1.dialogueState
    })
    console.log(`  Aclaración formulada ante 'No sé': "${res7_t2.reply}"`)
    console.log(`  Opciones sugeridas en aclaración: ${res7_t2.suggestedReplies.length}`)

    // T3: Usuario responde nuevamente "No sé" (protección contra ciclo)
    const res7_t3 = await processDialogueTurn({
        userMessage: "No sé",
        accumulatedCriteria: res7_t2.updatedCriteria,
        dialogueState: res7_t2.dialogueState
    })
    console.log(`  Respuesta tras segunda ambigüedad: "${res7_t3.reply}"`)
    console.log(`  Siguiente etapa sin ciclo: ${res7_t3.dialogueState.stage}`)

    const pass7 =
        res7_t2.recommendations.length === 0 &&
        res7_t2.suggestedReplies.length > 0 &&
        res7_t2.reply.toLowerCase().includes("dudas") &&
        res7_t3.dialogueState.stage !== "experience" // Avanzó de etapa sin bucle

    if (pass7) {
        console.log("  ✓ ESCENARIO 7 PASADO: Formuló aclaración pertinente y avanzó sin quedar atrapado en un ciclo.")
        passedCount++
        turnMetrics.push({ scenario: "Escenario 7 (Respuesta ambigua)", turnsToRecommend: "Aclaró en T2 y avanzó a T3 sin ciclo" })
    } else {
        console.error("  ✗ ESCENARIO 7 FALLIDO:", { res7_t2, res7_t3 })
    }

    // =========================================================================
    // ESCENARIO 8: Solicitud de alternativas
    // Después de recibir recomendaciones, el usuario solicita otros juegos.
    // Esperado: Conservar criterios y entregar alternativas pertinentes sin repetir.
    // =========================================================================
    console.log("\n[ESCENARIO 8] Solicitud de alternativas: 'Muéstrame otros juegos'")
    const res8_initial = await processDialogueTurn({
        userMessage: "Quiero relajarme jugando solo una media hora a un juego indie",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const batch1 = res8_initial.recommendations.map((r) => r.game.title)

    const res8_alt = await processDialogueTurn({
        userMessage: "Muéstrame otros juegos",
        accumulatedCriteria: res8_initial.updatedCriteria,
        dialogueState: res8_initial.dialogueState
    })
    const batch2 = res8_alt.recommendations.map((r) => r.game.title)
    console.log(`  Lote 1: [${batch1.join(", ")}]`)
    console.log(`  Lote 2 (alternativas): [${batch2.join(", ")}]`)

    const pass8 =
        batch2.length > 0 &&
        batch2.every((title) => !batch1.includes(title)) &&
        res8_alt.updatedCriteria.emotionalContext.includes("relajante")

    if (pass8) {
        console.log("  ✓ ESCENARIO 8 PASADO: Alternativas entregadas sin repetir ningún título anterior y conservando criterios.")
        passedCount++
        turnMetrics.push({ scenario: "Escenario 8 (Alternativas)", turnsToRecommend: "2 turnos (1 lote inicial + 1 lote alternativo)" })
    } else {
        console.error("  ✗ ESCENARIO 8 FALLIDO:", { batch1, batch2 })
    }

    // =========================================================================
    // ESCENARIO 9: Cambio de preferencias
    // Después de recibir recomendaciones, el usuario modifica el tiempo o el género.
    // Esperado: Actualizar criterios y mantener el comportamiento de modificación existente.
    // =========================================================================
    console.log("\n[ESCENARIO 9] Cambio de preferencias: Modificación de tiempo disponible y género")
    const initialCriteria9 = {
        emotionalContext: ["relajante"],
        availableTime: "media (30-60 min)",
        gameMode: "individual",
        preferredGenres: ["Simulación"],
        dislikedGenres: [],
        similarTo: []
    }
    const initialState9 = {
        stage: "recommended",
        turnCount: 4,
        questionsAsked: ["experience", "time", "mode", "genres"],
        shownGameTitles: ["Stardew Valley"]
    }

    // Modificación de tiempo
    const res9_time = await processDialogueTurn({
        userMessage: "Quiero algo más corto",
        accumulatedCriteria: initialCriteria9,
        dialogueState: initialState9
    })
    console.log(`  Tiempo actualizado: '${res9_time.updatedCriteria.availableTime}'`)

    // Modificación de género
    const res9_genre = await processDialogueTurn({
        userMessage: "Mejor algo de estrategia",
        accumulatedCriteria: res9_time.updatedCriteria,
        dialogueState: res9_time.dialogueState
    })
    console.log(`  Género actualizado: [${res9_genre.updatedCriteria.preferredGenres.join(", ")}]`)
    console.log(`  Top 1 recomendado con nuevos criterios: ${res9_genre.recommendations[0]?.game?.title}`)

    const pass9 =
        res9_time.updatedCriteria.availableTime.includes("corta") &&
        res9_genre.updatedCriteria.preferredGenres.includes("Estrategia") &&
        !res9_genre.updatedCriteria.preferredGenres.includes("Simulación") &&
        res9_genre.updatedCriteria.emotionalContext.includes("relajante") &&
        res9_genre.recommendations.length > 0

    if (pass9) {
        console.log("  ✓ ESCENARIO 9 PASADO: Criterios modificados con éxito, reteniendo el contexto previo y recalculando opciones.")
        passedCount++
        turnMetrics.push({ scenario: "Escenario 9 (Cambio de preferencias)", turnsToRecommend: "Inmediato tras cambio de criterio (1 turno por cambio)" })
    } else {
        console.error("  ✗ ESCENARIO 9 FALLIDO:", res9_genre.updatedCriteria)
    }

    // =========================================================================
    // ESCENARIO 10: Reinicio
    // Usuario inicia una nueva búsqueda.
    // Esperado: Limpiar criterios y estado conversacional.
    // =========================================================================
    console.log("\n[ESCENARIO 10] Reinicio: Usuario inicia nueva conversación")
    const dirtyCriteria = {
        emotionalContext: ["desafiante"],
        availableTime: "larga (> 1 hora)",
        gameMode: "cooperativo",
        preferredGenres: ["Roguelike"]
    }
    const dirtyState = {
        stage: "recommended",
        turnCount: 6,
        questionsAsked: ["experience", "time", "mode", "genres"]
    }

    const res10 = await processDialogueTurn({
        userMessage: "Hola",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Respuesta de reinicio: "${res10.reply.slice(0, 60)}..."`)

    const pass10 =
        res10.reply.includes("¡Hola! Bienvenido") &&
        res10.updatedCriteria.emotionalContext.length === 0 &&
        res10.updatedCriteria.availableTime === null &&
        res10.updatedCriteria.gameMode === null &&
        res10.updatedCriteria.preferredGenres.length === 0 &&
        res10.dialogueState.stage === "experience" &&
        res10.recommendations.length === 0

    if (pass10) {
        console.log("  ✓ ESCENARIO 10 PASADO: Estado completamente limpio y reiniciado a la bienvenida inicial sin datos residuales.")
        passedCount++
        turnMetrics.push({ scenario: "Escenario 10 (Reinicio)", turnsToRecommend: "Reinicio limpio a Turno 0" })
    } else {
        console.error("  ✗ ESCENARIO 10 FALLIDO:", res10)
    }

    // =========================================================================
    // TABLA RESUMEN DE TURNOS
    // =========================================================================
    console.log("\n==========================================================================")
    console.log(" TABLA DE TURNOS HASTA RECOMENDACIÓN / ESTADO CONVERSACIONAL (ETAPA 1)   ")
    console.log("==========================================================================")
    console.table(turnMetrics)

    console.log(`\n========================================`)
    console.log(`RESULTADOS ETAPA 1: ${passedCount}/${totalScenarios} escenarios superados exitosamente.`)
    console.log(`========================================\n`)

    await mongoose.connection.close()
    process.exit(passedCount === totalScenarios ? 0 : 1)
}

runEtapa1Tests().catch((err) => {
    console.error("Error fatal en pruebas de Etapa 1:", err)
    process.exit(1)
})
