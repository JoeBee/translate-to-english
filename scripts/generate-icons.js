// Script to generate PWA icons from an SVG template
// This creates placeholder icons - replace with actual icon design for production

const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a translation icon (language/arrow symbol)
const createSVGIcon = (size) => {
  const center = size / 2;
  const iconSize = size * 0.6;
  const leftX = center - size * 0.22;
  const rightX = center + size * 0.22;
  const topY = center - size * 0.05;
  const bottomY = center + size * 0.15;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2563eb;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad${size})" rx="${size * 0.15}"/>
  <!-- Language bubbles -->
  <circle cx="${leftX}" cy="${topY}" r="${size * 0.12}" fill="white" opacity="0.95"/>
  <circle cx="${rightX}" cy="${topY}" r="${size * 0.12}" fill="white" opacity="0.95"/>
  <!-- Arrow pointing right -->
  <path d="M ${center - size * 0.08} ${center + size * 0.05} L ${center + size * 0.08} ${center + size * 0.05} M ${center + size * 0.05} ${center + size * 0.02} L ${center + size * 0.08} ${center + size * 0.05} L ${center + size * 0.05} ${center + size * 0.08}" 
        stroke="white" stroke-width="${size * 0.03}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Text "EN" at bottom -->
  <text x="${center}" y="${bottomY + size * 0.12}" font-family="Arial, sans-serif" font-size="${size * 0.18}" fill="white" text-anchor="middle" font-weight="bold">EN</text>
</svg>`;
};

console.log('Generating PWA icons...');
console.log('Note: These are placeholder icons. Replace with actual icon design for production.\n');

// Generate SVG icons (browsers can use SVG directly)
sizes.forEach(size => {
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(iconsDir, filename);
  const svg = createSVGIcon(size);

  fs.writeFileSync(filepath, svg);
  console.log(`Created ${filename}`);
});

// Create a simple 512x512 PNG placeholder using base64 (minimal)
// For production, use a proper image editor to create real PNG icons
const createMinimalPNG = () => {
  // This is a minimal 1x1 transparent PNG encoded in base64
  // For production, replace with actual PNG icons
  console.log('\nNote: PNG icons need to be created manually or using an image editor.');
  console.log('SVG icons have been created and can be used directly.');
};

console.log('\n✅ Icon generation complete!');
console.log('Icons created in: public/icons/');
console.log('\nFor production:');
console.log('1. Create proper PNG icons using an image editor');
console.log('2. Replace SVG icons with PNG versions');
console.log('3. Update manifest.webmanifest to use PNG icons');
