/**
 * Servicio de Generación de Explicaciones Transparentes y Personalizadas (Etapa 3)
 *
 * Justifica objetivamente las recomendaciones basándose exclusivamente en:
 * - Preferencias expresadas por el usuario.
 * - Criterios realmente evaluados (género, tiempo, modo, ritmo, experiencia, objetivos, dificultad, precio).
 * - Metadatos verificados del catálogo sin inventar atributos.
 * - Desgloses y advertencias transparentes cuando existan desajustes secundarios.
 */

/**
 * Genera explicaciones transparentes, comprensibles y personalizadas
 * para cada videojuego recomendado con base en los factores de coincidencia.
 *
 * @param {Object} scoredItem Objeto con el videojuego, score, breakdown y matchFactors
 * @param {Object} criteria Criterios originales solicitados por el usuario
 * @returns {Object} Justificación estructurada y texto redactado
 */
function generateExplanation(scoredItem, criteria = {}) {
    const { game, score, matchFactors = {}, breakdown = {} } = scoredItem
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

    // 5. Atributos de Experiencia Graduables (Etapa 3 - Sección 6 y 9)
    if (matchFactors.matchedExperienceAttributes && matchFactors.matchedExperienceAttributes.length > 0) {
        for (const exp of matchFactors.matchedExperienceAttributes) {
            if (exp.isUnknown) continue
            if (exp.attribute === "exploration" && (exp.requestedPreference === "alto" || exp.requestedPreference === "alta") && exp.score >= 0.65) {
                userClause.push("buscas exploración libre y descubrimiento")
                reasons.push("Ofrece escenarios abiertos con amplias oportunidades de exploración a tu ritmo.")
            } else if (exp.attribute === "narrative" && (exp.requestedPreference === "alto" || exp.requestedPreference === "alta") && exp.score >= 0.65) {
                userClause.push("valoras una historia profunda y trama envolvente")
                reasons.push("Posee un alto valor narrativo con guion maduro y trasfondo profundo.")
            } else if (exp.attribute === "creativity" && (exp.requestedPreference === "alto" || exp.requestedPreference === "alta") && exp.score >= 0.65) {
                userClause.push("buscas construir y expresar tu creatividad")
                reasons.push("Brinda ricas posibilidades creativas y de construcción.")
            } else if (exp.attribute === "strategy" && (exp.requestedPreference === "alto" || exp.requestedPreference === "alta") && exp.score >= 0.65) {
                userClause.push("quieres pensar y planificar estrategias")
                reasons.push("Exige planificación táctica y toma meditada de decisiones.")
            } else if (exp.attribute === "combat" && (exp.requestedPreference === "bajo" || exp.requestedPreference === "baja" || exp.requestedPreference === "ninguno") && exp.score >= 0.65) {
                userClause.push("prefieres poco o ningún combate")
                reasons.push("No se centra en el combate, priorizando la resolución pacífica o la exploración.")
            } else if (exp.attribute === "combat" && (exp.requestedPreference === "alto" || exp.requestedPreference === "alta") && exp.score >= 0.65) {
                userClause.push("te atraen los combates intensos y activos")
                reasons.push("Ofrece enfrentamientos ágiles y mecánicas de combate profundas.")
            } else if (exp.attribute === "freedom" && (exp.requestedPreference === "alto" || exp.requestedPreference === "alta") && exp.score >= 0.65) {
                userClause.push("prefieres jugar a tu propio ritmo con total libertad")
                reasons.push("Otorga total libertad sin misiones coercitivas ni presiones de tiempo.")
            } else if (exp.attribute === "complexity" && (exp.requestedPreference === "bajo" || exp.requestedPreference === "baja") && exp.score >= 0.65) {
                userClause.push("buscas mecánicas accesibles sin excesiva complejidad")
                reasons.push("Mantiene un diseño directo y fácil de comprender.")
            }
        }
    }

    // 6. Estilo de Objetivos (Etapa 3)
    if (matchFactors.objectiveDetails && !matchFactors.objectiveDetails.isUnknown) {
        const { requested, gameValue } = matchFactors.objectiveDetails
        if (requested === "guiado" && (gameValue === "guiado" || gameValue === "mixto")) {
            userClause.push("te gustan los juegos con objetivos claros")
            reasons.push("Ofrece una progresión guiada con metas e indicaciones claras.")
        } else if (requested === "libre" && (gameValue === "libre" || gameValue === "mixto")) {
            userClause.push("buscas objetivos libres y autonomía")
            reasons.push("Estructura de mundo abierto con total libertad para marcar tus propios objetivos.")
        }
    }

    // 7. Dificultad (Etapa 3)
    if (matchFactors.difficultyDetails && !matchFactors.difficultyDetails.isUnknown) {
        const { requested, gameValue } = matchFactors.difficultyDetails
        if (requested === "baja" && (gameValue === "baja" || gameValue === "ajustable")) {
            userClause.push("prefieres una dificultad accesible y tranquila")
            reasons.push("Dificultad baja o ajustable, ideal para una sesión relajada sin frustración.")
        } else if (requested === "alta" && (gameValue === "alta" || gameValue === "ajustable")) {
            userClause.push("buscas una experiencia difícil y exigente")
            reasons.push("Curva de dificultad exigente con retos notables.")
        }
    }

    // 8. Condición de Precio (Etapa 3)
    if (matchFactors.priceDetails && !matchFactors.priceDetails.isUnknown) {
        const { requested, gameValue } = matchFactors.priceDetails
        if ((requested === "gratuito" || requested === "gratis") && (gameValue.toLowerCase().includes("gratuito") || gameValue.toLowerCase().includes("free"))) {
            userClause.push("prefieres juegos gratuitos")
            reasons.push("Disponible de forma completamente gratuita en PC.")
        }
    }

    // 9. Características disfrutadas concretas (Etapa 2)
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
            // Evitar duplicar si ya se redactó en atributos de experiencia
            if (feat === "exploracion" && userClause.some(c => c.includes("exploración"))) continue
            if (feat === "narrativa_historia" && userClause.some(c => c.includes("historia"))) continue
            if (feat === "construccion_creatividad" && userClause.some(c => c.includes("construir"))) continue
            if (feat === "estrategia_planificacion" && userClause.some(c => c.includes("estrategia"))) continue
            if (feat === "libertad_sandbox" && userClause.some(c => c.includes("ritmo") || c.includes("libertad"))) continue
            if (feat === "combate_accion" && userClause.some(c => c.includes("combate"))) continue

            if (featurePhrases[feat]) {
                userClause.push(featurePhrases[feat])
            }
            if (featureReasons[feat]) {
                reasons.push(featureReasons[feat])
            }
        }
    }

    // 10. Similitud, juegos disfrutados y preferencia de descubrimiento
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

    // 11. Respeto a características evitadas
    if (criteria.dislikedFeatures && criteria.dislikedFeatures.includes("combate_dificil")) {
        reasons.push("No incluye combates frustrantes ni dificultad excesiva, respetando tu preferencia.")
    }
    if (criteria.dislikedFeatures && criteria.dislikedFeatures.includes("pixel_art")) {
        reasons.push("Evita el estilo pixel art, respetando tu preferencia visual.")
    }
    if (criteria.dislikedFeatures && criteria.dislikedFeatures.includes("combate_accion")) {
        reasons.push("Ajustado a tu preferencia de evitar combates intensos en esta sesión.")
    }

    // 12. Advertencias transparentes (caveats - Sección 9)
    if (matchFactors.caveats && matchFactors.caveats.length > 0) {
        for (const cav of matchFactors.caveats) {
            reasons.push(cav)
        }
    }

    // 13. Aspecto clave destacado del juego
    if (game.experienceHighlights && game.experienceHighlights.length > 0) {
        reasons.push(`Aspecto clave: "${game.experienceHighlights[0]}".`)
    }

    // Deduplicar cláusulas del usuario
    const uniqueUserClauses = [...new Set(userClause)]

    // Redacción de resumen contextual y natural
    let summaryText = ""
    if (uniqueUserClauses.length > 0) {
        summaryText = `Te recomendamos este juego porque ${uniqueUserClauses.join(", ")}.`
        if (matchFactors.caveats && matchFactors.caveats.length > 0) {
            summaryText += ` ${matchFactors.caveats[0]}`
        } else if (game.experienceHighlights && game.experienceHighlights.length > 0) {
            summaryText += ` Aspecto clave: "${game.experienceHighlights[0]}".`
        }
    } else if (reasons.length > 0) {
        summaryText = reasons.join(" ")
    } else {
        summaryText = "Se ajusta a las preferencias generales de tu solicitud."
    }

    const confidenceLabel = breakdown.confidenceLevel || "evaluación multicriterio"

    return {
        summaryText,
        reasonsList: reasons,
        text: summaryText,
        reasons: reasons,
        confidenceScore: `${score}% de afinidad estimada (${confidenceLabel})`
    }
}

module.exports = {
    generateExplanation
}
