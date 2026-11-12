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
    { genre: "Puzzle", patterns: ["puzzle", "puzzles", "puzle", "puzles", "rompecabezas", "acertijo", "acertijos", "ingenio", "logica"] },
    { genre: "Roguelike", patterns: ["roguelike", "roguelite", "mazmorras", "runs"] },
    { genre: "FPS", patterns: ["fps", "shooter", "shooters", "disparos", "tiros", "primera persona"] },
    { genre: "Supervivencia", patterns: ["supervivencia", "survival", "sobrevivir", "recolectar"] },
    { genre: "Construcción", patterns: ["construccion", "construir", "edificar", "crafteo", "construir o crear"] },
    { genre: "Simulación", patterns: ["simulacion", "simulador", "granja"] },
    { genre: "Plataformas", patterns: ["plataformas", "saltos", "plataformas 2d"] },
    { genre: "Metroidvania", patterns: ["metroidvania"] },
    { genre: "Terror", patterns: ["terror", "miedo", "horror", "sustos"] },
    { genre: "Indie", patterns: ["indie", "indies"] }
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

// Catálogo normalizado de videojuegos reconocidos y sus alias en el catálogo de PC
const KNOWN_GAME_CATALOG = [
    { title: "Stardew Valley", patterns: ["stardew valley", "stardew"] },
    { title: "Dorfromantik", patterns: ["dorfromantik"] },
    { title: "A Short Hike", patterns: ["a short hike", "short hike"] },
    { title: "Slime Rancher", patterns: ["slime rancher"] },
    { title: "Gris", patterns: ["gris"] },
    { title: "Hades", patterns: ["hades"] },
    { title: "Dead Cells", patterns: ["dead cells"] },
    { title: "Celeste", patterns: ["celeste"] },
    { title: "Elden Ring", patterns: ["elden ring"] },
    { title: "Doom Eternal", patterns: ["doom eternal", "doom"] },
    { title: "The Witcher 3: Wild Hunt", patterns: ["the witcher 3: wild hunt", "the witcher 3", "the witcher", "witcher 3", "witcher"] },
    { title: "Firewatch", patterns: ["firewatch"] },
    { title: "Outer Wilds", patterns: ["outer wilds"] },
    { title: "Hollow Knight", patterns: ["hollow knight"] },
    { title: "Disco Elysium - The Final Cut", patterns: ["disco elysium - the final cut", "disco elysium"] },
    { title: "Minecraft", patterns: ["minecraft"] },
    { title: "Terraria", patterns: ["terraria"] },
    { title: "Subnautica", patterns: ["subnautica"] },
    { title: "Cities: Skylines", patterns: ["cities: skylines", "cities skylines"] },
    { title: "Civilization VI", patterns: ["civilization vi", "civilization 6", "civilization", "civ 6", "civ vi"] },
    { title: "Slay the Spire", patterns: ["slay the spire"] },
    { title: "Into the Breach", patterns: ["into the breach"] },
    { title: "It Takes Two", patterns: ["it takes two"] },
    { title: "Portal 2", patterns: ["portal 2", "portal"] },
    { title: "Deep Rock Galactic", patterns: ["deep rock galactic", "deep rock"] },
    { title: "Overcooked! All You Can Eat", patterns: ["overcooked! all you can eat", "overcooked 2", "overcooked"] },
    { title: "Frostpunk", patterns: ["frostpunk"] }
]

// Lista aplanada de patrones de títulos conocidos para retrocompatibilidad
const KNOWN_GAME_TITLES = KNOWN_GAME_CATALOG.flatMap((item) => item.patterns)

