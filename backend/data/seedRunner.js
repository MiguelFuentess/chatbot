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

        // Sincronización idempotente mediante bulkWrite (upsert por título)
        // Actualiza imageUrl y todos los campos preservando IDs y evitando duplicados
        const operations = games.map((game) => ({
            updateOne: {
                filter: { title: game.title },
                update: { $set: game },
                upsert: true
            }
        }))

        const result = await Game.bulkWrite(operations)
        console.log(
            `¡Éxito en sincronización! Coincidentes: ${result.matchedCount}, Modificados: ${result.modifiedCount}, Nuevos insertados: ${result.upsertedCount}.`
        )

        const totalInDb = await Game.countDocuments()
        console.log(`Total de videojuegos en la base de datos MongoDB: ${totalInDb}.`)

        await mongoose.connection.close()
        console.log("Conexión con MongoDB cerrada correctamente.")
        process.exit(0)
    } catch (error) {
        console.error("Error durante la ejecución del seed:", error)
        process.exit(1)
    }
}

runSeed()
