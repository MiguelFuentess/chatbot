/**
 * Genera explicaciones transparentes, comprensibles y personalizadas
 * para cada videojuego recomendado con base en los factores de coincidencia.
 *
 * @param {Object} scoredItem Objeto con el videojuego, score y matchFactors
 * @param {Object} criteria Criterios originales solicitados por el usuario
 * @returns {Object} Justificación estructurada y texto redactado
 */
function generateExplanation(scoredItem, criteria = {}) {
    const { game, score, matchFactors } = scoredItem
    const reasons = []

    // 1. Justificación por contexto emocional
    if (matchFactors.matchedEmotions && matchFactors.matchedEmotions.length > 0) {
        const emoStr = matchFactors.matchedEmotions.join(", ")
        if (emoStr.includes("relajante") || emoStr.includes("tranquilo") || emoStr.includes("cero estres")) {
            reasons.push("Ideal para desconectar y relajarte sin presiones de tiempo ni frustración.")
        } else if (emoStr.includes("desafiante") || emoStr.includes("reto")) {
            reasons.push("Ofrece el nivel de desafío y superación estimulante que estás buscando.")
        } else if (emoStr.includes("buena historia") || emoStr.includes("narrativo")) {
            reasons.push("Destaca por su narrativa profunda y una historia memorable y envolvente.")
        } else if (emoStr.includes("creativo")) {
            reasons.push("Brinda gran libertad para crear, construir y explorar a tu propio ritmo.")
        } else {
            reasons.push(`Alineado con tu búsqueda de una experiencia ${emoStr}.`)
        }
    }

    // 2. Justificación por tiempo disponible
    if (criteria.availableTime) {
        if (criteria.availableTime.toLowerCase().includes("corta") || criteria.availableTime.toLowerCase().includes("30")) {
            if (game.sessionDuration.includes("corta")) {
                reasons.push("Perfecto para partidas directas y ágiles de menos de 30 minutos.")
            }
        } else if (criteria.availableTime.toLowerCase().includes("larga")) {
            if (game.sessionDuration.includes("larga")) {
                reasons.push("Excelente para sumergirte en sesiones extensas y profundas.")
            }
        }
    }

    // 3. Justificación por géneros coincidentes
    if (matchFactors.matchedGenres && matchFactors.matchedGenres.length > 0) {
        const genresList = matchFactors.matchedGenres.join(" y ")
        reasons.push(`Coincide con tu preferencia por el género ${genresList}.`)
    }

    // 4. Justificación por modo de juego (cooperativo / amigos / solo)
    if (criteria.gameMode) {
        const mode = criteria.gameMode.toLowerCase()
        if (mode.includes("coop") || mode.includes("amigo")) {
            reasons.push("Cuenta con un excelente modo cooperativo diseñado para disfrutar en equipo.")
        } else if (mode.includes("solo") || mode.includes("individual")) {
            reasons.push("Diseñado para una experiencia individual inmersiva en solitario.")
        }
    }

    // 5. Justificación por similitud
    if (matchFactors.matchedSimilar && matchFactors.matchedSimilar.length > 0) {
        reasons.push(`Comparte elementos y mecánicas que recuerdan a ${matchFactors.matchedSimilar.join(", ")}.`)
    }

    // 6. Destacado especial de la experiencia
    if (game.experienceHighlights && game.experienceHighlights.length > 0) {
        reasons.push(`Aspecto clave: "${game.experienceHighlights[0]}".`)
    }

    // Si por algún motivo no se acumularon razones específicas, usar resumen del juego
    if (reasons.length === 0) {
        reasons.push("Se ajusta a las preferencias generales de tu solicitud.")
    }

    const summaryText = reasons.join(" ")

    return {
        summaryText,
        reasonsList: reasons,
        confidenceScore: `${score}% de afinidad`
    }
}

module.exports = {
    generateExplanation
}
