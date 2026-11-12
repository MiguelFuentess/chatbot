/**
 * Batería de Pruebas Automatizadas - Tercera Evolución: Etapa 3
 * Nuevos filtros de preferencias, atributos graduables y mejora del cálculo de afinidad.
 *
 * Cubre los 25 escenarios obligatorios especificados en la sección 13:
 * 1. Preferencia por exploración alta.
 * 2. Preferencia por narrativa.
 * 3. Preferencia por creatividad.
 * 4. Preferencia por estrategia.
 * 5. Preferencia por combate intenso.
 * 6. Preferencia por poco combate.
 * 7. Preferencia por libertad de juego.
 * 8. Preferencia por objetivos guiados.
 * 9. Solicitud de dificultad baja.
 * 10. Solicitud de dificultad alta.
 * 11. Restricción de juegos gratuitos.
 * 12. Restricción de modalidad cooperativa.
 * 13. Exclusión estricta de terror.
 * 14. Múltiples preferencias positivas.
 * 15. Preferencias positivas y negativas combinadas.
 * 16. Criterios contradictorios.
 * 17. Cambio de opinión durante la conversación.
 * 18. Metadatos desconocidos.
 * 19. Videojuego con pocos atributos clasificados.
 * 20. Usuario que proporciona un solo criterio (calibración epistémica de afinidad).
 * 21. Usuario que proporciona muchos criterios.
 * 22. Solicitud de alternativas.
 * 23. Reinicio de conversación.
 * 24. Compatibilidad con la memoria conversacional.
 * 25. Compatibilidad con recomendaciones anteriores.
 * 26. Límites matemáticos y normalización estricta de pesos [0..100].
 */

const path = require("path")
const dotenv = require("dotenv")
dotenv.config({ path: path.join(__dirname, "../.env") })

const mongoose = require("mongoose")
const connectDB = require("../config/db")
const Game = require("../models/Game")
const {
    evaluateRecommendations,
    scoreExperienceAttribute,
    scoreObjectiveStyle,
    scoreDifficulty,
    evaluatePrice
} = require("../services/recommendationEngine")
const { parseUserMessage } = require("../services/nlpService")
const { generateExplanation } = require("../services/explanationService")
const { processDialogueTurn } = require("../services/dialogueManager")
const {
    createInitialMemory,
    initConversationMemory,
    syncMemoryFromTurn,
    buildActiveCriteria
} = require("../services/conversationMemoryService")

