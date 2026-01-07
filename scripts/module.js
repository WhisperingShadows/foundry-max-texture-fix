// Large Map Splitter - Auto-splits oversized backgrounds to tiles

let MODULE_ID = null;
let TILE_DIRECTORY = null;


Hooks.once("init", () => {
  MODULE_ID = "bg-texture-size-fix";
  TILE_DIRECTORY = `worlds/${game.world.id}/assets/bg-tiles`;
  console.log(`${MODULE_ID} | Initialized`);
});

// CLIENT: Auto-report max texture size on canvas ready (once/session, flags persist)
Hooks.on("canvasReady", async (canvas) => {
  const gl = canvas.app.renderer.gl;
  // const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const maxSize = 8192;
  const current = game.user.flags[MODULE_ID]?.minTextureSize;
  if (current !== maxSize) {
      // Cleanly remove the entire module flag namespace first (if it exists)
      await game.user.unsetFlag(MODULE_ID, ""); // "" targets the whole namespace
      // OR equivalently: await game.user.update({ [`flags.${MODULE_ID}`]: null });
    
      // Then set the fresh value
      await game.user.setFlag(MODULE_ID, "minTextureSize", maxSize);
      
      console.log(`${MODULE_ID} | Updated max texture flag: ${maxSize}`);
  }
});

async function fixBackground(scene, imgSrc) {
  // Compute min max across ACTIVE players (incl. GM)
  const activeMins = game.users
    .map((u) => foundry.utils.getProperty(u, `flags.${MODULE_ID}.minTextureSize`))
    .filter((v) => v != null);
  if (activeMins.length === 0) {
    ui.notifications.warn(
      `${MODULE_ID} | No player max texture sizes reported! Have everyone reconnect or pan canvas.`
    );
    return;
  }
  const minMax = Math.min(...activeMins);
  ui.notifications.info(`${MODULE_ID} | Min player max texture: ${minMax}px`);

  // If no background image source was given, use current background
  if (!imgSrc) {
  	imgSrc = scene.background.src;
  }
  
  // Load image dims
  const img = new Image();
  img.crossOrigin = "anonymous";
  try {
    await new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imgSrc;
    });
  } catch (e) {
    ui.notifications.error(`${MODULE_ID} | Image load failed: ${e.message}`);
    return;
  }
  
  const sceneW = scene.width;
  const sceneH = scene.height;
  if (Math.abs(img.naturalWidth - sceneW) > 1 || Math.abs(img.naturalHeight - sceneH) > 1) {
    ui.notifications.warn(
      `${MODULE_ID} | Scene dims (${sceneW}x${sceneH}) != image (${img.naturalWidth}x${img.naturalHeight}). Minor scaling possible.`
    );
  }
  
  // Skip if fits
  if (img.naturalWidth <= minMax && img.naturalHeight <= minMax) return;
  
  ui.notifications.info(`${MODULE_ID} | Auto-splitting ${img.naturalWidth}x${img.naturalHeight} bg...`);

  // Remove any background tiles from previous generations
  await cleanupFixTiles(scene);

  // Get filepicker based on version
  if (+game.version.split(".")[0] >= 13) {
    let FilePickerImpl = foundry.applications.apps.FilePicker.implementation;
  }
  else {
      let FilePickerImpl = FilePicker;
  }

  // Ensure tile storage directory exists
  try {
    await FilePickerImpl.createDirectory("data", TILE_DIRECTORY);
  } catch (err) {
    if ( !err.message.startsWith("EEXIST: file already exists") ) {
      ui.notifications.error(`${MODULE_ID} | Failed to create tiles directory: ${err.message}`);
      console.error(err);
      return; // Abort splitting
    };
  }
  
  // Optimal tile sizes (largest possible <=95% minMax, minimal tiles)
  const padding = 0.95;
  let maxTile = Math.floor(minMax * padding);
  let numXTiles = Math.ceil(sceneW / maxTile);
  let tileW = Math.floor(sceneW / numXTiles);
  let numYTiles = Math.ceil(sceneH / maxTile);
  let tileH = Math.floor(sceneH / numYTiles);

  // Get scene coordinates (to account for scenes with padding)
  const {x: startX, y: startY} = scene.dimensions.sceneRect;

  // Generate tiles
  const tiles = [];
  for (let y = 0; y < numYTiles; y++) {
    for (let x = 0; x < numXTiles; x++) {
      const sx = x * tileW;
      const sy = y * tileH;
      const cropW = Math.min(tileW, sceneW - sx);
      const cropH = Math.min(tileH, sceneH - sy);
  
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const ctx = cropCanvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
  
      const blob = await new Promise((r) =>
        cropCanvas.toBlob(r, "image/webp", 0.98)
      );
      const fileName = `split-bg-${scene.id}-${x}-${y}.webp`;
      const { path } = await foundry.applications.apps.FilePicker.implementation.upload(
        "data",
        TILE_DIRECTORY,
        new File([blob], fileName, { type: "image/webp" }),
        {}
      );
      const tileSrc = path;

      // Possible optimization using TextureLoader to dynamically create in-memory tiles?
      // const tileTexture = foundry.canvas.TextureLoader.loadTexture( src: tileSrc );
  
      tiles.push({
        t: "Tile",
        texture: {
          "src": tileSrc,
          "anchorX": 0.5,
          "anchorY": 0.5,
          "offsetX": 0,
          "offsetY": 0,
          "fit": "fill",
          "scaleX": 1,
          "scaleY": 1,
          "rotation": 0,
          "tint": "#ffffff",
          "alphaThreshold": 0.75
        },
        x: startX + sx,
        y: startY + sy,
        width: cropW,
        height: cropH,
        z: 0,
        rotation: 0,
        alpha: 1.0,
        lockRotation: false,
        hidden: false,
        flags: {
          [MODULE_ID]: {
        	"generated": true
          }
        }
      });
    }
  }
  
  // Create tiles & null bg
  await scene.createEmbeddedDocuments("Tile", tiles);
  await scene.update({ "background.src": null });
  
  ui.notifications.success(
    `${MODULE_ID} | Background successfully split into ${tiles.length} tiles (${numXTiles}x${numYTiles}).`
  );

}

async function cleanupFixTiles(scene) {
  const tiles = scene.tiles.filter((t) => foundry.utils.getProperty(t, `flags.${MODULE_ID}.generated`) === true).map((t) => t._id);
  if (tiles) {
  	await scene.deleteEmbeddedDocuments("Tile", tiles);
  	ui.notifications.info("Removed old background tiles.");
  }
}

// GM-ONLY: Auto-split on background set
Hooks.on("updateScene", async (scene, update, options, userId) => {
  if (!game.user.isGM || !update.background?.src) return;

  const newSrc = update.background.src;
  if (!newSrc) return;

  await fixBackground(scene, newSrc);

});
