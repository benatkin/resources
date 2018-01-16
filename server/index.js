const express = require('express')
const next = require('next')

const bodyParser = require('body-parser')
const cookieSession = require('cookie-session')

const NoAuth = require('./auth/no-auth')
const AccessCodeAuth = require('./auth/access-code-auth')

const port = parseInt(process.env.PORT, 10) || 3000
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })

const graphqlMiddleware = require('./graphql')

const handle = app.getRequestHandler()

let auth;
if (process.env !== 'production' && process.env !== 'staging' && !process.env.ACCESS_CODE) {
  auth = new NoAuth()
} else {
  auth = new AccessCodeAuth()
}

async function init() {
  await app.prepare()

  const server = express()

  server.use(/\/((?!graphql).)*/, bodyParser.urlencoded({ extended: false }))
  
  auth.addMiddleware(server)

  server.post('/sign-in', (req, res) => {
    if (req.body.password === accessCode) {
      req.session.user = true
    }
    res.redirect('/')
  })

  server.get('/', (req, res) => {
    if (auth.loggedIn()) {
      return app.render(req, res, '/')
    } else {
      return app.render(req, res, '/login')
    }
  })

  server.get('/_next/*', (req, res) => {
    return handle(req, res)
  })

  server.use('/graphql', auth.ensureLoggedIn, graphqlMiddleware)

  server.get('*', auth.ensureLoggedIn, (req, res) => {
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