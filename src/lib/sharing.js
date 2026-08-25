function encodeShareLink(recipe) {
  // Strip large image data-urls before encoding to keep URL manageable
  const r = {...recipe, image: recipe.image?.startsWith("http") ? recipe.image : null};
  try {
    const json = JSON.stringify(r);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return `${window.location.href.split("#")[0]}#share=${b64}`;
  } catch { return null; }
}
function decodeShareLink(hash) {
  try {
    const b64 = hash.replace(/^#?share=/, "");
    const json = decodeURIComponent(escape(atob(b64)));
    const r = JSON.parse(json);
    if (!r.title || !r.ingredients) return null;
    return {...r, id: Date.now().toString(), createdAt: new Date(), sharedVia:"link"};
  } catch { return null; }
}
function recipeToText(recipe) {
  const LF = "\n";
  const lines = [];
  lines.push("# " + recipe.title);
  if (recipe.description) lines.push(recipe.description);
  lines.push("Prep: " + (recipe.prepTime||"-") + "  |  Cook: " + (recipe.cookTime||"-") + "  |  Serves: " + (recipe.servings||"-"));
  if (recipe.tags && recipe.tags.length) lines.push("Tags: " + recipe.tags.join(", "));
  lines.push(LF + "## Ingredients");
  recipe.ingredients.forEach(function(ing) { lines.push("- " + ing.amount + " " + ing.name); });
  lines.push(LF + "## Instructions");
  recipe.steps.forEach(function(s, i) { lines.push((i + 1) + ". " + s); });
  if (recipe.notes) { lines.push(LF + "## Notes"); lines.push(recipe.notes); }
  return lines.join(LF);
}

export { encodeShareLink, decodeShareLink, recipeToText };
