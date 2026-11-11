const { evaluateRecommendations } = require("../services/recommendationEngine")
const { generateExplanation } = require("../services/explanationService")
const { processDialogueTurn } = require("../services/dialogueManager")

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
