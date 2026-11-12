const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")
const dotenv = require("dotenv")

dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const Game = require("../models/Game")
const { validateCatalog } = require("../utils/gameValidator")

const runSeed = async () => {
    try {
        console.log("=== INICIANDO SINCRONIZACIÓN DE METADATOS Y CATÁLOGO ===")
        const dataPath = path.join(__dirname, "seedGames.json")
        const rawData = fs.readFileSync(dataPath, "utf-8")
        const games = JSON.parse(rawData)

        console.log(`Leídos ${games.length} videojuegos del archivo seedGames.json.`)

        // 1. Validación previa de integridad de catálogo y metadatos
        console.log("Validando reglas y restricciones de metadatos...")
        const validation = validateCatalog(games)

        if (!validation.isValid) {
            console.error("❌ ERRORES FATALES EN EL CATÁLOGO QUE IMPIDEN LA SINCRONIZACIÓN:")
            validation.fatalErrors.forEach((err) => console.error(`  - ${err}`))
            process.exit(1)
        }

        console.log("✓ Catálogo validado con éxito.")
        console.log(`  - Total títulos: ${validation.coverage.totalGames}`)
        console.log(`  - Cobertura de atributos de experiencia: ${validation.coverage.percentageClassified}% (${validation.coverage.totalClassifiedAttributes}/${validation.coverage.totalPossibleAttributes})`)
        console.log(`  - Títulos con objectiveStyle: ${validation.coverage.gamesWithObjectiveStyle}/${validation.coverage.totalGames}`)

        if (validation.warnings.length > 0) {
            console.log(`⚠️ Advertencias informativas (${validation.warnings.length}):`)
            validation.warnings.slice(0, 5).forEach((w) => console.log(`  - ${w}`))
            if (validation.warnings.length > 5) {
                console.log(`  ... y ${validation.warnings.length - 5} advertencias más.`)
            }
        }

        // 2. Conectar a MongoDB
        console.log("Conectando a la base de datos...")
        await connectDB()

        // 3. Respaldo de seguridad previo de la base de datos si existen documentos
        const existingCount = await Game.countDocuments()
        if (existingCount > 0) {
            const backupsDir = path.join(__dirname, "backups")
            if (!fs.existsSync(backupsDir)) {
                fs.mkdirSync(backupsDir, { recursive: true })
            }
            const existingDocs = await Game.find({}).lean()
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
            const backupFile = path.join(backupsDir, `games_backup_${timestamp}.json`)
            fs.writeFileSync(backupFile, JSON.stringify(existingDocs, null, 2), "utf-8")
            console.log(`✓ Respaldo de seguridad generado: ${path.basename(backupFile)} (${existingDocs.length} títulos respaldados).`)
        }

        // 4. Sincronización idempotente mediante bulkWrite (upsert por título)
        // Actualiza experienceAttributes, objectiveStyle y todos los campos preservando IDs
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
