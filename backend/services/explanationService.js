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
    const userClause = []

    // 1. Género identificado
    if (criteria.preferredGenres && criteria.preferredGenres.length > 0 && matchFactors.matchedGenres && matchFactors.matchedGenres.length > 0) {
        const gList = matchFactors.matchedGenres.join(" y ")
        userClause.push(`buscas una experiencia de ${gList}`)
        reasons.push(`Coincide con tu preferencia por el género ${gList}.`)
    }

    // 2. Tiempo disponible
    if (criteria.availableTime) {
        if (criteria.availableTime.toLowerCase().includes("corta") || criteria.availableTime.toLowerCase().includes("30")) {
            if (game.sessionDuration.includes("corta")) {
                userClause.push("tienes poco tiempo disponible (menos de 30 min)")
                reasons.push("Perfecto para partidas directas y ágiles de menos de 30 minutos.")
            }
        } else if (criteria.availableTime.toLowerCase().includes("media") || criteria.availableTime.toLowerCase().includes("60")) {
            if (game.sessionDuration.includes("media")) {
                userClause.push("dispones de entre 30 y 60 minutos")
                reasons.push("Ideal para sesiones de duración moderada (30 a 60 min).")
            }
        } else if (criteria.availableTime.toLowerCase().includes("larga")) {
            if (game.sessionDuration.includes("larga")) {
                userClause.push("cuentas con tiempo suficiente para sesiones extensas")
                reasons.push("Excelente para sumergirte en sesiones extensas y profundas.")
            }
        }
    }

    // 3. Contexto emocional voluntario
    if (criteria.emotionalContext && criteria.emotionalContext.length > 0 && matchFactors.matchedEmotions && matchFactors.matchedEmotions.length > 0) {
        const emoStr = matchFactors.matchedEmotions.join(", ")
        if (emoStr.includes("relajante") || emoStr.includes("tranquilo") || emoStr.includes("cero estres")) {
            userClause.push("mencionaste que hoy prefieres algo tranquilo para relajarte")
            reasons.push("Ideal para desconectar y relajarte sin presiones de tiempo ni frustración.")
        } else if (emoStr.includes("desafiante") || emoStr.includes("reto")) {
            userClause.push("buscas un reto estimulante y desafiante")
            reasons.push("Ofrece el nivel de desafío y superación estimulante que estás buscando.")
        } else if (emoStr.includes("buena historia") || emoStr.includes("narrativo")) {
            userClause.push("te interesa sumergirte en una buena historia")
            reasons.push("Destaca por su narrativa profunda y una historia memorable y envolvente.")
        } else if (emoStr.includes("creativo")) {
            userClause.push("deseas libertad creativa para construir")
            reasons.push("Brinda gran libertad para crear, construir y explorar a tu propio ritmo.")
        } else {
            userClause.push(`te interesa una experiencia ${emoStr}`)
            reasons.push(`Alineado con tu búsqueda de una experiencia ${emoStr}.`)
        }
    }

    // 4. Modalidad
    if (criteria.gameMode) {
        const mode = criteria.gameMode.toLowerCase()
        if (mode.includes("coop") || mode.includes("amigo")) {
            userClause.push("deseas jugar en cooperativo con amigos")
            reasons.push("Cuenta con un excelente modo cooperativo diseñado para disfrutar en equipo.")
        } else if (mode.includes("solo") || mode.includes("individual")) {
            userClause.push("prefieres jugar en solitario")
            reasons.push("Diseñado para una experiencia individual inmersiva en solitario.")
        }
    }

    // 5. Características disfrutadas concretas (Etapa 2)
    if (matchFactors.matchedFeatures && matchFactors.matchedFeatures.length > 0) {
        const featurePhrases = {
            exploracion: "disfrutas de la exploración y descubrir nuevos mundos",
            construccion_creatividad: "te gusta la libertad de construir y crear",
            narrativa_historia: "valoras una narrativa profunda y buena historia",
            combate_accion: "te atrae el combate dinámico y la acción",
            estrategia_planificacion: "te apasiona la estrategia y la gestión",
            puzzles_acertijos: "disfrutas resolver acertijos y puzzles de ingenio",
            libertad_sandbox: "prefieres jugar con libertad a tu propio ritmo",
            cooperacion: "buscas coordinar y colaborar en equipo",
            competencia: "te motiva la competencia contra otros jugadores",
            supervivencia: "te interesa la supervivencia y la gestión de recursos",
            desafio_progresion: "buscas un reto que ponga a prueba tu habilidad"
        }

        const featureReasons = {
            exploracion: "Brinda un mundo fascinante para explorar y descubrir a tu propio ritmo.",
            construccion_creatividad: "Destaca por sus amplias opciones de construcción y creatividad.",
            narrativa_historia: "Ofrece una historia memorable con una narrativa inmersiva.",
            combate_accion: "Presenta mecánicas de combate y acción sumamente satisfactorias.",
            estrategia_planificacion: "Requiere planificación táctica y toma de decisiones estratégicas.",
            puzzles_acertijos: "Contiene acertijos y desafíos de lógica ingeniosamente diseñados.",
            libertad_sandbox: "Proporciona total libertad de juego sin presiones.",
            cooperacion: "Ideal para disfrutar en cooperación y sincronía.",
            competencia: "Excelente para medir tu nivel competitivo.",
            supervivencia: "Ofrece una experiencia inmersiva de supervivencia y superación.",
            desafio_progresion: "Brinda una curva de aprendizaje desafiante y gratificante."
        }

        for (const feat of matchFactors.matchedFeatures) {
            if (featurePhrases[feat]) {
                userClause.push(featurePhrases[feat])
            }
            if (featureReasons[feat]) {
                reasons.push(featureReasons[feat])
            }
        }
    }

    // 6. Similitud, juegos disfrutados y preferencia de descubrimiento (Etapa 2)
    if (criteria.discoveryPreference === "diferente" && criteria.likedGames && criteria.likedGames.length > 0) {
        userClause.push(`buscas una experiencia diferente a los juegos que sueles jugar (${criteria.likedGames.join(", ")})`)
        reasons.push(`Te brinda un cambio de aires fresco y diferente respecto a ${criteria.likedGames.join(", ")}, explorando nuevas dinámicas.`)
    } else if (matchFactors.matchedLikedGames && matchFactors.matchedLikedGames.length > 0) {
        userClause.push(`has disfrutado de ${matchFactors.matchedLikedGames.join(", ")}`)
        reasons.push(`Comparte mecánicas y sensaciones que te gustaron en ${matchFactors.matchedLikedGames.join(", ")}.`)
    } else if (matchFactors.matchedSimilar && matchFactors.matchedSimilar.length > 0) {
        userClause.push(`te gustan títulos similares a ${matchFactors.matchedSimilar.join(", ")}`)
        reasons.push(`Comparte elementos y mecánicas que recuerdan a ${matchFactors.matchedSimilar.join(", ")}.`)
    }

    // 7. Respeto a características evitadas
    if (criteria.dislikedFeatures && criteria.dislikedFeatures.includes("combate_dificil")) {
        reasons.push("No incluye combates frustrantes ni dificultad excesiva, respetando tu preferencia.")
    }

    // 8. Aspecto clave destacado del juego
    if (game.experienceHighlights && game.experienceHighlights.length > 0) {
        reasons.push(`Aspecto clave: "${game.experienceHighlights[0]}".`)
    }

    // Redacción de resumen contextual y natural
    let summaryText = ""
    if (userClause.length > 0) {
        summaryText = `Te recomendamos este juego porque ${userClause.join(", ")}.`
        if (game.experienceHighlights && game.experienceHighlights.length > 0) {
            summaryText += ` Aspecto clave: "${game.experienceHighlights[0]}".`
        }
    } else if (reasons.length > 0) {
        summaryText = reasons.join(" ")
    } else {
        summaryText = "Se ajusta a las preferencias generales de tu solicitud."
    }

    return {
        summaryText,
        reasonsList: reasons,
        confidenceScore: `${score}% de afinidad`
    }
}

module.exports = {
    generateExplanation
}
