/**
 * Validador robusto de datos y metadatos para el catálogo de videojuegos de RecoGames.
 * Diferencia entre errores fatales (que impiden persistir) y advertencias (atributos pendientes de clasificar).
 */

const VALID_GAME_MODES = ["individual", "cooperativo", "multijugador"]
const VALID_PACINGS = ["relajado", "moderado", "intenso"]
const VALID_DIFFICULTIES = ["baja", "media", "alta", "ajustable"]
const VALID_SESSION_DURATIONS = ["corta (< 30 min)", "media (30-60 min)", "larga (> 1 hora)"]
const VALID_PRICE_CONDITIONS = ["Gratuito", "De pago", "Free-to-play"]
const VALID_OBJECTIVE_STYLES = ["libre", "guiado", "mixto"]
const EXPERIENCE_KEYS = ["exploration", "narrative", "creativity", "strategy", "combat", "freedom", "complexity"]

/**
 * Valida un único registro de videojuego.
 * @param {Object} game
 * @returns {{ isValid: boolean, errors: Array<string>, warnings: Array<string> }}
 */
function validateGame(game) {
    const errors = []
    const warnings = []

    if (!game || typeof game !== "object") {
        return { isValid: false, errors: ["El registro de videojuego no es un objeto válido."], warnings: [] }
    }

    const title = typeof game.title === "string" ? game.title.trim() : ""
    if (!title) {
        errors.push("El campo 'title' es obligatorio y debe ser una cadena no vacía.")
    }

    const description = typeof game.description === "string" ? game.description.trim() : ""
    if (!description) {
        errors.push("El campo 'description' es obligatorio y debe ser una cadena no vacía.")
    }

    // Validación de géneros
    if (!Array.isArray(game.genres) || game.genres.length === 0) {
        errors.push("El campo 'genres' es obligatorio y debe contener al menos un género.")
    } else {
        const genreSet = new Set()
        for (const g of game.genres) {
            if (typeof g !== "string" || !g.trim()) {
                errors.push("Todos los géneros deben ser cadenas de texto no vacías.")
            } else {
                const lower = g.trim().toLowerCase()
                if (genreSet.has(lower)) {
                    errors.push(`Género duplicado en el juego: '${g}'.`)
                }
                genreSet.add(lower)
            }
        }
    }

    // Validación de gameModes
    if (!Array.isArray(game.gameModes) || game.gameModes.length === 0) {
        errors.push("El campo 'gameModes' es obligatorio y debe contener al menos un modo.")
    } else {
        for (const mode of game.gameModes) {
            if (!VALID_GAME_MODES.includes(mode)) {
                errors.push(`Modo de juego inválido '${mode}'. Valores permitidos: ${VALID_GAME_MODES.join(", ")}.`)
            }
        }
    }

    // Validación de sessionDuration
    if (!game.sessionDuration || !VALID_SESSION_DURATIONS.includes(game.sessionDuration)) {
        errors.push(`Duración de sesión inválida '${game.sessionDuration}'. Valores permitidos: ${VALID_SESSION_DURATIONS.join(", ")}.`)
    }

    // Validación de pacing
    if (game.pacing && !VALID_PACINGS.includes(game.pacing)) {
        errors.push(`Ritmo de juego (pacing) inválido '${game.pacing}'. Valores permitidos: ${VALID_PACINGS.join(", ")}.`)
    }

    // Validación de difficulty
    if (game.difficulty && !VALID_DIFFICULTIES.includes(game.difficulty)) {
        errors.push(`Dificultad inválida '${game.difficulty}'. Valores permitidos: ${VALID_DIFFICULTIES.join(", ")}.`)
    }

    // Validación de priceCondition
    if (game.priceCondition && !VALID_PRICE_CONDITIONS.includes(game.priceCondition)) {
        errors.push(`Condición de precio inválida '${game.priceCondition}'. Valores permitidos: ${VALID_PRICE_CONDITIONS.join(", ")}.`)
    }

    // Validación de objectiveStyle (Etapa 1 - Tercera Evolución)
    if (game.objectiveStyle !== undefined && game.objectiveStyle !== null) {
        if (!VALID_OBJECTIVE_STYLES.includes(game.objectiveStyle)) {
            errors.push(`objectiveStyle inválido '${game.objectiveStyle}'. Valores permitidos: ${VALID_OBJECTIVE_STYLES.join(", ")} o null.`)
        }
    } else if (game.objectiveStyle === null) {
        warnings.push(`El juego '${title || "sin título"}' tiene objectiveStyle pendiente de clasificar (null).`)
    }

    // Validación de experienceAttributes (Etapa 1 - Tercera Evolución)
    if (game.experienceAttributes !== undefined && game.experienceAttributes !== null) {
        if (typeof game.experienceAttributes !== "object") {
            errors.push("experienceAttributes debe ser un objeto o null.")
        } else {
            for (const key of EXPERIENCE_KEYS) {
                const val = game.experienceAttributes[key]
                if (val === undefined || val === null) {
                    warnings.push(`Atributo de experiencia '${key}' sin clasificar (null) en '${title}'.`)
                } else if (typeof val !== "number" || !Number.isInteger(val)) {
                    errors.push(`Atributo de experiencia '${key}' debe ser un número entero entre 0 y 5 o null, recibido: ${val}.`)
                } else if (val < 0 || val > 5) {
                    errors.push(`Atributo de experiencia '${key}' fuera de rango (${val}). Rango permitido: 0 a 5.`)
                }
            }
        }
    } else if (game.experienceAttributes === null) {
        warnings.push(`El juego '${title || "sin título"}' no posee subdocumento de experienceAttributes clasificado (null).`)
    }

    // Validación de duplicados en emotionalTags
    if (Array.isArray(game.emotionalTags)) {
        const emoSet = new Set()
        for (const emo of game.emotionalTags) {
            const clean = String(emo).toLowerCase().trim()
            if (emoSet.has(clean)) {
                errors.push(`Etiqueta emocional duplicada: '${emo}'.`)
            }
            emoSet.add(clean)
        }
    }

    // Validación de duplicados en similarTo
    if (Array.isArray(game.similarTo)) {
        const simSet = new Set()
        for (const sim of game.similarTo) {
            const clean = String(sim).toLowerCase().trim()
            if (simSet.has(clean)) {
                errors.push(`Título similar duplicado en similarTo: '${sim}'.`)
            }
            simSet.add(clean)
        }
    }

    // Validación de imageUrl
    if (game.imageUrl) {
        if (typeof game.imageUrl !== "string" || !/^https?:\/\//i.test(game.imageUrl.trim())) {
            errors.push(`URL de imagen malformada: '${game.imageUrl}'. Debe comenzar con http:// o https://.`)
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    }
}

/**
 * Valida una colección completa de videojuegos y calcula métricas de cobertura de metadatos.
 * @param {Array<Object>} games
 * @returns {Object}
 */
function validateCatalog(games) {
    if (!Array.isArray(games)) {
        return {
            isValid: false,
            totalGames: 0,
            fatalErrors: ["El catálogo no es un array de videojuegos."],
            warnings: [],
            coverage: null
        }
    }

    const fatalErrors = []
    const warnings = []
    const seenTitles = new Map()

    let gamesWithExperienceAttributes = 0
    let totalPossibleAttributes = games.length * EXPERIENCE_KEYS.length
    let totalClassifiedAttributes = 0
    let totalUnclassifiedAttributes = 0
    let gamesWithObjectiveStyle = 0

    games.forEach((game, index) => {
        const title = game && typeof game.title === "string" ? game.title.trim() : `Juego[${index}]`

        // Detección de títulos duplicados
        const lowerTitle = title.toLowerCase()
        if (seenTitles.has(lowerTitle)) {
            fatalErrors.push(`Título duplicado detectado en el catálogo: '${title}' (índices ${seenTitles.get(lowerTitle)} y ${index}).`)
        } else {
            seenTitles.set(lowerTitle, index)
        }

        const result = validateGame(game)
        if (!result.isValid) {
            fatalErrors.push(`[${title}]: ${result.errors.join(" | ")}`)
        }
        if (result.warnings.length > 0) {
            warnings.push(...result.warnings)
        }

        // Estadísticas de cobertura de nuevos metadatos
        if (game.objectiveStyle && VALID_OBJECTIVE_STYLES.includes(game.objectiveStyle)) {
            gamesWithObjectiveStyle++
        }

        if (game.experienceAttributes && typeof game.experienceAttributes === "object") {
            let hasAnyAttr = false
            for (const key of EXPERIENCE_KEYS) {
                const val = game.experienceAttributes[key]
                if (typeof val === "number" && Number.isInteger(val) && val >= 0 && val <= 5) {
                    totalClassifiedAttributes++
                    hasAnyAttr = true
                } else {
                    totalUnclassifiedAttributes++
                }
            }
            if (hasAnyAttr) {
                gamesWithExperienceAttributes++
            }
        } else {
            totalUnclassifiedAttributes += EXPERIENCE_KEYS.length
        }
    })

    const percentageClassified = totalPossibleAttributes > 0
        ? Number(((totalClassifiedAttributes / totalPossibleAttributes) * 100).toFixed(2))
        : 0

    return {
        isValid: fatalErrors.length === 0,
        totalGames: games.length,
        fatalErrors,
        warnings,
        coverage: {
            totalGames: games.length,
            gamesWithExperienceAttributes,
            gamesWithObjectiveStyle,
            totalPossibleAttributes,
            totalClassifiedAttributes,
            totalUnclassifiedAttributes,
            percentageClassified
        }
    }
}

module.exports = {
    VALID_GAME_MODES,
    VALID_PACINGS,
    VALID_DIFFICULTIES,
    VALID_SESSION_DURATIONS,
    VALID_PRICE_CONDITIONS,
    VALID_OBJECTIVE_STYLES,
    EXPERIENCE_KEYS,
    validateGame,
    validateCatalog
}
