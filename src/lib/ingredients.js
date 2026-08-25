// ─── Ingredient splitting (e.g. "salt and pepper" -> two separate entries) ────
const SPLIT_PAIRS = [
  ["salt and black pepper", "salt", "black pepper"],
  ["salt and white pepper", "salt", "white pepper"],
  ["salt and pepper",       "salt", "pepper"],
  ["pepper and salt",       "pepper", "salt"],
  ["oil and salt",          "oil", "salt"],
  ["sugar and salt",        "sugar", "salt"],
  ["herbs and spices",      "herbs", "spices"],
];
function splitIngredients(ingredients) {
  const result = [];
  (ingredients || []).forEach(ing => {
    const nameLow = (ing.name || "").toLowerCase().trim();
    const pair = SPLIT_PAIRS.find(([combo]) => nameLow.includes(combo));
    if (pair) {
      const [, a, b] = pair;
      result.push({ amount: ing.amount || "to taste", name: a });
      result.push({ amount: ing.amount || "to taste", name: b });
    } else {
      result.push(ing);
    }
  });
  return result;
}


export { SPLIT_PAIRS, splitIngredients };