// Títulos de referencia conocidos en el catálogo (relaciones similarTo)
const KNOWN_REFERENCE_TARGETS = [
    { title: "Dark Souls", patterns: ["dark souls", "darksouls"] },
    { title: "Bloodborne", patterns: ["bloodborne"] },
    { title: "Skyrim", patterns: ["skyrim", "the elder scrolls"] },
    { title: "Cyberpunk 2077", patterns: ["cyberpunk 2077", "cyberpunk"] },
    { title: "Animal Crossing", patterns: ["animal crossing"] },
    { title: "Ori and the Blind Forest", patterns: ["ori and the blind forest", "ori"] },
    { title: "Journey", patterns: ["journey"] },
    { title: "The Binding of Isaac", patterns: ["the binding of isaac", "binding of isaac", "isaac"] },
    { title: "Super Meat Boy", patterns: ["super meat boy"] },
    { title: "Townscaper", patterns: ["townscaper"] },
    { title: "Islanders", patterns: ["islanders"] },
    { title: "SimCity", patterns: ["simcity"] },
    { title: "Anno 1800", patterns: ["anno 1800", "anno"] },
    { title: "Age of Empires", patterns: ["age of empires", "aoe"] },
    { title: "Crusader Kings III", patterns: ["crusader kings iii", "crusader kings"] },
    { title: "Monster Train", patterns: ["monster train"] },
    { title: "Inscryption", patterns: ["inscryption"] },
    { title: "Balatro", patterns: ["balatro"] },
    { title: "FTL: Faster Than Light", patterns: ["ftl: faster than light", "ftl"] },
    { title: "XCOM", patterns: ["xcom"] },
    { title: "A Way Out", patterns: ["a way out"] },
    { title: "Unravel Two", patterns: ["unravel two", "unravel"] },
    { title: "The Talos Principle", patterns: ["the talos principle", "talos principle"] },
    { title: "Left 4 Dead", patterns: ["left 4 dead", "l4d"] },
    { title: "Helldivers 2", patterns: ["helldivers 2", "helldivers"] },
    { title: "Warhammer: Vermintide 2", patterns: ["warhammer: vermintide 2", "vermintide 2", "vermintide"] },
    { title: "Moving Out", patterns: ["moving out"] },
    { title: "PlateUp!", patterns: ["plateup!", "plateup"] },
    { title: "This War of Mine", patterns: ["this war of mine"] },
    { title: "What Remains of Edith Finch", patterns: ["what remains of edith finch", "edith finch"] },
    { title: "The Stanley Parable", patterns: ["the stanley parable", "stanley parable"] },
    { title: "Life is Strange", patterns: ["life is strange"] }
]

const SIMILAR_TARGETS = [
    "minecraft", "dark souls", "elden ring", "stardew valley", "hollow knight",
    "dead cells", "hades", "celeste", "subnautica", "terraria", "portal",
    "civilization", "slay the spire"
]

// Definición de las 11 características de juego (Etapa 2)
const FEATURE_DEFINITIONS = [
    {
        id: "exploracion",
        patterns: ["exploracion", "explorar", "descubrir lugares", "descubrir el mapa", "mundo abierto", "investigar el mundo", "curiosear el mapa", "secretos", "descubrir secretos", "explorar libremente", "exploro"]
    },
    {
        id: "construccion_creatividad",
        patterns: ["construccion", "construir", "edificar", "crafteo", "craftear", "crear cosas", "libertad creativa", "fabricar", "diseñar", "creatividad", "crear", "craftear y construir"]
    },
    {
        id: "narrativa_historia",
        patterns: ["narrativa", "historia", "historias", "buena historia", "buena trama", "guion", "lore", "dialogos", "trama profunda", "argumento", "trama envolvente"]
    },
    {
        id: "combate_accion",
        patterns: ["combate", "combates", "pelea", "peleas", "accion", "disparos", "frenetico", "lucha", "pelear", "armas", "tiroteos"]
    },
    {
        id: "estrategia_planificacion",
        patterns: ["estrategia", "planificacion", "planificar", "gestion", "gestionar", "tactica", "optimizar recursos", "imperio", "microgestion", "administrar", "gestionar mi granja", "gestion de granja"]
    },
    {
        id: "puzzles_acertijos",
        patterns: ["puzzles", "puzzle", "acertijos", "acertijo", "rompecabezas", "enigmas", "resolucion de acertijos", "logica", "pensar soluciones", "ingenio"]
    },
    {
        id: "libertad_sandbox",
        patterns: ["libertad", "libertad de juego", "libremente", "a mi propio ritmo", "hacer lo que quiera", "sin prisas", "sandbox", "ritmo libre", "jugar a mi ritmo", "sin presiones", "tranquilidad", "paz"]
    },
    {
        id: "cooperacion",
        patterns: ["cooperacion", "cooperar", "cooperativo", "en equipo", "con amigos", "colaborar", "apoyarnos", "coordinar"]
    },
    {
        id: "competencia",
        patterns: ["competencia", "competitivo", "pvp", "rankeds", "competir", "contra otros jugadores", "medir mi habilidad"]
    },
    {
        id: "supervivencia",
        patterns: ["supervivencia", "sobrevivir", "recolectar recursos", "subsistir", "craftear para vivir"]
    },
    {
        id: "desafio_progresion",
        patterns: ["desafio", "progresion", "reto", "superarme", "dificultad alta", "souls", "desafiante", "poner a prueba mi habilidad", "retos dificiles", "dificultad"]
    }
]

/**
 * Normaliza y resuelve un título de videojuego, identificando si pertenece
 * al catálogo, a referencias conocidas o si es un título no verificado (Etapa 2).
 */
