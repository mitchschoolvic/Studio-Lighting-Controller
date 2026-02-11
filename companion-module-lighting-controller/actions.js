module.exports = {
	getActions(self) {
		const presetChoices = self.presets.map((p) => ({ id: p.id, label: p.name }))

		return {
			select_preset: {
				name: 'Select Preset',
				options: [
					{
						type: 'dropdown',
						label: 'Preset',
						id: 'presetId',
						choices: presetChoices,
						default: presetChoices.length > 0 ? presetChoices[0].id : '',
					},
				],
				callback: async (action) => {
					const presetId = action.options.presetId

					if (!presetId) {
						self.log('warn', 'No preset selected')
						return
					}

					self.sendCommand({
						action: 'recall_preset',
						id: presetId,
					})
				},
			},
		}
	},
}
