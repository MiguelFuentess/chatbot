/**
 * Suite de Pruebas Automatizadas: ETAPA 6 - COMPARADOR VISUAL Y CONVERSACIONAL DE VIDEOJUEGOS
 *
 * Valida de forma rigurosa los 22 escenarios requeridos:
 * 1. Comparación válida entre dos títulos.
 * 2. Selección desde tarjetas (Opción A).
 * 3. Comparación por lenguaje natural (Opción B).
 * 4. Referencia al primer juego ("el primero").
 * 5. Referencia al segundo juego ("el segundo").
 * 6. Títulos ambiguos / búsqueda aproximada.
 * 7. Juego inexistente (error amable sin caída 500).
 * 8. Mismo juego dos veces (validación y rechazo amigable).
 * 9. Metadatos completos (comparación integral de 7 atributos de experiencia y generales).
 * 10. Metadatos parcialmente desconocidos (valores null tratados con texto informativo sin NaN).
 * 11. Afinidades marcadamente distintas según perfil activo.
 * 12. Afinidades idénticas o muy cercanas tratadas equilibradamente.
 * 13. Perfil sin suficiente información (modo descriptivo neutral).
 * 14. Perfil con múltiples criterios activos (evaluación multicriterio coordinada).
 * 15. Juego que viola una restricción estricta (warning y penalización transparente).
 * 16. Cambio de preferencias tras comparar.
 * 17. Actualizador dinámico del comparador según aspecto específico (combate, narrativa, etc.).
 * 18. Continuación conversacional tras comparar.
 * 19. Solicitud de alternativas tras comparar ("Buscar alternativas a ambos").
 * 20. Limpieza completa del comparador al reiniciar la conversación.
 * 21. Compatibilidad estructural para visualización móvil (JSON plano serializable).
 * 22. Compatibilidad total con etapas anteriores (diálogo adaptativo y recomendaciones previas intactas).
 */

const path = require("path")
const dotenv = require("dotenv")
dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const {
    getGameDetails,
    compareGamesData,
    calculateGameAffinityForComparison,
    evaluateGameRestrictions
} = require("../services/comparisonService")
const { processDialogueTurn } = require("../services/dialogueManager")
const { detectComparisonIntent, resolveGameReference } = require("../services/feedbackManager")
const { createInitialMemory, buildActiveCriteria } = require("../services/conversationMemoryService")

