const { InstanceBase, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const { getConfigFields } = require('./config.js')
const { getActions } = require('./actions.js')
const { getFeedbacks } = require('./feedbacks.js')
const { getVariableDefinitions } = require('./variables.js')
const WebSocket = require('ws')

const RECONNECT_INTERVAL_MS = 5000

class LightingControllerInstance extends InstanceBase {
	async init(config) {
		this.config = config

		/** @type {{ id: string, name: string, fadeTime: number, color: string }[]} */
		this.presets = []

		/** @type {string|null} */
		this.activePresetId = null

		/** @type {WebSocket|null} */
		this.ws = null

		/** @type {ReturnType<typeof setTimeout>|null} */
		this.reconnectTimer = null

		this.setVariableDefinitions(getVariableDefinitions())
		this.setVariableValues({ current_preset_name: '', current_preset_id: '' })

		this.refreshDefinitions()
		this.connectToApp()
	}

	async destroy() {
		this.clearReconnect()
		this.closeWebSocket()
	}

	async configUpdated(config) {
		this.config = config
		this.clearReconnect()
		this.closeWebSocket()
		this.connectToApp()
	}

	getConfigFields() {
		return getConfigFields()
	}

	// ── WebSocket Client ─────────────────────────────────────────────

	connectToApp() {
		const host = this.config.host || '127.0.0.1'
		const port = this.config.port || '9091'
		const url = `ws://${host}:${port}`

		this.updateStatus(InstanceStatus.Connecting, 'Connecting...')
		this.log('info', `Connecting to ${url}`)

		try {
			this.ws = new WebSocket(url)
		} catch (err) {
			this.log('error', `Failed to create WebSocket: ${err.message}`)
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			this.scheduleReconnect()
			return
		}

		this.ws.on('open', () => {
			this.log('info', 'Connected to Lighting Controller')
			this.updateStatus(InstanceStatus.Ok, 'Connected')
			this.requestPresets()
		})

		this.ws.on('message', (data) => {
			this.handleMessage(data)
		})

		this.ws.on('close', () => {
			this.log('info', 'Disconnected from Lighting Controller')
			this.updateStatus(InstanceStatus.Disconnected, 'Disconnected')
			this.ws = null
			this.scheduleReconnect()
		})

		this.ws.on('error', (err) => {
			this.log('error', `WebSocket error: ${err.message}`)
			// 'close' event will fire after this, triggering reconnect
		})
	}

	closeWebSocket() {
		if (this.ws) {
			this.ws.removeAllListeners()
			this.ws.close()
			this.ws = null
		}
	}

	scheduleReconnect() {
		this.clearReconnect()
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			this.connectToApp()
		}, RECONNECT_INTERVAL_MS)
	}

	clearReconnect() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
	}

	// ── Messaging ────────────────────────────────────────────────────

	sendCommand(data) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(data))
			this.log('debug', `Sent: ${JSON.stringify(data)}`)
		} else {
			this.log('warn', 'Cannot send — not connected')
		}
	}

	requestPresets() {
		this.sendCommand({ action: 'list_presets' })
	}

	handleMessage(raw) {
		try {
			const msg = JSON.parse(raw.toString())

			if (msg.status === 'ok' && msg.action === 'list_presets') {
				this.handlePresetList(msg.data)
				return
			}

			if (msg.event === 'preset_activated') {
				this.handlePresetActivated(msg.data)
				return
			}

			if (msg.event === 'presets_updated') {
				this.handlePresetList(msg.data)
				return
			}

			this.log('debug', `Received: ${raw.toString()}`)
		} catch (err) {
			this.log('debug', `Failed to parse message: ${err.message}`)
		}
	}

	// ── Preset State ─────────────────────────────────────────────────

	handlePresetList(presets) {
		if (!Array.isArray(presets)) {
			this.log('warn', 'Received invalid preset list')
			return
		}

		this.presets = presets
		this.log('info', `Received ${presets.length} preset(s)`)
		this.refreshDefinitions()
	}

	handlePresetActivated(data) {
		if (!data || !data.id) return

		this.activePresetId = data.id

		this.setVariableValues({
			current_preset_name: data.name || '',
			current_preset_id: data.id,
		})

		this.checkFeedbacks('preset_active')
		this.log('info', `Preset activated: ${data.name}`)
	}

	// ── Definition Refresh ───────────────────────────────────────────

	refreshDefinitions() {
		this.setActionDefinitions(getActions(this))
		this.setFeedbackDefinitions(getFeedbacks(this))
	}
}

runEntrypoint(LightingControllerInstance, [])
