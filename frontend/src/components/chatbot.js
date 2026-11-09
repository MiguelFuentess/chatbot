import React, { useState, useEffect, useRef } from "react"
import axios from "axios"
import GameCard from "./GameCard"
import QuickReplies from "./QuickReplies"
import "./ChatBot.css"

const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000/api"

const INITIAL_QUICK_REPLIES = [
    "Quiero relajarme y desconectar",
    "Busco acción y desafío",
    "Jugar en cooperativo con amigos",
    "Algo parecido a Minecraft",
    "Tengo solo 30 minutos"
]

const ChatBot = () => {
    const [messages, setMessages] = useState([
        {
            role: "bot",
            text: "¡Hola! Soy tu asistente inteligente para la recomendación personalizada de videojuegos de PC. Cuéntame: ¿cómo te sientes hoy o qué tipo de experiencia estás buscando?",
            suggestedReplies: INITIAL_QUICK_REPLIES
        }
    ])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [accumulatedCriteria, setAccumulatedCriteria] = useState({})

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

        // 1. Agregar mensaje del usuario a la lista
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
            // 2. Enviar mensaje y criterios acumulados al endpoint de recomendación
            const res = await axios.post(`${API_BASE}/recommendations/chat`, {
                message: query,
                accumulatedCriteria
            })

            const { reply, recommendations, updatedCriteria, suggestedReplies } = res.data

            // 3. Actualizar memoria de criterios acumulados
            if (updatedCriteria) {
                setAccumulatedCriteria(updatedCriteria)
            }

            // 4. Agregar respuesta del bot con tarjetas de recomendaciones si existen
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
                    text: "Hubo un inconveniente al conectar con el motor de recomendación. Por favor, verifica que el servidor backend esté activo e inténtalo nuevamente.",
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
        setMessages([
            {
                role: "bot",
                text: "Se ha reiniciado la búsqueda. Cuéntame de nuevo qué tipo de videojuego estás buscando o cómo te gustaría sentirte al jugar.",
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
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`message-row ${
                            msg.role === "user" ? "message-row-user" : "message-row-bot"
                        }`}
                    >
                        <div
                            className={`message-bubble ${
                                msg.role === "user" ? "user-bubble" : "bot-bubble"
                            }`}
                        >
                            <p style={{ margin: 0 }}>{msg.text}</p>

                            {/* Tarjetas de videojuegos recomendados */}
                            {msg.recommendations && msg.recommendations.length > 0 && (
                                <div className="cards-container">
                                    {msg.recommendations.map((rec, recIdx) => (
                                        <GameCard key={recIdx} recommendation={rec} />
                                    ))}
                                </div>
                            )}

                            {/* Sugerencias rápidas de respuesta */}
                            {msg.suggestedReplies && msg.suggestedReplies.length > 0 && (
                                <QuickReplies
                                    replies={msg.suggestedReplies}
                                    onSelect={(selectedText) => sendMessage(selectedText)}
                                />
                            )}
                        </div>
                    </div>
                ))}

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
                    placeholder="Escribe tu mensaje... (ej. 'Quiero algo tranquilo para 30 minutos')"
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
