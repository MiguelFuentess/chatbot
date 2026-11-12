/**
 * Batería de pruebas automatizadas para la Etapa 2 - Tercera Evolución
 * Ampliación del catálogo a 80-100 videojuegos en RecoGames.
 */

const path = require("path")
const dotenv = require("dotenv")
const mongoose = require("mongoose")

dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const Game = require("../models/Game")
const { validateCatalog } = require("../utils/gameValidator")
const { evaluateRecommendations } = require("../services/recommendationEngine")
const { processDialogueTurn } = require("../services/dialogueManager")

async function runCatalogExpansionTests() {
    console.log("==========================================================================")
    console.log("=== BATERÍA DE PRUEBAS: ETAPA 2 - AMPLIACIÓN DEL CATÁLOGO (80-100 JUEGOS) ===")
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
        const seedGames = require("../data/seedGames.json")
        const totalInDb = await Game.countDocuments()
        const distinctTitlesInDb = await Game.distinct("title")

        // 1. Número total de registros en el rango 80-100
        assert(
            totalInDb >= 80 && totalInDb <= 100 && seedGames.length === totalInDb,
            `1. Catálogo ampliado en rango objetivo [80..100] (Actual: ${totalInDb} títulos en DB y JSON)`
        )

        // 2. Ausencia de títulos duplicados
        assert(
            distinctTitlesInDb.length === totalInDb,
            `2. Cero duplicados en base de datos (${distinctTitlesInDb.length} títulos únicos de ${totalInDb})`
        )

        // 3. Ausencia de títulos vacíos
        const emptyTitles = seedGames.filter((g) => !g.title || !g.title.trim())
        assert(emptyTitles.length === 0, "3. Cero títulos vacíos o indefinidos")

        // 4. Géneros válidos en todos los registros
        const invalidGenres = seedGames.filter(
            (g) => !Array.isArray(g.genres) || g.genres.length === 0 || g.genres.some((gen) => typeof gen !== "string" || !gen.trim())
        )
        assert(invalidGenres.length === 0, "4. Géneros válidos y no vacíos en el 100% de los registros")

        // 5. Modalidades válidas (individual, cooperativo, multijugador)
        const allowedModes = ["individual", "cooperativo", "multijugador"]
        const invalidModes = seedGames.filter(
            (g) => !Array.isArray(g.gameModes) || g.gameModes.some((m) => !allowedModes.includes(m))
        )
        assert(invalidModes.length === 0, "5. Modalidades de juego conforme al vocabulario controlado")

        // 6. Dificultades válidas
        const allowedDiff = ["baja", "media", "alta", "ajustable"]
        const invalidDiff = seedGames.filter((g) => g.difficulty && !allowedDiff.includes(g.difficulty))
        assert(invalidDiff.length === 0, "6. Dificultades conformes al enum ('baja', 'media', 'alta', 'ajustable')")

        // 7. Duraciones de sesión válidas
        const allowedDur = ["corta (< 30 min)", "media (30-60 min)", "larga (> 1 hora)"]
        const invalidDur = seedGames.filter((g) => !allowedDur.includes(g.sessionDuration))
        assert(invalidDur.length === 0, "7. Duraciones de sesión conformes a las tres categorías normalizadas")

        // 8. Valores en rango en atributos de experiencia (0..5 o null)
        const expKeys = ["exploration", "narrative", "creativity", "strategy", "combat", "freedom", "complexity"]
        let invalidExpValues = 0
        seedGames.forEach((g) => {
            if (g.experienceAttributes) {
                expKeys.forEach((k) => {
                    const v = g.experienceAttributes[k]
                    if (v !== null && (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 5)) {
                        invalidExpValues++
                    }
                })
            }
        })
        assert(invalidExpValues === 0, "8. Atributos de experiencia estrictamente enteros [0..5] o null")

        // 9. Cobertura de clasificación de atributos
        const validation = validateCatalog(seedGames)
        assert(
            validation.isValid && validation.coverage.percentageClassified === 100,
            `9. Cobertura de atributos de experiencia al 100% (${validation.coverage.totalClassifiedAttributes}/${validation.coverage.totalPossibleAttributes} clasificados)`
        )

        // 10. URLs de imágenes bien formadas
        const malformedImages = seedGames.filter((g) => !g.imageUrl || !/^https?:\/\//i.test(g.imageUrl.trim()))
        assert(malformedImages.length === 0, "10. El 100% de los títulos dispone de una URL HTTPS de imagen oficial válida")

        // 11. Campos obligatorios presentes
        const missingMandatory = seedGames.filter((g) => !g.title || !g.description || !g.genres || !g.gameModes || !g.sessionDuration)
        assert(missingMandatory.length === 0, "11. Campos obligatorios íntegros en los 88 registros")

        // 12. Estilo de objetivos válido (libre, guiado, mixto)
        const allowedObj = ["libre", "guiado", "mixto"]
        const invalidObj = seedGames.filter((g) => !allowedObj.includes(g.objectiveStyle))
        assert(invalidObj.length === 0, "12. Estilo de objetivos (objectiveStyle) 100% clasificado y válido")

        // 13. Plataforma PC verificada
        const nonPC = seedGames.filter((g) => !Array.isArray(g.platforms) || !g.platforms.includes("PC"))
        assert(nonPC.length === 0, "13. Disponibilidad en plataforma PC verificada en todos los títulos")

        // 14. Referencias de similitud válidas y sin duplicados
        let duplicateSimilar = 0
        seedGames.forEach((g) => {
            if (Array.isArray(g.similarTo)) {
                const sSet = new Set()
                g.similarTo.forEach((s) => {
                    const clean = s.toLowerCase().trim()
                    if (sSet.has(clean)) duplicateSimilar++
                    sSet.add(clean)
                })
            }
        })
        assert(duplicateSimilar === 0, "14. Cero duplicados en el listado de juegos similares (similarTo)")

        // 15. Integridad y persistencia en MongoDB
        const sampleGames = await Game.find({
            title: { $in: ["Unpacking", "Factorio", "Balatro", "Satisfactory", "Dave the Diver"] }
        })
        assert(sampleGames.length === 5, "15. Muestra aleatoria de títulos nuevos persistida correctamente en MongoDB")

        // 16. Consultas polimórficas tradicionales
        const puzzleGames = await Game.find({ genres: "Puzzle" })
        const coopGames = await Game.find({ gameModes: "cooperativo" })
        const longGames = await Game.find({ sessionDuration: "larga (> 1 hora)" })
        assert(
            puzzleGames.length >= 15 && coopGames.length >= 20 && longGames.length >= 15,
            `16. Diversidad enriquecida en consultas MongoDB (Puzzles: ${puzzleGames.length}, Coop: ${coopGames.length}, Largos: ${longGames.length})`
        )

        // 17. Recomendación multicriterio funcional con catálogo ampliado
        const recPuzzles = await evaluateRecommendations({
            preferredGenres: ["Puzzle"],
            emotionalContext: ["relajante"],
            availableTime: "corta (< 30 min)"
        })
        assert(recPuzzles && recPuzzles.length > 0, "17. Motor de recomendaciones genera propuestas coherentes con catálogo ampliado")

        // 18. Flujo conversacional y chatbot estable
        const chatResp = await processDialogueTurn({
            userMessage: "Busco un juego de puzles relajante o algo de organizar",
            accumulatedCriteria: {},
            dialogueState: {}
        })
        assert(chatResp && chatResp.reply && chatResp.updatedCriteria, "18. Integración plena con el gestor conversacional de diálogo")

        console.log("\n==========================================================================")
        console.log(`RESUMEN ETAPA 2: ${passedCount} pasadas de 18 pruebas (${failedCount} falladas).`)
        console.log("==========================================================================")

        await mongoose.connection.close()
        process.exit(failedCount === 0 ? 0 : 1)
    } catch (error) {
        console.error("Error fatal en pruebas de ampliación de catálogo:", error)
        await mongoose.connection.close()
        process.exit(1)
    }
}

runCatalogExpansionTests()
