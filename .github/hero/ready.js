// Marks the page ready once every face it uses has loaded, so render.mjs never captures fallback fonts.
const FACES = ['500 16px "Oswald"', '500 16px "Quicksand"', '700 16px "Quicksand"'];

async function markReady() {
  const loaded = await Promise.all(FACES.map((face) => document.fonts.load(face)));
  await Promise.all([...document.images].map((image) => image.decode()));
  if (loaded.every((faces) => faces.length > 0)) document.documentElement.classList.add("ready");
}

markReady();
