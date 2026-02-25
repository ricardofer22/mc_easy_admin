import express from 'express'
import util from 'node:util'
import child_process from 'node:child_process'

const app = express()
const port = 3000

app.set('view engine', 'ejs')
app.set('views', 'src/views')

app.get('/', (req, res) => {
  res.render('index')
})

const exec = util.promisify(child_process.exec)

app.get('/run', async (req, res) => {
  const { stdout, stderr } = await exec('ls -lh')
  res.send(stdout)
})

app.listen(port, () => {
  console.log(`Server running at port ${port}`)
})
