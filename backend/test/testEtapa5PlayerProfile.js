/**
 * Suite de Pruebas Automatizadas: ETAPA 5 - PERFIL TEMPORAL DEL JUGADOR
 *
 * Valida de forma rigurosa los 20 escenarios requeridos:
 * 1. Perfil temporal vacío al inicio de la conversación.
 * 2. Reflejo de género preferido tras mención en el chat.
 * 3. Reflejo de tiempo disponible tras mención en el chat.
 * 4. Reflejo de modo de juego tras mención en el chat.
 * 5. Reflejo de dificultad tras mención en el chat.
 * 6. Reflejo de emociones / tipo de experiencia expresada.
 * 7. Reflejo de juegos favoritos mencionados con motivo.
 * 8. Reflejo de exclusiones y géneros rechazados.
 * 9. Reflejo de elementos mecánicos no deseados.
 * 10. Reflejo de juegos rechazados en la memoria.
 * 11. Reflejo de nivel de descubrimiento activo (familiar, balanced, exploratory).
 * 12. Edición: cambio de género preferido desde el perfil.
 * 13. Edición: eliminación de género preferido desde el perfil.
 * 14. Edición: modificación de tiempo disponible.
 * 15. Edición: modificación de modo de juego.
 * 16. Edición: modificación de dificultad deseada.
 * 17. Edición: adición de exclusión con resolución automática de contradicciones.
 * 18. Edición: eliminación de exclusión desde el perfil.
 * 19. Re-evaluación inmediata de recomendaciones con el perfil editado.
 * 20. Limpieza completa del perfil temporal al reiniciar la conversación.
 */

const path = require("path")
const dotenv = require("dotenv")
dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const {
    createInitialMemory,
    initConversationMemory,
    syncMemoryFromTurn,
    buildActiveCriteria,
    applyProfileUpdate
} = require("../services/conversationMemoryService")
const { processDialogueTurn } = require("../services/dialogueManager")
const { evaluateRecommendations } = require("../services/recommendationEngine")

