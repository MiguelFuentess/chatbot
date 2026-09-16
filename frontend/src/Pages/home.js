import React from "react"
import { useNavigate } from "react-router-dom"

const Home = () =>{
    const navigate = useNavigate()

    return(
        <div>
            <h1>CHAT BOT EN MERN</h1>
            <button onClick={() => navigate("/add")}>Agregar Pregunta</button>
            <button onClick={() => navigate("/chat")}>Usar Chat</button>
        </div>
    )
}

export default Home