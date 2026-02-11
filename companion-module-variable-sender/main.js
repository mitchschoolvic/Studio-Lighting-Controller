const { InstanceBase, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const { getActions } = require('./actions.js')
const { getConfigFields } = require('./config.js')
const { WebSocketServer } = require('ws')

class WebsocketInstance extends InstanceBase {
  async init(config) {
    this.config = config

    this.updateStatus(InstanceStatus.Ok)

    this.initWebSocket()
    this.setActionDefinitions(getActions(this))
    this.updateVariableDefinitions()
  }

  async destroy() {
    if (this.wss) {
      this.wss.close()
      delete this.wss
    }
  }

  async configUpdated(config) {
    this.config = config
    this.initWebSocket()
  }

  getConfigFields() {
    return getConfigFields()
  }

  updateVariableDefinitions() {
    const variables = require('./variables.js')
    variables(this)
  }

  initWebSocket() {
    if (this.wss) {
      this.wss.close()
      delete this.wss
    }

    if (this.config.port) {
      // Default to Listening (Yellow) until a client creates a connection
      this.updateStatus(InstanceStatus.Connecting, 'Listening...')

      try {
        const host = this.config.host || '127.0.0.1'
        this.wss = new WebSocketServer({ port: this.config.port, host: host })

        this.wss.on('listening', () => {
          this.log('info', `WebSocket Server listening on ${host}:${this.config.port}`)
          this.updateStatus(InstanceStatus.Connecting, 'Listening for App...')
        })

        this.wss.on('connection', (ws) => {
          this.log('info', 'New Client Connected')
          this.updateStatus(InstanceStatus.Ok, 'App Connected')

          ws.on('message', (message) => {
            try {
              const msgStr = message.toString()
              if (msgStr.startsWith('{')) {
                const data = JSON.parse(msgStr)
                if (data.type === 'set_variable') {
                  this.setVariableValues({ [data.name]: data.value })
                }
              }
            } catch (e) {
              this.log('debug', `Failed to parse message: ${e.message}`)
            }
          })

          ws.on('close', () => {
            this.log('info', 'Client Disconnected')
            this.checkConnectionStatus()
          })
        })

        this.wss.on('error', (err) => {
          this.log('error', `WebSocket Server Error: ${err.message}`)
          this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
        })

      } catch (e) {
        this.log('error', `Failed to start WebSocket Server: ${e.message}`)
        this.updateStatus(InstanceStatus.ConnectionFailure, e.message)
      }
    }
  }

  checkConnectionStatus() {
    if (this.wss && this.wss.clients.size > 0) {
      this.updateStatus(InstanceStatus.Ok, 'App Connected')
    } else {
      this.updateStatus(InstanceStatus.Connecting, 'Listening for App...')
    }
  }

  sendCommand(data) {
    if (this.wss) {
      const msg = JSON.stringify(data)
      let count = 0
      this.wss.clients.forEach((client) => {
        if (client.readyState === 1) { // OPEN
          client.send(msg)
          count++
        }
      })
      this.log('debug', `Sent to ${count} clients: ${msg}`)
    } else {
      this.log('warn', 'WebSocket Server not running, cannot send command')
    }
  }
}

runEntrypoint(WebsocketInstance, [])