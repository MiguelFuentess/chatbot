import React, { useState, useEffect, useRef } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import GameCard from "./GameCard"
import GameComparison from "./GameComparison"
import QuickReplies from "./QuickReplies"
import PlayerProfile from "./PlayerProfile"
import "./ChatBot.css"

const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000/api"

const WELCOME_TEXT = `¡Hola! Bienvenido. Soy tu asistente de videojuegos. Estoy aquí para ayudarte a encontrar un juego que se adapte a lo que buscas hoy.

Para empezar, ¿qué tipo de experiencia te gustaría tener?`

const INITIAL_QUICK_REPLIES = [
    "Quiero relajarme",
    "Busco algo emocionante",
    "Quiero un desafío",
    "Me gustaría explorar una buena historia",
    "Quiero construir o crear algo",
    "No estoy seguro, sorpréndeme"
]

const ChatBot = () => {
    const navigate = useNavigate()

    const [messages, setMessages] = useState([
        {
            role: "bot",
            isWelcome: true,
            text: WELCOME_TEXT,
            suggestedReplies: INITIAL_QUICK_REPLIES
        }
    ])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [accumulatedCriteria, setAccumulatedCriteria] = useState({})
    const [dialogueState, setDialogueState] = useState({
        stage: "experience",
        questionsAsked: ["experience"],
        turnCount: 0
    })
    const [conversationMemory, setConversationMemory] = useState(null)
    const [compareCandidate, setCompareCandidate] = useState(null)
    const [isOnline, setIsOnline] = useState(true)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
    const [profileOpen, setProfileOpen] = useState(false)

    const messagesEndRef = useRef(null)

    // Verificación de salud y conexión con el servidor (Requisito Sección 5)
    useEffect(() => {
        let isMounted = true
        axios
            .get(`${API_BASE}/health`)
            .then((res) => {
                if (isMounted && res.data && res.data.status === "ok") {
                    setIsOnline(true)
                }
            })
            .catch(() => {
                if (isMounted) setIsOnline(false)
            })
        return () => {
            isMounted = false
        }
    }, [])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, loading])

    const sendMessage = async (textToSend) => {
        const query = (textToSend || input).trim()
        if (!query || loading) return

        // 1. Agregar mensaje del usuario al chat
        setMessages((prev) => [
            ...prev,
            {
                role: "user",
                text: query
            }
        ])
        setInput("")
        setLoading(true)

        try {
            // 2. Enviar mensaje, criterios acumulados, estado y memoria al backend
            const payload = {
                message: query,
                accumulatedCriteria,
                dialogueState: {
                    ...dialogueState,
                    ...(conversationMemory ? { conversationMemory } : {})
                }
            }

            const res = await axios.post(`${API_BASE}/recommendations/chat`, payload)

            const {
                reply,
                recommendations,
                updatedCriteria,
                dialogueState: newDialogueState,
                suggestedReplies,
                conversationMemory: newMemory,
                comparisonData
            } = res.data

            // 3. Confirmar conexión exitosa
            setIsOnline(true)

            // 4. Actualizar memoria de criterios acumulados y estado de diálogo
            if (updatedCriteria) {
                setAccumulatedCriteria(updatedCriteria)
            }
            if (newDialogueState) {
                setDialogueState(newDialogueState)
            }
            // 5. Preservar memoria estructurada de sesión (Etapa 6)
            if (newMemory) {
                setConversationMemory(newMemory)
            } else if (newDialogueState?.conversationMemory) {
                setConversationMemory(newDialogueState.conversationMemory)
            }

            // 6. Agregar respuesta del bot con tarjetas o preguntas de seguimiento
            setMessages((prev) => [
                ...prev,
                {
                    role: "bot",
                    text: reply,
                    recommendations: recommendations || [],
                    suggestedReplies: suggestedReplies || [],
                    comparisonData: comparisonData || null
                }
            ])
        } catch (error) {
            console.error("Error al comunicarse con el asistente:", error)
            setIsOnline(false)
            setMessages((prev) => [
                ...prev,
                {
                    role: "bot",
                    text: "Hubo un inconveniente al conectar con el asistente. Por favor, verifica que el servidor backend esté activo e inténtalo nuevamente.",
                    recommendations: []
                }
            ])
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const handleCardCompare = (game) => {
        if (!game || !game.title) return
        if (!compareCandidate) {
            setCompareCandidate(game)
        } else if (compareCandidate.title.toLowerCase() === game.title.toLowerCase()) {
            // Deseleccionar al hacer clic nuevamente sobre el mismo
            setCompareCandidate(null)
        } else {
            const titleA = compareCandidate.title
            const titleB = game.title
            setCompareCandidate(null)
            sendMessage(`Compara ${titleA} con ${titleB}`)
        }
    }

    const handleReset = () => {
        setAccumulatedCriteria({})
        setDialogueState({
            stage: "experience",
            questionsAsked: ["experience"],
            turnCount: 0
        })
        setConversationMemory(null)
        setCompareCandidate(null)
        setMessages([
            {
                role: "bot",
                isWelcome: true,
                text: WELCOME_TEXT,
                suggestedReplies: INITIAL_QUICK_REPLIES
            }
        ])
        if (mobileSidebarOpen) {
            setMobileSidebarOpen(false)
        }
    }

    const handleProfileUpdate = async (updateAction) => {
        try {
            const payload = {
                memory: conversationMemory,
                criteria: accumulatedCriteria,
                dialogueState,
                updateAction
            }
            const res = await axios.post(`${API_BASE}/recommendations/profile-update`, payload)
            if (res.data) {
                if (res.data.memory) setConversationMemory(res.data.memory)
                if (res.data.criteria) setAccumulatedCriteria(res.data.criteria)
                if (res.data.dialogueState) setDialogueState(res.data.dialogueState)
            }
        } catch (error) {
            console.error("Error al actualizar perfil en servidor:", error)
            throw error
        }
    }

    const isInitialWelcome = messages.length === 1 && messages[0].isWelcome

    return (
        <div className="rg-chat-viewport">
            {/* BACKDROP PARA MÓVIL */}
            {mobileSidebarOpen && (
                <div
                    className="rg-sidebar-backdrop"
                    onClick={() => setMobileSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* BARRA LATERAL (SIDEBAR) */}
            <aside
                className={`rg-chat-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${
                    mobileSidebarOpen ? "mobile-open" : ""
                }`}
                aria-label="Panel lateral de navegación"
            >
                <div className="rg-sidebar-top">
                    {/* Logotipo RecoGames */}
                    <button
                        className="rg-sidebar-brand"
                        onClick={() => navigate("/")}
                        title="Ir a la pantalla de bienvenida"
                    >
                        <div className="rg-sidebar-brand-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: "22px" }} aria-hidden="true">
                                sports_esports
                            </span>
                        </div>
                        {!sidebarCollapsed && (
                            <div className="rg-sidebar-brand-text">
                                <span className="rg-sidebar-brand-title">RecoGames</span>
                                <span className="rg-sidebar-brand-sub">AI Companion</span>
                            </div>
                        )}
                    </button>

                    {/* Botón Funcional: + Nueva Conversación */}
                    <button
                        type="button"
                        className="rg-sidebar-btn-new"
                        onClick={handleReset}
                        title="Reiniciar conversación y comenzar nueva búsqueda"
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">add</span>
                        {!sidebarCollapsed && <span>Nueva conversación</span>}
                    </button>

                    {/* Navegación Básica Real */}
                    <nav className="rg-sidebar-nav" aria-label="Enlaces rápidos">
                        <button
                            type="button"
                            className="rg-sidebar-nav-item"
                            onClick={() => navigate("/")}
                            title="Volver a la página de bienvenida"
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">explore</span>
                            {!sidebarCollapsed && <span>Inicio</span>}
                        </button>

                        <button
                            type="button"
                            className="rg-sidebar-nav-item"
                            onClick={() => setProfileOpen(true)}
                            title="Ver y editar mis preferencias de juego"
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">tune</span>
                            {!sidebarCollapsed && <span>Mis preferencias</span>}
                        </button>
                    </nav>
                </div>

                {/* Pie del Sidebar: Botón Minimizar */}
                <div className="rg-sidebar-bottom">
                    <button
                        type="button"
                        className="rg-sidebar-collapse-btn"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        title={sidebarCollapsed ? "Expandir barra lateral" : "Minimizar barra lateral"}
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">
                            {sidebarCollapsed ? "keyboard_double_arrow_right" : "keyboard_double_arrow_left"}
                        </span>
                        {!sidebarCollapsed && <span>Minimizar barra</span>}
                    </button>
                </div>
            </aside>

            {/* ÁREA PRINCIPAL DEL CHAT */}
            <div className="rg-chat-main-area">
                {/* Cabecera Superior Sticky */}
                <header className="rg-chat-top-header" role="banner">
                    <div className="rg-top-header-left">
                        <button
                            type="button"
                            className="rg-mobile-menu-btn"
                            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                            aria-label="Abrir menú lateral"
                        >
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                        <h2 className="rg-top-header-title">RecoGames Chat</h2>
                    </div>

                    <div className="rg-top-header-right">
                        <button
                            type="button"
                            className="rg-top-header-btn-profile"
                            onClick={() => setProfileOpen(true)}
                            title="Ver y editar mis preferencias de juego"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">
                                tune
                            </span>
                            <span>Mis preferencias</span>
                        </button>

                        <button
                            type="button"
                            className="rg-top-header-btn-new"
                            onClick={handleReset}
                            title="Comenzar una nueva conversación"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">
                                add
                            </span>
                            <span>Nueva</span>
                        </button>
                    </div>
                </header>

                {/* Línea Decorativa Multicolor Serigráfica */}
                <div className="rg-chat-top-gradient" aria-hidden="true" />

                {/* Contenedor Scrollable de la Conversación */}
                <main className="rg-chat-scroll-container">
                    <div className="rg-chat-inner-max">
                        {/* 1. Tarjeta Mascota / Cabecera Interna de Asistente */}
                        <section className="rg-chat-mascot-card" aria-label="Información del asistente">
                            <div className="rg-mascot-decor-circle-1" aria-hidden="true" />
                            <div className="rg-mascot-decor-circle-2" aria-hidden="true" />

                            <div className="rg-mascot-content-left">
                                {/* Mascota Geométrica Robot SVG */}
                                <div className="rg-mascot-avatar-box">
                                    <svg
                                        className="rg-mascot-svg"
                                        fill="none"
                                        viewBox="0 0 64 64"
                                        xmlns="http://www.w3.org/2000/svg"
                                        aria-hidden="true"
                                    >
                                        <rect fill="currentColor" height="34" rx="8" width="40" x="12" y="16" />
                                        <circle cx="25" cy="30" fill="#002247" r="5" />
                                        <circle cx="39" cy="30" fill="#002247" r="5" />
                                        <rect fill="#002247" height="4" rx="2" width="14" x="25" y="40" />
                                        <line stroke="currentColor" strokeLinecap="round" strokeWidth="4" x1="32" x2="32" y1="8" y2="16" />
                                        <circle cx="32" cy="7" fill="#7dfbb2" r="3" />
                                    </svg>
                                    <div className="rg-mascot-dot-status">
                                        <div className="rg-mascot-dot-inner" />
                                    </div>
                                </div>

                                <div className="rg-mascot-text-group">
                                    <div className="rg-mascot-status-tag">
                                        <span>Compañero Inteligente</span>
                                        <span className="rg-status-dot-blink" aria-hidden="true" />
                                        <span>
                                            {isOnline
                                                ? "En línea y listo para conversar"
                                                : "Sin conexión con el servidor (reintentando...)"}
                                        </span>
                                    </div>
                                    <h1 className="rg-mascot-title">Tu asistente de videojuegos</h1>
                                    <p className="rg-mascot-subtitle">
                                        Conversemos para encontrar algo que realmente te guste
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* 2. Tarjeta de Disparadores Iniciales (Welcome State) */}
                        {isInitialWelcome && (
                            <section className="rg-welcome-trigger-card" aria-label="Disparadores iniciales de conversación">
                                <div className="rg-welcome-trigger-header">
                                    <h2 className="rg-welcome-trigger-title">
                                        <span className="material-symbols-outlined" aria-hidden="true">
                                            waving_hand
                                        </span>
                                        <span>¡Hola! ¿Qué te gustaría jugar hoy?</span>
                                    </h2>
                                    <p className="rg-welcome-trigger-desc">
                                        Puedo ayudarte a descubrir videojuegos según tus gustos, tus experiencias favoritas
                                        o el tipo de aventura que quieras vivir.
                                    </p>
                                </div>

                                {/* 4 Tarjetas de Disparadores Estilo Stitch */}
                                <div className="rg-trigger-prompts-grid">
                                    <button
                                        type="button"
                                        className="rg-trigger-btn"
                                        onClick={() => sendMessage("Busco algo nuevo y diferente para salir de la rutina")}
                                    >
                                        <div className="rg-trigger-icon-box">
                                            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                                                auto_awesome
                                            </span>
                                        </div>
                                        <div className="rg-trigger-text-wrap">
                                            <span className="rg-trigger-main-text">Descubrir algo nuevo</span>
                                            <span className="rg-trigger-sub-text">Sal de lo habitual</span>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        className="rg-trigger-btn"
                                        onClick={() => sendMessage("Me gustaría explorar una buena historia")}
                                    >
                                        <div className="rg-trigger-icon-box">
                                            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                                                menu_book
                                            </span>
                                        </div>
                                        <div className="rg-trigger-text-wrap">
                                            <span className="rg-trigger-main-text">Una buena historia</span>
                                            <span className="rg-trigger-sub-text">Guiones profundos</span>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        className="rg-trigger-btn"
                                        onClick={() => sendMessage("Quiero relajarme con un juego tranquilo sin prisas")}
                                    >
                                        <div className="rg-trigger-icon-box">
                                            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                                                spa
                                            </span>
                                        </div>
                                        <div className="rg-trigger-text-wrap">
                                            <span className="rg-trigger-main-text">Juego relajante</span>
                                            <span className="rg-trigger-sub-text">Cero presión</span>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        className="rg-trigger-btn"
                                        onClick={() => sendMessage("No estoy seguro, sorpréndeme")}
                                    >
                                        <div className="rg-trigger-icon-box">
                                            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                                                explore
                                            </span>
                                        </div>
                                        <div className="rg-trigger-text-wrap">
                                            <span className="rg-trigger-main-text">No sé qué jugar</span>
                                            <span className="rg-trigger-sub-text">Déjate sorprender</span>
                                        </div>
                                    </button>
                                </div>
                            </section>
                        )}

                        {/* 3. Hilo de Conversación Continuo */}
                        <div className="rg-chat-thread" role="log" aria-live="polite">
                            {messages.map((msg, idx) => {
                                const isLastMessage = idx === messages.length - 1

                                if (msg.role === "user") {
                                    return (
                                        <div key={idx} className="rg-msg-row-user">
                                            <div className="rg-user-bubble">
                                                <p>{msg.text}</p>
                                            </div>
                                            <div className="rg-avatar-user" aria-hidden="true">
                                                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                                                    person
                                                </span>
                                            </div>
                                        </div>
                                    )
                                }

                                // Mensaje del Asistente (Bot)
                                return (
                                    <div key={idx} className="rg-msg-row-bot">
                                        <div className="rg-avatar-bot" aria-hidden="true">
                                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                                                smart_toy
                                            </span>
                                        </div>

                                        <div className="rg-bot-bubble-wrapper">
                                            <div className="rg-bot-bubble">
                                                <p>{msg.text}</p>
                                            </div>

                                            {/* Comparador Visual y Conversacional de Videojuegos (Etapa 6) */}
                                            {msg.comparisonData && (
                                                <div className="rg-comparison-block">
                                                    <GameComparison
                                                        comparisonData={msg.comparisonData}
                                                        onAction={(actionText) => sendMessage(actionText)}
                                                    />
                                                </div>
                                            )}

                                            {/* Tarjetas de Videojuegos Recomendados */}
                                            {msg.recommendations && msg.recommendations.length > 0 && (
                                                <div className="rg-recommendations-block">
                                                    <div className="rg-recommendations-header-badge">
                                                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                                                            verified
                                                        </span>
                                                        <span>Opciones recomendadas ({msg.recommendations.length} títulos)</span>
                                                    </div>

                                                    {msg.recommendations.map((rec, recIdx) => (
                                                        <GameCard
                                                            key={recIdx}
                                                            recommendation={rec}
                                                            onAction={(actionText) => sendMessage(actionText)}
                                                            onCompare={handleCardCompare}
                                                            isSelectedForCompare={compareCandidate?.title === rec.game.title}
                                                        />
                                                    ))}
                                                </div>
                                            )}

                                            {/* Opciones Rápidas de Respuesta (activas en el último mensaje) */}
                                            {msg.suggestedReplies &&
                                                msg.suggestedReplies.length > 0 &&
                                                isLastMessage &&
                                                !loading && (
                                                    <QuickReplies
                                                        replies={msg.suggestedReplies}
                                                        onSelect={(selectedText) => sendMessage(selectedText)}
                                                    />
                                                )}
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Indicador de Escritura Animado */}
                            {loading && (
                                <div className="rg-typing-row" aria-label="El asistente está escribiendo">
                                    <div className="rg-typing-avatar">
                                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                                            sync
                                        </span>
                                    </div>
                                    <div className="rg-typing-pill">
                                        <div className="rg-typing-dots-cluster">
                                            <div className="rg-typing-dot rg-dot-d1" />
                                            <div className="rg-typing-dot rg-dot-d2" />
                                            <div className="rg-typing-dot rg-dot-d3" />
                                        </div>
                                        <span className="rg-typing-text">
                                            RecoGames está pensando en tu próxima joya...
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                </main>

                {/* 4. Campo de Entrada Inferior (Input Bar & Footnote) */}
                <footer className="rg-chat-input-dock">
                    {/* Banner flotante de selección de comparación activa (Opción A) */}
                    {compareCandidate && (
                        <div className="rg-compare-candidate-banner" role="status">
                            <div className="rg-compare-candidate-info">
                                <span className="material-symbols-outlined" style={{ fontSize: "18px" }} aria-hidden="true">
                                    compare_arrows
                                </span>
                                <span>
                                    Comparando: <strong>{compareCandidate.title}</strong>. Selecciona el segundo juego haciendo clic en &ldquo;Comparar&rdquo;.
                                </span>
                            </div>
                            <button
                                type="button"
                                className="rg-compare-cancel-btn"
                                onClick={() => setCompareCandidate(null)}
                                title="Cancelar selección de comparación"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">
                                    close
                                </span>
                                <span>Cancelar</span>
                            </button>
                        </div>
                    )}

                    <div className="rg-chat-input-wrapper">
                        <form
                            className="rg-chat-input-box"
                            onSubmit={(e) => {
                                e.preventDefault()
                                sendMessage()
                            }}
                        >
                            <input
                                type="text"
                                className="rg-chat-text-input"
                                placeholder="Escribe aquí lo que te gustaría jugar..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={loading}
                                aria-label="Mensaje para el asistente"
                            />
                            <button
                                type="submit"
                                className="rg-chat-send-btn"
                                disabled={loading || !input.trim()}
                                aria-label="Enviar mensaje"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: "22px" }} aria-hidden="true">
                                    arrow_upward
                                </span>
                            </button>
                        </form>
                    </div>

                    <p className="rg-chat-footnote">
                        <span className="material-symbols-outlined" aria-hidden="true">forum</span>
                        <span>Las mejores recomendaciones comienzan con una buena conversación.</span>
                    </p>
                </footer>
            </div>

            {/* 5. Perfil Temporal del Jugador (Drawer / Overlay Editable) */}
            <PlayerProfile
                isOpen={profileOpen}
                onClose={() => setProfileOpen(false)}
                conversationMemory={conversationMemory}
                accumulatedCriteria={accumulatedCriteria}
                onUpdateProfile={handleProfileUpdate}
            />
        </div>
    )
}

export default ChatBot
