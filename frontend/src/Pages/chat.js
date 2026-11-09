import React from "react"
import { useNavigate } from "react-router-dom"
import ChatBot from "../components/chatbot"
import "./Pages.css"

const Chat = () => {
    const navigate = useNavigate()

    return (
        <div className="page-container">
            {/* Barra de navegación superior */}
            <header className="page-nav">
                <div className="nav-brand" onClick={() => navigate("/")}>
                    <span>🎮 RecoGames AI</span>
                </div>
                <div className="nav-actions">
                    <button className="btn-secondary" onClick={() => navigate("/")}>
                        ← Volver al Inicio
                    </button>
                </div>
            </header>

            {/* Contenedor central del Chat */}
            <main className="chat-page-content">
                <ChatBot />
            </main>
        </div>
    )
}

export default Chat
