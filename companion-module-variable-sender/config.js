module.exports = {
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Bind IP (default 127.0.0.1)',
				width: 6,
				default: '127.0.0.1',
				regex: '/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/',
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 6,
				default: '8080',
				regex: '/^\\d+$/',
			},
		]
	},
}