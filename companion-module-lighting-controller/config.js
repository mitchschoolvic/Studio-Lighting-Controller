module.exports = {
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Controller IP Address',
				width: 6,
				default: '127.0.0.1',
				regex: '/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/',
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'WebSocket Port',
				width: 6,
				default: '9091',
				regex: '/^\\d+$/',
			},
		]
	},
}
