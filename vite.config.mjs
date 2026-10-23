import installer from "./worker/index.mjs";
import { defineConfig } from "vite";
import { catalog, getTrack } from "./data/catalog.mjs";
import { moduleCard } from "./data/render.mjs";

export default defineConfig({
  plugins: [{
    name: 'local-installer',
    configureServer: installMiddleware,
    configurePreviewServer: installMiddleware,
  }, {
    name: "catalog-html",
    transformIndexHtml(html) {
      const cards = catalog.map(entry => moduleCard({ entry, track: getTrack(entry, 13) ?? entry.tracks[0] })).join("");
      return html.replace('<div class="catalog-grid" id="catalog-list"></div>', `<div class="catalog-grid" id="catalog-list">${cards}</div>`);
    },
  }],
});

function installMiddleware(server) {
  server.middlewares.use('/install', async (req, res) => {
    try {
      const response = await installer.fetch(new Request(`http://127.0.0.1:${server.httpServer.address().port}/install${req.url}`, {method:req.method}));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(500); res.end('Installer error'); }
  });
}
