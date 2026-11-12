const { evaluateRecommendations } = require("../services/recommendationEngine")
const { generateExplanation } = require("../services/explanationService")
const { processDialogueTurn } = require("../services/dialogueManager")
const { applyProfileUpdate } = require("../services/conversationMemoryService")
const { compareGamesData } = require("../services/comparisonService")

/**
 * Endpoint conversacional interactivo y adaptativo
 * POST /api/recommendations/chat
 */
exports.handleChatConversation = async (req, res) => {
    try {
        const body = req.body || {}
        const {
            accumulatedCriteria = {},
            dialogueState = {}
        } = body
        const rawMessage = typeof body.message === "string" ? body.message : (body.message != null ? String(body.message) : "")

        if (!rawMessage || !rawMessage.trim()) {
            return res.status(400).json({
                message: "El mensaje del usuario no puede estar vacío."
            })
        }

        // Delegar la gestión del turno conversacional al gestor de diálogo
        const result = await processDialogueTurn({
            userMessage: rawMessage.trim(),
            accumulatedCriteria,
            dialogueState
        })

        res.status(200).json(result)
    } catch (error) {
        console.error("Error en la conversación de recomendación:", error)
        res.status(500).json({
            message: "Error interno al procesar el mensaje conversacional",
            error: error.message
        })
    }
}

/**
 * Evalúa y devuelve recomendaciones estructuradas y justificadas por criterios directos
 * POST /api/recommendations/evaluate
 */
exports.evaluateCriteria = async (req, res) => {
    try {
        const criteria = req.body.criteria || req.body || {}
        const options = req.body.options || {}

        const scoredGames = await evaluateRecommendations(criteria, options)

        const recommendations = scoredGames.map((item) => {
            const explanation = generateExplanation(item, criteria)
            return {
                game: item.game,
                score: item.score,
                breakdown: item.breakdown,
                explanation
            }
        })

        res.status(200).json({
            criteriaEvaluated: criteria,
            totalFound: recommendations.length,
            recommendations
        })
    } catch (error) {
        console.error("Error al evaluar recomendaciones:", error)
        res.status(500).json({
            message: "Error interno al procesar las recomendaciones",
            error: error.message
        })
    }
}

/**
 * Actualiza el perfil temporal del jugador desde la interfaz editable (Etapa 5)
 * POST /api/recommendations/profile-update
 */
exports.handleProfileUpdate = async (req, res) => {
    try {
        const { memory, criteria, dialogueState, updateAction } = req.body || {}
        if (!updateAction || !updateAction.type) {
            return res.status(400).json({
                message: "Se requiere un objeto updateAction válido con la propiedad type."
            })
        }

        const updated = applyProfileUpdate({
            memory,
            criteria,
            dialogueState,
            updateAction
        })

        res.status(200).json(updated)
    } catch (error) {
        console.error("Error al actualizar perfil temporal:", error)
        res.status(500).json({
            message: "Error interno al actualizar el perfil temporal",
            error: error.message
        })
    }
}

/**
 * Compara visual y conversacionalmente dos videojuegos específicos (Etapa 6)
 * POST /api/recommendations/compare
 */
exports.handleCompareGames = async (req, res) => {
    try {
        const { titleA, titleB, criteria = {}, aspect = "general" } = req.body || {}
        if (!titleA || !titleB) {
            return res.status(400).json({
                error: "missing_selection",
                message: "Se requiere seleccionar dos videojuegos para realizar la comparación."
            })
        }

        const result = await compareGamesData({ titleA, titleB, criteria, aspect })
        if (result.error) {
            const status = result.error === "game_not_found" ? 404 : 400
            return res.status(status).json(result)
        }

        res.status(200).json(result)
    } catch (error) {
        console.error("Error al procesar la comparación de videojuegos:", error)
        res.status(500).json({
            message: "Error interno al procesar la comparación de videojuegos",
            error: error.message
        })
    }
}
