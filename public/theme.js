/* Runs before paint so a saved light theme never flashes dark. */
try {
  var t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) { /* storage blocked in private mode; the default stands */ }
