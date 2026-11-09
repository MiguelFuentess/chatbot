/**
 * Servicio de Procesamiento de Lenguaje Natural (NLP) en Español
 * Especializado en el dominio de recomendación de videojuegos.
 */

// Diccionario de géneros reconocidos y sus alias
const GENRE_PATTERNS = [
    { genre: "Aventura", patterns: ["aventura", "aventuras", "narrativa", "explorar"] },
    { genre: "RPG", patterns: ["rpg", "rol", "juego de rol"] },
    { genre: "Acción", patterns: ["accion", "pelea", "combate", "frenetico"] },
    { genre: "Estrategia", patterns: ["estrategia", "tactico", "tactica", "gestion", "imperio"] },
    { genre: "Puzzle", patterns: ["puzzle", "puzle", "rompecabezas", "acertijo", "ingenio", "logica"] },
    { genre: "Roguelike", patterns: ["roguelike", "roguelite", "mazmorras", "runs"] },
    { genre: "FPS", patterns: ["fps", "shooter", "disparos", "tiros", "primera persona"] },
    { genre: "Supervivencia", patterns: ["supervivencia", "survival", "sobrevivir", "recolectar"] },
    { genre: "Construcción", patterns: ["construccion", "construir", "edificar", "crafteo"] },
    { genre: "Simulación", patterns: ["simulacion", "simulador", "granja"] },
    { genre: "Plataformas", patterns: ["plataformas", "saltos", "plataformas 2d"] },
    { genre: "Metroidvania", patterns: ["metroidvania"] },
    { genre: "Terror", patterns: ["terror", "miedo", "horror", "sustos"] }
]

// Exclusiones explícitas (dislikes)
const DISLIKE_TRIGGERS = [
    /no\s+(?:me\s+)?(?:gusta|gustan|quiero|interesa|banco)\s+(?:el|la|los|las)?\s*([a-záéíóúñ\s]+)/i,
    /nada\s+de\s+([a-záéíóúñ\s]+)/i,
    /(?:odio|detesto|cero)\s+([a-záéíóúñ\s]+)/i,
    /sin\s+([a-záéíóúñ\s]+)/i
]

// Diccionario de estados emocionales expresados voluntariamente
const EMOTIONAL_TRIGGERS = [
    { tag: "relajante", patterns: ["tranquilo", "relajar", "relajarme", "relajante", "cansado", "agotado", "estresado", "desconectar", "paz", "despejar la mente", "cero estres", "sin presion", "chill"] },
    { tag: "desafiante", patterns: ["desafiante", "desafio", "reto", "dificil", "complejo", "probar mi habilidad", "hardcore", "exigente", "sufrir"] },
    { tag: "emocionante", patterns: ["emocionante", "adrenalina", "rapido", "estimulante", "intenso", "accion rapida", "aburrido", "algo divertido", "no aburrirme"] },
    { tag: "buena historia", patterns: ["buena historia", "buena trama", "historia profunda", "historia atrapante", "narrativo", "emotivo", "lore"] },
    { tag: "creativo", patterns: ["creativo", "crear", "construir", "imaginacion", "libertad", "hacer lo que quiera"] },
    { tag: "inmersivo", patterns: ["inmersivo", "sumergirme", "perder la nocion del tiempo", "mundo abierto", "atmosfera"] }
]

// Patrones de tiempo disponible
const TIME_TRIGGERS = [
    { duration: "corta (< 30 min)", patterns: ["30 min", "30 minutos", "media hora", "poco tiempo", "tiempo corto", "partida corta", "partidas cortas", "20 min", "15 min", "un rato", "rapido"] },
    { duration: "media (30-60 min)", patterns: ["1 hora", "una hora", "45 min", "media", "tiempo moderado", "una horita"] },
    { duration: "larga (> 1 hora)", patterns: ["mucho tiempo", "toda la tarde", "toda la noche", "varias horas", "horas", "larga", "largo", "tiempo de sobra", "partidas largas"] }
]

// Patrones de modo de juego
const MODE_TRIGGERS = [
    { mode: "cooperativo", patterns: ["amigos", "amigo", "cooperativo", "coop", "con mi novia", "con mi novio", "en pareja", "con alguien", "duo", "con amigos"] },
    { mode: "multijugador", patterns: ["multijugador", "multiplayer", "online", "con mas personas", "competitivo"] },
    { mode: "individual", patterns: ["solo", "solitario", "en solitario", "sin gente", "campaña solo", "yo solo"] }
]

// Patrones de juegos de referencia (similarTo)
const SIMILAR_TARGETS = [
    "minecraft", "dark souls", "elden ring", "stardew valley", "hollow knight",
    "dead cells", "hades", "celeste", "subnautica", "terraria", "portal",
    "civilization", "slay the spire"
]

/**
 * Normaliza texto eliminando acentos para facilitar el emparejamiento.
 */
function cleanText(text = "") {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
}

/**
 * Extrae intenciones y criterios de búsqueda a partir del lenguaje natural del usuario.
 *
 * @param {string} userMessage Texto ingresado por el usuario
 * @param {Object} previousCriteria Criterios previos acumulados en la sesión
 * @returns {Object} Intención detectada, criterios actualizados y bandera de ambigüedad
 */
