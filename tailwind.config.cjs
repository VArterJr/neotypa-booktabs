/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/client/index.html', './src/client/**/*.{js,ts,jsx,tsx}'],
	theme: {
		extend: {}
	},
	plugins: [require('daisyui')],
	daisyui: {
		themes: true
	}
};
