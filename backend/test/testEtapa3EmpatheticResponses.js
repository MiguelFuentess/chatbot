/**
 * ETAPA 3: Batería de Pruebas Automatizadas de Respuestas Empáticas, Naturales y Contextualizadas
 *
 * Valida:
 * 1. Las 14 condiciones obligatorias de calidad conversacional, empatía y variabilidad.
 * 2. Tres simulaciones completas de extremo a extremo (Conversaciones A, B y C).
 */

const path = require("path")
const dotenv = require("dotenv")

dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const {
    processDialogueTurn,
    evaluateRecommendationReadiness,
    QUESTIONS_CONFIG
} = require("../services/dialogueManager")
const {
    composeTurnReply,
    composeRecommendationIntro,
    composeClarificationReply,
    composeEmpathySnippet,
    composeContextConnection,
    composeQuestionTransition,
    pickVariedPhrase,
    recordOpenerUsage,
    OPENERS
} = require("../services/responseComposer")

async function runEtapa3Tests() {
    console.log("==========================================================================")
    console.log(" ETAPA 3: VALIDACIÓN DE RESPUESTAS EMPÁTICAS, NATURALES Y CONTEXTUALIZADAS")
    console.log("==========================================================================")
    await connectDB()

    let passed = 0
    const total = 14
    const summary = []

    // =========================================================================
    // 1. Usuario cansado / busca relajación: empatía natural, sin terapia
    // =========================================================================
    console.log("\n[CONDICIÓN 1] Empatía natural ante cansancio sin psicologizar")
    const res1 = await processDialogueTurn({
        userMessage: "Hoy ha sido un día pesadísimo en el trabajo, solo quiero relajarme y desconectar",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Entrada: "Hoy ha sido un día pesadísimo en el trabajo..."`)
    console.log(`  Respuesta bot: "${res1.reply}"`)

    const pass1 =
        (res1.reply.toLowerCase().includes("tranquila") || res1.reply.toLowerCase().includes("relajar") || res1.reply.toLowerCase().includes("sin presiones")) &&
        !res1.reply.toLowerCase().includes("terapia") &&
        !res1.reply.toLowerCase().includes("psicólog") &&
        res1.updatedCriteria.emotionalContext.includes("relajante") &&
        res1.dialogueState.stage === "time"

    if (pass1) {
        console.log("  ✓ CONDICIÓN 1 PASADA: Empatía adecuada ante fatiga, sin diagnósticos invasivos.")
        passed++
        summary.push({ id: 1, name: "Empatía ante fatiga", status: "PASADO", note: "Reconoce necesidad de relajación sin presiones" })
    } else {
        console.error("  ✗ CONDICIÓN 1 FALLIDA.")
        summary.push({ id: 1, name: "Empatía ante fatiga", status: "FALLIDO", note: "No formuló empatía esperada" })
    }

    // =========================================================================
    // 2. Usuario buscando emoción / desafíos: respuesta estimulante
    // =========================================================================
    console.log("\n[CONDICIÓN 2] Reconocimiento de emoción o desafío estimulante")
    const res2 = await processDialogueTurn({
        userMessage: "Quiero un reto exigente y estimulante que me ponga a prueba",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Entrada: "Quiero un reto exigente y estimulante..."`)
    console.log(`  Respuesta bot: "${res2.reply}"`)

    const pass2 =
        (res2.reply.toLowerCase().includes("reto") || res2.reply.toLowerCase().includes("habilidad") || res2.reply.toLowerCase().includes("desafío")) &&
        res2.updatedCriteria.emotionalContext.includes("desafiante")

    if (pass2) {
        console.log("  ✓ CONDICIÓN 2 PASADA: Tono activo y motivador ante búsqueda de desafío.")
        passed++
        summary.push({ id: 2, name: "Tono estimulante (reto)", status: "PASADO", note: "Respuesta orientada a reto y superación" })
    } else {
        console.error("  ✗ CONDICIÓN 2 FALLIDA.")
        summary.push({ id: 2, name: "Tono estimulante (reto)", status: "FALLIDO", note: "No reconoció el reto" })
    }

    // =========================================================================
    // 3. Reconocimiento de juego favorito: respuesta empática y conectada
    // =========================================================================
    console.log("\n[CONDICIÓN 3] Reconocimiento de juego disfrutado")
    const res3 = await processDialogueTurn({
        userMessage: "Disfruté muchísimo Outer Wilds",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Entrada: "Disfruté muchísimo Outer Wilds"`)
    console.log(`  Respuesta bot: "${res3.reply}"`)

    const pass3 =
        res3.updatedCriteria.likedGames.includes("Outer Wilds") &&
        res3.dialogueState.stage === "followup_game" &&
        res3.reply.toLowerCase().includes("outer wilds")

    if (pass3) {
        console.log("  ✓ CONDICIÓN 3 PASADA: Conectó con Outer Wilds formulando seguimiento específico.")
        passed++
        summary.push({ id: 3, name: "Reconocimiento juego disfrutado", status: "PASADO", note: "Seguimiento específico de Outer Wilds" })
    } else {
        console.error("  ✗ CONDICIÓN 3 FALLIDA.")
        summary.push({ id: 3, name: "Reconocimiento juego disfrutado", status: "FALLIDO", note: "Fallo en Outer Wilds" })
    }

    // =========================================================================
    // 4. Reconocimiento de característica concreta: conexión con el motivo
    // =========================================================================
    console.log("\n[CONDICIÓN 4] Reconocimiento de característica concreta")
    const res4 = await processDialogueTurn({
        userMessage: "Me encanta explorar mundos abiertos y descubrir secretos a mi ritmo",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Entrada: "Me encanta explorar mundos abiertos..."`)
    console.log(`  Respuesta bot: "${res4.reply}"`)

    const pass4 =
        res4.updatedCriteria.likedFeatures.includes("exploracion") &&
        (res4.reply.toLowerCase().includes("exploración") || res4.reply.toLowerCase().includes("secretos") || res4.reply.toLowerCase().includes("descubrir"))

    if (pass4) {
        console.log("  ✓ CONDICIÓN 4 PASADA: Característica de exploración vinculada con fluidez.")
        passed++
        summary.push({ id: 4, name: "Característica concreta", status: "PASADO", note: "Exploración y secretos conectados" })
    } else {
        console.error("  ✗ CONDICIÓN 4 FALLIDA.")
        summary.push({ id: 4, name: "Característica concreta", status: "FALLIDO", note: "Fallo en extracción o respuesta de característica" })
    }

    // =========================================================================
    // 5. Manejo natural de respuesta ambigua: opciones amables sin regaño ("dudas")
    // =========================================================================
    console.log("\n[CONDICIÓN 5] Respuesta ambigua sin reproche ('dudas')")
    const res5 = await processDialogueTurn({
        userMessage: "La verdad no sé qué me apetece",
        accumulatedCriteria: {},
        dialogueState: { stage: "experience", questionsAsked: ["experience"] }
    })
    console.log(`  Entrada: "La verdad no sé qué me apetece"`)
    console.log(`  Respuesta bot: "${res5.reply}"`)

    const pass5 =
        res5.reply.toLowerCase().includes("dudas") &&
        res5.suggestedReplies.length > 0 &&
        res5.recommendations.length === 0

    if (pass5) {
        console.log("  ✓ CONDICIÓN 5 PASADA: Clarificación amable y orientadora ante incertidumbre.")
        passed++
        summary.push({ id: 5, name: "Respuesta ambigua amable", status: "PASADO", note: "Aclaración paciente con 'dudas'" })
    } else {
        console.error("  ✗ CONDICIÓN 5 FALLIDA.")
        summary.push({ id: 5, name: "Respuesta ambigua amable", status: "FALLIDO", note: "Falta aclaración de dudas" })
    }

    // =========================================================================
    // 6. Transición entre preguntas sin cambios bruscos
    // =========================================================================
    console.log("\n[CONDICIÓN 6] Transición fluida con puente contextual")
    const res6_t1 = await processDialogueTurn({
        userMessage: "Quiero un juego cooperativo de aventura para jugar con mis amigos",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Respuesta T1: "${res6_t1.reply}"`)

    const pass6 =
        res6_t1.reply.toLowerCase().includes("amigos") &&
        res6_t1.reply.toLowerCase().includes("tiempo") &&
        res6_t1.dialogueState.stage === "time"

    if (pass6) {
        console.log("  ✓ CONDICIÓN 6 PASADA: Transición suave conectando 'amigos' con la pregunta de tiempo.")
        passed++
        summary.push({ id: 6, name: "Transición contextual", status: "PASADO", note: "Conexión 'Pensando en coordinar con amigos' -> tiempo" })
    } else {
        console.error("  ✗ CONDICIÓN 6 FALLIDA.")
        summary.push({ id: 6, name: "Transición contextual", status: "FALLIDO", note: "Falta conexión contextual" })
    }

    // =========================================================================
    // 7. Cambio de opinión reteniendo criterios previos
    // =========================================================================
    console.log("\n[CONDICIÓN 7] Cambio de opinión con retención de contexto")
    // T1: Define relajante + tiempo corto
    const res7_t1 = await processDialogueTurn({
        userMessage: "Quiero relajarme en partidas cortas de 20 minutos",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    // T2: Responde modo individual
    const res7_t2 = await processDialogueTurn({
        userMessage: "Jugaré solo",
        accumulatedCriteria: res7_t1.updatedCriteria,
        dialogueState: res7_t1.dialogueState
    })
    // T3: El usuario cambia de opinión: "Mejor cámbiame a jugar con amigos"
    const res7_t3 = await processDialogueTurn({
        userMessage: "Mejor cámbiame a jugar en cooperativo con amigos",
        accumulatedCriteria: res7_t2.updatedCriteria,
        dialogueState: res7_t2.dialogueState
    })
    console.log(`  Respuesta T3 tras cambio de modo: "${res7_t3.reply}"`)

    const pass7 =
        res7_t3.updatedCriteria.gameMode === "cooperativo" &&
        res7_t3.updatedCriteria.emotionalContext.includes("relajante") &&
        res7_t3.updatedCriteria.availableTime.includes("corta") &&
        (res7_t3.reply.toLowerCase().includes("cambiamos") || res7_t3.reply.toLowerCase().includes("pasamos") || res7_t3.reply.toLowerCase().includes("modalidad"))

    if (pass7) {
        console.log("  ✓ CONDICIÓN 7 PASADA: Modo cambiado a cooperativo manteniendo relajación y tiempo corto.")
        passed++
        summary.push({ id: 7, name: "Cambio de opinión", status: "PASADO", note: "Retuvo emoción y tiempo al cambiar a cooperativo" })
    } else {
        console.error("  ✗ CONDICIÓN 7 FALLIDA:", res7_t3.updatedCriteria)
        summary.push({ id: 7, name: "Cambio de opinión", status: "FALLIDO", note: "Pérdida de criterios previos al cambiar" })
    }

    // =========================================================================
    // 8. Rechazo de recomendación sin inventar motivos
    // =========================================================================
    console.log("\n[CONDICIÓN 8] Rechazo de videojuego sin inventar motivos no expresados")
    const res8 = await processDialogueTurn({
        userMessage: "No me gusta Hades",
        accumulatedCriteria: {
            emotionalContext: ["desafiante"],
            availableTime: "corta (< 30 min)",
            gameMode: "individual",
            preferredGenres: ["Acción"]
        },
        dialogueState: {
            stage: "recommended",
            shownGameTitles: ["Hades", "Dead Cells", "Hollow Knight"],
            rejectedGames: []
        }
    })
    console.log(`  Respuesta ante rechazo de Hades: "${res8.reply}"`)

    const pass8 =
        res8.dialogueState.rejectedGames.includes("Hades") &&
        res8.recommendations.every((r) => r.game.title !== "Hades") &&
        res8.reply.toLowerCase().includes("hades") &&
        !res8.reply.toLowerCase().includes("mitología") &&
        !res8.reply.toLowerCase().includes("odiabas")

    if (pass8) {
        console.log("  ✓ CONDICIÓN 8 PASADA: Excluyó Hades con respeto sin inventar prejuicios.")
        passed++
        summary.push({ id: 8, name: "Rechazo sin invenciones", status: "PASADO", note: "Hades descartado respetuosamente sin pretextos falsos" })
    } else {
        console.error("  ✗ CONDICIÓN 8 FALLIDA.")
        summary.push({ id: 8, name: "Rechazo sin invenciones", status: "FALLIDO", note: "Fallo en rechazo" })
    }

    // =========================================================================
    // 9. Solicitud de alternativas: tono comprensivo y fresco
    // =========================================================================
    console.log("\n[CONDICIÓN 9] Solicitud de alternativas")
    const res9 = await processDialogueTurn({
        userMessage: "Muéstrame otras opciones diferentes",
        accumulatedCriteria: {
            emotionalContext: ["relajante"],
            availableTime: "corta (< 30 min)",
            gameMode: "individual",
            preferredGenres: ["Puzzle"]
        },
        dialogueState: {
            stage: "recommended",
            shownGameTitles: ["Dorfromantik", "A Short Hike", "Gris"],
            rejectedGames: []
        }
    })
    console.log(`  Respuesta bot alternativas: "${res9.reply}"`)
    console.log(`  Nuevas opciones:`, res9.recommendations.map((r) => r.game.title))

    const pass9 =
        res9.reply.toLowerCase().includes("alternativas") &&
        res9.recommendations.length > 0 &&
        res9.recommendations.every((r) => !["Dorfromantik", "A Short Hike", "Gris"].includes(r.game.title))

    if (pass9) {
        console.log("  ✓ CONDICIÓN 9 PASADA: Entregó alternativas frescas sin repetir juegos previos.")
        passed++
        summary.push({ id: 9, name: "Solicitud de alternativas", status: "PASADO", note: "Títulos nuevos sin repetir el lote previo" })
    } else {
        console.error("  ✗ CONDICIÓN 9 FALLIDA.")
        summary.push({ id: 9, name: "Solicitud de alternativas", status: "FALLIDO", note: "Repitió juegos o no detectó alternativas" })
    }

    // =========================================================================
    // 10. Introducción coherente a recomendaciones: síntesis en prosa humana
    // =========================================================================
    console.log("\n[CONDICIÓN 10] Introducción y síntesis humana de recomendaciones")
    const introCriteria = {
        emotionalContext: ["relajante"],
        availableTime: "corta (< 30 min)",
        gameMode: "individual",
        preferredGenres: ["Simulación"],
        likedGames: ["Stardew Valley"],
        discoveryPreference: "similar"
    }
    const introText = composeRecommendationIntro(introCriteria, { recentOpeners: [] })
    console.log(`  Síntesis generada: "${introText}"`)

    const pass10 =
        (introText.includes("Stardew Valley") || introText.includes("relajarte") || introText.includes("solitario")) &&
        introText.includes("Simulación") &&
        !introText.includes("undefined") &&
        !introText.includes("null")

    if (pass10) {
        console.log("  ✓ CONDICIÓN 10 PASADA: Síntesis coherente en prosa humana integrando criterios.")
        passed++
        summary.push({ id: 10, name: "Síntesis narrativa", status: "PASADO", note: "Prosa fluida conectando juegos, género y modo" })
    } else {
        console.error("  ✗ CONDICIÓN 10 FALLIDA.")
        summary.push({ id: 10, name: "Síntesis narrativa", status: "FALLIDO", note: "Fallo en síntesis" })
    }

    // =========================================================================
    // 11. Ausencia de preferencias inventadas
    // =========================================================================
    console.log("\n[CONDICIÓN 11] Ausencia total de preferencias inventadas")
    const res11 = await processDialogueTurn({
        userMessage: "Recomiéndame juegos ya",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    console.log(`  Respuesta con solicitud pura sin criterios: "${res11.reply}"`)

    const pass11 =
        !res11.reply.toLowerCase().includes("como te gusta") &&
        !res11.reply.toLowerCase().includes("como mencionaste que juegas") &&
        res11.updatedCriteria.preferredGenres.length === 0 &&
        res11.recommendations.length > 0

    if (pass11) {
        console.log("  ✓ CONDICIÓN 11 PASADA: Cero atribuciones de gustos no indicados por el usuario.")
        passed++
        summary.push({ id: 11, name: "Sin inventar preferencias", status: "PASADO", note: "Catálogo general ofrecido sin atribuir gustos falsos" })
    } else {
        console.error("  ✗ CONDICIÓN 11 FALLIDA.")
        summary.push({ id: 11, name: "Sin inventar preferencias", status: "FALLIDO", note: "Se atribuyeron criterios no dichos" })
    }

    // =========================================================================
    // 12. Reinicio de conversación: saludo limpio y cálido
    // =========================================================================
    console.log("\n[CONDICIÓN 12] Reinicio limpio de conversación")
    const res12 = await processDialogueTurn({
        userMessage: "Reiniciar",
        accumulatedCriteria: {
            emotionalContext: ["desafiante"],
            preferredGenres: ["Roguelike"]
        },
        dialogueState: {
            stage: "recommended",
            turnCount: 5,
            shownGameTitles: ["Hades"]
        }
    })
    console.log(`  Respuesta de reinicio: "${res12.reply.split('\n')[0]}"`)

    const pass12 =
        res12.reply.includes("¡Hola! Bienvenido") &&
        res12.updatedCriteria.emotionalContext.length === 0 &&
        res12.updatedCriteria.preferredGenres.length === 0 &&
        res12.dialogueState.turnCount === 1

    if (pass12) {
        console.log("  ✓ CONDICIÓN 12 PASADA: Reinicio sin rastro de datos de la sesión anterior.")
        passed++
        summary.push({ id: 12, name: "Reinicio limpio", status: "PASADO", note: "Bienvenida estándar, turnCount: 1 y memoria vacía" })
    } else {
        console.error("  ✗ CONDICIÓN 12 FALLIDA.")
        summary.push({ id: 12, name: "Reinicio limpio", status: "FALLIDO", note: "Quedaron datos residuales tras reiniciar" })
    }

    // =========================================================================
    // 13. Respuestas variadas: no repetir la misma fórmula en turnos consecutivos
    // =========================================================================
    console.log("\n[CONDICIÓN 13] Rotación variada de aperturas (anti-repetición)")
    const testState = { recentOpeners: [] }
    const p1 = pickVariedPhrase(OPENERS.acknowledgment, testState.recentOpeners)
    recordOpenerUsage(testState, p1)
    const p2 = pickVariedPhrase(OPENERS.acknowledgment, testState.recentOpeners)
    recordOpenerUsage(testState, p2)
    const p3 = pickVariedPhrase(OPENERS.acknowledgment, testState.recentOpeners)
    recordOpenerUsage(testState, p3)
    console.log(`  Aperturas consecutivas generadas: ["${p1}", "${p2}", "${p3}"]`)

    const pass13 = p1 !== p2 && p2 !== p3

    if (pass13) {
        console.log("  ✓ CONDICIÓN 13 PASADA: Las aperturas consecutivas fueron variadas y no idénticas.")
        passed++
        summary.push({ id: 13, name: "Variación de aperturas", status: "PASADO", note: "Rotación activa evitando muletillas robóticas" })
    } else {
        console.error("  ✗ CONDICIÓN 13 FALLIDA.")
        summary.push({ id: 13, name: "Variación de aperturas", status: "FALLIDO", note: "Repitió aperturas consecutivamente" })
    }

    // =========================================================================
    // 14. Conservación de funciones de etapas anteriores
    // =========================================================================
    console.log("\n[CONDICIÓN 14] Preservación de funciones de Etapas 1 y 2")
    const readiness = evaluateRecommendationReadiness({
        criteria: {
            emotionalContext: ["relajante"],
            availableTime: "corta (< 30 min)",
            gameMode: "individual",
            preferredGenres: ["Puzzle"]
        },
        dialogueState: {},
        analysis: {}
    })
    const pass14 = readiness.readyToRecommend === true && readiness.dimensionsCount === 4

    if (pass14) {
        console.log("  ✓ CONDICIÓN 14 PASADA: La evaluación de suficiencia y el motor multicriterio siguen 100% operativos.")
        passed++
        summary.push({ id: 14, name: "Coexistencia Etapas 1 y 2", status: "PASADO", note: "Suficiencia de 4 dimensiones y motor intactos" })
    } else {
        console.error("  ✗ CONDICIÓN 14 FALLIDA.")
        summary.push({ id: 14, name: "Coexistencia Etapas 1 y 2", status: "FALLIDO", note: "Fallo en evaluateRecommendationReadiness" })
    }

    // =========================================================================
    // SIMULACIÓN DE 3 CONVERSACIONES COMPLETAS (SECCIÓN 14 DEL PROMPT)
    // =========================================================================
    console.log("\n==========================================================================")
    console.log(" SIMULACIÓN DE CONVERSACIONES COMPLETAS                                   ")
    console.log("==========================================================================")

    // CONVERSACIÓN A: JUGADOR CANSADO
    console.log("\n--- CONVERSACIÓN A: Jugador cansado tras el trabajo ---")
    const convA_logs = []
    let stateA = {}
    let critA = {}

    // A.1: Expresa fatiga
    const tA1 = await processDialogueTurn({
        userMessage: "Vengo de un día larguísimo en la oficina y quiero relajarme un rato",
        accumulatedCriteria: critA,
        dialogueState: stateA
    })
    convA_logs.push({ turn: 1, user: "Vengo de un día larguísimo en la oficina y quiero relajarme un rato", bot: tA1.reply, stage: tA1.dialogueState.stage })
    critA = tA1.updatedCriteria
    stateA = tA1.dialogueState

    // A.2: Tiempo
    const tA2 = await processDialogueTurn({
        userMessage: "Tengo menos de 30 minutos",
        accumulatedCriteria: critA,
        dialogueState: stateA
    })
    convA_logs.push({ turn: 2, user: "Tengo menos de 30 minutos", bot: tA2.reply, stage: tA2.dialogueState.stage })
    critA = tA2.updatedCriteria
    stateA = tA2.dialogueState

    // A.3: Modo
    const tA3 = await processDialogueTurn({
        userMessage: "Jugaré solo",
        accumulatedCriteria: critA,
        dialogueState: stateA
    })
    convA_logs.push({ turn: 3, user: "Jugaré solo", bot: tA3.reply, stage: tA3.dialogueState.stage })
    critA = tA3.updatedCriteria
    stateA = tA3.dialogueState

    // A.4: Géneros preferidos
    const tA4 = await processDialogueTurn({
        userMessage: "Me gustan los juegos de puzzle o simulación tranquila",
        accumulatedCriteria: critA,
        dialogueState: stateA
    })
    convA_logs.push({
        turn: 4,
        user: "Me gustan los juegos de puzzle o simulación tranquila",
        bot: tA4.reply,
        stage: tA4.dialogueState.stage,
        recommendations: tA4.recommendations.map((r) => r.game.title)
    })

    console.table(convA_logs.map((l) => ({ turn: l.turn, user: l.user, bot: l.bot.substring(0, 70) + "...", stage: l.stage })))
    console.log(`Recomendaciones finales Conv A:`, tA4.recommendations.map((r) => `${r.game.title} (${r.score}%)`))

    // CONVERSACIÓN B: JUGADOR EXPLORADOR (MINECRAFT)
    console.log("\n--- CONVERSACIÓN B: Jugador con gustos previos (explorador / Minecraft) ---")
    const convB_logs = []
    let stateB = {}
    let critB = {}

    // B.1: Menciona Minecraft
    const tB1 = await processDialogueTurn({
        userMessage: "Disfruté muchísimo Minecraft",
        accumulatedCriteria: critB,
        dialogueState: stateB
    })
    convB_logs.push({ turn: 1, user: "Disfruté muchísimo Minecraft", bot: tB1.reply, stage: tB1.dialogueState.stage })
    critB = tB1.updatedCriteria
    stateB = tB1.dialogueState

    // B.2: Motivo
    const tB2 = await processDialogueTurn({
        userMessage: "Construir y crear cosas",
        accumulatedCriteria: critB,
        dialogueState: stateB
    })
    convB_logs.push({ turn: 2, user: "Construir y crear cosas", bot: tB2.reply, stage: tB2.dialogueState.stage })
    critB = tB2.updatedCriteria
    stateB = tB2.dialogueState

    // B.3: Descubrimiento
    const tB3 = await processDialogueTurn({
        userMessage: "Quiero algo parecido",
        accumulatedCriteria: critB,
        dialogueState: stateB
    })
    convB_logs.push({ turn: 3, user: "Quiero algo parecido", bot: tB3.reply, stage: tB3.dialogueState.stage })
    critB = tB3.updatedCriteria
    stateB = tB3.dialogueState

    // B.4: Tiempo y modo
    const tB4 = await processDialogueTurn({
        userMessage: "Tengo una hora y jugaré solo",
        accumulatedCriteria: critB,
        dialogueState: stateB
    })
    convB_logs.push({ turn: 4, user: "Tengo una hora y jugaré solo", bot: tB4.reply, stage: tB4.dialogueState.stage })
    critB = tB4.updatedCriteria
    stateB = tB4.dialogueState

    // B.5: Experiencia o género faltante
    const tB5 = await processDialogueTurn({
        userMessage: "Me gusta la aventura y exploración",
        accumulatedCriteria: critB,
        dialogueState: stateB
    })
    convB_logs.push({
        turn: 5,
        user: "Me gusta la aventura y exploración",
        bot: tB5.reply,
        stage: tB5.dialogueState.stage,
        recommendations: tB5.recommendations.map((r) => r.game.title)
    })

    console.table(convB_logs.map((l) => ({ turn: l.turn, user: l.user, bot: l.bot.substring(0, 70) + "...", stage: l.stage })))
    console.log(`Recomendaciones finales Conv B:`, tB5.recommendations.map((r) => `${r.game.title} (${r.score}%)`))

    // CONVERSACIÓN C: JUGADOR INDECISO CON CAMBIO DE OPINIÓN Y ALTERNATIVAS
    console.log("\n--- CONVERSACIÓN C: Jugador indeciso con cambio de opinión y alternativas ---")
    const convC_logs = []
    let stateC = {}
    let critC = {}

    // C.1: Desafío inicial
    const tC1 = await processDialogueTurn({
        userMessage: "Quiero algo desafiante para jugar solo",
        accumulatedCriteria: critC,
        dialogueState: stateC
    })
    convC_logs.push({ turn: 1, user: "Quiero algo desafiante para jugar solo", bot: tC1.reply, stage: tC1.dialogueState.stage })
    critC = tC1.updatedCriteria
    stateC = tC1.dialogueState

    // C.2: Tiempo
    const tC2 = await processDialogueTurn({
        userMessage: "Tengo unos 45 minutos",
        accumulatedCriteria: critC,
        dialogueState: stateC
    })
    convC_logs.push({ turn: 2, user: "Tengo unos 45 minutos", bot: tC2.reply, stage: tC2.dialogueState.stage })
    critC = tC2.updatedCriteria
    stateC = tC2.dialogueState

    // C.3: Cambio de opinión
    const tC3 = await processDialogueTurn({
        userMessage: "Pensándolo bien, mejor quiero algo tranquilo para relajarme",
        accumulatedCriteria: critC,
        dialogueState: stateC
    })
    convC_logs.push({ turn: 3, user: "Pensándolo bien, mejor quiero algo tranquilo para relajarme", bot: tC3.reply, stage: tC3.dialogueState.stage })
    critC = tC3.updatedCriteria
    stateC = tC3.dialogueState

    // C.4: Género
    const tC4 = await processDialogueTurn({
        userMessage: "Me gusta la aventura y los puzzles",
        accumulatedCriteria: critC,
        dialogueState: stateC
    })
    convC_logs.push({
        turn: 4,
        user: "Me gusta la aventura y los puzzles",
        bot: tC4.reply,
        stage: tC4.dialogueState.stage,
        recommendations: tC4.recommendations.map((r) => r.game.title)
    })
    critC = tC4.updatedCriteria
    stateC = tC4.dialogueState

    // C.5: Pide alternativas
    const tC5 = await processDialogueTurn({
        userMessage: "Muéstrame otras opciones diferentes",
        accumulatedCriteria: critC,
        dialogueState: stateC
    })
    convC_logs.push({
        turn: 5,
        user: "Muéstrame otras opciones diferentes",
        bot: tC5.reply,
        stage: tC5.dialogueState.stage,
        recommendations: tC5.recommendations.map((r) => r.game.title)
    })

    console.table(convC_logs.map((l) => ({ turn: l.turn, user: l.user, bot: l.bot.substring(0, 70) + "...", stage: l.stage })))
    console.log(`Lote inicial Conv C (Turno 4):`, tC4.recommendations.map((r) => r.game.title))
    console.log(`Lote alternativo Conv C (Turno 5):`, tC5.recommendations.map((r) => r.game.title))

    console.log("\n==========================================================================")
    console.log(" TABLA RESUMEN DE PRUEBAS ETAPA 3 (14 CONDICIONES)                       ")
    console.log("==========================================================================")
    console.table(summary)

    console.log(`\n========================================`)
    console.log(`RESULTADOS ETAPA 3: ${passed}/${total} condiciones superadas.`)
    console.log(`========================================\n`)

    if (passed === total) {
        process.exit(0)
    } else {
        process.exit(1)
    }
}

if (require.main === module) {
    runEtapa3Tests()
}

module.exports = { runEtapa3Tests }