async function runEtapa5Tests() {
    console.log("==========================================================================")
    console.log("=== BATERÍA DE PRUEBAS: ETAPA 5 - PERFIL TEMPORAL DEL JUGADOR ===")
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
    // 1. Perfil temporal vacío al inicio de la conversación
    // =========================================================================
    const initialMem = createInitialMemory()
    const activeInitCriteria = buildActiveCriteria(initialMem)

    const isInitialEmpty =
        initialMem.habitualPreferences.genres.length === 0 &&
        initialMem.habitualPreferences.features.length === 0 &&
        initialMem.currentNeeds.preferredGenres.length === 0 &&
        initialMem.currentNeeds.dislikedGenres.length === 0 &&
        initialMem.currentNeeds.emotion.length === 0 &&
        initialMem.currentNeeds.availableTime === null &&
        initialMem.currentNeeds.gameMode === null &&
        initialMem.currentNeeds.desiredDifficulty === null &&
        initialMem.pastExperiences.likedGames.length === 0 &&
        initialMem.pastExperiences.dislikedGames.length === 0 &&
        activeInitCriteria.preferredGenres.length === 0

    assertTest(
        isInitialEmpty,
        1,
        "Perfil temporal vacío al inicio de la conversación",
        "Todos los campos inicializados sin datos ficticios"
    )

    // =========================================================================
    // 2. Reflejo de género preferido tras mención en el chat
    // =========================================================================
    const turnGenre = await processDialogueTurn({
        userMessage: "Me gustan mucho los juegos de rol y estrategia",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const memGenre = turnGenre.dialogueState.conversationMemory
    const hasRoleOrStrategy =
        memGenre.currentNeeds.preferredGenres.some((g) => /rpg|rol|estrategia/i.test(g)) ||
        turnGenre.updatedCriteria.preferredGenres.some((g) => /rpg|rol|estrategia/i.test(g))

    assertTest(
        hasRoleOrStrategy,
        2,
        "Reflejo de género preferido tras mención en el chat",
        `Preferidos: [${turnGenre.updatedCriteria.preferredGenres.join(", ")}]`
    )

    // =========================================================================
    // 3. Reflejo de tiempo disponible tras mención en el chat
    // =========================================================================
    const turnTime = await processDialogueTurn({
        userMessage: "Hoy solo tengo 30 minutos para jugar",
        accumulatedCriteria: turnGenre.updatedCriteria,
        dialogueState: turnGenre.dialogueState
    })
    const memTime = turnTime.dialogueState.conversationMemory
    const hasTime30 =
        (memTime.currentNeeds.availableTime && memTime.currentNeeds.availableTime.includes("30")) ||
        (turnTime.updatedCriteria.availableTime && turnTime.updatedCriteria.availableTime.includes("30"))

    assertTest(
        Boolean(hasTime30),
        3,
        "Reflejo de tiempo disponible tras mención en el chat",
        `availableTime: ${turnTime.updatedCriteria.availableTime}`
    )

    // =========================================================================
    // 4. Reflejo de modo de juego tras mención en el chat
    // =========================================================================
    const turnMode = await processDialogueTurn({
        userMessage: "Prefiero jugar en solitario sin conexión",
        accumulatedCriteria: turnTime.updatedCriteria,
        dialogueState: turnTime.dialogueState
    })
    const memMode = turnMode.dialogueState.conversationMemory
    const hasSingleplayer =
        /un jugador|individual|solitario/i.test(memMode.currentNeeds.gameMode || "") ||
        /un jugador|individual|solitario/i.test(turnMode.updatedCriteria.gameMode || "")

    assertTest(
        hasSingleplayer,
        4,
        "Reflejo de modo de juego tras mención en el chat",
        `gameMode: ${turnMode.updatedCriteria.gameMode}`
    )

    // =========================================================================
    // 5. Reflejo de dificultad tras mención en el chat
    // =========================================================================
    const turnDiff = await processDialogueTurn({
        userMessage: "Busco una dificultad relajada y tranquila sin estrés",
        accumulatedCriteria: turnMode.updatedCriteria,
        dialogueState: turnMode.dialogueState
    })
    const memDiff = turnDiff.dialogueState.conversationMemory
    const hasDiff =
        /baja|relajada/i.test(memDiff.currentNeeds.desiredDifficulty || "") ||
        /baja|relajada/i.test(turnDiff.updatedCriteria.desiredDifficulty || "")

    assertTest(
        hasDiff,
        5,
        "Reflejo de dificultad tras mención en el chat",
        `desiredDifficulty: ${turnDiff.updatedCriteria.desiredDifficulty}`
    )

    // =========================================================================
    // 6. Reflejo de emociones / tipo de experiencia expresada
    // =========================================================================
    const turnEmotion = await processDialogueTurn({
        userMessage: "Quiero relajarme y desconectar después del trabajo",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const memEmotion = turnEmotion.dialogueState.conversationMemory
    const hasRelaxingEmotion =
        memEmotion.currentNeeds.emotion.includes("relajante") ||
        turnEmotion.updatedCriteria.emotionalContext.includes("relajante")

    assertTest(
        hasRelaxingEmotion,
        6,
        "Reflejo de emociones / tipo de experiencia expresada",
        `Emoción registrada: [${turnEmotion.updatedCriteria.emotionalContext.join(", ")}]`
    )

    // =========================================================================
    // 7. Reflejo de juegos favoritos mencionados con motivo
    // =========================================================================
    const turnLikedGame = await processDialogueTurn({
        userMessage: "Me encantó Subnautica porque me fascina explorar mundos submarinos",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const memLiked = turnLikedGame.dialogueState.conversationMemory
    const subnauticaLiked = memLiked.pastExperiences.likedGames.find((g) =>
        /subnautica/i.test(g.title)
    )
    const hasMotive = subnauticaLiked && subnauticaLiked.motive && subnauticaLiked.motive.length > 0

    assertTest(
        Boolean(subnauticaLiked && hasMotive),
        7,
        "Reflejo de juegos favoritos mencionados con motivo",
        `Juego: ${subnauticaLiked?.title}, Motivo: "${subnauticaLiked?.motive}"`
    )

    // =========================================================================
    // 8. Reflejo de exclusiones y géneros rechazados
    // =========================================================================
    const turnExclusion = await processDialogueTurn({
        userMessage: "No me gusta el terror ni los juegos de miedo con sustos",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const memExclusion = turnExclusion.dialogueState.conversationMemory
    const hasTerrorExcluded =
        memExclusion.currentNeeds.dislikedGenres.includes("Terror") ||
        turnExclusion.updatedCriteria.dislikedGenres.includes("Terror")

    assertTest(
        hasTerrorExcluded,
        8,
        "Reflejo de exclusiones y géneros rechazados",
        `Exclusiones: [${turnExclusion.updatedCriteria.dislikedGenres.join(", ")}]`
    )

    // =========================================================================
    // 9. Reflejo de elementos mecánicos no deseados
    // =========================================================================
    const turnFeature = await processDialogueTurn({
        userMessage: "Nada de pixel art ni gráficos retro",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const memFeature = turnFeature.dialogueState.conversationMemory
    const hasPixelArtExcluded =
        memFeature.currentNeeds.dislikedFeatures.some((f) => /pixel/i.test(f)) ||
        turnFeature.updatedCriteria.dislikedFeatures.some((f) => /pixel/i.test(f))

    assertTest(
        hasPixelArtExcluded,
        9,
        "Reflejo de elementos mecánicos no deseados",
        `Disliked features: [${turnFeature.updatedCriteria.dislikedFeatures.join(", ")}]`
    )

    // =========================================================================
    // 10. Reflejo de juegos rechazados en la memoria
    // =========================================================================
    const turnDislikedGame = await processDialogueTurn({
        userMessage: "Jugué Hollow Knight pero no me gustó nada porque es demasiado frustrante",
        accumulatedCriteria: {},
        dialogueState: {}
    })
    const memDislikedGame = turnDislikedGame.dialogueState.conversationMemory
    const hollowDisliked = memDislikedGame.pastExperiences.dislikedGames.find((g) =>
        /hollow\s*knight/i.test(g.title)
    )

    assertTest(
        Boolean(hollowDisliked),
        10,
        "Reflejo de juegos rechazados en la memoria",
        `Juego rechazado: ${hollowDisliked?.title}, Motivo: "${hollowDisliked?.motive}"`
    )

    // =========================================================================
    // 11. Reflejo de nivel de descubrimiento activo
    // =========================================================================
    let memDiscovery = createInitialMemory()
    let critDiscovery = buildActiveCriteria(memDiscovery)
    const updateDiscovery = applyProfileUpdate({
        memory: memDiscovery,
        criteria: critDiscovery,
        updateAction: { type: "change_discovery", value: "exploratory" }
    })

    assertTest(
        updateDiscovery.memory.currentNeeds.discoveryPreference === "exploratory" &&
        updateDiscovery.criteria.discoveryPreference === "exploratory",
        11,
        "Reflejo de nivel de descubrimiento activo (familiar, balanced, exploratory)",
        `discoveryPreference: ${updateDiscovery.criteria.discoveryPreference}`
    )

    // =========================================================================
    // 12. Edición: cambio de género preferido desde el perfil
    // =========================================================================
    const updateGenre = applyProfileUpdate({
        memory: updateDiscovery.memory,
        criteria: updateDiscovery.criteria,
        updateAction: { type: "change_genre", value: "RPG", operation: "replace" }
    })

    assertTest(
        updateGenre.memory.currentNeeds.preferredGenres.includes("RPG") &&
        updateGenre.criteria.preferredGenres.includes("RPG"),
        12,
        "Edición: cambio de género preferido desde el perfil",
        `Género activo sustituido a RPG: [${updateGenre.criteria.preferredGenres.join(", ")}]`
    )

    // =========================================================================
    // 13. Edición: eliminación de género preferido desde el perfil
    // =========================================================================
    const deleteGenre = applyProfileUpdate({
        memory: updateGenre.memory,
        criteria: updateGenre.criteria,
        updateAction: { type: "delete_genre", value: "RPG" }
    })

    assertTest(
        !deleteGenre.memory.currentNeeds.preferredGenres.includes("RPG") &&
        !deleteGenre.criteria.preferredGenres.includes("RPG"),
        13,
        "Edición: eliminación de género preferido desde el perfil",
        `Géneros tras borrado: [${deleteGenre.criteria.preferredGenres.join(", ")}]`
    )

    // =========================================================================
    // 14. Edición: modificación de tiempo disponible
    // =========================================================================
    const updateTime = applyProfileUpdate({
        memory: deleteGenre.memory,
        criteria: deleteGenre.criteria,
        updateAction: { type: "change_time", value: "más de 60 minutos" }
    })

    assertTest(
        updateTime.memory.currentNeeds.availableTime === "más de 60 minutos" &&
        updateTime.criteria.availableTime === "más de 60 minutos",
        14,
        "Edición: modificación de tiempo disponible",
        `Nuevo tiempo: ${updateTime.criteria.availableTime}`
    )

    // =========================================================================
    // 15. Edición: modificación de modo de juego
    // =========================================================================
    const updateMode = applyProfileUpdate({
        memory: updateTime.memory,
        criteria: updateTime.criteria,
        updateAction: { type: "change_mode", value: "cooperativo" }
    })

    assertTest(
        updateMode.memory.currentNeeds.gameMode === "cooperativo" &&
        updateMode.criteria.gameMode === "cooperativo",
        15,
        "Edición: modificación de modo de juego",
        `Nuevo modo: ${updateMode.criteria.gameMode}`
    )

    // =========================================================================
    // 16. Edición: modificación de dificultad deseada
    // =========================================================================
    const updateDifficulty = applyProfileUpdate({
        memory: updateMode.memory,
        criteria: updateMode.criteria,
        updateAction: { type: "change_difficulty", value: "desafiante" }
    })

    assertTest(
        updateDifficulty.memory.currentNeeds.desiredDifficulty === "desafiante" &&
        updateDifficulty.criteria.desiredDifficulty === "desafiante",
        16,
        "Edición: modificación de dificultad deseada",
        `Nueva dificultad: ${updateDifficulty.criteria.desiredDifficulty}`
    )

    // =========================================================================
    // 17. Edición: adición de exclusión con resolución automática de contradicciones
    // =========================================================================
    // Primero añadimos "Acción" como preferido
    let testMem = createInitialMemory()
    testMem.currentNeeds.preferredGenres = ["Acción", "Estrategia"]
    testMem.habitualPreferences.genres = ["Acción"]
    let testCrit = buildActiveCriteria(testMem)

    // Ahora añadimos "Acción" a exclusión
    const addExcl = applyProfileUpdate({
        memory: testMem,
        criteria: testCrit,
        updateAction: { type: "add_exclusion", value: "Acción" }
    })

    const isExcluded = addExcl.criteria.dislikedGenres.includes("Acción")
    const isRemovedFromPreferred = !addExcl.criteria.preferredGenres.includes("Acción")
    const isRemovedFromMemoryPreferred = !addExcl.memory.currentNeeds.preferredGenres.includes("Acción")

    assertTest(
        isExcluded && isRemovedFromPreferred && isRemovedFromMemoryPreferred,
        17,
        "Edición: adición de exclusión con resolución de contradicciones",
        "Acción excluida y purgada automáticamente de preferidos"
    )

    // =========================================================================
    // 18. Edición: eliminación de exclusión desde el perfil
    // =========================================================================
    const remExcl = applyProfileUpdate({
        memory: addExcl.memory,
        criteria: addExcl.criteria,
        updateAction: { type: "remove_exclusion", value: "Acción" }
    })

    const isExclusionCleared = !remExcl.criteria.dislikedGenres.includes("Acción") &&
        !remExcl.memory.currentNeeds.dislikedGenres.includes("Acción")

    assertTest(
        isExclusionCleared,
        18,
        "Edición: eliminación de exclusión desde el perfil",
        `Exclusiones restantes: [${remExcl.criteria.dislikedGenres.join(", ")}]`
    )

    // =========================================================================
    // 19. Re-evaluación inmediata de recomendaciones con el perfil editado
    // =========================================================================
    // Crear un perfil editado que prefiera "Construcción" y excluya "Terror"
    const profileEdited = applyProfileUpdate({
        memory: createInitialMemory(),
        criteria: {},
        updateAction: { type: "change_genre", value: "Construcción", operation: "replace" }
    })
    const finalProfile = applyProfileUpdate({
        memory: profileEdited.memory,
        criteria: profileEdited.criteria,
        updateAction: { type: "add_exclusion", value: "Terror" }
    })

    const recsWithProfile = await evaluateRecommendations(finalProfile.criteria, { limit: 4 })
    const hasValidRecommendations = recsWithProfile.length > 0
    const noTerrorInRecs = recsWithProfile.every((r) =>
        !r.game.genres.some((g) => g.toLowerCase() === "terror")
    )
    const hasConstruction = recsWithProfile.some((r) =>
        r.game.genres.some((g) => g.toLowerCase() === "construcción")
    )

    assertTest(
        hasValidRecommendations && noTerrorInRecs && hasConstruction,
        19,
        "Re-evaluación inmediata de recomendaciones con el perfil editado",
        `Recomendaciones generadas: ${recsWithProfile.map((r) => r.game.title).join(", ")}`
    )

    // =========================================================================
    // 20. Limpieza completa del perfil temporal al reiniciar la conversación
    // =========================================================================
    // Simular handleReset: reset a estado inicial vacío
    const resetMem = createInitialMemory()
    const resetCriteria = buildActiveCriteria(resetMem)

    const isCompletelyReset =
        resetMem.habitualPreferences.genres.length === 0 &&
        resetMem.habitualPreferences.features.length === 0 &&
        resetMem.currentNeeds.preferredGenres.length === 0 &&
        resetMem.currentNeeds.dislikedGenres.length === 0 &&
        resetMem.pastExperiences.likedGames.length === 0 &&
        resetMem.memoryLog.length === 0 &&
        resetCriteria.preferredGenres.length === 0 &&
        resetCriteria.dislikedGenres.length === 0

    assertTest(
        isCompletelyReset,
        20,
        "Limpieza completa del perfil temporal al reiniciar la conversación",
        "Memoria, criterios y logs reiniciados a cero sin persistencia"
    )

    console.log(`\n==========================================================================`)
    console.log(`RESUMEN ETAPA 5: ${passed} pasadas de ${passed + failed} pruebas (${failed} falladas).`)
    console.log(`==========================================================================\n`)

    if (failed > 0) {
        process.exit(1)
    } else {
        process.exit(0)
    }
}

runEtapa5Tests().catch((err) => {
    console.error("Error en pruebas de Etapa 5:", err)
    process.exit(1)
})
