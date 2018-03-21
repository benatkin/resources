if (! ['staging', 'production'].includes(process.env.NODE_ENV)) {
  require('now-env')
}

const express = require('express')
const next = require('next')
const session = require('express-session')

const port = parseInt(process.env.PORT, 10) || 3000
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev, quiet: true })

const graphqlMiddleware = require('./graphql')
const auth = require('./auth')
const {checkEnv} = require('./util')

const handle = app.getRequestHandler()

async function init() {
  await app.prepare()

  const server = express()

  checkEnv('CONSOLE_SESSION_KEY', 64)
  server.use(session({
    secret: process.env.CONSOLE_SESSION_KEY,
    resave: false,
    saveUninitialized: false
  }))

  server.get('/auth/github', (req, res) => {
    const state = auth.randomState()
    req.session.state = state
    res.redirect(auth.authUrl(state))
  })

  server.get('/auth/github/callback', async (req, res) => {
    const {code, state} = req.query
    if (state !== req.session.state) {
      console.error('Invalid state:', state, 'Expected:', req.session.state)
      return res.status(401).json({error: 'Authentication failed.'})
    }

    let token
    try {
      token = await auth.getToken({code})
    } catch (e) {
      console.error('Error getting token:', e)
      return res.status(401).json({error: 'Authentication failed.'})
    }

    let username
    try {
      username = await auth.getUsername({token})
    } catch (e) {
      console.error('Error getting token:', e)
      return res.status(401).json({error: 'Authentication failed.'})
    }

    res.redirect('/')
  })

  server.get('/', (req, res) => {
    return app.render(req, res, '/', {id: 'none'})
  })

  server.get('/requests/:id', (req, res) => {
    return app.render(req, res, '/', { id: req.params.id })
  })

  server.get('/_next/*', (req, res) => {
    return handle(req, res)
  })

  server.use('/graphql', graphqlMiddleware)

  server.get('*', (req, res) => {
    return handle(req, res)
  })

  server.listen(port, err => {
    if (err) throw err
    console.log(`> Ready on http://localhost:${port}`)
  })
}

init().then(() => {
  // do nothing
}).catch(err => {
  console.error(err.stack)
  process.exit(1)
})
