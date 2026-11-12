/**
 * Batería de pruebas automatizadas para la Etapa 1 - Tercera Evolución
 * Ampliación y normalización de metadatos del catálogo de videojuegos en RecoGames.
 */

const path = require("path")
const dotenv = require("dotenv")
const mongoose = require("mongoose")

dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const Game = require("../models/Game")
const { validateGame, validateCatalog } = require("../utils/gameValidator")
const { normalizeStringArray, normalizeExperienceAttributes, normalizeObjectiveStyle } = require("../utils/metadataNormalizer")
const { evaluateRecommendations } = require("../services/recommendationEngine")
const { processDialogueTurn } = require("../services/dialogueManager")

async function runMetadataTests() {
    console.log("==========================================================================")
    console.log("=== BATERÍA DE PRUEBAS: ETAPA 1 - AMPLIACIÓN Y NORMALIZACIÓN DE METADATOS ===")
    console.log("==========================================================================\n")

    await connectDB()

    let passedCount = 0
    let failedCount = 0

    function assert(condition, testName, details = "") {
        if (condition) {
            console.log(`✓ [PASADO] ${testName}`)
            passedCount++
        } else {
            console.error(`❌ [FALLADO] ${testName}. Detalle: ${details}`)
            failedCount++
        }
    }

    try {
        // ----------------------------------------------------------------------
        // PRUEBA 1: Modelo Game con los campos actuales
        // ----------------------------------------------------------------------
        const gameTraditional = new Game({
            title: "Test Game Tradicional",
            description: "Un juego de prueba con campos tradicionales.",
            genres: ["Aventura"],
            platforms: ["PC"],
            gameModes: ["individual"],
            sessionDuration: "corta (< 30 min)",
            pacing: "relajado",
            difficulty: "media",
            emotionalTags: ["relajante"],
            experienceHighlights: ["Destacado 1"],
            similarTo: ["Hades"],
            imageUrl: "https://example.com/image.jpg",
            priceCondition: "De pago"
        })
        const errTraditional = gameTraditional.validateSync()
        assert(!errTraditional, "1. Modelo Game admite los campos tradicionales sin error", errTraditional && errTraditional.message)

        // ----------------------------------------------------------------------
        // PRUEBA 2: Modelo Game con los nuevos atributos
        // ----------------------------------------------------------------------
        const gameWithNewAttrs = new Game({
            title: "Test Game Con Nuevos Atributos",
            description: "Un juego con atributos de experiencia y estilo de objetivo.",
            genres: ["RPG"],
            gameModes: ["individual"],
            sessionDuration: "media (30-60 min)",
            objectiveStyle: "mixto",
            experienceAttributes: {
                exploration: 4,
                narrative: 5,
                creativity: 2,
                strategy: 3,
                combat: 4,
                freedom: 3,
                complexity: 4
            }
        })
        const errNewAttrs = gameWithNewAttrs.validateSync()
        assert(!errNewAttrs, "2. Modelo Game admite nuevos atributos (experienceAttributes y objectiveStyle)", errNewAttrs && errNewAttrs.message)

        // ----------------------------------------------------------------------
        // PRUEBA 3: Valores de experiencia entre 0 y 5 aceptados
        // ----------------------------------------------------------------------
        const gameEdges = new Game({
            title: "Test Game Limites",
            description: "Prueba de valores límite 0 y 5.",
            genres: ["Puzzle"],
            gameModes: ["individual"],
            sessionDuration: "corta (< 30 min)",
            experienceAttributes: {
                exploration: 0,
                narrative: 5,
                creativity: 0,
                strategy: 5,
                combat: 0,
                freedom: 5,
                complexity: 0
            }
        })
        const errEdges = gameEdges.validateSync()
        assert(!errEdges, "3. Valores de experiencia en los extremos 0 y 5 son válidos y aceptados")

        // ----------------------------------------------------------------------
        // PRUEBA 4: Rechazo de valores negativos
        // ----------------------------------------------------------------------
        const gameNegative = new Game({
            title: "Test Game Negativo",
            description: "Valor negativo.",
            genres: ["Acción"],
            gameModes: ["individual"],
            sessionDuration: "corta (< 30 min)",
            experienceAttributes: { exploration: -1 }
        })
        const errNeg = gameNegative.validateSync()
        assert(errNeg && errNeg.errors["experienceAttributes.exploration"], "4. Rechazo estricto de valores negativos (< 0) en experienceAttributes")

        // ----------------------------------------------------------------------
        // PRUEBA 5: Rechazo de valores superiores a 5
        // ----------------------------------------------------------------------
        const gameOverflow = new Game({
            title: "Test Game Overflow",
            description: "Valor superior a 5.",
            genres: ["Acción"],
            gameModes: ["individual"],
            sessionDuration: "corta (< 30 min)",
            experienceAttributes: { combat: 6 }
        })
        const errOver = gameOverflow.validateSync()
        assert(errOver && errOver.errors["experienceAttributes.combat"], "5. Rechazo estricto de valores superiores a 5 en experienceAttributes")

        // ----------------------------------------------------------------------
        // PRUEBA 6: Rechazo de valores no enteros (decimales)
        // ----------------------------------------------------------------------
        const gameDecimal = new Game({
            title: "Test Game Decimal",
            description: "Valor no entero.",
            genres: ["Estrategia"],
            gameModes: ["individual"],
            sessionDuration: "corta (< 30 min)",
            experienceAttributes: { strategy: 3.5 }
        })
        const errDec = gameDecimal.validateSync()
        assert(errDec && errDec.errors["experienceAttributes.strategy"], "6. Rechazo estricto de valores no enteros (decimales) en experienceAttributes")

        // ----------------------------------------------------------------------
        // PRUEBA 7: Campos desconocidos representados como null
        // ----------------------------------------------------------------------
        const gameNulls = new Game({
            title: "Test Game Nulls",
            description: "Juego con atributos pendientes representados como null.",
            genres: ["Indie"],
            gameModes: ["individual"],
            sessionDuration: "corta (< 30 min)",
            objectiveStyle: null,
            experienceAttributes: {
                exploration: 4,
                narrative: null,
                creativity: null,
                strategy: null,
                combat: null,
                freedom: null,
                complexity: null
            }
        })
        const errNulls = gameNulls.validateSync()
        assert(!errNulls && gameNulls.experienceAttributes.narrative === null, "7. Campos desconocidos aceptados válidamente como null sin forzar ceros")

        // ----------------------------------------------------------------------
        // PRUEBA 8: Validación de objectiveStyle
        // ----------------------------------------------------------------------
        const validStyles = ["libre", "guiado", "mixto"]
        let allStylesValid = true
        for (const style of validStyles) {
            const g = new Game({
                title: `Test Game ${style}`,
                description: "Test style",
                genres: ["Indie"],
                gameModes: ["individual"],
                sessionDuration: "corta (< 30 min)",
                objectiveStyle: style
            })
            if (g.validateSync()) allStylesValid = false
        }
        const gInvalidStyle = new Game({
            title: "Test Game Invalid Style",
            description: "Test style",
            genres: ["Indie"],
            gameModes: ["individual"],
            sessionDuration: "corta (< 30 min)",
            objectiveStyle: "abierto_infinito"
        })
        const errInvStyle = gInvalidStyle.validateSync()
        assert(allStylesValid && errInvStyle && errInvStyle.errors["objectiveStyle"], "8. Validación estricta de objectiveStyle ('libre', 'guiado', 'mixto', null y rechazo de otros)")

        // ----------------------------------------------------------------------
        // PRUEBA 9: Normalización de etiquetas
        // ----------------------------------------------------------------------
        const rawTags = ["Aventura", "  aventura  ", "Exploración", "EXPLORACIÓN", "RPG"]
        const normalized = normalizeStringArray(rawTags, { toLowerCase: true })
        assert(normalized.length === 3 && normalized.includes("aventura") && normalized.includes("rpg"), "9. Normalización y deduplicación de etiquetas de texto")

        // ----------------------------------------------------------------------
        // PRUEBA 10: Detección de duplicados
        // ----------------------------------------------------------------------
        const duplicateCatalog = [
            { title: "Hades", description: "D1", genres: ["Acción"], gameModes: ["individual"], sessionDuration: "corta (< 30 min)" },
            { title: "hades", description: "D2", genres: ["Acción"], gameModes: ["individual"], sessionDuration: "corta (< 30 min)" }
        ]
        const dupCheck = validateCatalog(duplicateCatalog)
        assert(!dupCheck.isValid && dupCheck.fatalErrors.some(e => e.includes("duplicado")), "10. Detección automática de títulos duplicados en el catálogo")

        // ----------------------------------------------------------------------
        // PRUEBA 11: Registros existentes sin nuevos atributos
        // ----------------------------------------------------------------------
        const legacyGame = new Game({
            title: "Legacy Game Without New Fields",
            description: "Sin objectiveStyle ni experienceAttributes.",
            genres: ["Casual"],
            gameModes: ["individual"],
            sessionDuration: "corta (< 30 min)"
        })
        const errLegacy = legacyGame.validateSync()
        assert(!errLegacy && legacyGame.objectiveStyle === null && legacyGame.experienceAttributes === null, "11. Compatibilidad total con registros heredados que carecen de los nuevos campos")

        // ----------------------------------------------------------------------
        // PRUEBA 12: Seed ejecutado dos veces sin duplicar videojuegos
        // ----------------------------------------------------------------------
        const totalGamesInDb = await Game.countDocuments()
        const distinctTitles = await Game.distinct("title")
        assert(totalGamesInDb === distinctTitles.length && totalGamesInDb >= 80 && totalGamesInDb <= 100, `12. Idempotencia del catálogo en MongoDB (${totalGamesInDb} juegos y 0 duplicados)`)

        // ----------------------------------------------------------------------
        // PRUEBA 13: Actualización correcta de registros en MongoDB
        // ----------------------------------------------------------------------
        const stardew = await Game.findOne({ title: "Stardew Valley" })
        const hades = await Game.findOne({ title: "Hades" })
        const minecraft = await Game.findOne({ title: "Minecraft" })

        const updateOk = stardew && stardew.objectiveStyle === "libre" && stardew.experienceAttributes.freedom === 5 &&
                         hades && hades.objectiveStyle === "guiado" && hades.experienceAttributes.combat === 5 &&
                         minecraft && minecraft.objectiveStyle === "libre" && minecraft.experienceAttributes.creativity === 5
        assert(updateOk, "13. Actualización y persistencia de nuevos atributos en MongoDB confirmada")

        // ----------------------------------------------------------------------
        // PRUEBA 14: Conservación de imágenes oficiales y títulos existentes
        // ----------------------------------------------------------------------
        const gamesWithImages = await Game.find({ imageUrl: { $regex: /^https?:\/\//i } })
        assert(gamesWithImages.length === totalGamesInDb, `14. Conservación intacta de las ${gamesWithImages.length} URLs de imágenes oficiales del catálogo`)

        // ----------------------------------------------------------------------
        // PRUEBA 15: Compatibilidad con consultas actuales de Game
        // ----------------------------------------------------------------------
        const coopGames = await Game.find({ gameModes: "cooperativo" })
        const shortGames = await Game.find({ sessionDuration: "corta (< 30 min)" })
        assert(coopGames.length >= 8 && shortGames.length >= 9, "15. Compatibilidad total con filtros de consulta tradicionales de MongoDB")

        // ----------------------------------------------------------------------
        // PRUEBA 16: Compatibilidad con el motor de recomendaciones
        // ----------------------------------------------------------------------
        const recResult = await evaluateRecommendations({
            emotionalContext: ["relajante"],
            availableTime: "corta (< 30 min)",
            gameMode: "individual"
        })
        assert(recResult && recResult.length > 0 && recResult[0].game.title === "Dorfromantik", "16. Compatibilidad absoluta del motor de recomendaciones (Dorfromantik top 1 relax corto)")

        // ----------------------------------------------------------------------
        // PRUEBA 17: Compatibilidad con el chatbot y diálogo conversacional
        // ----------------------------------------------------------------------
        const chatTurn = await processDialogueTurn({
            userMessage: "Hola, me gustaría relajarme hoy con algún juego de granja o construcción.",
            accumulatedCriteria: {},
            dialogueState: {}
        })
        assert(chatTurn && chatTurn.reply && chatTurn.updatedCriteria, "17. Compatibilidad absoluta con el flujo conversacional y gestor de diálogo")

        console.log("\n==========================================================================")
        console.log(`RESUMEN: ${passedCount} pasadas de 17 pruebas (${failedCount} falladas).`)
        console.log("==========================================================================")

        await mongoose.connection.close()
        process.exit(failedCount === 0 ? 0 : 1)
    } catch (error) {
        console.error("Error fatal durante la ejecución de las pruebas de metadatos:", error)
        await mongoose.connection.close()
        process.exit(1)
    }
}

runMetadataTests()
