const { evaluateRecommendations } = require("../services/recommendationEngine")
const { generateExplanation } = require("../services/explanationService")
const { parseUserMessage } = require("../services/nlpService")

/**
 * Genera una introducción conversacional amable acorde a los criterios extraídos.
 */
function createConversationalIntro(criteria = {}, topRecommendations = []) {
    if (topRecommendations.length === 0) {
        return "No encontré videojuegos que cumplan con todos esos criterios exactos en el catálogo. ¿Te gustaría intentar con otros géneros o flexibilizar el tiempo de juego?"
    }

    const details = []

    if (criteria.emotionalContext && criteria.emotionalContext.length > 0) {
        const emo = criteria.emotionalContext.join(", ")
        details.push(`una experiencia enfocada en ${emo}`)
    }

    if (criteria.availableTime) {
        details.push(`partidas de duración ${criteria.availableTime}`)
    }

    if (criteria.gameMode) {
        details.push(`en modalidad ${criteria.gameMode}`)
    }

    if (criteria.preferredGenres && criteria.preferredGenres.length > 0) {
        details.push(`del género ${criteria.preferredGenres.join(" / ")}`)
    }

    if (details.length > 0) {
        return `Teniendo en cuenta que buscas ${details.join(" y ")}, he seleccionado estas ${topRecommendations.length} recomendaciones para ti:`
    }

    return `He analizado tus preferencias y encontré estas ${topRecommendations.length} recomendaciones ideales:`
}

/**
 * Endpoint conversacional interactivo
 * POST /api/recommendations/chat
 */
exports.handleChatConversation = async (req, res) => {
    try {
        const { message = "", accumulatedCriteria = {} } = req.body

        if (!message.trim()) {
            return res.status(400).json({
                message: "El mensaje del usuario no puede estar vacío."
            })
        }

        // 1. Procesamiento de lenguaje natural del mensaje
        const analysis = parseUserMessage(message, accumulatedCriteria)

        // 2. Si es un saludo sin intenciones de juego
        if (analysis.intent === "greeting") {
            return res.status(200).json({
                reply: analysis.reply,
                isAmbiguous: false,
                updatedCriteria: analysis.criteria,
                recommendations: []
            })
        }

        // 3. Si la solicitud es demasiado vaga o ambigua, formular preguntas guía
        if (analysis.isAmbiguous) {
            return res.status(200).json({
                reply: analysis.clarificationPrompt,
                isAmbiguous: true,
                updatedCriteria: analysis.criteria,
                recommendations: [],
                suggestedReplies: [
                    "Quiero relajarme y descansar",
                    "Busco un reto de acción y adrenalina",
                    "Quiero jugar en cooperativo con amigos",
                    "Tengo solo 30 minutos disponibles"
                ]
            })
        }

        // 4. Si contamos con criterios suficientes, invocar el motor de recomendación
        const scoredGames = await evaluateRecommendations(analysis.criteria, { limit: 3 })

        // 5. Enriquecer cada juego con explicaciones comprensibles
        const recommendations = scoredGames.map((item) => {
            const explanation = generateExplanation(item, analysis.criteria)
            return {
                game: item.game,
                score: item.score,
                breakdown: item.breakdown,
                explanation
            }
        })

        const reply = createConversationalIntro(analysis.criteria, recommendations)

        res.status(200).json({
            reply,
            isAmbiguous: false,
            updatedCriteria: analysis.criteria,
            recommendations
        })
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