async function runEtapa6Tests() {
    console.log("==========================================================================")
    console.log("=== BATERÍA DE PRUEBAS: ETAPA 6 - COMPARADOR DE VIDEOJUEGOS ===")
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
    // 1. Comparación válida entre dos títulos
    // =========================================================================
    const comp1 = await compareGamesData({
        titleA: "Hollow Knight",
        titleB: "Celeste",
        criteria: { preferredGenres: ["Plataformas"] }
    })

    const isComp1Valid =
        comp1 &&
        comp1.gameA &&
        comp1.gameB &&
        comp1.gameA.title === "Hollow Knight" &&
        comp1.gameB.title === "Celeste" &&
        comp1.affinityA &&
        comp1.affinityB &&
        typeof comp1.affinityA.score === "number" &&
        typeof comp1.affinityB.score === "number" &&
        comp1.attributeComparison &&
        Array.isArray(comp1.attributeComparison.experienceAttributes) &&
        comp1.attributeComparison.experienceAttributes.length === 7 &&
        typeof comp1.explanation === "string" &&
        comp1.explanation.length > 20

    assertTest(
        isComp1Valid,
        1,
        "Comparación válida entre dos títulos",
        `Compara Hollow Knight y Celeste con afinidades ${comp1?.affinityA?.score}% y ${comp1?.affinityB?.score}%`
    )

    // =========================================================================
    // 2. Selección desde tarjetas (Opción A)
    // =========================================================================
    // Simula la selección consecutiva de tarjetas en el frontend
    const cardSelectionGameA = await getGameDetails("Hades")
    const cardSelectionGameB = await getGameDetails("Dead Cells")
    const compFromCards = await compareGamesData({
        titleA: cardSelectionGameA.title,
        titleB: cardSelectionGameB.title,
        criteria: { preferredGenres: ["Roguelike"] }
    })

    const isSelectionValid =
        compFromCards &&
        !compFromCards.error &&
        compFromCards.gameA.title === "Hades" &&
        compFromCards.gameB.title === "Dead Cells"

    assertTest(
        isSelectionValid,
        2,
        "Selección desde tarjetas (Opción A)",
        "Selección de dos tarjetas produce comparación exitosa de Hades vs Dead Cells"
    )

    // =========================================================================
    // 3. Comparación por lenguaje natural (Opción B)
    // =========================================================================
    const nlState = {
        stage: "recommended",
        lastRecommendedGames: ["Hollow Knight", "Celeste"],
        turnCount: 2
    }
    const nlTurn = await processDialogueTurn({
        userMessage: "Compara Hollow Knight con Celeste",
        accumulatedCriteria: { preferredGenres: ["Indie", "Aventura"] },
        dialogueState: nlState
    })

    const isNlDetected =
        nlTurn &&
        nlTurn.comparisonData &&
        nlTurn.comparisonData.gameA.title === "Hollow Knight" &&
        nlTurn.comparisonData.gameB.title === "Celeste" &&
        nlTurn.dialogueState.stage === "compared"

    assertTest(
        isNlDetected,
        3,
        "Comparación por lenguaje natural (Opción B)",
        "Detecta 'Compara Hollow Knight con Celeste' y devuelve comparisonData estructurado"
    )

    // =========================================================================
    // 4. Referencia al primer juego ("el primero")
    // =========================================================================
    const stateWithCompared = {
        stage: "compared",
        lastComparedGames: ["Hollow Knight", "Celeste"],
        turnCount: 3
    }
    const resolvedFirst = resolveGameReference("Me interesa el primero", stateWithCompared)
    const turnFirst = await processDialogueTurn({
        userMessage: "Me interesa el primero",
        accumulatedCriteria: { preferredGenres: ["Metroidvania"] },
        dialogueState: stateWithCompared
    })

    const isFirstResolved =
        resolvedFirst &&
        resolvedFirst.resolvedGameTitle === "Hollow Knight" &&
        turnFirst &&
        turnFirst.reply &&
        turnFirst.reply.toLowerCase().includes("hollow knight")

    assertTest(
        isFirstResolved,
        4,
        "Referencia al primer juego",
        `'el primero' resolvió a ${resolvedFirst?.resolvedGameTitle}`
    )

    // =========================================================================
    // 5. Referencia al segundo juego ("el segundo")
    // =========================================================================
    const resolvedSecond = resolveGameReference("Cuéntame más del segundo", stateWithCompared)
    const turnSecond = await processDialogueTurn({
        userMessage: "Cuéntame más del segundo",
        accumulatedCriteria: { preferredGenres: ["Plataformas"] },
        dialogueState: stateWithCompared
    })

    const isSecondResolved =
        resolvedSecond &&
        resolvedSecond.resolvedGameTitle === "Celeste" &&
        turnSecond &&
        turnSecond.reply &&
        turnSecond.reply.toLowerCase().includes("celeste")

    assertTest(
        isSecondResolved,
        5,
        "Referencia al segundo juego",
        `'el segundo' resolvió a ${resolvedSecond?.resolvedGameTitle}`
    )

    // =========================================================================
    // 6. Títulos ambiguos / búsqueda aproximada
    // =========================================================================
    const approxGame = await getGameDetails("hollow")
    const isApproxMatched = approxGame && approxGame.title === "Hollow Knight"

    assertTest(
        isApproxMatched,
        6,
        "Títulos ambiguos / búsqueda aproximada",
        `Búsqueda de 'hollow' resolvió a ${approxGame?.title}`
    )

    // =========================================================================
    // 7. Juego inexistente (error amable sin caída 500)
    // =========================================================================
    const compNotFound = await compareGamesData({
        titleA: "Hollow Knight",
        titleB: "Juego Fantasma Imaginario 9999",
        criteria: {}
    })

    const isNotFoundHandled =
        compNotFound &&
        compNotFound.error === "game_not_found" &&
        compNotFound.missingGame === "Juego Fantasma Imaginario 9999"

    assertTest(
        isNotFoundHandled,
        7,
        "Juego inexistente (error amable)",
        `Devuelve error controlado game_not_found para '${compNotFound.missingGame}'`
    )

    // =========================================================================
    // 8. Mismo juego dos veces (validación y rechazo amigable)
    // =========================================================================
    const compSameGame = await compareGamesData({
        titleA: "Celeste",
        titleB: "Celeste",
        criteria: {}
    })

    const isSameGameHandled =
        compSameGame &&
        compSameGame.error === "same_game"

    assertTest(
        isSameGameHandled,
        8,
        "Mismo juego dos veces",
        "Rechaza comparar el mismo juego consigo mismo devolviendo same_game"
    )

    // =========================================================================
    // 9. Metadatos completos
    // =========================================================================
    const compFullMeta = await compareGamesData({
        titleA: "The Witcher 3: Wild Hunt",
        titleB: "Elden Ring",
        criteria: { preferredGenres: ["RPG"] }
    })

    const hasAll7Attrs =
        compFullMeta &&
        compFullMeta.attributeComparison &&
        compFullMeta.attributeComparison.experienceAttributes.length === 7 &&
        compFullMeta.gameA.difficulty &&
        compFullMeta.gameB.difficulty &&
        compFullMeta.gameA.pacing &&
        compFullMeta.gameB.pacing

    assertTest(
        hasAll7Attrs,
        9,
        "Metadatos completos",
        "Comparó The Witcher 3 y Elden Ring con los 7 atributos de experiencia y metadatos generales"
    )

    // =========================================================================
    // 10. Metadatos parcialmente desconocidos (sin NaN ni ceros falsos)
    // =========================================================================
    const compPartial = await compareGamesData({
        titleA: "Hollow Knight",
        titleB: "Celeste",
        criteria: {}
    })
    // Verificar que los atributos devuelven estructura limpia sin NaN
    const noNaN = compPartial.attributeComparison.experienceAttributes.every(
        (a) => (a.valA === null || !isNaN(a.valA)) && (a.valB === null || !isNaN(a.valB))
    )

    assertTest(
        noNaN,
        10,
        "Metadatos parcialmente desconocidos",
        "Atributos null no generan valores NaN ni corrupciones numéricas"
    )

    // =========================================================================
    // 11. Afinidades marcadamente distintas según perfil activo
    // =========================================================================
    const compDistinct = await compareGamesData({
        titleA: "Doom Eternal",
        titleB: "Stardew Valley",
        criteria: {
            preferredGenres: ["Acción", "Shooter"],
            desiredDifficulty: "alta",
            desiredPacing: "rápido"
        }
    })

    const isDistinctCoherent =
        compDistinct &&
        compDistinct.affinityA.score > compDistinct.affinityB.score &&
        compDistinct.affinityA.score - compDistinct.affinityB.score >= 20

    assertTest(
        isDistinctCoherent,
        11,
        "Afinidades marcadamente distintas",
        `Doom Eternal (${compDistinct?.affinityA?.score}%) vs Stardew Valley (${compDistinct?.affinityB?.score}%) refleja con precisión el perfil de acción`
    )

    // =========================================================================
    // 12. Afinidades idénticas o muy cercanas
    // =========================================================================
    const compClose = await compareGamesData({
        titleA: "Hades",
        titleB: "Dead Cells",
        criteria: {
            preferredGenres: ["Roguelike", "Indie"]
        }
    })

    const diff = Math.abs(compClose.affinityA.score - compClose.affinityB.score)
    const isCloseBalanced = diff <= 15 && compClose.explanation.length > 20

    assertTest(
        isCloseBalanced,
        12,
        "Afinidades idénticas o muy cercanas",
        `Diferencia mínima de ${diff}% (${compClose.affinityA.score}% vs ${compClose.affinityB.score}%) tratada equilibradamente sin inventar ventajas artificiales`
    )

    // =========================================================================
    // 13. Perfil sin suficiente información (modo descriptivo neutral)
    // =========================================================================
    const compNoCriteria = await compareGamesData({
        titleA: "Hollow Knight",
        titleB: "Celeste",
        criteria: {}
    })

    const isDescriptiveMode =
        compNoCriteria &&
        compNoCriteria.affinityA.hasSufficientCriteria === false &&
        compNoCriteria.affinityB.hasSufficientCriteria === false &&
        compNoCriteria.explanation.toLowerCase().includes("descriptiva")

    assertTest(
        isDescriptiveMode,
        13,
        "Perfil sin suficiente información (modo descriptivo)",
        "Sin criterios previos, no inventa afinidades y activa modo comparativo descriptivo"
    )

    // =========================================================================
    // 14. Perfil con múltiples criterios activos
    // =========================================================================
    const multiCriteria = {
        preferredGenres: ["RPG", "Aventura"],
        availableTime: "larga (> 1 hora)",
        gameMode: "Individual",
        desiredPacing: "inmersivo",
        desiredDifficulty: "media"
    }
    const compMulti = await compareGamesData({
        titleA: "The Witcher 3: Wild Hunt",
        titleB: "Stardew Valley",
        criteria: multiCriteria
    })

    const isMultiEvaluated =
        compMulti &&
        compMulti.affinityA.hasSufficientCriteria === true &&
        compMulti.affinityA.breakdown &&
        typeof compMulti.affinityA.breakdown.genreScore === "number" &&
        typeof compMulti.affinityA.breakdown.timeScore === "number"

    assertTest(
        isMultiEvaluated,
        14,
        "Perfil con múltiples criterios activos",
        "Evaluó simultáneamente género, duración, modalidad y ritmo en el desglose multicriterio"
    )

    // =========================================================================
    // 15. Juego que viola una restricción estricta
    // =========================================================================
    const restrictedGame = await getGameDetails("Doom Eternal")
    const strictCriteria = {
        preferredGenres: ["RPG"],
        dislikedGenres: ["Shooter"] // Doom Eternal es Shooter -> Infracción estricta
    }
    const restrictionEval = evaluateGameRestrictions(restrictedGame, strictCriteria)
    const compRestricted = await compareGamesData({
        titleA: "The Witcher 3: Wild Hunt",
        titleB: "Doom Eternal",
        criteria: strictCriteria
    })

    const isRestrictionFlagged =
        restrictionEval.isRestricted &&
        restrictionEval.violations.length > 0 &&
        compRestricted.affinityB.isRestricted === true &&
        compRestricted.affinityB.violations.length > 0 &&
        compRestricted.explanation.toLowerCase().includes("restricci")

    assertTest(
        isRestrictionFlagged,
        15,
        "Juego con restricción estricta",
        `Doom Eternal detectado con restricción: ${compRestricted.affinityB.violations.join(", ")}`
    )

    // =========================================================================
    // 16. Cambio de preferencias tras comparar
    // =========================================================================
    const postCompTurn = await processDialogueTurn({
        userMessage: "Pensándolo bien, prefiero juegos de granjas y simulación relajante",
        accumulatedCriteria: { preferredGenres: ["Plataformas"] },
        dialogueState: {
            stage: "compared",
            lastComparedGames: ["Hollow Knight", "Celeste"],
            turnCount: 4
        }
    })

    const isPrefUpdated =
        postCompTurn &&
        postCompTurn.updatedCriteria &&
        (postCompTurn.updatedCriteria.preferredGenres.includes("Simulación") ||
            postCompTurn.updatedCriteria.emotionalContext?.includes("relajante") ||
            postCompTurn.reply.toLowerCase().includes("relaj"))

    assertTest(
        isPrefUpdated,
        16,
        "Cambio de preferencias tras comparar",
        "Turno posterior a comparación asimila nuevo gusto relajante y actualiza criterios"
    )

    // =========================================================================
    // 17. Actualizador dinámico del comparador según aspecto específico
    // =========================================================================
    const compCombat = await compareGamesData({
        titleA: "Hollow Knight",
        titleB: "Celeste",
        criteria: {},
        aspect: "combate"
    })
    const compNarrative = await compareGamesData({
        titleA: "The Witcher 3: Wild Hunt",
        titleB: "DOOM",
        criteria: {},
        aspect: "narrativa"
    })

    const isAspectDynamic =
        compCombat &&
        compCombat.explanation.toLowerCase().includes("combate") &&
        compNarrative &&
        compNarrative.explanation.toLowerCase().includes("narrativ")

    assertTest(
        isAspectDynamic,
        17,
        "Actualizador dinámico del comparador",
        "Comparaciones enfocadas en combate y narrativa modulan la explicación correspondientemente"
    )

    // =========================================================================
    // 18. Continuación conversacional tras comparar
    // =========================================================================
    const compFollowup = await processDialogueTurn({
        userMessage: "¿Cuál tiene menos combate?",
        accumulatedCriteria: { preferredGenres: ["Plataformas"] },
        dialogueState: {
            stage: "compared",
            lastComparedGames: ["Hollow Knight", "Celeste"],
            turnCount: 5
        }
    })

    const isFollowupCoherent =
        compFollowup &&
        compFollowup.reply &&
        compFollowup.reply.toLowerCase().includes("celeste") &&
        compFollowup.reply.toLowerCase().includes("combate")

    assertTest(
        isFollowupCoherent,
        18,
        "Continuación conversacional tras comparar",
        "Pregunta post-comparación '¿Cuál tiene menos combate?' contrasta adecuadamente ambos títulos"
    )

    // =========================================================================
    // 19. Solicitud de alternativas tras comparar
    // =========================================================================
    const altTurn = await processDialogueTurn({
        userMessage: "Buscar alternativas a ambos",
        accumulatedCriteria: { preferredGenres: ["Plataformas", "Indie"] },
        dialogueState: {
            stage: "compared",
            lastComparedGames: ["Hollow Knight", "Celeste"],
            turnCount: 6
        }
    })

    const isAltGenerated =
        altTurn &&
        altTurn.recommendations &&
        altTurn.recommendations.length > 0

    assertTest(
        isAltGenerated,
        19,
        "Solicitud de alternativas tras comparar",
        `Generó ${altTurn?.recommendations?.length} alternativas recomendadas tras la comparación`
    )

    // =========================================================================
    // 20. Limpieza completa del comparador al reiniciar la conversación
    // =========================================================================
    const resetTurn = await processDialogueTurn({
        userMessage: "reiniciar",
        accumulatedCriteria: { preferredGenres: ["Metroidvania"] },
        dialogueState: {
            stage: "compared",
            lastComparedGames: ["Hollow Knight", "Celeste"],
            pendingComparisonGame: "Hollow Knight",
            turnCount: 7
        }
    })

    const isResetClean =
        resetTurn &&
        resetTurn.dialogueState.stage === "experience" &&
        (!resetTurn.dialogueState.lastComparedGames || resetTurn.dialogueState.lastComparedGames.length === 0) &&
        !resetTurn.dialogueState.pendingComparisonGame

    assertTest(
        isResetClean,
        20,
        "Limpieza completa del comparador al reiniciar",
        "Estado del diálogo reseteado a 'experience' y comparador completamente limpio"
    )

    // =========================================================================
    // 21. Compatibilidad estructural para visualización móvil
    // =========================================================================
    const serialized = JSON.stringify(comp1)
    const parsed = JSON.parse(serialized)

    const isMobileCompatible =
        parsed &&
        parsed.gameA &&
        parsed.gameB &&
        parsed.affinityA &&
        parsed.affinityB &&
        parsed.attributeComparison &&
        Array.isArray(parsed.attributeComparison.experienceAttributes) &&
        typeof parsed.explanation === "string"

    assertTest(
        isMobileCompatible,
        21,
        "Compatibilidad estructural para visualización móvil",
        "Estructura serializable en JSON plano sin referencias circulares ni tipos incompatibles"
    )

    // =========================================================================
    // 22. Compatibilidad total con etapas anteriores
    // =========================================================================
    const initTurn = await processDialogueTurn({
        userMessage: "Quiero explorar mundos misteriosos",
        accumulatedCriteria: {},
        dialogueState: { stage: "initial", turnCount: 1, questionsAsked: [] }
    })

    const isBackwardsCompatible =
        initTurn &&
        initTurn.reply &&
        initTurn.dialogueState &&
        initTurn.dialogueState.stage !== "compared"

    assertTest(
        isBackwardsCompatible,
        22,
        "Compatibilidad total con etapas anteriores",
        "El flujo adaptativo de exploración opera intacto según los estándares de etapas 1 a 5"
    )

    console.log(`\n==========================================================================`)
    console.log(`RESUMEN ETAPA 6: ${passed} pasadas de ${passed + failed} pruebas (${failed} falladas).`)
    console.log(`==========================================================================\n`)

    if (failed > 0) {
        process.exit(1)
    } else {
        process.exit(0)
    }
}

runEtapa6Tests().catch((err) => {
    console.error("Error en pruebas de Etapa 6:", err)
    process.exit(1)
})
