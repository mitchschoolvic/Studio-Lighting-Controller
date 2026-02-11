module.exports = {
	getActions(self) {
		return {
			send_variable: {
				name: 'Send Variable to App',
				options: [
					{
						type: 'textinput',
						label: 'Variable to Send (e.g. $(internal:time_hms))',
						id: 'variableValue',
						default: '',
						useVariables: true,
					},
				],
				callback: async (action, context) => {
					// Parse the variable string to get its current value
					const parsedValue = await context.parseVariablesInString(action.options.variableValue)

					// Construct the message object
					const message = {
						type: 'variable_update',
						value: parsedValue,
						timestamp: Date.now(),
					}

					// Send via the helper method in main.js
					self.sendCommand(message)
				},
			},
			send_recording_variable: {
				name: 'Send Recording Variable to App',
				options: [
					{
						type: 'textinput',
						label: 'Variable to Send (e.g. $(internal:time_hms))',
						id: 'variableValue',
						default: '',
						useVariables: true,
					},
				],
				callback: async (action, context) => {
					// Parse the variable string to get its current value
					const parsedValue = await context.parseVariablesInString(action.options.variableValue)

					// Construct the message object
					const message = {
						type: 'recording_variable_update',
						value: parsedValue,
						timestamp: Date.now(),
					}

					// Send via the helper method in main.js
					self.sendCommand(message)
				},
			},
			send_playback_variable: {
				name: 'Send Playback Variable to App',
				options: [
					{
						type: 'textinput',
						label: 'Variable to Send (e.g. $(internal:time_hms))',
						id: 'variableValue',
						default: '',
						useVariables: true,
					},
				],
				callback: async (action, context) => {
					// Parse the variable string to get its current value
					const parsedValue = await context.parseVariablesInString(action.options.variableValue)

					// Construct the message object
					const message = {
						type: 'playback_variable_update',
						value: parsedValue,
						timestamp: Date.now(),
					}

					// Send via the helper method in main.js
					self.sendCommand(message)
				},
			},
		}
	},
}