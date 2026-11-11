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
    { genre: "FPS", patterns: ["fps", "shooter", "shooters", "disparos", "tiros", "primera persona"] },
    { genre: "Supervivencia", patterns: ["supervivencia", "survival", "sobrevivir", "recolectar"] },
    { genre: "Construcción", patterns: ["construccion", "construir", "edificar", "crafteo", "construir o crear"] },
    { genre: "Simulación", patterns: ["simulacion", "simulador", "granja"] },
    { genre: "Plataformas", patterns: ["plataformas", "saltos", "plataformas 2d"] },
    { genre: "Metroidvania", patterns: ["metroidvania"] },
    { genre: "Terror", patterns: ["terror", "miedo", "horror", "sustos"] }
]

// Exclusiones explícitas (dislikes)
const DISLIKE_TRIGGERS = [
    /no\s+(?:me\s+)?(?:gusta|gustan|quiero|interesa|banco)\s+(?:el|la|los|las)?\s*(?:de\s+)?([a-záéíóúñ\s]+)/i,
    /nada\s+de\s+([a-záéíóúñ\s]+)/i,
    /(?:odio|detesto|cero)\s+([a-záéíóúñ\s]+)/i,
    /sin\s+([a-záéíóúñ\s]+)/i,
    /evit(?:ar|o|ando)?\s+(?:el|la|los|las)?\s*([a-záéíóúñ\s]+)/i,
    /(?:pero\s+)?no\s+(?:los?\s+de|las?\s+de|el\s+de|la\s+de)\s+([a-záéíóúñ\s]+)/i
]

// Diccionario de estados emocionales expresados voluntariamente
const EMOTIONAL_TRIGGERS = [
    { tag: "relajante", patterns: ["quiero relajarme", "relajarme", "relajar", "tranquilo", "relajante", "cansado", "agotado", "estresado", "desconectar", "paz", "despejar la mente", "cero estres", "sin presion", "chill"] },
    { tag: "desafiante", patterns: ["quiero un desafio", "un desafio", "desafiante", "desafio", "reto", "dificil", "complejo", "probar mi habilidad", "hardcore", "exigente", "sufrir", "mas desafiante"] },
    { tag: "emocionante", patterns: ["busco algo emocionante", "emocionante", "adrenalina", "rapido", "estimulante", "intenso", "accion rapida", "aburrido", "algo divertido", "no aburrirme"] },
    { tag: "buena historia", patterns: ["explorar una buena historia", "buena historia", "buena trama", "historia profunda", "historia atrapante", "narrativo", "emotivo", "lore"] },
    { tag: "creativo", patterns: ["construir o crear", "construir o crear algo", "creativo", "crear", "construir", "imaginacion", "libertad", "hacer lo que quiera", "sandbox"] },
    { tag: "inmersivo", patterns: ["inmersivo", "sumergirme", "perder la nocion del tiempo", "mundo abierto", "atmosfera"] }
]

// Patrones de tiempo disponible
const TIME_TRIGGERS = [
    { duration: "corta (< 30 min)", patterns: ["menos de 30 minutos", "menos de 30 min", "menos de 30", "< 30", "30 min", "30 minutos", "media hora", "poco tiempo", "tiempo corto", "partida corta", "partidas cortas", "20 min", "20 minutos", "15 min", "15 minutos", "un rato", "rapido", "mas corto", "algo mas corto", "partida mas corta", "tengo menos tiempo", "menos tiempo", "algo mas rapido"] },
    { duration: "media (30-60 min)", patterns: ["entre 30 y 60 minutos", "entre 30 y 60 min", "entre 30 y 60", "30 a 60 minutos", "30 a 60 min", "30 a 60", "1 hora", "una hora", "45 min", "45 minutos", "tiempo moderado", "una horita"] },
    { duration: "larga (> 1 hora)", patterns: ["mas de una hora", "mas de 1 hora", "> 1 hora", "mucho tiempo", "toda la tarde", "toda la noche", "varias horas", "horas", "larga", "largo", "tiempo de sobra", "partidas largas", "no tengo limite de tiempo", "no tengo limite", "sin limite", "mas largo", "algo mas largo", "tengo mas tiempo", "mas tiempo"] }
]

