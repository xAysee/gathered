// Detects whether an amount string is numeric (has a leading number)
function isNumericAmount(amountStr) {
  if (!amountStr) return false;
  const s = amountStr.trim();
  // Matches: leading digit, unicode fraction chars, or ASCII fraction like 1/2
  return /^[\d¼½¾⅓⅔⅛⅜⅝⅞]/.test(s) || /^\d+\/\d+/.test(s);
}

// Parse a fraction/mixed/decimal string to a float, return null if not parseable
function parseAmountNum(s) {
  s = s.trim();
  const UNICODE_FRACS = { "\u00bc":0.25, "\u00bd":0.5, "\u00be":0.75, "\u2153":0.333333, "\u2154":0.666667, "\u215b":0.125, "\u215c":0.375, "\u215d":0.625, "\u215e":0.875 };
  const fracCharClass = "\u00bc\u00bd\u00be\u2153\u2154\u215b\u215c\u215d\u215e";
  // Mixed: whole number + space + unicode fraction, e.g. "1 \u00bc" or "1\u00bc"
  const mixedUnicodeRe = new RegExp(`^(\\d+)\\s*([${fracCharClass}])`);
  // Standalone unicode fraction, e.g. "\u00bc"
  const unicodeRe = new RegExp(`^([${fracCharClass}])`);
  // ASCII mixed fraction, e.g. "1 1/2"
  const mixedRe = /^(\d+)\s+(\d+)\/(\d+)/;
  // ASCII simple fraction, e.g. "1/2"
  const fracRe = /^(\d+)\/(\d+)/;
  // Plain decimal/integer, e.g. "2.5" or "400"
  const decRe = /^(\d+\.?\d*)/;
  let m;
  if ((m = s.match(mixedUnicodeRe))) return parseInt(m[1]) + UNICODE_FRACS[m[2]];
  if ((m = s.match(unicodeRe))) return UNICODE_FRACS[m[1]];
  if ((m = s.match(mixedRe))) return parseInt(m[1]) + parseInt(m[2])/parseInt(m[3]);
  if ((m = s.match(fracRe))) return parseInt(m[1])/parseInt(m[2]);
  if ((m = s.match(decRe))) return parseFloat(m[1]);
  return null;
}

// Extract the unit suffix from an amount string (e.g. "2 cups" → "cups", "400g" → "g")
function extractUnit(s) {
  s = s.trim();
  const m = s.match(/^[\d\s\/\.¼½¾⅓⅔⅛⅜⅝⅞]+(.*)$/);
  return m ? normaliseUnit(m[1].trim().toLowerCase()) : "";
}
// Normalise unit spelling variants so "teaspoon" and "teaspoons" group together
function normaliseUnit(u) {
  if (!u) return u;
  const map = {
    "teaspoons":"tsp","teaspoon":"tsp",
    "tablespoons":"tbsp","tablespoon":"tbsp",
    "cups":"cup","cup":"cup",
    "liters":"l","litres":"l","liter":"l","litre":"l",
    "milliliters":"ml","millilitres":"ml","milliliter":"ml","millilitre":"ml",
    "grams":"g","gram":"g",
    "kilograms":"kg","kilogram":"kg",
    "ounces":"oz","ounce":"oz",
    "pounds":"lb","pound":"lb",
    "fluid ounces":"fl oz","fluid ounce":"fl oz","fl ounces":"fl oz",
  };
  return map[u] || u;
}

// Format a number back with fractions where nice
function fmtNum(n) {
  const FRACS = { 0.125:"⅛", 0.25:"¼", 0.333:"⅓", 0.5:"½", 0.667:"⅔", 0.75:"¾" };
  if (n <= 0) return "0";
  const whole = Math.floor(n);
  const frac = n - whole;
  const fracKey = Object.keys(FRACS).find(k => Math.abs(frac - parseFloat(k)) < 0.04);
  if (fracKey && whole === 0) return FRACS[fracKey];
  if (fracKey && whole > 0) return `${whole} ${FRACS[fracKey]}`;
  if (frac < 0.05) return `${whole}`;
  return parseFloat(n.toFixed(2)).toString();
}

function buildGroceryList(mealPlan, recipes) {
  // map: ingredientKey → { name, sources: [{recipeTitle, rawAmount, scale}] }
  const map = {};
  Object.values(mealPlan).forEach(dayMeals => {
    (dayMeals||[]).forEach(({ recipeId, servings }) => {
      const recipe = recipes.find(r => r.id === recipeId);
      if (!recipe) return;
      const scale = servings / (recipe.servings || 1);
      recipe.ingredients.forEach(ing => {
        const key = ing.name.toLowerCase().trim();
        if (!map[key]) map[key] = { name: ing.name, sources: [] };
        map[key].sources.push({ recipeTitle: recipe.title, rawAmount: ing.amount, scale });
      });
    });
  });

  return Object.values(map).sort((a,b) => a.name.localeCompare(b.name)).map(item => {
    const sources = item.sources;
    // Determine if ALL sources have numeric amounts with the same unit → aggregate
    const allNumeric = sources.every(s => isNumericAmount(s.rawAmount));
    const units = sources.map(s => extractUnit(s.rawAmount));
    const allSameUnit = allNumeric && units.every(u => u === units[0]);

    let displayAmount = null;
    let subLines = []; // per-recipe breakdown shown below

    if (allSameUnit) {
      // Sum scaled amounts
      const total = sources.reduce((acc, s) => {
        const num = parseAmountNum(s.rawAmount);
        return acc + (num !== null ? num * s.scale : 0);
      }, 0);
      const unit = units[0];
      displayAmount = fmtNum(total) + (unit ? " " + unit : "");
      // Build sub-lines only if multiple distinct recipes contributed
      const recipeGroups = {};
      sources.forEach(s => {
        const num = parseAmountNum(s.rawAmount);
        const scaled = num !== null ? num * s.scale : 0;
        if (!recipeGroups[s.recipeTitle]) recipeGroups[s.recipeTitle] = 0;
        recipeGroups[s.recipeTitle] += scaled;
      });
      if (Object.keys(recipeGroups).length > 1) {
        subLines = Object.entries(recipeGroups).map(([title, amt]) => `${fmtNum(amt)}${unit ? " "+unit : ""} (${title})`);
      } else {
        // Single recipe, just show the recipe title
        subLines = [`${displayAmount} — ${Object.keys(recipeGroups)[0]}`];
      }
    } else {
      // Non-numeric or mixed units (e.g. "handful", "to taste") -- can't sum these,
      // but DO consolidate repeated entries from the same recipe+amount into a count.
      const groups = {}; // key: "amount||recipeTitle" -> { amount, recipeTitle, count }
      sources.forEach(s => {
        const numeric = isNumericAmount(s.rawAmount);
        const scaled = numeric ? scaleAmount(s.rawAmount, s.scale) : s.rawAmount;
        const key = scaled + "||" + s.recipeTitle;
        if (!groups[key]) groups[key] = { amount: scaled, recipeTitle: s.recipeTitle, count: 0 };
        groups[key].count += 1;
      });
      subLines = Object.values(groups).map(g =>
        `${g.amount} \u2014 ${g.recipeTitle}${g.count > 1 ? ` \u00d7${g.count}` : ""}`
      );
      // For the headline display amount, show unique amount values (deduped)
      displayAmount = [...new Set(Object.values(groups).map(g => g.amount))].join(", ");
    }

    return { name: item.name, displayAmount, subLines, isNonNumeric: !allSameUnit };
  });
}


export { isNumericAmount, parseAmountNum, extractUnit, normaliseUnit, fmtNum, buildGroceryList };
