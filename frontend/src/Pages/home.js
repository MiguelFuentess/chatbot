import React from "react"
import { useNavigate } from "react-router-dom"
import "./Pages.css"

const Home = () => {
    const navigate = useNavigate()

    return (
        <div className="page-container">
            {/* Barra de navegación superior */}
            <header className="page-nav">
                <div className="nav-brand" onClick={() => navigate("/")}>
                    <span>🎮 RecoGames AI</span>
                </div>
                <div className="nav-actions">
                    <button className="btn-primary" onClick={() => navigate("/chat")}>
                        Abrir Asistente
                    </button>
                </div>
            </header>

            {/* Sección Principal (Hero) */}
            <main className="home-hero">
                <div className="hero-badge">PROYECTO DE INVESTIGACIÓN ACADÉMICA</div>
                <h1 className="hero-title">
                    Recomendación Inteligente y Personalizada de Videojuegos
                </h1>
                <p className="hero-subtitle">
                    Conversa de manera natural con nuestro asistente inteligente. A través de preguntas progresivas,
                    comprende la experiencia que buscas hoy y te recomienda videojuegos de PC a tu medida con explicaciones claras.
                </p>

                <div className="hero-buttons">
                    <button className="btn-primary" onClick={() => navigate("/chat")}>
                        Iniciar Conversación con el Asistente ➤
                    </button>
                </div>

                {/* Dimensiones de Personalización */}
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">🧘</div>
                        <h4>Contexto Emocional</h4>
                        <p>
                            Indica voluntariamente si buscas relajarte, superar un reto desafiante o desconectar tras un día largo.
                        </p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon">⏱️</div>
                        <h4>Tiempo de Sesión</h4>
                        <p>
                            Encuentra partidas adaptadas al tiempo que tienes hoy, desde sesiones cortas de 20-30 min hasta experiencias inmersivas.
                        </p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon">👥</div>
                        <h4>Modalidad y Preferencias</h4>
                        <p>
                            Filtra si jugarás en solitario o en cooperativo con amigos, indicando tus géneros favoritos o aquellos que prefieres evitar.
                        </p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon">💡</div>
                        <h4>Explicabilidad Clara</h4>
                        <p>
                            El asistente te explica con transparencia y detalle las razones concretas de por qué te recomienda cada videojuego.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default Home
