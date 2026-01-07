![](https://img.shields.io/badge/Foundry-v13-informational)
<!--- Downloads @ Latest Badge -->
<!--- replace <user>/<repo> with your username/repository -->
<!--- ![Latest Release Download Count](https://img.shields.io/github/downloads/<user>/<repo>/latest/module.zip) -->

<!--- Forge Bazaar Install % Badge -->
<!--- replace <your-module-name> with the `name` in your manifest -->
<!--- ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2F<your-module-name>&colorB=4aa94a) -->

### Manifest URL

`https://github.com/WhisperingShadows/foundry-max-texture-fix/releases/latest/download/module.json`

# Foundry Max Texture Fix

This is a simple module which fixes maps / background images above a certain size not rendering on lower-end hardware due to maximum texture size limitations. It accomplishes this by detecting when a scene's background is set to an image above a certain size, then automatically splitting it into smaller pieces below the maximum texture size, and placing Tiles containing these smaller images into the scene instead.

## Changelog
None yet.