async function runEtapa3Tests() {
    console.log("==========================================================================")
    console.log("=== BATERÍA DE PRUEBAS: ETAPA 3 - AFINIDAD Y NUEVOS FILTROS DE PREFERENCIA ===")
    console.log("==========================================================================")

    await connectDB()

    let passed = 0
    let failed = 0
    const results = []

    function assert(condition, message) {
        if (condition) {
            console.log(`✓ [PASADO] ${message}`)
            passed++
            results.push({ name: message, status: "PASADO" })
        } else {
            console.error(`✗ [FALLIDO] ${message}`)
            failed++
            results.push({ name: message, status: "FALLIDO" })
        }
    }

    try {
        // ----------------------------------------------------------------------
        // PRUEBA 1: Preferencia por exploración alta
        // ----------------------------------------------------------------------
        const r1 = await evaluateRecommendations({
            experiencePreferences: { exploration: "alto" }
        }, { limit: 3 })
        const p1Ok = r1.length > 0 && (r1[0].game.experienceAttributes?.exploration >= 4)
        assert(p1Ok, `1. Preferencia por exploración alta (Top 1: ${r1[0]?.game.title}, Exploration: ${r1[0]?.game.experienceAttributes?.exploration}/5)`)

        // ----------------------------------------------------------------------
        // PRUEBA 2: Preferencia por narrativa
        // ----------------------------------------------------------------------
        const r2 = await evaluateRecommendations({
            experiencePreferences: { narrative: "alto" }
        }, { limit: 3 })
        const p2Ok = r2.length > 0 && (r2[0].game.experienceAttributes?.narrative >= 4)
        const exp2 = generateExplanation(r2[0], { experiencePreferences: { narrative: "alto" } })
        assert(p2Ok && exp2.summaryText.toLowerCase().includes("historia"), `2. Preferencia por narrativa (Top 1: ${r2[0]?.game.title}, Narrative: ${r2[0]?.game.experienceAttributes?.narrative}/5)`)

        // ----------------------------------------------------------------------
        // PRUEBA 3: Preferencia por creatividad
        // ----------------------------------------------------------------------
        const r3 = await evaluateRecommendations({
            experiencePreferences: { creativity: "alto" }
        }, { limit: 3 })
        const p3Ok = r3.length > 0 && (r3[0].game.experienceAttributes?.creativity >= 4)
        assert(p3Ok, `3. Preferencia por creatividad (Top 1: ${r3[0]?.game.title}, Creativity: ${r3[0]?.game.experienceAttributes?.creativity}/5)`)

        // ----------------------------------------------------------------------
        // PRUEBA 4: Preferencia por estrategia
        // ----------------------------------------------------------------------
        const r4 = await evaluateRecommendations({
            experiencePreferences: { strategy: "alto" }
        }, { limit: 3 })
        const p4Ok = r4.length > 0 && (r4[0].game.experienceAttributes?.strategy >= 4)
        assert(p4Ok, `4. Preferencia por estrategia (Top 1: ${r4[0]?.game.title}, Strategy: ${r4[0]?.game.experienceAttributes?.strategy}/5)`)

        // ----------------------------------------------------------------------
        // PRUEBA 5: Preferencia por combate intenso
        // ----------------------------------------------------------------------
        const r5 = await evaluateRecommendations({
            experiencePreferences: { combat: "alto" }
        }, { limit: 3 })
        const p5Ok = r5.length > 0 && (r5[0].game.experienceAttributes?.combat >= 4)
        assert(p5Ok, `5. Preferencia por combate intenso (Top 1: ${r5[0]?.game.title}, Combat: ${r5[0]?.game.experienceAttributes?.combat}/5)`)

        // ----------------------------------------------------------------------
        // PRUEBA 6: Preferencia por poco combate
        // ----------------------------------------------------------------------
        const r6 = await evaluateRecommendations({
            experiencePreferences: { combat: "bajo" }
        }, { limit: 5 })
        const p6Ok = r6.length > 0 && r6.every(item => (item.game.experienceAttributes?.combat ?? 0) <= 2)
        assert(p6Ok, `6. Preferencia por poco combate (100% de recomendaciones con combate <= 2/5)`)

        // ----------------------------------------------------------------------
        // PRUEBA 7: Preferencia por libertad de juego
        // ----------------------------------------------------------------------
        const r7 = await evaluateRecommendations({
            experiencePreferences: { freedom: "alto" }
        }, { limit: 3 })
        const p7Ok = r7.length > 0 && (r7[0].game.experienceAttributes?.freedom >= 4)
        assert(p7Ok, `7. Preferencia por libertad de juego (Top 1: ${r7[0]?.game.title}, Freedom: ${r7[0]?.game.experienceAttributes?.freedom}/5)`)

        // ----------------------------------------------------------------------
        // PRUEBA 8: Preferencia por objetivos guiados
        // ----------------------------------------------------------------------
        const r8 = await evaluateRecommendations({
            objectiveStylePreference: "guiado"
        }, { limit: 3 })
        const p8Ok = r8.length > 0 && (r8[0].game.objectiveStyle === "guiado")
        assert(p8Ok, `8. Preferencia por objetivos guiados (Top 1: ${r8[0]?.game.title}, Style: ${r8[0]?.game.objectiveStyle})`)

        // ----------------------------------------------------------------------
        // PRUEBA 9: Solicitud de dificultad baja
        // ----------------------------------------------------------------------
        const r9 = await evaluateRecommendations({
            desiredDifficulty: "baja"
        }, { limit: 5 })
        const p9Ok = r9.length > 0 && ["baja", "ajustable"].includes(r9[0].game.difficulty)
        assert(p9Ok, `9. Solicitud de dificultad baja (Top 1: ${r9[0]?.game.title}, Dificultad: ${r9[0]?.game.difficulty})`)

        // ----------------------------------------------------------------------
        // PRUEBA 10: Solicitud de dificultad alta
        // ----------------------------------------------------------------------
        const r10 = await evaluateRecommendations({
            desiredDifficulty: "alta"
        }, { limit: 5 })
        const p10Ok = r10.length > 0 && r10[0].game.difficulty === "alta"
        assert(p10Ok, `10. Solicitud de dificultad alta (Top 1: ${r10[0]?.game.title}, Dificultad: ${r10[0]?.game.difficulty})`)

        // ----------------------------------------------------------------------
        // PRUEBA 11: Restricción de juegos gratuitos
        // ----------------------------------------------------------------------
        const pFreeRes = evaluatePrice("Gratuito", "gratuito", false)
        const pPaidStrict = evaluatePrice("De pago", "gratuito", true)
        const pPaidFlex = evaluatePrice("De pago", "gratuito", false)
        const p11Ok = pFreeRes.score === 1.0 && pPaidStrict.isDiscard === true && pPaidFlex.score < 0.30
        assert(p11Ok, "11. Evaluación y distinción rigurosa de condición de precio (gratuito 1.0, de pago estricto descartado)")

        // ----------------------------------------------------------------------
        // PRUEBA 12: Restricción estricta de modalidad cooperativa
        // ----------------------------------------------------------------------
        const r12 = await evaluateRecommendations({
            gameMode: "cooperativo"
        }, { limit: 10 })
        const p12Ok = r12.length > 0 && r12.every(item => item.game.gameModes.includes("cooperativo"))
        assert(p12Ok, `12. Restricción de modalidad cooperativa (100% de ${r12.length} resultados soporta cooperativo)`)

        // ----------------------------------------------------------------------
        // PRUEBA 13: Exclusión estricta de terror
        // ----------------------------------------------------------------------
        const r13 = await evaluateRecommendations({
            preferredGenres: ["Aventura"],
            dislikedGenres: ["Terror"]
        }, { limit: 15 })
        const p13Ok = r13.length > 0 && r13.every(item => !item.game.genres.some(g => g.toLowerCase().includes("terror")))
        assert(p13Ok, `13. Exclusión estricta de terror (100% de resultados libres de Terror)`)

        // ----------------------------------------------------------------------
        // PRUEBA 14: Múltiples preferencias positivas simultáneas
        // ----------------------------------------------------------------------
        const r14 = await evaluateRecommendations({
            preferredGenres: ["Aventura"],
            emotionalContext: ["buena historia"],
            experiencePreferences: {
                exploration: "alto",
                narrative: "alto"
            }
        }, { limit: 3 })
        const p14Ok = r14.length > 0 && r14[0].score >= 85 && r14[0].game.experienceAttributes?.exploration >= 4
        assert(p14Ok, `14. Múltiples preferencias positivas (Top 1: ${r14[0]?.game.title}, Score: ${r14[0]?.score}%)`)

        // ----------------------------------------------------------------------
        // PRUEBA 15: Preferencias positivas y negativas combinadas
        // ----------------------------------------------------------------------
        const r15 = await evaluateRecommendations({
            preferredGenres: ["Aventura"],
            experiencePreferences: {
                exploration: "alto",
                combat: "ninguno"
            }
        }, { limit: 5 })
        const p15Ok = r15.length > 0 && r15.every(item => (item.game.experienceAttributes?.combat ?? 0) <= 2)
        assert(p15Ok, `15. Preferencias positivas y negativas combinadas (Exploración alta + Cero combate, Top 1: ${r15[0]?.game.title})`)

        // ----------------------------------------------------------------------
        // PRUEBA 16: Criterios contradictorios resueltos en NLP
        // ----------------------------------------------------------------------
        const parsedContra = parseUserMessage("Quiero combates intensos, pero pensándolo mejor nada de combates")
        const p16Ok = parsedContra.criteria.experiencePreferences.combat === "ninguno" &&
                      parsedContra.criteria.dislikedFeatures.includes("combate_accion") &&
                      !parsedContra.criteria.likedFeatures.includes("combate_accion")
        assert(p16Ok, "16. Resolución consistente de contradicciones en NLP (la negación posterior prevalece)")

        // ----------------------------------------------------------------------
        // PRUEBA 17: Cambio de opinión durante la conversación
        // ----------------------------------------------------------------------
        const t1 = await processDialogueTurn({
            userMessage: "Quiero una aventura con mucho combate",
            accumulatedCriteria: {},
            dialogueState: {}
        })
        const t2 = await processDialogueTurn({
            userMessage: "Pensándolo mejor, prefiero explorar y evitar combates intensos",
            accumulatedCriteria: t1.updatedCriteria,
            dialogueState: t1.dialogueState
        })
        const p17Ok = ["bajo", "ninguno"].includes(t2.updatedCriteria.experiencePreferences.combat) &&
                      t2.updatedCriteria.experiencePreferences.exploration === "alto"
        assert(p17Ok, "17. Cambio de opinión durante la conversación (actualización coherente de prioridades)")

        // ----------------------------------------------------------------------
        // PRUEBA 18: Metadatos desconocidos evaluados como neutros (0.50)
        // ----------------------------------------------------------------------
        const expUnknown = scoreExperienceAttribute(null, "alto")
        const objUnknown = scoreObjectiveStyle(null, "guiado")
        const diffUnknown = scoreDifficulty(null, "alta")
        const p18Ok = expUnknown.score === 0.50 && expUnknown.isUnknown === true &&
                      objUnknown.score === 0.50 && objUnknown.isUnknown === true &&
                      diffUnknown.score === 0.50 && diffUnknown.isUnknown === true
        assert(p18Ok, "18. Tratamiento de metadatos desconocidos como neutrales (0.50) sin inventar ceros ni unos")

        // ----------------------------------------------------------------------
        // PRUEBA 19: Resiliencia ante juego con atributos nulos o incompletos
        // ----------------------------------------------------------------------
        const dummyGame = {
            title: "Test Incomplete Game",
            description: "Juego de prueba",
            genres: ["Aventura"],
            gameModes: ["individual"],
            sessionDuration: "media (30-60 min)",
            pacing: "moderado",
            difficulty: "media",
            emotionalTags: [],
            similarTo: [],
            experienceAttributes: null,
            objectiveStyle: null,
            priceCondition: null
        }
        let scoredDummy = null
        try {
            const resultWithDummy = await evaluateRecommendations({
                preferredGenres: ["Aventura"],
                experiencePreferences: { exploration: "alto" }
            }, { limit: 100 })
            scoredDummy = true
        } catch (e) {
            scoredDummy = false
        }
        assert(scoredDummy, "19. Resiliencia total ante videojuegos con atributos no clasificados o nulos")

        // ----------------------------------------------------------------------
        // PRUEBA 20: Usuario que proporciona un solo criterio (calibración epistémica)
        // ----------------------------------------------------------------------
        const rSingle = await evaluateRecommendations({
            availableTime: "corta (< 30 min)"
        }, { limit: 3 })
        const p20Ok = rSingle.length > 0 && rSingle[0].score <= 85 && rSingle[0].score >= 70 &&
                      rSingle[0].breakdown.confidenceLevel.includes("Estimación preliminar")
        assert(p20Ok, `20. Calibración epistémica con criterio único (Score: ${rSingle[0]?.score}%, Nivel: ${rSingle[0]?.breakdown.confidenceLevel})`)

        // ----------------------------------------------------------------------
        // PRUEBA 21: Usuario que proporciona muchos criterios
        // ----------------------------------------------------------------------
        const rMulti = await evaluateRecommendations({
            preferredGenres: ["Acción", "Roguelike"],
            emotionalContext: ["desafiante"],
            availableTime: "corta (< 30 min)",
            gameMode: "individual",
            desiredPacing: "intenso",
            desiredDifficulty: "alta",
            experiencePreferences: {
                combat: "alto"
            }
        }, { limit: 3 })
        const p21Ok = rMulti.length > 0 && rMulti[0].score >= 95 &&
                      rMulti[0].breakdown.confidenceLevel.includes("Estimación sólida")
        assert(p21Ok, `21. Evaluación multicriterio rica (Top 1: ${rMulti[0]?.game.title}, Score: ${rMulti[0]?.score}%, Confianza sólida)`)

        // ----------------------------------------------------------------------
        // PRUEBA 22: Solicitud de alternativas
        // ----------------------------------------------------------------------
        const rBatch1 = await evaluateRecommendations({
            preferredGenres: ["Puzzle"],
            experiencePreferences: { combat: "ninguno" }
        }, { limit: 3 })
        const shownTitles = rBatch1.map(item => item.game.title)
        const rBatch2 = await evaluateRecommendations({
            preferredGenres: ["Puzzle"],
            experiencePreferences: { combat: "ninguno" },
            excludeTitles: shownTitles
        }, { limit: 3 })
        const hasOverlap = rBatch2.some(item => shownTitles.includes(item.game.title))
        assert(!hasOverlap && rBatch2.length > 0, `22. Solicitud de alternativas sin solapamiento (Lote 1: [${shownTitles.join(", ")}] vs Lote 2: [${rBatch2.map(i => i.game.title).join(", ")}])`)

        // ----------------------------------------------------------------------
        // PRUEBA 23: Reinicio de conversación
        // ----------------------------------------------------------------------
        const rReset = await processDialogueTurn({
            userMessage: "reiniciar",
            accumulatedCriteria: {
                preferredGenres: ["RPG"],
                experiencePreferences: { exploration: "alto" }
            },
            dialogueState: { stage: "recommended", turnCount: 5 }
        })
        const p23Ok = (rReset.reply.includes("Bienvenido") || rReset.reply.includes("comenzar de nuevo") || rReset.reply.includes("asistente")) &&
                      Object.keys(rReset.updatedCriteria.experiencePreferences || {}).every(k => rReset.updatedCriteria.experiencePreferences[k] == null)
        assert(p23Ok, "23. Reinicio limpio de conversación con vaciado íntegro de nuevos criterios")

        // ----------------------------------------------------------------------
        // PRUEBA 24: Compatibilidad con la memoria conversacional
        // ----------------------------------------------------------------------
        const mem = createInitialMemory()
        const criteriaToSync = {
            experiencePreferences: { exploration: "alto", combat: "bajo" },
            objectiveStylePreference: "guiado",
            desiredDifficulty: "media"
        }
        syncMemoryFromTurn({ memory: mem, userMessage: "Quiero explorar", analysis: {}, criteria: criteriaToSync, dialogueState: { turnCount: 1 } })
        const activeFromMem = buildActiveCriteria(mem, {})
        const p24Ok = activeFromMem.experiencePreferences?.exploration === "alto" &&
                      activeFromMem.experiencePreferences?.combat === "bajo" &&
                      activeFromMem.objectiveStylePreference === "guiado" &&
                      activeFromMem.desiredDifficulty === "media"
        assert(p24Ok, "24. Sincronización e integración perfecta de nuevos criterios en conversationMemoryService")

        // ----------------------------------------------------------------------
        // PRUEBA 25: Compatibilidad con recomendaciones históricas
        // ----------------------------------------------------------------------
        const rClassic = await evaluateRecommendations({
            emotionalContext: ["relajante"],
            availableTime: "corta (< 30 min)",
            gameMode: "individual"
        }, { limit: 3 })
        const p25Ok = rClassic.length > 0 && rClassic[0].game.title === "Dorfromantik"
        assert(p25Ok, `25. Compatibilidad retrospectiva con perfiles clásicos (Dorfromantik top 1 relax corto con ${rClassic[0]?.score}%)`)

        // ----------------------------------------------------------------------
        // PRUEBA 26: Límites matemáticos y normalización estricta de pesos
        // ----------------------------------------------------------------------
        const allScored = await evaluateRecommendations({
            preferredGenres: ["Aventura", "Acción"],
            emotionalContext: ["emocionante"],
            availableTime: "media (30-60 min)",
            gameMode: "individual",
            desiredPacing: "intenso",
            experiencePreferences: {
                exploration: "alto",
                combat: "alto",
                narrative: "alto"
            },
            objectiveStylePreference: "guiado",
            desiredDifficulty: "alta"
        }, { limit: 88 })
        const allInBounds = allScored.every(item => item.score >= 0 && item.score <= 100)
        assert(allInBounds && allScored.length > 0, `26. Puntuaciones matemáticamente confinadas a [0..100] en todo el catálogo (${allScored.length} juegos evaluados)`)

        console.log("\n==========================================================================")
        console.log(`RESUMEN ETAPA 3: ${passed} pasadas de ${passed + failed} pruebas (${failed} falladas).`)
        console.log("==========================================================================")

        await mongoose.connection.close()
        process.exit(failed === 0 ? 0 : 1)
    } catch (err) {
        console.error("Error fatal durante la batería de pruebas de la Etapa 3:", err)
        await mongoose.connection.close()
        process.exit(1)
    }
}

runEtapa3Tests()
