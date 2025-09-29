export default {
  "src/**/*.{ts,tsx,js,jsx,css,html}": ["biome lint --apply --error-on-warnings"],
  "{*.json,.biome.json}": ["biome format --write"],
};