function parseUserMessage(userMessage = "", previousCriteria = {}) {
    const rawText = userMessage.trim()
    const text = cleanText(userMessage)

    // Clonar criterios acumulados previos
    const criteria = {
        preferredGenres: [...(previousCriteria.preferredGenres || [])],
        dislikedGenres: [...(previousCriteria.dislikedGenres || [])],
        emotionalContext: [...(previousCriteria.emotionalContext || [])],
        availableTime: previousCriteria.availableTime || null,
        gameMode: previousCriteria.gameMode || null,
        desiredPacing: previousCriteria.desiredPacing || null,
        similarTo: [...(previousCriteria.similarTo || [])]
    }

    // 1. Detección flexible de saludos iniciales
    const strippedPunctuation = text.replace(/[,.?!¡¿]+/g, " ").replace(/\s+/g, " ").trim()
    const isGreeting = /^(?:hola|buenas|buenos dias|buenas tardes|buenas noches|que tal|hey|saludos)(?:\s+(?:hola|buenas|buenos dias|buenas tardes|buenas noches|que tal|como estas|amigo|bot|asistente))?$/i.test(strippedPunctuation)

    if (isGreeting && Object.keys(previousCriteria).length === 0) {
        return {
            intent: "greeting",
            criteria,
            isAmbiguous: false,
            reply: "¡Hola! Soy tu asistente inteligente de videojuegos para PC. Cuéntame: ¿cómo te sientes hoy o qué tipo de juego estás buscando? (Por ejemplo: 'Estoy cansado y quiero algo tranquilo para jugar 30 minutos', o 'Busco un reto de acción')."
        }
    }

    // 2. Detección de dislikes / exclusiones
    for (const regex of DISLIKE_TRIGGERS) {
        const match = text.match(regex)
        if (match && match[1]) {
            const dislikedClause = match[1].trim()
            for (const item of GENRE_PATTERNS) {
                if (item.patterns.some((p) => dislikedClause.includes(cleanText(p)))) {
                    if (!criteria.dislikedGenres.includes(item.genre)) {
                        criteria.dislikedGenres.push(item.genre)
                    }
                    // Remover de preferidos si estaba
                    criteria.preferredGenres = criteria.preferredGenres.filter((g) => g !== item.genre)
                }
            }
        }
    }

    // 3. Detección de géneros preferidos (excluyendo lo mencionado en dislikes)
    for (const item of GENRE_PATTERNS) {
        const isMentioned = item.patterns.some((p) => {
            const regex = new RegExp(`\\b${cleanText(p)}\\b`, "i")
            return regex.test(text)
        })

        if (isMentioned && !criteria.dislikedGenres.includes(item.genre)) {
            if (!criteria.preferredGenres.includes(item.genre)) {
                criteria.preferredGenres.push(item.genre)
            }
        }
    }

    // 4. Detección de contexto emocional voluntario
    for (const item of EMOTIONAL_TRIGGERS) {
        const isMatched = item.patterns.some((p) => text.includes(cleanText(p)))
        if (isMatched) {
            if (!criteria.emotionalContext.includes(item.tag)) {
                criteria.emotionalContext.push(item.tag)
            }
            // Inferencia de ritmo
            if (item.tag === "relajante" && !criteria.desiredPacing) {
                criteria.desiredPacing = "relajado"
            } else if (item.tag === "desafiante" || item.tag === "emocionante") {
                if (!criteria.desiredPacing) criteria.desiredPacing = "intenso"
            }
        }
    }

    // 5. Detección de tiempo disponible
    for (const item of TIME_TRIGGERS) {
        if (item.patterns.some((p) => text.includes(cleanText(p)))) {
            criteria.availableTime = item.duration
            break
        }
    }

    // 6. Detección de modo de juego
    for (const item of MODE_TRIGGERS) {
        if (item.patterns.some((p) => text.includes(cleanText(p)))) {
            criteria.gameMode = item.mode
            break
        }
    }

    // 7. Detección de juegos de referencia (similarTo)
    for (const target of SIMILAR_TARGETS) {
        if (text.includes(target)) {
            const capitalized = target.charAt(0).toUpperCase() + target.slice(1)
            if (!criteria.similarTo.includes(capitalized)) {
                criteria.similarTo.push(capitalized)
            }
        }
    }

    // 8. Evaluación de ambigüedad
    const totalCriteriaPoints =
        criteria.preferredGenres.length +
        criteria.emotionalContext.length +
        (criteria.availableTime ? 1 : 0) +
        (criteria.gameMode ? 1 : 0) +
        criteria.similarTo.length

    const isGenericRequest = /^(?:quiero jugar algo|recomiendame un juego|recomiendame algo|que puedo jugar|busco un juego|dame un juego|juegos)[\s?!.]*$/i.test(text)

    const isAmbiguous = isGenericRequest || totalCriteriaPoints === 0

    return {
        intent: isAmbiguous ? "clarification_needed" : "recommendation_request",
        criteria,
        isAmbiguous,
        clarificationPrompt: isAmbiguous
            ? "¿Para ayudarte a encontrar el juego perfecto, prefieres una experiencia tranquila para relajarte o algo desafiante y con acción? ¿Cuánto tiempo tienes para jugar y estarás solo o con amigos?"
            : null
    }
}

module.exports = {
    parseUserMessage,
    cleanText,
    GENRE_PATTERNS,
    EMOTIONAL_TRIGGERS,
    TIME_TRIGGERS,
    MODE_TRIGGERS
}
