import React, { useState, useEffect, useRef } from "react"
import axios from "axios"
import GameCard from "./GameCard"
import QuickReplies from "./QuickReplies"
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

    const messagesEndRef = useRef(null)

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
            // 2. Enviar mensaje, criterios acumulados y estado del diálogo al backend
            const res = await axios.post(`${API_BASE}/recommendations/chat`, {
                message: query,
                accumulatedCriteria,
                dialogueState
            })

            const {
                reply,
                recommendations,
                updatedCriteria,
                dialogueState: newDialogueState,
                suggestedReplies
            } = res.data

            // 3. Actualizar memoria de criterios acumulados y estado de diálogo
            if (updatedCriteria) {
                setAccumulatedCriteria(updatedCriteria)
            }
            if (newDialogueState) {
                setDialogueState(newDialogueState)
            }

            // 4. Agregar respuesta del bot con tarjetas o preguntas de seguimiento
            setMessages((prev) => [
                ...prev,
                {
                    role: "bot",
                    text: reply,
                    recommendations: recommendations || [],
                    suggestedReplies: suggestedReplies || []
                }
            ])
        } catch (error) {
            console.error("Error al comunicarse con el asistente:", error)
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

    const handleReset = () => {
        setAccumulatedCriteria({})
        setDialogueState({
            stage: "experience",
            questionsAsked: ["experience"],
            turnCount: 0
        })
        setMessages([
            {
                role: "bot",
                isWelcome: true,
                text: WELCOME_TEXT,
                suggestedReplies: INITIAL_QUICK_REPLIES
            }
        ])
    }

    return (
        <div className="chat-wrapper">
            {/* Cabecera del Asistente */}
            <div className="chat-header">
                <div className="chat-header-title">
                    <div className="chat-status-dot" />
                    <div>
                        <h3>Asistente de Videojuegos</h3>
                        <span className="chat-subtitle">Recomendador Inteligente Personalizado</span>
                    </div>
                </div>
                <button type="button" className="reset-chat-btn" onClick={handleReset}>
                    🔄 Nueva Búsqueda
                </button>
            </div>

            {/* Listado de Mensajes */}
            <div className="chat-messages">
                {messages.map((msg, idx) => {
                    const isLastMessage = idx === messages.length - 1

                    return (
                        <div
                            key={idx}
                            className={`message-row ${
                                msg.role === "user" ? "message-row-user" : "message-row-bot"
                            }`}
                        >
                            <div
                                className={`message-bubble ${
                                    msg.role === "user"
                                        ? "user-bubble"
                                        : msg.isWelcome
                                        ? "bot-bubble welcome-bubble"
                                        : "bot-bubble"
                                }`}
                            >
                                <span
                                    className={`bubble-role-label ${
                                        msg.role === "user" ? "user-role-label" : "bot-role-label"
                                    }`}
                                >
                                    {msg.role === "user" ? "👤 Tú" : "🤖 Asistente RecoGames"}
                                </span>

                                {msg.isWelcome && (
                                    <div className="welcome-badge">
                                        <span>🎮 Asistente de PC</span>
                                    </div>
                                )}

                                <p style={{ margin: "4px 0 0 0", whiteSpace: "pre-line" }}>{msg.text}</p>

                                {/* Tarjetas de videojuegos recomendados */}
                                {msg.recommendations && msg.recommendations.length > 0 && (
                                    <div className="cards-wrapper">
                                        <div className="recommendation-batch-header">
                                            <span>🎯 Opciones recomendadas ({msg.recommendations.length} títulos)</span>
                                        </div>
                                        <div className="cards-container">
                                            {msg.recommendations.map((rec, recIdx) => (
                                                <GameCard key={recIdx} recommendation={rec} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Sugerencias rápidas de respuesta (activas en el último mensaje) */}
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

                {/* Indicador de escritura animado */}
                {loading && (
                    <div className="message-row message-row-bot">
                        <div className="typing-indicator">
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Formulario de entrada */}
            <div className="chat-input-area">
                <input
                    type="text"
                    placeholder="Escribe tu mensaje... (ej. 'Quiero algo tranquilo para 20 minutos')"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                />
                <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={loading || !input.trim()}
                >
                    Enviar ➤
                </button>
            </div>
        </div>
    )
}

export default ChatBot