function resolveGameTitle(rawTitle = "") {
    const clean = cleanText(rawTitle)
    if (!clean || clean.length < 2) return null

    // 1. Buscar en catálogo oficial
    for (const item of KNOWN_GAME_CATALOG) {
        if (item.patterns.some((p) => clean === p || new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(clean))) {
            return { title: item.title, inCatalog: true, verified: true }
        }
    }

    // 2. Buscar en referencias del catálogo
    for (const item of KNOWN_REFERENCE_TARGETS) {
        if (item.patterns.some((p) => clean === p || new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(clean))) {
            return { title: item.title, inCatalog: false, verified: true }
        }
    }

    // 3. Título no verificado
    const cleanedRaw = rawTitle.replace(/[.,?!¡¿]+/g, "").trim()
    const capitalized = cleanedRaw
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    return { title: capitalized, inCatalog: false, verified: false }
}

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

    // Clonar criterios acumulados previos con salvaguarda ante valores nulos (Etapas 1 y 2)
    const criteria = {
        preferredGenres: [...(prev.preferredGenres || [])],
        dislikedGenres: [...(prev.dislikedGenres || [])],
        emotionalContext: [...(prev.emotionalContext || [])],
        availableTime: prev.availableTime || null,
        gameMode: prev.gameMode || null,
        desiredPacing: prev.desiredPacing || null,
        similarTo: [...(prev.similarTo || [])],
        likedGames: [...(prev.likedGames || [])],
        dislikedGames: [...(prev.dislikedGames || [])],
        unverifiedGames: [...(prev.unverifiedGames || [])],
        likedFeatures: [...(prev.likedFeatures || [])],
        dislikedFeatures: [...(prev.dislikedFeatures || [])],
        discoveryPreference: prev.discoveryPreference || null,
        habitualTastes: [...(prev.habitualTastes || [])]
    }

    // Detección de contraste: Gusto habitual vs. Necesidad actual (Etapa 4, Sección 7)
    let isHabitualVsCurrent = false
    let habitualTaste = null
    let currentNeed = null

    const hasHabitualMarker = /(?:normalmente|suelo|acostumbro|por lo general|habitualmente|me suelen gustar|me gustan|prefiero)\s+.*?(?:dificil|desafi|reto|complej|accion|rpg|fps|estrateg)/i.test(text)
    const hasCurrentNeedMarker = /(?:pero|aunque|sin embargo|por hoy|hoy)\s+(?:quiero|busco|prefiero|apetece|algo|estoy)\s+.*?(?:tranquil|relaj|desconect|calm|paz|ligero|descans)/i.test(text) ||
        /(?:pero|aunque|sin embargo)\s+hoy\s+/i.test(text)

    if (hasHabitualMarker && hasCurrentNeedMarker) {
        isHabitualVsCurrent = true
        if (/dificil|desafi|reto|complej/i.test(text)) {
            habitualTaste = { tag: "desafiante", text: "desafíos" }
            if (!criteria.habitualTastes.includes("desafiante")) {
                criteria.habitualTastes.push("desafiante")
            }
        }
        if (/tranquil|relaj|desconect|calm|paz/i.test(text)) {
            currentNeed = { tag: "relajante", text: "tranquilo" }
            criteria.emotionalContext = ["relajante"]
            criteria.desiredPacing = "relajado"
        }
    }

    let isHabitualPure = false
    if (hasHabitualMarker && !hasCurrentNeedMarker) {
        isHabitualPure = true
        if (/dificil|desafi|reto|complej/i.test(text)) {
            if (!criteria.habitualTastes.includes("desafiante")) criteria.habitualTastes.push("desafiante")
        }
    }

    // Detección de respuestas condicionales, ambiguas o parciales (Etapa 4, Sección 5)
    const isDepende = /\b(?:depende|segun|relativo)\b/i.test(text)
    const isUnPocoDeTodo = /(?:un poco de todo|variado|de todo un poco|mezcla)/i.test(text)

    // 1. Detección de saludos iniciales
    const strippedPunctuation = text.replace(/[,.?!¡¿]+/g, " ").replace(/\s+/g, " ").trim()
    const isGreeting = /^(?:hola|buenas|buenos dias|buenas tardes|buenas noches|que tal|hey|saludos)(?:\s+(?:hola|buenas|buenos dias|buenas tardes|buenas noches|que tal|como estas|amigo|bot|asistente))?$/i.test(strippedPunctuation)

    // 2. Detección de "No estoy seguro, sorpréndeme" / sorpréndeme
    const isSurpriseMe = /(?:sorprendeme|sorprende me|no estoy seguro[, ]+sorprendeme)/i.test(text) || (isUnPocoDeTodo && dState.stage === "experience")

    // Detección de respuesta incierta o ambigua ("No sé", "ni idea", "no estoy seguro", "tal vez")
    const isUncertain = /^(?:no se|no sé|ni idea|no estoy seguro|no sabria decirte|no lo tengo claro|mm no se|mmm no se|tal vez|quizas)[\s.?!]*$/i.test(text)

    // 3. Detección de indiferencia en modalidad ("Me da igual", "Depende")
    let isModeIndifferent =
        ((dState.stage === "mode" || text.includes("modo") || text.includes("jugar") || text.includes("modalidad")) &&
         /(?:me da igual|da igual|no importa|indiferente|como sea|cualquiera|ambos|lo que sea|depende)/i.test(text)) ||
        /(?:me da igual la modalidad|no importa la modalidad|cualquier modalidad|indiferente el modo)/i.test(text)

    // 4. Detección de indiferencia en géneros ("No tengo preferencias", "Un poco de todo", "Depende")
    let isGenreIndifferent =
        /(?:flexibilizar(?:\s+el)?\s+g[eé]nero|no tengo preferencias|sin preferencias|cualquier genero|no importa el genero|todos los generos|no tengo|ninguno en particular|ninguno|un poco de todo)/i.test(text) ||
        ((dState.stage === "genres" || text.includes("genero") || text.includes("estilo")) &&
         /(?:me da igual|da igual|no importa|indiferente|como sea|cualquiera|lo que sea|depende|un poco de todo)/i.test(text)) ||
        /(?:me da igual el genero|no importa el genero|cualquier genero|sin preferencia)/i.test(text)

    // Detección de indiferencia en tiempo ("Depende")
    let isTimeIndifferent =
        /(?:flexibilizar(?:\s+la)?\s+duraci[oó]n|flexibilizar(?:\s+el)?\s+tiempo)/i.test(text) ||
        ((dState.stage === "time" || text.includes("tiempo") || text.includes("duracion")) &&
         /(?:me da igual|da igual|no importa|indiferente|como sea|cualquiera|lo que sea|depende)/i.test(text)) ||
        /(?:me da igual el tiempo|no importa el tiempo|cualquier duracion)/i.test(text)

    // 5. Detección de solicitud de alternativas ("Muéstrame otros juegos", "algo diferente", "no me convencen estas opciones", "más alternativas")
    const wantsAlternatives = /(?:muestrame otros|otros juegos|otras opciones|dame otras opciones|mas alternativas|dame mas alternativas|algo diferente|quiero algo diferente|no me convencen|no me convence|ver otras|ver mas alternativas|diferentes juegos|cambiar opciones|opciones diferentes)/i.test(text)

    // 6. Detección de solicitud explícita de recomendación inmediata (Regla D)
    const wantsRecommendationsNow = /(?:ya\s+(?:puedes\s+)?recomendar(?:me)?|recomiendame\s+(?:ya|juegos)|recomienda(?:me)?\s+ya\b|recomiendame\s+.*?\s+ya\b|recomiendame\s+segun\s+lo\s+que|recomi[eé]ndame\s+seg[uú]n\s+(?:lo\s+hablado|el\s+contexto|lo\s+que\s+hemos\s+hablado)|busca\s+seg[uú]n\s+lo\s+hablado|puedes\s+recomendarme|muestrame\s+(?:los\s+)?(?:juegos|opciones|recomendaciones)|ver\s+(?:los\s+)?(?:juegos|recomendaciones)|(?:con\s+eso\s+)?(?:es\s+)?suficiente|con\s+eso\s+basta|no\s+(?:quiero\s+)?(?:responder\s+)?mas\s+preguntas|sin\s+mas\s+preguntas|dame\s+recomendaciones)/i.test(text)

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
        const isMatched = item.patterns.some((p) => {
            const cleanedP = cleanText(p)
            return new RegExp(`\\b${cleanedP}\\b`, "i").test(text)
        })
        if (isMatched) {
            if (isHabitualVsCurrent && item.tag === "desafiante") {
                continue
            }
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
            const isDisliked = new RegExp(`(?:no\\s+me\\s+gust[oa]|distinto\\s+a|diferente\\s+a|sin|odio|descartar)\\s+(?:el\\s+juego\\s+)?(?:el\\s+)?${target}`, "i").test(text)
            if (!isDisliked) {
                const capitalized = target.charAt(0).toUpperCase() + target.slice(1)
                if (!criteria.similarTo.includes(capitalized)) {
                    criteria.similarTo.push(capitalized)
                }
            }
        }
    }

    // =========================================================================
    // ETAPA 2: GUSTOS Y EXPERIENCIAS PREVIAS DEL JUGADOR
    // =========================================================================

    // A. Detección de salto o desinterés en hablar de juegos anteriores
    const isSkippingPastGames =
        /(?:prefiero\s+saltar|saltar|no\s+recuerdo|ninguno\s+en\s+particular|ninguno|no\s+tengo\s+juegos?\s+favoritos?|prefiero\s+no\s+responder|no\s+se\s+ninguno|omitir|pasar)/i.test(text) &&
        (dState.stage === "followup_game" || dState.stage === "followup_disliked" || dState.stage === "past_games" || text.includes("saltar") || text.includes("omitir"))

    // B. Detección de preferencia de descubrimiento (discoveryPreference)
    if (/(?:algo\s+(?:completamente\s+|totalmente\s+)?(?:distinto|diferente)|probar\s+algo\s+(?:completamente\s+|totalmente\s+)?(?:distinto|diferente)|descubrir\s+algo\s+(?:completamente\s+|totalmente\s+)?(?:diferente|nuevo)|salir\s+de\s+la\s+rutina|(?:distinto|diferente)\s+a\s+(?:lo\s+que\s+suelo\s+jugar|los\s+juegos\s+que\s+suelo\s+jugar|lo\s+habitual|lo\s+de\s+siempre))/i.test(text)) {
        criteria.discoveryPreference = "diferente"
    } else if (/(?:algo\s+parecido|algo\s+similar|volver\s+a\s+vivir\s+algo\s+parecido|en\s+la\s+misma\s+linea|parecido\s+a\s+los\s+que\s+suelo\s+jugar|parecido\s+a|similar\s+a)/i.test(text)) {
        criteria.discoveryPreference = "similar"
    } else if (/(?:me\s+da\s+igual\s+si\s+es\s+parecido|da\s+igual\s+si\s+es\s+similar|indiferente|no\s+importa\s+si\s+es\s+parecido)/i.test(text) && dState.stage === "discovery_pref") {
        criteria.discoveryPreference = "indistinto"
    }

    // C. Detección de videojuegos que NO le gustaron (dislikedGames)
    let newDislikedGame = null
    const SPANISH_STOPWORDS = [
        "pero", "y", "que", "porque", "a mi", "tambien", "ademas", "aunque",
        "el", "la", "los", "las", "un", "una", "de", "del", "al", "en", "por", "para", "con", "sin", "nada", "eso", "esto"
    ]

    const dislikedGamePatterns = [
        /(?:no\s+me\s+gust(?:o|a|an)?|no\s+disfrut(?:e|o)|odio|detesto|no\s+soporto|no\s+le\s+encontre\s+la\s+gracia\s+a)\s+(?:el\s+juego\s+)?(?:el\s+|la\s+|los\s+|las\s+)?([a-záéíóúñ0-9: \-]+?)(?:\s*[,;.]|\s+(?:porque|por|ya\s+que|pero|aunque|y)|$)/i,
        /(?:el\s+juego\s+)?([a-záéíóúñ0-9: \-]+?)\s+no\s+me\s+gust(?:o|a|an)?/i
    ]

    for (const pat of dislikedGamePatterns) {
        const match = text.match(pat)
        if (match && match[1]) {
            const rawCandidate = match[1].trim()
            const cleanCandidate = cleanText(rawCandidate)
            if (SPANISH_STOPWORDS.includes(cleanCandidate)) continue

            const res = resolveGameTitle(rawCandidate)
            if (res && res.title && res.title.length > 2) {
                if (!res.verified) {
                    const isGenre = GENRE_PATTERNS.some(g => g.patterns.some(p => cleanCandidate === p))
                    const isFeat = FEATURE_DEFINITIONS.some(f => f.patterns.some(p => cleanCandidate === p))
                    if (isGenre || isFeat) continue
                    if (!text.includes("juego") && !text.includes("titulo")) {
                        continue
                    }
                }
                if (!criteria.dislikedGames.includes(res.title)) {
                    criteria.dislikedGames.push(res.title)
                }
                criteria.likedGames = criteria.likedGames.filter(t => t !== res.title)
                newDislikedGame = res.title
                break
            }
        }
    }

    // D. Detección de videojuegos disfrutados (likedGames) y no verificados
    let newLikedGame = null
    const unverifiedGames = []
    const likedGamePatterns = [
        /(?:uno\s+de\s+mis\s+juegos?\s+favoritos?\s+es|mi\s+juego\s+favorito\s+es|mis\s+juegos?\s+favoritos?\s+son|me\s+encanta|me\s+encanto|disfrut(?:e|o)\s+mucho|disfrut(?:e|o)|juegos?\s+que\s+me\s+gustan?|me\s+gust(?:o|a)(?:\s+mucho)?|le\s+meti\s+muchas\s+horas\s+a)\s+([a-záéíóúñ0-9: \-]+?)(?:\s*[,;.]|\s+(?:porque|por|ya\s+que|pero|aunque|y)|$)/i,
        /([a-záéíóúñ0-9: \-]+?)\s+es\s+uno\s+de\s+mis\s+juegos?\s+favoritos?/i,
        /me\s+gusta\s+([a-záéíóúñ0-9: \-]+?)\s+(?:porque|por|ya\s+que)/i
    ]

    for (const pat of likedGamePatterns) {
        const match = text.match(pat)
        if (match && match[1]) {
            const rawCandidate = match[1].trim()
            const cleanCandidate = cleanText(rawCandidate)
            if (SPANISH_STOPWORDS.includes(cleanCandidate)) continue

            const res = resolveGameTitle(rawCandidate)
            if (res && res.title && res.title.length > 2) {
                if (!res.verified) {
                    const isGenre = GENRE_PATTERNS.some(g => g.patterns.some(p => cleanCandidate === p))
                    const isFeat = FEATURE_DEFINITIONS.some(f => f.patterns.some(p => cleanCandidate === p))
                    if (isGenre || isFeat) continue
                }
                if (!criteria.likedGames.includes(res.title)) {
                    criteria.likedGames.push(res.title)
                }
                if (!res.verified) {
                    if (!unverifiedGames.includes(res.title)) unverifiedGames.push(res.title)
                    if (!criteria.unverifiedGames.includes(res.title)) criteria.unverifiedGames.push(res.title)
                }
                newLikedGame = res.title
                break
            }
        }
    }

    // Buscar títulos conocidos (catálogo y referencias) en contexto afirmativo o negativo
    for (const item of [...KNOWN_GAME_CATALOG, ...KNOWN_REFERENCE_TARGETS]) {
        const cleanPattern = cleanText(item.patterns[0])
        const reg = new RegExp(`\\b${cleanPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
        if (reg.test(text)) {
            // Verificar si es mención de rechazo
            const isDisliked = criteria.dislikedGames.includes(item.title) ||
                new RegExp(`(?:no\\s+me\\s+gust[oa]|no\\s+quiero|odio|detesto|no\\s+soporto)\\s+(?:el\\s+juego\\s+)?(?:el\\s+|la\\s+)?${cleanPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text) ||
                new RegExp(`${cleanPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+no\\s+me\\s+gust[oa]`, "i").test(text)

            if (!isDisliked) {
                if (/(?:me\s+gust[oa]|disfrut|encanta|favorito|jugu|jueg|jugad|jugab|jugan|parecido\s+a|similar\s+a)/i.test(text)) {
                    if (!criteria.likedGames.includes(item.title)) {
                        criteria.likedGames.push(item.title)
                    }
                    if (!newLikedGame) newLikedGame = item.title
                }
            } else {
                if (!criteria.dislikedGames.includes(item.title)) {
                    criteria.dislikedGames.push(item.title)
                }
                criteria.likedGames = criteria.likedGames.filter(t => t !== item.title)
                if (!newDislikedGame) newDislikedGame = item.title
            }
        }
    }

    // Detección de referencia explícita "similar a [Juego]"
    const similarMatch = text.match(/(?:parecido\s+a|similar\s+a|en\s+la\s+linea\s+de)\s+([a-záéíóúñ0-9: \-]+)/i)
    if (similarMatch && similarMatch[1]) {
        const candidate = similarMatch[1].trim()
        const res = resolveGameTitle(candidate)
        if (res && res.title) {
            if (!criteria.similarTo.includes(res.title)) {
                criteria.similarTo.push(res.title)
            }
            criteria.discoveryPreference = "similar"
        }
    }

    // E. Detección de características evitadas / rechazadas (dislikedFeatures)
    // Caso especial: combate difícil / dificultad excesiva
    if (/(?:no\s+quiero|sin|evit(?:ar|o|ando)?|nada\s+de|odio|detesto)\s+(?:los?\s+)?(?:combates?\s+dificil(?:es)?|peleas?\s+dificil(?:es)?|jefes?\s+dificil(?:es)?|dificultad\s+alta|dificultad\s+extrema|morir\s+a\s+cada\s+rato)/i.test(text) ||
        /(?:combates?|peleas?|jefes?)\s+(?:son\s+)?(?:demasiado\s+)?dificil(?:es)?/i.test(text) ||
        /(?:demasiado\s+dificil(?:es)?|muy\s+dificil(?:es)?\s+y\s+frustrante|dificultad\s+frustrante)/i.test(text)) {
        if (!criteria.dislikedFeatures.includes("combate_dificil")) {
            criteria.dislikedFeatures.push("combate_dificil")
        }
        criteria.emotionalContext = criteria.emotionalContext.filter(e => e !== "desafiante")
        criteria.likedFeatures = criteria.likedFeatures.filter(f => f !== "combate_accion" && f !== "desafio_progresion")
    }

    // Filtrar similarTo si el juego fue descartado o si pide algo diferente
    if (criteria.discoveryPreference === "diferente") {
        criteria.similarTo = criteria.similarTo.filter(s => !criteria.likedGames.some(l => l.toLowerCase() === s.toLowerCase()))
    }
    if (criteria.dislikedGames.length > 0) {
        criteria.similarTo = criteria.similarTo.filter(s => !criteria.dislikedGames.some(d => d.toLowerCase() === s.toLowerCase()))
    }

    // Aversiones directas a características concretas
    for (const feat of FEATURE_DEFINITIONS) {
        for (const p of feat.patterns) {
            const escapedP = cleanText(p).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            const dislikeRegex = new RegExp(`(?:no\\s+(?:me\\s+)?gust(?:an?|a)?|sin|evit(?:ar|o|ando)?|nada\\s+de|odio|detesto|cero|menos)\\s+(?:el|la|los|las)?\\s*(?:de\\s+)?(?:much[oa]s?\\s+)?\\b${escapedP}\\b`, "i")
            if (dislikeRegex.test(text)) {
                if (!criteria.dislikedFeatures.includes(feat.id)) {
                    criteria.dislikedFeatures.push(feat.id)
                }
                criteria.likedFeatures = criteria.likedFeatures.filter(f => f !== feat.id)
                break
            }
        }
    }

    // F. Detección de características disfrutadas (likedFeatures)
    for (const feat of FEATURE_DEFINITIONS) {
        if (criteria.dislikedFeatures.includes(feat.id)) continue
        if (feat.id === "combate_accion" && criteria.dislikedFeatures.includes("combate_dificil")) continue

        const positiveMatch = feat.patterns.some(p => {
            const escapedP = cleanText(p).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            const matchWord = new RegExp(`\\b${escapedP}\\b`, "i")
            if (!matchWord.test(text)) return false

            const isNegated = new RegExp(`(?:no\\s+(?:me\\s+)?gust(?:an?|a)?|sin|evit(?:ar|o|ando)?|nada\\s+de|odio|detesto|cero|menos)\\s+(?:el|la|los|las)?\\s*(?:de\\s+)?(?:much[oa]s?\\s+)?\\b${escapedP}\\b`, "i").test(text)
            return !isNegated
        })

        if (positiveMatch) {
            if (!criteria.likedFeatures.includes(feat.id)) {
                criteria.likedFeatures.push(feat.id)
            }
        }
    }

    // Detección de respuestas directas a preguntas de seguimiento de características (Etapa 4, Sección 4)
    if (dState.stage === "feature_exploracion") {
        if (/(?:tranquilamente|tranquilo|relajad|sin prisas|descubrir lugares tranquilamente)/i.test(text)) {
            if (!criteria.likedFeatures.includes("libertad_sandbox")) criteria.likedFeatures.push("libertad_sandbox")
            criteria.emotionalContext = ["relajante"]
            criteria.desiredPacing = "relajado"
        } else if (/(?:desafios?|retos?|superando|peligro|enemigos)/i.test(text)) {
            if (!criteria.likedFeatures.includes("desafio_progresion")) criteria.likedFeatures.push("desafio_progresion")
            criteria.emotionalContext = ["desafiante"]
            criteria.desiredPacing = "intenso"
        }
    } else if (dState.stage === "feature_narrativa") {
        if (/(?:emotiva|profunda|sentimiento|emocion)/i.test(text)) {
            if (!criteria.likedFeatures.includes("narrativa_historia")) criteria.likedFeatures.push("narrativa_historia")
        } else if (/(?:misterio|secreto|resolver)/i.test(text)) {
            if (!criteria.likedFeatures.includes("narrativa_historia")) criteria.likedFeatures.push("narrativa_historia")
            if (!criteria.likedFeatures.includes("puzzles_acertijos")) criteria.likedFeatures.push("puzzles_acertijos")
            if (!criteria.preferredGenres.includes("Aventura")) criteria.preferredGenres.push("Aventura")
        } else if (/(?:decision|rol|rpg|consecuencia)/i.test(text)) {
            if (!criteria.likedFeatures.includes("narrativa_historia")) criteria.likedFeatures.push("narrativa_historia")
            if (!criteria.preferredGenres.includes("RPG")) criteria.preferredGenres.push("RPG")
        }
    } else if (dState.stage === "feature_construccion") {
        if (/(?:libremente|aire|sin limites|creatividad)/i.test(text)) {
            if (!criteria.likedFeatures.includes("construccion_creatividad")) criteria.likedFeatures.push("construccion_creatividad")
            if (!criteria.likedFeatures.includes("libertad_sandbox")) criteria.likedFeatures.push("libertad_sandbox")
        } else if (/(?:objetivo|mision|meta|guiado)/i.test(text)) {
            if (!criteria.likedFeatures.includes("construccion_creatividad")) criteria.likedFeatures.push("construccion_creatividad")
            if (!criteria.likedFeatures.includes("estrategia_planificacion")) criteria.likedFeatures.push("estrategia_planificacion")
        }
    } else if (dState.stage === "feature_estrategia") {
        if (/(?:calma|turnos?|pensar|tranquilo)/i.test(text)) {
            if (!criteria.likedFeatures.includes("estrategia_planificacion")) criteria.likedFeatures.push("estrategia_planificacion")
            criteria.desiredPacing = "relajado"
        } else if (/(?:presion|tiempo real|rapido|accion)/i.test(text)) {
            if (!criteria.likedFeatures.includes("estrategia_planificacion")) criteria.likedFeatures.push("estrategia_planificacion")
            criteria.desiredPacing = "intenso"
        }
    } else if (dState.stage === "feature_cooperacion") {
        if (/(?:colaborar|cooperar|equipo|amigos)/i.test(text)) {
            criteria.gameMode = "cooperativo"
            if (!criteria.likedFeatures.includes("cooperacion")) criteria.likedFeatures.push("cooperacion")
        } else if (/(?:competir|contra otros|pvp)/i.test(text)) {
            criteria.gameMode = "multijugador"
            if (!criteria.likedFeatures.includes("competencia")) criteria.likedFeatures.push("competencia")
        } else if (/(?:solo|solitario)/i.test(text)) {
            criteria.gameMode = "individual"
        }
    } else if (dState.stage === "feature_desafio") {
        if (/(?:habilidad|reflejos?|accion)/i.test(text)) {
            if (!criteria.preferredGenres.includes("Acción")) criteria.preferredGenres.push("Acción")
            criteria.desiredPacing = "intenso"
        } else if (/(?:acertijo|puzzle|logica)/i.test(text)) {
            if (!criteria.preferredGenres.includes("Puzzle")) criteria.preferredGenres.push("Puzzle")
            if (!criteria.likedFeatures.includes("puzzles_acertijos")) criteria.likedFeatures.push("puzzles_acertijos")
        } else if (/(?:estrategia|tactica)/i.test(text)) {
            if (!criteria.preferredGenres.includes("Estrategia")) criteria.preferredGenres.push("Estrategia")
            if (!criteria.likedFeatures.includes("estrategia_planificacion")) criteria.likedFeatures.push("estrategia_planificacion")
        }
    }

    // 16. Detección de solicitudes genéricas / ambiguas
    const totalCriteriaPoints =
        criteria.preferredGenres.length +
        criteria.emotionalContext.length +
        (criteria.availableTime ? 1 : 0) +
        (criteria.gameMode ? 1 : 0) +
        criteria.similarTo.length +
        criteria.likedGames.length +
        criteria.likedFeatures.length

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
        isUncertain,
        isModeIndifferent,
        isGenreIndifferent,
        isTimeIndifferent,
        wantsRecommendationsNow,
        wantsAlternatives,
        rejectedGame,
        isChangingGenre,
        genreModified,
        isTimeModified: timeModified,
        isModeModified: modeModified,
        isEmotionModified: emotionModified,
        referencesPrevious,
        newLikedGame,
        newDislikedGame,
        unverifiedGames,
        isSkippingPastGames,
        isHabitualVsCurrent,
        isHabitualPure,
        habitualTaste,
        currentNeed,
        isDepende,
        rawText
    }
}

module.exports = {
    parseUserMessage,
    cleanText,
    resolveGameTitle,
    GENRE_PATTERNS,
    EMOTIONAL_TRIGGERS,
    TIME_TRIGGERS,
    MODE_TRIGGERS,
    FEATURE_DEFINITIONS,
    KNOWN_GAME_CATALOG
}