// Patrones de modo de juego
const MODE_TRIGGERS = [
    { mode: "cooperativo", patterns: ["quiero jugar con amigos", "jugar con amigos", "con amigos", "amigos", "amigo", "cooperativo", "coop", "con mi novia", "con mi novio", "con mi pareja", "mi pareja", "en pareja", "con alguien", "duo", "prefiero cooperativo", "mejor cooperativo", "mejor con amigos", "jugar de a dos", "de a dos"] },
    { mode: "multijugador", patterns: ["multijugador", "multiplayer", "online", "con mas personas", "competitivo", "prefiero algo multijugador", "prefiero multijugador", "algo multijugador", "mejor multijugador"] },
    { mode: "individual", patterns: ["prefiero jugar solo", "jugar solo", "solo", "solitario", "en solitario", "sin gente", "campaña solo", "yo solo", "mejor solo", "para jugar solo"] }
]

// Lista de videojuegos reconocidos del catálogo para detección de rechazos o menciones
const KNOWN_GAME_TITLES = [
    "stardew valley", "dorfromantik", "a short hike", "slime rancher", "gris",
    "hades", "dead cells", "celeste", "elden ring", "doom eternal",
    "the witcher 3", "the witcher", "firewatch", "outer wilds", "hollow knight",
    "disco elysium", "minecraft", "terraria", "subnautica", "cities: skylines",
    "cities skylines", "civilization vi", "civilization", "slay the spire",
    "into the breach", "it takes two", "portal 2", "portal",
    "deep rock galactic", "overcooked", "frostpunk"
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
 * @param {Object} dialogueState Estado conversacional actual
 * @returns {Object} Intención detectada, criterios actualizados y metadatos
 */
function parseUserMessage(userMessage = "", previousCriteria = {}, dialogueState = {}) {
    const rawText = (userMessage || "").trim()
    const text = cleanText(userMessage)
    const prev = previousCriteria || {}
    const dState = dialogueState || {}

    // Clonar criterios acumulados previos con salvaguarda ante valores nulos
    const criteria = {
        preferredGenres: [...(prev.preferredGenres || [])],
        dislikedGenres: [...(prev.dislikedGenres || [])],
        emotionalContext: [...(prev.emotionalContext || [])],
        availableTime: prev.availableTime || null,
        gameMode: prev.gameMode || null,
        desiredPacing: prev.desiredPacing || null,
        similarTo: [...(prev.similarTo || [])]
    }

    // 1. Detección de saludos iniciales
    const strippedPunctuation = text.replace(/[,.?!¡¿]+/g, " ").replace(/\s+/g, " ").trim()
    const isGreeting = /^(?:hola|buenas|buenos dias|buenas tardes|buenas noches|que tal|hey|saludos)(?:\s+(?:hola|buenas|buenos dias|buenas tardes|buenas noches|que tal|como estas|amigo|bot|asistente))?$/i.test(strippedPunctuation)

    // 2. Detección de "No estoy seguro, sorpréndeme"
    const isSurpriseMe = /(?:no estoy seguro|sorprendeme|sorprende me|no se|lo que sea|cualquiera)/i.test(text)

    // 3. Detección de indiferencia en modalidad ("Me da igual")
    const isModeIndifferent = /(?:me da igual|da igual|no importa|indiferente|como sea|cualquiera)/i.test(text) &&
        (dState.stage === "mode" || text.includes("modo") || text.includes("jugar"))

    // 4. Detección de indiferencia en géneros ("No tengo preferencias")
    const isGenreIndifferent = /(?:no tengo preferencias|sin preferencias|cualquier genero|no importa el genero|todos los generos)/i.test(text)

    // 5. Detección de solicitud de alternativas ("Muéstrame otros juegos", "algo diferente", "no me convencen estas opciones", "más alternativas")
    const wantsAlternatives = /(?:muestrame otros|otros juegos|otras opciones|dame otras opciones|mas alternativas|dame mas alternativas|algo diferente|quiero algo diferente|no me convencen|no me convence|ver otras|ver mas alternativas|diferentes juegos|cambiar opciones|opciones diferentes)/i.test(text)

    // 6. Detección de solicitud explícita de recomendación inmediata
    const wantsRecommendationsNow = /(?:recomiendame ya|muestrame opciones|dame opciones|que me recomiendas|muestrame juegos|ver juegos|ver recomendaciones)/i.test(text)

    // 7. Detección de cambio de opinión / corrección ("Mejor quiero...", "cambia a...")
    const isChangingMind = /(?:mejor|cambia|cambiar|ahora prefiero|en vez de eso)/i.test(text)
    const isChangingGenre = /(?:mejor\s+(?:recomiendame\s+)?(?:algo\s+de\s+)?|aunque\s+mejor\s+(?:algo\s+de\s+)?|cambia(?:r)?\s+(?:a|el\s+genero\s+a)\s+|ahora\s+prefiero\s+|en\s+vez\s+de\s+[a-z\s]+prefiero\s+|prefiero\s+algo\s+de\s+|recomiendame\s+algo\s+de\s+)/i.test(text)

    // 8. Detección de rechazo explícito de un juego específico
    let rejectedGame = null
    for (const title of KNOWN_GAME_TITLES) {
        const pattern = new RegExp(`(?:no\\s+me\\s+gusta|no\\s+quiero|quita|sin|descartar)\\s+(?:el\\s+juego\\s+)?(?:el\\s+)?${cleanText(title)}`, "i")
        if (pattern.test(text)) {
            rejectedGame = title.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
            break
        }
    }
    if (!rejectedGame && /(?:no\s+me\s+gusta\s+(?:este|ese)\s+juego|(?:este|ese)\s+no\s+me\s+gusta|descarta\s+(?:este|ese)|(?:este|ese)\s+no)/i.test(text)) {
        rejectedGame = "CURRENT_TOP_GAME"
    }

    // 9. Detección de referencia a contexto previo
    const referencesPrevious = /(?:como\s+te\s+dije(?:\s+antes)?|lo\s+que\s+te\s+dije|recuerda\s+que|manten(?:er)?\s+lo\s+de|sigue\s+con)/i.test(text)

    // 10. Detección de dislikes / exclusiones
    for (const regex of DISLIKE_TRIGGERS) {
        const match = text.match(regex)
        if (match && match[1]) {
            const dislikedClause = match[1].trim()
            for (const item of GENRE_PATTERNS) {
                if (item.patterns.some((p) => dislikedClause.includes(cleanText(p)))) {
                    if (!criteria.dislikedGenres.includes(item.genre)) {
                        criteria.dislikedGenres.push(item.genre)
                    }
                    // Remover de preferidos si estaba previamente
                    criteria.preferredGenres = criteria.preferredGenres.filter((g) => g !== item.genre)
                }
            }
        }
    }

    // 11. Detección de géneros preferidos (excluyendo lo mencionado en dislikes)
    let genreModified = false
    for (const item of GENRE_PATTERNS) {
        const isMentioned = item.patterns.some((p) => {
            const regex = new RegExp(`\\b${cleanText(p)}\\b`, "i")
            return regex.test(text)
        })

        if (isMentioned && !criteria.dislikedGenres.includes(item.genre)) {
            if (isChangingGenre) {
                // Reemplazar género previo por el nuevo género corregido
                criteria.preferredGenres = [item.genre]
                genreModified = true
            } else if (!criteria.preferredGenres.includes(item.genre)) {
                criteria.preferredGenres.push(item.genre)
                genreModified = true
            }
        }
    }

    // 12. Detección de contexto emocional voluntario (con manejo de cambio de opinión)
    let emotionModified = false
    for (const item of EMOTIONAL_TRIGGERS) {
        const isMatched = item.patterns.some((p) => text.includes(cleanText(p)))
        if (isMatched) {
            emotionModified = true
            if (isChangingMind) {
                // Si el usuario cambia de opinión, limpiamos la emoción previa para evitar contradicciones
                criteria.emotionalContext = [item.tag]
            } else if (!criteria.emotionalContext.includes(item.tag)) {
                // Si son emociones opuestas (ej. relajante vs desafiante), reemplazar la opuesta
                if (item.tag === "desafiante") {
                    criteria.emotionalContext = criteria.emotionalContext.filter((e) => e !== "relajante")
                } else if (item.tag === "relajante") {
                    criteria.emotionalContext = criteria.emotionalContext.filter((e) => e !== "desafiante")
                }
                criteria.emotionalContext.push(item.tag)
            }

            // Inferencia de ritmo
            if (item.tag === "relajante") {
                criteria.desiredPacing = "relajado"
            } else if (item.tag === "desafiante" || item.tag === "emocionante") {
                criteria.desiredPacing = "intenso"
            }
        }
    }

    // 13. Detección de tiempo disponible
    let timeModified = false
    for (const item of TIME_TRIGGERS) {
        if (item.patterns.some((p) => text.includes(cleanText(p)))) {
            criteria.availableTime = item.duration
            timeModified = true
            break
        }
    }

    // Detección numérica dinámica de minutos u horas (ej. "25 minutos", "40 min", "2 horas")
    if (!timeModified) {
        const minMatch = text.match(/\b([0-9]{1,3})\s*(?:minutos|minuto|min|m)\b/i)
        if (minMatch && minMatch[1]) {
            const mins = parseInt(minMatch[1], 10)
            if (mins < 30) {
                criteria.availableTime = "corta (< 30 min)"
                timeModified = true
            } else if (mins <= 60) {
                criteria.availableTime = "media (30-60 min)"
                timeModified = true
            } else {
                criteria.availableTime = "larga (> 1 hora)"
                timeModified = true
            }
        } else {
            const hrMatch = text.match(/\b([0-9]{1,2})\s*(?:horas|hora|hrs|hr|h)\b/i)
            if (hrMatch && hrMatch[1]) {
                const hrs = parseInt(hrMatch[1], 10)
                criteria.availableTime = hrs >= 1 ? "larga (> 1 hora)" : "corta (< 30 min)"
                timeModified = true
            }
        }
    }

    // 14. Detección de modo de juego
    let modeModified = false
    if (!isModeIndifferent) {
        for (const item of MODE_TRIGGERS) {
            if (item.patterns.some((p) => text.includes(cleanText(p)))) {
                criteria.gameMode = item.mode
                modeModified = true
                break
            }
        }
    }

    // 15. Detección de juegos de referencia (similarTo)
    for (const target of SIMILAR_TARGETS) {
        if (text.includes(target)) {
            const capitalized = target.charAt(0).toUpperCase() + target.slice(1)
            if (!criteria.similarTo.includes(capitalized)) {
                criteria.similarTo.push(capitalized)
            }
        }
    }

    // 16. Detección de solicitudes genéricas / ambiguas
    const totalCriteriaPoints =
        criteria.preferredGenres.length +
        criteria.emotionalContext.length +
        (criteria.availableTime ? 1 : 0) +
        (criteria.gameMode ? 1 : 0) +
        criteria.similarTo.length

    const isGenericRequest = /^(?:quiero jugar algo|recomiendame un juego|recomiendame algo|que puedo jugar|busco un juego|dame un juego|juegos)[\s?!.]*$/i.test(text)
    const isAmbiguous = isGenericRequest || totalCriteriaPoints === 0

    const greetingReply = isGreeting
        ? "¡Hola! Bienvenido. Soy tu asistente de videojuegos. Estoy aquí para ayudarte a encontrar un juego que se adapte a lo que buscas hoy.\n\nPara empezar, ¿qué tipo de experiencia te gustaría tener?"
        : null

    const clarificationPrompt = isAmbiguous
        ? "¿Para ayudarte a encontrar el juego perfecto, prefieres una experiencia tranquila para relajarte o algo desafiante y con acción? ¿Cuánto tiempo tienes para jugar y estarás solo o con amigos?"
        : null

    return {
        intent: isGreeting
            ? "greeting"
            : isGenericRequest
            ? "generic_request"
            : wantsAlternatives
            ? "wants_alternatives"
            : wantsRecommendationsNow
            ? "recommend_now"
            : "criteria_provided",
        criteria,
        isGreeting,
        reply: greetingReply,
        isAmbiguous,
        clarificationPrompt,
        isGenericRequest,
        isSurpriseMe,
        isModeIndifferent,
        isGenreIndifferent,
        wantsRecommendationsNow,
        wantsAlternatives,
        rejectedGame,
        isChangingGenre,
        genreModified,
        isTimeModified: timeModified,
        isModeModified: modeModified,
        isEmotionModified: emotionModified,
        referencesPrevious,
        rawText
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
