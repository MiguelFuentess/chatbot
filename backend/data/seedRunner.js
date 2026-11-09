const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")
const dotenv = require("dotenv")

dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const Game = require("../models/Game")

const runSeed = async () => {
    try {
        console.log("Conectando a la base de datos para ejecutar el seed...")
        await connectDB()

        const dataPath = path.join(__dirname, "seedGames.json")
        const rawData = fs.readFileSync(dataPath, "utf-8")
        const games = JSON.parse(rawData)

        console.log(`Leídos ${games.length} videojuegos del archivo seedGames.json.`)

        // Limpiar colección previa para garantizar estado limpio y reproducible
        const deleteResult = await Game.deleteMany({})
        console.log(`Colección de videojuegos reiniciada (eliminados: ${deleteResult.deletedCount}).`)

        const inserted = await Game.insertMany(games)
        console.log(`¡Éxito! Se insertaron ${inserted.length} videojuegos en la base de datos MongoDB.`)

        await mongoose.connection.close()
        console.log("Conexión con MongoDB cerrada correctamente.")
        process.exit(0)
    } catch (error) {
        console.error("Error durante la ejecución del seed:", error)
        process.exit(1)
    }
}

runSeed()
