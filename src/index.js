import express from "express"
import util from "node:util"
import child_process from "node:child_process"
import fs from "node:fs"
import { spawn } from "child_process"
import { Server } from "socket.io"
import { createServer } from "http"

const app = express()
const port = 3000
const httpServer = createServer(app)
const io = new Server(httpServer)

const javaEnv = {
  ...process.env,
  JAVA_HOME: '/usr/local/java/jdk-25.0.2+10',
  PATH: `/usr/local/java/jdk-25.0.2+10/bin:${process.env.PATH}`
}

const download = `mkdir -p mcsv && wget -O mcsv/server.jar https://piston-data.mojang.com/v1/objects/64bb6d763bed0a9f1d632ec347938594144943ed/server.jar`
const execute = `cd mcsv && java -Xmx4G -Xms4G -jar server.jar nogui`

app.set("view engine", "ejs")
app.set("views", "src/views")

app.get("/", (req, res) => {
  res.render("index")
})

const exec = util.promisify(child_process.exec)

let minecraftProcess = null

app.post("/run", async (req, res) => {
  if (minecraftProcess) return res.json({ status: 'already running' })

  const lockFile = '/app/mcsv/world/session.lock'
  if (fs.existsSync(lockFile)) {
    io.emit('log', '⚠️ Servidor ya está corriendo, eliminando lock y reconectando...\r\n')
    try {
      fs.unlinkSync(lockFile)
    } catch (e) {
      io.emit('log', `Error eliminando lock: ${e.message}\r\n`)
      return res.status(500).json({ status: 'error', message: 'No se pudo eliminar el lock' })
    }
  }

  minecraftProcess = spawn('java', ['-Xmx4G', '-Xms4G', '--enable-native-access=ALL-UNNAMED', '-jar', 'server.jar', 'nogui'], {
    cwd: '/app/mcsv',
    env: javaEnv,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  io.emit('log', '🚀 Iniciando servidor...\r\n')

  minecraftProcess.stdout.on('data', (data) => {
    io.emit('log', data.toString())
  })

  minecraftProcess.stderr.on('data', (data) => {
    io.emit('log', data.toString())
  })

  minecraftProcess.stdout.setEncoding('utf8')
  minecraftProcess.stderr.setEncoding('utf8')

  minecraftProcess.on('close', () => {
    io.emit('log', 'Servidor detenido.\r\n')
    minecraftProcess = null
  })

  res.json({ status: 'started' })
})

app.post("/install", async (req, res) => {
  try {
    await exec(download, { shell: "/bin/bash", env: javaEnv })
    console.log("Server downloaded successfully")
    await exec(execute, { shell: "/bin/bash", env: javaEnv })
    console.log("EULA created successfully")
    fs.writeFileSync("mcsv/eula.txt", "eula=true")
    console.log("EULA signed successfully")
    res.status(201).send("Server installed successfully")
  } catch (error) {
    console.error("Error installing server:", error)
    res.status(500).send("Error installing server")
  }
})

app.post("/stop", (req, res) => {
  const lockFile = '/app/mcsv/world/session.lock'

  const cleanup = () => {
    exec('fuser -k 25565/tcp', () => {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile)
        io.emit('log', '🔓 Lock eliminado\r\n')
      }
      io.emit('log', '🛑 Servidor detenido\r\n')
      res.json({ status: 'stopped' })
    })
  }

  if (minecraftProcess) {
    minecraftProcess.on('close', () => {
      minecraftProcess = null
      cleanup()
    })
    minecraftProcess.kill('SIGTERM')
  } else {
    cleanup()
  }
})

httpServer.listen(port, () => {
  console.log(`Server running at port ${port}`)
})
