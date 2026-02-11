#!/usr/bin/env node
/**
 * Generate a simple 22x22 tray icon PNG for the DMX Controller app.
 * Run: node scripts/generate-tray-icon.js
 *
 * This creates a simple light bulb icon as a template image.
 * For production, replace with a proper designed icon.
 */

const fs = require('fs');
const path = require('path');

// Minimal valid 22x22 PNG with a simple DMX icon pattern
// This is a Base64-encoded 22x22 PNG with a light icon design
const ICON_BASE64 = 
  'iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAABHNCSVQICAgIfAhkiAAAAAlwSFlz' +
  'AAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAGiSURB' +
  'VDiNrdRNaBNBFAfwf7KbbNI0aZOmrUq1FhEv4kFBvXgQD+JNPHkR9SAePIgH8eBFPImo+HERxYOI' +
  'CIIXQRAPigehIH4gVKn1I61pk2yS3WR3x0OyYTfZxPjgMTPvzf/NzM4M4z9J+cdy0yjNEjCCUsqy' +
  'GfYB2A1gGwC22NRCALMAfgHwWZYNLgVmjPWg6EIXgK2qoq4CAJimOcMYm2eMzQOYA/AewBcCgsYA' +
  'lBhjP/8Ge1mW9YWx7L2MyVNblJa1gOJREAHf8D/AwV4cdxSM0s1MWQYA91yWjVhJ0hcgHhcQRwBE' +
  'AESB+iSh7Zy+dLwAYIwxBhLKVqHU+lVcmwEQBxoWI5jbLbR+BaA73VZdgHFyHJ1AdhPwt4Mev30' +
  'hMcTfBgKBQ8CiJqm+RPATwCLKAYf/QvserKEW+LXJtxTUm1VSmrCgwCihmF8tlzzZ/0bsMKQWI4q' +
  'pBaWvF1C8K5S02fYR/VWz3oAy5cVn7+LwEYAMRIasnSrx2SsqATUK4T+YHpB8OQYBpjBGNACgMoY' +
  'ixiGMYeiCy8DuF2X5Z8fqb/pH/a34oKaQ3VYAAAAAElFTkSuQmCC';

const outputPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
const buffer = Buffer.from(ICON_BASE64, 'base64');
fs.writeFileSync(outputPath, buffer);
console.log(`Tray icon written to ${outputPath}`);
