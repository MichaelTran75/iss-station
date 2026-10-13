// Model data: meshes, skeletons and motion from data/*.json, and the PMA-2 textures from assets/. boot.js runs this module
// before any other, so the station modules use the data synchronously and build in a fixed order.
const assetFiles = {"pmaReferenceData": "data/pma-2.json?v=9bc51550c5", "payloadReference": "data/payloads.json?v=e3df59b776", "columbusCrewHuman": "data/columbus-crew.json?v=2dc54df3a1", "columbusCrewMotion": "data/columbus-crew-motion.json?v=de8d0eec90", "zaryaReference": "data/zarya.json?v=b2d1a5f9db", "dragonReference": "data/crew-dragon.json?v=7def71e643", "dragonCrewSuit": "data/crew-dragon-suit.json?v=d795e5d772"};
const threeReady = import('three');
const assetDataReady = Promise.all(Object.entries(assetFiles).map(async ([name, path]) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Could not load ' + path + ' (HTTP ' + response.status + ').');
    return [name, await response.json()];
})).then(Object.fromEntries);
threeReady.catch(() => {});
export const assetData = await assetDataReady;
// PMA-2's textures, in the order of its materials.
const { TextureLoader } = await threeReady;
const textureLoader = new TextureLoader();
export const pmaTextures = await Promise.all(assetData.pmaReferenceData.materials.map(definition => textureLoader.loadAsync(definition.image)));
