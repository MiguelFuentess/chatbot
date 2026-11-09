const express = require("express")
const dotenv = require("dotenv")
const cors = require("cors")
const connectDB = require("./config/db")
const chatRoutes = require("./routes/chatroutes")
const gameRoutes = require("./routes/gameRoutes")
const recommendationRoutes = require("./routes/recommendationRoutes")

dotenv.config()
connectDB()

const app = express()
app.use(cors())
app.use(express.json())

// Rutas de la API
app.use("/api/chats", chatRoutes)
app.use("/api/games", gameRoutes)
app.use("/api/recommendations", recommendationRoutes)

// Endpoint de verificación de estado (Healthcheck)
app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", message: "Servidor operativo" })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`))
