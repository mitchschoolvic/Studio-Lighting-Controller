const { combineRgb } = require('@companion-module/base')

module.exports = {
	getFeedbacks(self) {
		const presetChoices = self.presets.map((p) => ({ id: p.id, label: p.name }))

		return {
			preset_active: {
				type: 'boolean',
				name: 'Preset Active',
				description: 'True when the selected preset is the currently active preset',
				options: [
					{
						type: 'dropdown',
						label: 'Preset',
						id: 'presetId',
						choices: presetChoices,
						default: presetChoices.length > 0 ? presetChoices[0].id : '',
					},
				],
				defaultStyle: {
					bgcolor: combineRgb(0, 180, 0),
					color: combineRgb(255, 255, 255),
				},
				callback: (feedback) => {
					return self.activePresetId === feedback.options.presetId
				},
			},
		}
	},
}
