import React from "react"
import { useNavigate } from "react-router-dom"
import "./WelcomeHome.css"

const Home = () => {
    const navigate = useNavigate()

    const scrollToSection = (id) => {
        const element = document.getElementById(id)
        if (element) {
            element.scrollIntoView({ behavior: "smooth" })
        }
    }

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    return (
        <div className="rg-welcome-page">
            {/* ENCABEZADO FIJO DE NAVEGACIÓN */}
            <header className="rg-header" role="banner">
                <div className="rg-header-inner">
                    <button
                        className="rg-brand"
                        onClick={scrollToTop}
                        aria-label="RecoGames - Ir al inicio"
                    >
                        <div className="rg-brand-icon">
                            <span className="rg-icon" aria-hidden="true">sports_esports</span>
                        </div>
                        <span className="rg-brand-name">RecoGames</span>
                        <span className="rg-brand-badge">AI</span>
                    </button>

                    <nav className="rg-nav-center" aria-label="Navegación principal">
                        <button
                            className="rg-nav-link active"
                            onClick={scrollToTop}
                            aria-current="page"
                        >
                            Inicio
                        </button>
                        <button
                            className="rg-nav-link"
                            onClick={() => scrollToSection("como-funciona")}
                        >
                            Cómo funciona
                        </button>
                        <button
                            className="rg-nav-link"
                            onClick={() => scrollToSection("caracteristicas")}
                        >
                            Características
                        </button>
                    </nav>

                    <div className="rg-header-cta">
                        <button
                            className="rg-btn-nav"
                            onClick={() => navigate("/chat")}
                            aria-label="Comenzar conversación con el asistente"
                        >
                            <span>Comenzar</span>
                            <span className="rg-icon" style={{ fontSize: "16px" }} aria-hidden="true">arrow_forward</span>
                        </button>
                    </div>
                </div>
            </header>

            <main>
                {/* SECCIÓN 1: HERO PRINCIPAL ESTILO CARTEL POSTER ART */}
                <section className="rg-hero" aria-labelledby="hero-title">
                    {/* Acentos flotantes serigráficos */}
                    <div className="rg-decor-dot rg-dot-1" aria-hidden="true"></div>
                    <div className="rg-decor-dot rg-dot-2" aria-hidden="true"></div>
                    <div className="rg-decor-dot rg-dot-3" aria-hidden="true"></div>
                    <div className="rg-decor-dot rg-dot-4" aria-hidden="true"></div>
                    <div className="rg-decor-dot rg-dot-5" aria-hidden="true"></div>

                    <div className="rg-hero-container">
                        {/* Columna izquierda: Titular principal y acciones */}
                        <div className="rg-hero-content">
                            <div className="rg-pill-badge">
                                <span className="rg-pulse-dot" aria-hidden="true"></span>
                                <span>Recomendador conversacional sensible</span>
                            </div>

                            <h1 id="hero-title" className="rg-hero-title">
                                Descubre tu próximo videojuego a través de una{" "}
                                <span className="rg-highlight">conversación</span>.
                            </h1>

                            <p className="rg-hero-desc">
                                Cuéntanos qué te gusta jugar, qué experiencias disfrutas o qué te
                                gustaría encontrar, y el asistente te ayudará a descubrir opciones
                                pensadas especialmente para ti.
                            </p>

                            <div className="rg-hero-actions">
                                <button
                                    className="rg-btn-primary"
                                    onClick={() => navigate("/chat")}
                                    aria-label="Comenzar conversación con RecoGames"
                                >
                                    <span>Comenzar conversación</span>
                                    <span className="rg-icon" aria-hidden="true">chat</span>
                                </button>
                                <button
                                    className="rg-btn-secondary"
                                    onClick={() => scrollToSection("como-funciona")}
                                    aria-label="Ver cómo funciona el asistente"
                                >
                                    <span>Ver cómo funciona</span>
                                    <span className="rg-icon" aria-hidden="true">arrow_downward</span>
                                </button>
                            </div>

                            <div className="rg-hero-microtext">
                                <span className="rg-icon rg-icon-fill" aria-hidden="true">check_circle</span>
                                <span>Sin formularios largos. Solo una conversación natural y sincera.</span>
                            </div>
                        </div>

                        {/* Columna derecha: Escena plana estilo cartel con consola y diálogo */}
                        <div className="rg-hero-graphic-col" aria-label="Demostración visual de conversación con el asistente">
                            <div className="rg-poster-card">
                                {/* Fondo de líneas y puntos serigráficos en SVG */}
                                <svg
                                    className="rg-poster-svg-bg"
                                    fill="none"
                                    viewBox="0 0 400 500"
                                    aria-hidden="true"
                                >
                                    <line
                                        stroke="#006b5b"
                                        strokeDasharray="4 4"
                                        strokeWidth="2.5"
                                        x1="200"
                                        x2="200"
                                        y1="50"
                                        y2="450"
                                    />
                                    <line
                                        stroke="#002247"
                                        strokeWidth="1.5"
                                        x1="80"
                                        x2="320"
                                        y1="280"
                                        y2="280"
                                    />
                                    <circle cx="200" cy="90" fill="#002247" r="4" />
                                    <circle cx="90" cy="180" fill="#006b5b" r="3" />
                                    <circle cx="310" cy="220" fill="#002247" r="5" />
                                    <circle cx="150" cy="380" fill="#006b5b" r="3.5" />
                                </svg>

                                {/* Nube 1: Jugador */}
                                <div className="rg-speech-bubble-user">
                                    <div className="rg-bubble-tag">
                                        <span className="rg-icon" style={{ fontSize: "16px" }} aria-hidden="true">account_circle</span>
                                        <span>Tú</span>
                                    </div>
                                    <p className="rg-bubble-text">
                                        "Busco algo inmersivo y sin prisas, con un mundo hermoso que me permita explorar a mi ritmo..."
                                    </p>
                                </div>

                                {/* Centro gráfico: Plataforma serigráfica con monitor y mando */}
                                <div className="rg-poster-center-island" aria-hidden="true">
                                    <div className="rg-island-platform">
                                        <div className="rg-console-cluster">
                                            {/* Monitor plano */}
                                            <div className="rg-mini-monitor">
                                                <div className="rg-monitor-screen">
                                                    <span className="rg-icon" style={{ fontSize: "18px" }}>explore</span>
                                                </div>
                                                <div className="rg-monitor-stand"></div>
                                            </div>
                                            {/* Mando retro */}
                                            <div className="rg-mini-gamepad">
                                                <span className="rg-icon" style={{ fontSize: "14px" }}>sports_esports</span>
                                                <div className="rg-gamepad-dot"></div>
                                            </div>
                                        </div>

                                        <div className="rg-island-label">
                                            <span className="rg-icon" style={{ fontSize: "16px" }}>tune</span>
                                            <span>SINTONIZANDO EXPERIENCIAS</span>
                                        </div>
                                    </div>
                                    <div className="rg-island-stem"></div>
                                </div>

                                {/* Nube 2: Asistente RecoGames */}
                                <div className="rg-speech-bubble-bot">
                                    <div className="rg-bubble-tag">
                                        <span className="rg-icon" style={{ fontSize: "16px" }} aria-hidden="true">smart_toy</span>
                                        <span>RecoGames AI</span>
                                    </div>
                                    <p className="rg-bubble-text">
                                        "Prueba una odisea espacial contemplativa o un viaje en velero por islas olvidadas. Te explico por qué."
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECCIÓN 2: ¿QUÉ PUEDE HACER POR TI? (3 TARJETAS LIMPIAS) */}
                <section className="rg-features-section" id="que-puede-hacer" aria-labelledby="features-title">
                    <div className="rg-features-container">
                        <div className="rg-section-header-split">
                            <div>
                                <span className="rg-kicker">Propósito y utilidad</span>
                                <h2 id="features-title" className="rg-section-title">
                                    ¿Qué puede hacer por ti?
                                </h2>
                            </div>
                            <p className="rg-section-desc">
                                Un espacio diseñado para librarte de listas infinitas de venta y ayudarte
                                a reconectar con lo que de verdad quieres jugar hoy.
                            </p>
                        </div>

                        <div className="rg-features-grid">
                            {/* Tarjeta 1 */}
                            <div className="rg-feature-card rg-card-style-1">
                                <div>
                                    <div className="rg-feature-icon-box rg-icon-box-1" aria-hidden="true">
                                        <span className="rg-icon rg-icon-fill" style={{ fontSize: "28px" }}>psychology</span>
                                    </div>
                                    <h3 className="rg-feature-title">Conocer tus gustos</h3>
                                    <p className="rg-feature-text">
                                        El asistente conversa contigo para entender qué disfrutas al jugar,
                                        qué ritmo buscas y qué sensaciones quieres revivir frente a la pantalla.
                                    </p>
                                </div>
                                <div className="rg-feature-footer">
                                    <span>Diálogo empático</span>
                                    <span className="rg-icon" style={{ fontSize: "16px" }} aria-hidden="true">arrow_forward</span>
                                </div>
                            </div>

                            {/* Tarjeta 2 */}
                            <div className="rg-feature-card rg-card-style-2">
                                <div>
                                    <div className="rg-feature-icon-box rg-icon-box-2" aria-hidden="true">
                                        <span className="rg-icon rg-icon-fill" style={{ fontSize: "28px" }}>travel_explore</span>
                                    </div>
                                    <h3 className="rg-feature-title">Explorar opciones</h3>
                                    <p className="rg-feature-text">
                                        Te ayuda a descubrir juegos que encajan de forma orgánica con tus intereses,
                                        desde joyas independientes desconocidas hasta grandes clásicos.
                                    </p>
                                </div>
                                <div className="rg-feature-footer rg-accent-navy">
                                    <span>Amplitud de catálogo</span>
                                    <span className="rg-icon" style={{ fontSize: "16px" }} aria-hidden="true">arrow_forward</span>
                                </div>
                            </div>

                            {/* Tarjeta 3 */}
                            <div className="rg-feature-card rg-card-style-3">
                                <div>
                                    <div className="rg-feature-icon-box rg-icon-box-3" aria-hidden="true">
                                        <span className="rg-icon rg-icon-fill" style={{ fontSize: "28px" }}>format_quote</span>
                                    </div>
                                    <h3 className="rg-feature-title">Recomendar con sentido</h3>
                                    <p className="rg-feature-text">
                                        No solo sugiere títulos al azar: también te explica en un párrafo
                                        claro y honesto por qué cada sugerencia encaja exactamente contigo.
                                    </p>
                                </div>
                                <div className="rg-feature-footer">
                                    <span>Argumentos reales</span>
                                    <span className="rg-icon" style={{ fontSize: "16px" }} aria-hidden="true">arrow_forward</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECCIÓN 3: ASÍ FUNCIONA (PROCESO EDITORIAL DE 3 PASOS) */}
                <section className="rg-steps-section" id="como-funciona" aria-labelledby="steps-title">
                    <div className="rg-steps-container">
                        <div className="rg-steps-header-center">
                            <span className="rg-kicker">Paso a paso</span>
                            <h2 id="steps-title" className="rg-section-title">
                                Así funciona
                            </h2>
                            <p className="rg-section-desc" style={{ maxWidth: "580px", margin: "0 auto" }}>
                                Una dinámica simple, fluida y sin fricciones técnicas pensada para cualquier tipo de jugador.
                            </p>
                        </div>

                        <div className="rg-steps-grid">
                            <div className="rg-steps-connector-line" aria-hidden="true"></div>

                            {/* Paso 1 */}
                            <div className="rg-step-card rg-step-card-1">
                                <div className="rg-step-top">
                                    <div className="rg-step-num-badge rg-step-num-1">1</div>
                                    <span className="rg-icon rg-step-icon" aria-hidden="true">forum</span>
                                </div>
                                <div>
                                    <h3 className="rg-step-title">Conversamos</h3>
                                    <p className="rg-step-text">
                                        Empiezas contándole al asistente qué tipo de juegos te gustan, qué mecánicas
                                        te relajan o qué títulos te han marcado en el pasado.
                                    </p>
                                </div>
                                <div className="rg-step-callout">
                                    <span className="rg-callout-tag">Ejemplo de entrada</span>
                                    <p className="rg-callout-content">
                                        "Terminé Outer Wilds y extraño esa sensación de curiosidad solitaria..."
                                    </p>
                                </div>
                            </div>

                            {/* Paso 2 */}
                            <div className="rg-step-card rg-step-card-2">
                                <div className="rg-step-top">
                                    <div className="rg-step-num-badge rg-step-num-2">2</div>
                                    <span className="rg-icon rg-step-icon" aria-hidden="true">auto_stories</span>
                                </div>
                                <div>
                                    <h3 className="rg-step-title">Entendemos tus preferencias</h3>
                                    <p className="rg-step-text">
                                        El sistema identifica tus intereses profundos a través del diálogo,
                                        comprendiendo tu tiempo disponible y tu estado de ánimo actual.
                                    </p>
                                </div>
                                <div className="rg-step-callout">
                                    <span className="rg-callout-tag">Análisis de contexto</span>
                                    <p className="rg-callout-content">
                                        Mapeo de tono contemplativo, narrativa arqueológica y cero combate forzado.
                                    </p>
                                </div>
                            </div>

                            {/* Paso 3 */}
                            <div className="rg-step-card rg-step-card-3">
                                <div className="rg-step-top">
                                    <div className="rg-step-num-badge rg-step-num-3">3</div>
                                    <span className="rg-icon rg-step-icon" aria-hidden="true">recommend</span>
                                </div>
                                <div>
                                    <h3 className="rg-step-title">Recibes recomendaciones</h3>
                                    <p className="rg-step-text">
                                        Obtienes sugerencias precisas y justificadas, más alineadas con lo que
                                        realmente disfrutas y listas para enriquecer tu biblioteca.
                                    </p>
                                </div>
                                <div className="rg-step-callout">
                                    <span className="rg-callout-tag">Tu resultado curado</span>
                                    <p className="rg-callout-content">
                                        Cartel editorial con 3 juegos seleccionados y el motivo de cada elección.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECCIÓN 4: MANIFIESTO DIFERENCIAL (BLOQUE MENTA / ENFOQUE SENSIBLE) */}
                <section className="rg-manifesto-section" id="caracteristicas" aria-labelledby="manifesto-title">
                    <div className="rg-decor-circle-1" aria-hidden="true"></div>
                    <div className="rg-decor-circle-2" aria-hidden="true"></div>

                    <div className="rg-manifesto-container">
                        {/* Columna de texto */}
                        <div className="rg-manifesto-content">
                            <div className="rg-pill-manifesto">Enfoque sensible</div>
                            <h2 id="manifesto-title" className="rg-manifesto-title">
                                No se trata solo de recomendar un juego.
                            </h2>
                            <p className="rg-manifesto-lead">
                                El objetivo es entender qué te gusta, qué te emociona y qué tipo de
                                experiencia quieres vivir para encontrar videojuegos que encajen contigo de verdad.
                            </p>
                            <p className="rg-manifesto-body">
                                Los algoritmos tradicionales miden clics y ventas masivas. Nosotros priorizamos
                                el estado de ánimo, la narrativa, la estética sonora y el tiempo libre real
                                que tienes para sentarte a jugar.
                            </p>
                        </div>

                        {/* Columna de citas */}
                        <div className="rg-manifesto-quotes">
                            {/* Cita 1 */}
                            <div className="rg-quote-card rg-quote-1">
                                <div className="rg-quote-header">
                                    <span className="rg-icon" style={{ fontSize: "18px" }} aria-hidden="true">audiotrack</span>
                                    <span>Atmósfera</span>
                                </div>
                                <p className="rg-quote-text">
                                    "Me encantan las bandas sonoras acústicas, el silencio de los mundos solitarios y la sensación de descubrimiento lento."
                                </p>
                            </div>

                            {/* Cita 2 */}
                            <div className="rg-quote-card rg-quote-2">
                                <div className="rg-quote-header">
                                    <span className="rg-icon" style={{ fontSize: "18px" }} aria-hidden="true">schedule</span>
                                    <span>Tiempo de vida</span>
                                </div>
                                <p className="rg-quote-text">
                                    "Tengo 45 minutos al día tras el trabajo. No quiero tutoriales interminables ni tareas de relleno."
                                </p>
                            </div>

                            {/* Cita 3 */}
                            <div className="rg-quote-card rg-quote-3">
                                <div className="rg-quote-header">
                                    <span className="rg-icon" style={{ fontSize: "18px" }} aria-hidden="true">favorite</span>
                                    <span>Conexión humana</span>
                                </div>
                                <p className="rg-quote-text">
                                    "Busco historias con personajes bien escritos que se queden conmigo mucho tiempo después de apagar la consola."
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECCIÓN 5: LLAMADO FINAL A LA ACCIÓN (BANNER POSTER DE ALTO IMPACTO) */}
                <section className="rg-cta-section" aria-labelledby="cta-title">
                    <div className="rg-cta-container">
                        <div className="rg-cta-card">
                            <div className="rg-cta-circle-1" aria-hidden="true"></div>
                            <div className="rg-cta-circle-2" aria-hidden="true"></div>

                            <div className="rg-pill-cta">
                                <span className="rg-icon" style={{ fontSize: "16px" }} aria-hidden="true">bolt</span>
                                <span>Empieza en menos de un minuto</span>
                            </div>

                            <h2 id="cta-title" className="rg-cta-title">
                                Tu próxima aventura puede empezar aquí.
                            </h2>

                            <p className="rg-cta-desc">
                                Habla con el asistente y descubre juegos hechos a la medida de tu tiempo,
                                tus gustos y tu forma de sentir las historias.
                            </p>

                            <div>
                                <button
                                    className="rg-btn-cta-big"
                                    onClick={() => navigate("/chat")}
                                    aria-label="Empezar ahora a hablar con el asistente"
                                >
                                    <span>Empezar ahora</span>
                                    <span className="rg-icon" style={{ fontSize: "26px" }} aria-hidden="true">arrow_right_alt</span>
                                </button>
                            </div>

                            <span className="rg-cta-note">
                                Gratis, sin registro y listo para charlar en español.
                            </span>
                        </div>
                    </div>
                </section>
            </main>

            {/* PIE DE PÁGINA */}
            <footer className="rg-footer" role="contentinfo">
                <div className="rg-footer-container">
                    <div className="rg-footer-grid">
                        <div className="rg-footer-brand-col">
                            <div className="rg-brand" onClick={scrollToTop}>
                                <div className="rg-brand-icon" style={{ width: "32px", height: "32px" }}>
                                    <span className="rg-icon" style={{ fontSize: "18px" }} aria-hidden="true">smart_toy</span>
                                </div>
                                <span className="rg-brand-name" style={{ fontSize: "1.2rem" }}>RecoGames AI</span>
                            </div>
                            <p className="rg-footer-desc">
                                Descubrimiento conversacional de videojuegos diseñado como un cartel editorial interactivo.
                                Sintetizamos tus preferencias estéticas, mecánicas y narrativas en recomendaciones sinceras y precisas.
                            </p>
                        </div>

                        <div className="rg-footer-nav-col">
                            <span className="rg-footer-heading">Exploración</span>
                            <button className="rg-footer-link" onClick={scrollToTop}>Inicio</button>
                            <button className="rg-footer-link" onClick={() => scrollToSection("como-funciona")}>Cómo funciona</button>
                            <button className="rg-footer-link" onClick={() => scrollToSection("caracteristicas")}>Características</button>
                        </div>

                        <div className="rg-footer-nav-col">
                            <span className="rg-footer-heading">Asistente RecoGames</span>
                            <button className="rg-footer-link" onClick={() => navigate("/chat")}>Iniciar recomendador</button>
                            <button className="rg-footer-link" onClick={() => scrollToSection("como-funciona")}>Ver paso a paso</button>
                            <button className="rg-footer-link" onClick={() => scrollToSection("caracteristicas")}>Ver enfoque sensible</button>
                        </div>
                    </div>

                    <div className="rg-footer-bottom-bar">
                        <div className="rg-footer-bottom-left">
                            <span className="rg-icon" aria-hidden="true">info</span>
                            <span>Las recomendaciones pueden mejorar a medida que avanza la conversación.</span>
                        </div>
                        <div className="rg-footer-bottom-right">
                            © 2026 RecoGames AI. Todos los derechos reservados.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default Home
