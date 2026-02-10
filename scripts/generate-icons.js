const fs = require('fs')
const path = require('path')

// SVG template for the icon - blue background with white "P"
const generateSVG = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#2563eb"/>
  <text
    x="50%"
    y="54%"
    dominant-baseline="middle"
    text-anchor="middle"
    fill="white"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font-weight="bold"
    font-size="${size * 0.55}"
  >P</text>
</svg>`

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const iconsDir = path.join(__dirname, '..', 'public', 'icons')

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

// Generate SVG files (browsers can use these, and we'll convert to PNG)
sizes.forEach(size => {
  const svg = generateSVG(size)
  const filename = `icon-${size}x${size}.svg`
  fs.writeFileSync(path.join(iconsDir, filename), svg)
  console.log(`Generated ${filename}`)
})

// Also generate apple-touch-icon
const appleSVG = generateSVG(180)
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.svg'), appleSVG)
console.log('Generated apple-touch-icon.svg')

// Generate favicon.svg
const faviconSVG = generateSVG(32)
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), faviconSVG)
console.log('Generated favicon.svg')

console.log('\nDone! SVG icons generated.')
console.log('Note: For production, convert SVGs to PNGs using a tool like sharp or an online converter.')
