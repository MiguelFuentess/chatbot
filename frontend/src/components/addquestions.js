import React, { useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import "../Pages/Pages.css"

const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000/api"

const AddQuestion = () => {
    const [question, setQuestion] = useState("")
    const [answer, setAnswer] = useState("")
    const [statusMsg, setStatusMsg] = useState("")
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await axios.post(`${API_BASE}/chats/add`, { question, answer })
            setStatusMsg("Pregunta agregada con éxito")
            setQuestion("")
            setAnswer("")
        } catch (error) {
            console.error("Error al agregar la pregunta: ", error)
            setStatusMsg("Error al agregar la pregunta. Revisa la consola.")
        }
    }

    return (
        <div className="page-container">
            <header className="page-nav">
                <div className="nav-brand" onClick={() => navigate("/")}>
                    <span>🎮 RecoGames AI</span>
                </div>
                <div className="nav-actions">
                    <button className="btn-secondary" onClick={() => navigate("/")}>
                        ← Volver al Inicio
                    </button>
                    <button className="btn-primary" onClick={() => navigate("/chat")}>
                        Ir al Chat
                    </button>
                </div>
            </header>

            <main className="chat-page-content">
                <div
                    style={{
                        background: "#ffffff",
                        color: "#1e293b",
                        padding: "30px",
                        borderRadius: "14px",
                        maxWidth: "500px",
                        width: "100%",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
                    }}
                >
                    <h2 style={{ marginTop: 0, color: "#0f172a" }}>Agregar Pregunta FAQ</h2>
                    <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px" }}>
                        Registra una respuesta predeterminada para el módulo de preguntas frecuentes.
                    </p>

                    {statusMsg && (
                        <div
                            style={{
                                padding: "10px",
                                borderRadius: "8px",
                                marginBottom: "16px",
                                fontSize: "14px",
                                backgroundColor: statusMsg.includes("éxito") ? "#dcfce7" : "#fee2e2",
                                color: statusMsg.includes("éxito") ? "#166534" : "#991b1b"
                            }}
                        >
                            {statusMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "14px", fontWeight: "600" }}>Pregunta:</label>
                            <input
                                type="text"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                placeholder="Ej: ¿Qué requisitos mínimos necesito?"
                                required
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: "8px",
                                    border: "1px solid #cbd5e1",
                                    fontSize: "14px"
                                }}
                            />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "14px", fontWeight: "600" }}>Respuesta:</label>
                            <textarea
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder="Escribe la respuesta detallada..."
                                required
                                rows={4}
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: "8px",
                                    border: "1px solid #cbd5e1",
                                    fontSize: "14px",
                                    fontFamily: "inherit",
                                    resize: "vertical"
                                }}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            style={{ marginTop: "10px", width: "100%" }}
                        >
                            Guardar Pregunta
                        </button>
                    </form>
                </div>
            </main>
        </div>
    )
}

export default AddQuestion
