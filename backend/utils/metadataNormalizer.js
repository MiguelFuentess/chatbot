/**
 * Utilidades para normalización y saneamiento de metadatos de videojuegos en RecoGames.
 * Garantiza consistencia en cadenas de texto, etiquetas, colecciones y tipos de datos.
 */

/**
 * Limpia y normaliza una cadena de texto (elimina espacios superfluos).
 * @param {string} str
 * @returns {string}
 */
function normalizeString(str) {
    if (typeof str !== "string") return ""
    return str.replace(/\s+/g, " ").trim()
}

/**
 * Normaliza y deduplica un array de strings preservando el orden original.
 * @param {Array<string>} list
 * @param {Object} options
 * @param {boolean} [options.toLowerCase=false]
 * @returns {Array<string>}
 */
function normalizeStringArray(list = [], options = {}) {
    if (!Array.isArray(list)) return []
    const seen = new Set()
    const result = []

    for (const item of list) {
        if (typeof item !== "string") continue
        const clean = normalizeString(item)
        if (!clean) continue

        const finalItem = options.toLowerCase ? clean.toLowerCase() : clean
        const lookupKey = finalItem.toLowerCase()
        if (!seen.has(lookupKey)) {
            seen.add(lookupKey)
            result.push(finalItem)
        }
    }

    return result
}

/**
 * Normaliza atributos de experiencia asegurando que sean enteros 0-5 o null.
 * @param {Object} attrs
 * @returns {Object}
 */
function normalizeExperienceAttributes(attrs = {}) {
    if (!attrs || typeof attrs !== "object") {
        return {
            exploration: null,
            narrative: null,
            creativity: null,
            strategy: null,
            combat: null,
            freedom: null,
            complexity: null
        }
    }

    const keys = ["exploration", "narrative", "creativity", "strategy", "combat", "freedom", "complexity"]
    const normalized = {}

    for (const key of keys) {
        const val = attrs[key]
        if (val === null || val === undefined || val === "") {
            normalized[key] = null
        } else {
            const num = Number(val)
            if (Number.isInteger(num) && num >= 0 && num <= 5) {
                normalized[key] = num
            } else {
                normalized[key] = null
            }
        }
    }

    return normalized
}

/**
 * Normaliza el estilo de objetivo (libre, guiado, mixto o null).
 * @param {string|null} style
 * @returns {string|null}
 */
function normalizeObjectiveStyle(style) {
    if (!style || typeof style !== "string") return null
    const clean = style.toLowerCase().trim()
    const valid = ["libre", "guiado", "mixto"]
    return valid.includes(clean) ? clean : null
}

module.exports = {
    normalizeString,
    normalizeStringArray,
    normalizeExperienceAttributes,
    normalizeObjectiveStyle
}
