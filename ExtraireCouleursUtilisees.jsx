//@target illustrator
/*
 * ExtraireCouleursUtilisees.jsx  —  v1.0.0
 * ----------------------------------------------------------------------------
 * FR : Extrait toutes les couleurs réellement utilisées dans le document
 *      (fonds, contours, textes, arrêtés de dégradé en option) et les ajoute
 *      dans un nouveau groupe de nuances nommé (ex. « Couleurs extraites »).
 *      Déduplication RVB / CMJN / Gris / Lab / tons directs, avec tolérance
 *      optionnelle. Portée document, calque actif ou sélection.
 *      Le bouton « Analyser » compte les couleurs uniques sans rien modifier.
 *      Distinct de AimanterCouleursNuancier (qui mappe vers un nuancier existant).
 * EN : Extracts every colour actually used in the document (fills, strokes,
 *      text, optional gradient stops) and adds them to a new named swatch
 *      group (e.g. "Extracted Colors"). Deduplicates RGB / CMYK / Gray / Lab /
 *      spot colours, with optional tolerance. Scope: document, active layer
 *      or selection. The "Analyze" button counts unique colours without
 *      changing anything. Distinct from AimanterCouleursNuancier (which maps
 *      onto an existing swatch set).
 *
 * Cible / Target : Illustrator CC (2018+) jusqu'aux versions récentes.
 * Statut / Status : NON TESTÉ DANS ILLUSTRATOR — syntaxe ES3 vérifiée (acorn).
 *                   NOT TESTED IN ILLUSTRATOR — ES3 syntax checked (acorn).
 * Annulation / Undo : une seule opération (app.beginUndoGroup / endUndoGroup).
 * Conseil : travaillez sur une copie de votre fichier.
 * Tip     : work on a copy of your file.
 * Aucune connexion réseau, aucune collecte de données, aucun fichier écrit.
 * No network access, no data collection, no file written.
 *
 * Licence MIT — (c) 2026 Amirouche Amwanes. Code original.
 */

(function () {

    var VERSION = "1.0.0";
    var TITLE = "Extraire couleurs / Extract colours " + VERSION;
    var DEFAULT_GROUP_FR = "Couleurs extraites";
    var DEFAULT_GROUP_EN = "Extracted Colors";

    // ------------------------------------------------------------------
    // Langue / UI language (français si Illustrator est en français)
    // ------------------------------------------------------------------
    var FR = String(app.locale || "").toLowerCase().indexOf("fr") === 0;
    function L(fr, en) { return FR ? fr : en; }

    function fmt(n, d) {
        var s = (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
        return FR ? s.replace(".", ",") : s;
    }
    function parseNum(s, def) {
        var v = parseFloat(String(s).replace(",", "."));
        return isNaN(v) ? def : v;
    }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    // ------------------------------------------------------------------
    // Vérifications de départ / Preconditions
    // ------------------------------------------------------------------
    if (app.documents.length === 0) {
        alert(L("Aucun document ouvert.\nOuvrez un document puis relancez le script.",
                "No document is open.\nOpen a document and run the script again."),
              TITLE);
        return;
    }
    var doc = app.activeDocument;

    // ------------------------------------------------------------------
    // Helpers couleur / Colour helpers
    // ------------------------------------------------------------------
    function isProcessColor(c) {
        if (!c) { return false; }
        var t = c.typename;
        return t === "RGBColor" || t === "CMYKColor" || t === "GrayColor" || t === "LabColor";
    }

    function isSpotUsable(c) {
        if (!c || c.typename !== "SpotColor") { return false; }
        try {
            if (c.spot.colorType === ColorModel.REGISTRATION) { return false; }
        } catch (e) { return false; }
        return true;
    }

    // Clone une couleur de process (sans référence partagée).
    // Clone a process colour (no shared reference).
    function cloneProcess(c) {
        var n;
        switch (c.typename) {
            case "RGBColor":
                n = new RGBColor();
                n.red = c.red; n.green = c.green; n.blue = c.blue;
                return n;
            case "CMYKColor":
                n = new CMYKColor();
                n.cyan = c.cyan; n.magenta = c.magenta; n.yellow = c.yellow; n.black = c.black;
                return n;
            case "GrayColor":
                n = new GrayColor();
                n.gray = c.gray;
                return n;
            case "LabColor":
                n = new LabColor();
                n.l = c.l; n.a = c.a; n.b = c.b;
                return n;
        }
        return null;
    }

    // Clé exacte (déduplication stricte) / Exact key (strict dedup)
    function exactKey(c) {
        switch (c.typename) {
            case "RGBColor":
                return "R|" + Math.round(c.red) + "|" + Math.round(c.green) + "|" + Math.round(c.blue);
            case "CMYKColor":
                return "C|" + Math.round(c.cyan * 100) / 100 + "|" + Math.round(c.magenta * 100) / 100 +
                       "|" + Math.round(c.yellow * 100) / 100 + "|" + Math.round(c.black * 100) / 100;
            case "GrayColor":
                return "G|" + Math.round(c.gray * 100) / 100;
            case "LabColor":
                return "L|" + Math.round(c.l * 100) / 100 + "|" + Math.round(c.a * 100) / 100 +
                       "|" + Math.round(c.b * 100) / 100;
            case "SpotColor":
                // Teintes différentes du même ton = même nuance (on conserve le spot à 100 %).
                // Different tints of the same spot share one swatch (stored at 100 %).
                return "S|" + c.spot.name;
        }
        return null;
    }

    // Composantes normalisées 0–1 pour comparaison avec tolérance.
    // Normalised 0–1 components for tolerance comparison.
    function toNorm(c) {
        switch (c.typename) {
            case "RGBColor":
                return { space: "RGB", v: [c.red / 255, c.green / 255, c.blue / 255] };
            case "CMYKColor":
                return { space: "CMYK", v: [c.cyan / 100, c.magenta / 100, c.yellow / 100, c.black / 100] };
            case "GrayColor":
                return { space: "Gray", v: [c.gray / 100] };
            case "LabColor":
                return { space: "Lab", v: [c.l / 100, (c.a + 128) / 255, (c.b + 128) / 255] };
            case "SpotColor":
                return { space: "Spot", name: c.spot.name, v: [] };
        }
        return null;
    }

    function withinTol(a, b, tol) {
        if (!a || !b || a.space !== b.space) { return false; }
        if (a.space === "Spot") { return a.name === b.name; }
        var i, d, max = 0;
        for (i = 0; i < a.v.length; i++) {
            d = Math.abs(a.v[i] - b.v[i]);
            if (d > max) { max = d; }
        }
        return max <= tol;
    }

    function describe(c) {
        switch (c.typename) {
            case "RGBColor":
                return "RVB " + Math.round(c.red) + "/" + Math.round(c.green) + "/" + Math.round(c.blue);
            case "CMYKColor":
                return L("CMJN ", "CMYK ") + Math.round(c.cyan) + "/" + Math.round(c.magenta) +
                       "/" + Math.round(c.yellow) + "/" + Math.round(c.black);
            case "GrayColor":
                return L("Gris ", "Gray ") + Math.round(c.gray) + " %";
            case "LabColor":
                return "Lab " + Math.round(c.l) + "/" + Math.round(c.a) + "/" + Math.round(c.b);
            case "SpotColor":
                return c.spot.name;
        }
        return c.typename;
    }

    // Nom de nuance proposé / Proposed swatch name
    function autoName(c, index, prefix) {
        if (c.typename === "SpotColor") {
            try { return c.spot.name; } catch (e) { return "Spot " + index; }
        }
        if (prefix && prefix.length > 0) {
            return prefix + index;
        }
        switch (c.typename) {
            case "RGBColor":
                return "RVB " + Math.round(c.red) + "-" + Math.round(c.green) + "-" + Math.round(c.blue);
            case "CMYKColor":
                return "CMJN " + Math.round(c.cyan) + "-" + Math.round(c.magenta) +
                       "-" + Math.round(c.yellow) + "-" + Math.round(c.black);
            case "GrayColor":
                return L("Gris ", "Gray ") + Math.round(c.gray);
            case "LabColor":
                return "Lab " + Math.round(c.l) + "-" + Math.round(c.a) + "-" + Math.round(c.b);
        }
        return "Color " + index;
    }

    // ------------------------------------------------------------------
    // Collecte / Collection
    // ------------------------------------------------------------------
    function makeCollector(opt) {
        return {
            items: [],           // { color, key, label, spotName }
            byKey: {},
            norms: [],
            examined: 0,
            skipped: 0,
            found: 0             // occurrences brutes / raw hits
        };
    }

    function addColor(col, state, opt) {
        if (!col) { return; }
        var t = col.typename;
        if (t === "NoColor" || t === "PatternColor") { return; }
        if (t === "GradientColor") { return; } // géré à part / handled separately
        if (t === "SpotColor") {
            if (!isSpotUsable(col)) { return; }
        } else if (!isProcessColor(col)) {
            return;
        }

        state.found++;
        var key = exactKey(col);
        if (!key) { return; }

        if (opt.tol > 0 && t !== "SpotColor") {
            var norm = toNorm(col);
            var i, existing;
            for (i = 0; i < state.norms.length; i++) {
                if (withinTol(norm, state.norms[i], opt.tol)) {
                    return; // déjà représenté / already represented
                }
            }
            if (state.byKey.hasOwnProperty(key)) { return; }
            state.byKey[key] = true;
            state.norms.push(norm);
        } else {
            if (state.byKey.hasOwnProperty(key)) { return; }
            state.byKey[key] = true;
            if (opt.tol > 0) {
                state.norms.push(toNorm(col));
            }
        }

        var clone;
        if (t === "SpotColor") {
            clone = col; // on réutilise le SpotColor (spot partagé) / reuse SpotColor
        } else {
            clone = cloneProcess(col);
            if (!clone) { return; }
        }
        state.items.push({
            color: clone,
            key: key,
            label: describe(col),
            spotName: t === "SpotColor" ? col.spot.name : null,
            typename: t
        });
    }

    function collectGradient(gc, state, opt) {
        if (!opt.grad) { return; }
        var grad, i, st;
        try { grad = gc.gradient; } catch (e) { return; }
        if (!grad) { return; }
        // Évite de re-parcourir le même dégradé nommé.
        // Avoid re-walking the same named gradient.
        var gkey = "GRAD|" + grad.name;
        if (state.byKey.hasOwnProperty(gkey + "|seen")) { return; }
        state.byKey[gkey + "|seen"] = true;
        try {
            for (i = 0; i < grad.gradientStops.length; i++) {
                st = grad.gradientStops[i];
                addColor(st.color, state, opt);
            }
        } catch (e2) {}
    }

    function collectPath(p, state, opt) {
        try {
            if (opt.fill && p.filled) {
                if (p.fillColor.typename === "GradientColor") {
                    collectGradient(p.fillColor, state, opt);
                } else {
                    addColor(p.fillColor, state, opt);
                }
            }
        } catch (e1) {}
        try {
            if (opt.stroke && p.stroked) {
                if (p.strokeColor.typename === "GradientColor") {
                    collectGradient(p.strokeColor, state, opt);
                } else {
                    addColor(p.strokeColor, state, opt);
                }
            }
        } catch (e2) {}
    }

    function collectText(tf, state, opt) {
        if (!opt.text) { return; }
        var chars, i, ca, n;
        try {
            chars = tf.textRange.characters;
            n = chars.length;
        } catch (e0) { return; }
        for (i = 0; i < n; i++) {
            try {
                ca = chars[i].characterAttributes;
                if (opt.fill) {
                    try {
                        if (ca.fillColor.typename === "GradientColor") {
                            collectGradient(ca.fillColor, state, opt);
                        } else {
                            addColor(ca.fillColor, state, opt);
                        }
                    } catch (e1) {}
                }
                if (opt.stroke) {
                    try {
                        if (ca.strokeColor.typename !== "NoColor" &&
                            ca.strokeColor.typename !== "GradientColor") {
                            addColor(ca.strokeColor, state, opt);
                        }
                    } catch (e2) {}
                }
            } catch (e3) {}
        }
    }

    function walkItem(item, state, opt) {
        var locked = false, hidden = false;
        try { locked = item.locked; } catch (eL) {}
        try { hidden = item.hidden; } catch (eH) {}
        if (opt.skipLockedHidden && (locked || hidden)) {
            state.skipped++;
            return;
        }
        var i;
        switch (item.typename) {
            case "GroupItem":
                try {
                    for (i = 0; i < item.pageItems.length; i++) {
                        walkItem(item.pageItems[i], state, opt);
                    }
                } catch (eG) {}
                break;
            case "PathItem":
                state.examined++;
                collectPath(item, state, opt);
                break;
            case "CompoundPathItem":
                state.examined++;
                try {
                    if (item.pathItems.length > 0) {
                        collectPath(item.pathItems[0], state, opt);
                    }
                } catch (eC) {}
                break;
            case "TextFrame":
                state.examined++;
                collectText(item, state, opt);
                break;
            default:
                // Images, symboles, maillages, plug-ins : non traités.
                // Images, symbols, meshes, plug-ins: not processed.
                state.skipped++;
        }
    }

    function walkLayer(layer, state, opt) {
        if (opt.skipLockedHidden) {
            try {
                if (layer.locked || !layer.visible) { return; }
            } catch (e) { return; }
        }
        var i;
        try {
            for (i = 0; i < layer.pageItems.length; i++) {
                walkItem(layer.pageItems[i], state, opt);
            }
        } catch (e1) {}
        try {
            for (i = 0; i < layer.layers.length; i++) {
                walkLayer(layer.layers[i], state, opt);
            }
        } catch (e2) {}
    }

    function collectAll(opt) {
        var state = makeCollector(opt);
        var i;
        if (opt.scope === "selection") {
            if (!doc.selection || doc.selection.length === 0) {
                state.emptySelection = true;
                return state;
            }
            for (i = 0; i < doc.selection.length; i++) {
                walkItem(doc.selection[i], state, opt);
            }
        } else if (opt.scope === "layer") {
            walkLayer(doc.activeLayer, state, opt);
        } else {
            for (i = 0; i < doc.layers.length; i++) {
                walkLayer(doc.layers[i], state, opt);
            }
        }
        return state;
    }

    // ------------------------------------------------------------------
    // Création des nuances / Swatch creation
    // ------------------------------------------------------------------
    function findSwatchGroupByName(name) {
        var i, g;
        try {
            for (i = 0; i < doc.swatchGroups.length; i++) {
                g = doc.swatchGroups[i];
                if (g.name === name) { return g; }
            }
        } catch (e) {}
        return null;
    }

    function uniqueSwatchName(base) {
        var name = base, n = 1, exists, i, sw;
        while (true) {
            exists = false;
            try {
                for (i = 0; i < doc.swatches.length; i++) {
                    sw = doc.swatches[i];
                    if (sw.name === name) { exists = true; break; }
                }
            } catch (e) {}
            if (!exists) { return name; }
            n++;
            name = base + " " + n;
        }
    }

    function clearGroupSwatches(group) {
        var list, i;
        try {
            list = group.getAllSwatches();
            // Supprimer de la fin vers le début / delete from end to start
            for (i = list.length - 1; i >= 0; i--) {
                try { list[i].remove(); } catch (e) {}
            }
        } catch (e2) {}
    }

    function addSwatches(state, opt) {
        var groupName = opt.groupName;
        var group = findSwatchGroupByName(groupName);
        var created = 0, reused = 0, skipped = 0, i, entry, sw, name, col;

        if (group && opt.overwrite) {
            clearGroupSwatches(group);
        }
        if (!group) {
            try {
                group = doc.swatchGroups.add();
                group.name = groupName;
            } catch (eG) {
                throw new Error(L("Impossible de créer le groupe de nuances « ",
                                  "Could not create swatch group \"") + groupName +
                                L(" ».", "\"."));
            }
        }

        for (i = 0; i < state.items.length; i++) {
            entry = state.items[i];
            name = autoName(entry.color, i + 1, opt.prefix);
            name = uniqueSwatchName(name);

            try {
                if (entry.typename === "SpotColor") {
                    // Réutilise le SpotColor existant (ajoute une nuance liée au ton).
                    // Reuse the existing SpotColor (add a swatch linked to the spot).
                    col = new SpotColor();
                    col.spot = entry.color.spot;
                    col.tint = 100;
                } else {
                    col = cloneProcess(entry.color);
                }
                sw = doc.swatches.add();
                sw.name = name;
                sw.color = col;
                try { group.addSwatch(sw); } catch (eAdd) {}
                created++;
            } catch (eSw) {
                skipped++;
            }
        }
        return { created: created, reused: reused, skipped: skipped, group: group, groupName: groupName };
    }

    // ------------------------------------------------------------------
    // Boîte de dialogue / Dialog
    // ------------------------------------------------------------------
    var dlg = new Window("dialog", TITLE);
    dlg.orientation = "column";
    dlg.alignChildren = ["fill", "top"];

    var tip = dlg.add("statictext", undefined,
        L("Conseil : travaillez sur une copie de votre fichier.",
          "Tip: work on a copy of your file."), { multiline: true });
    tip.preferredSize = [440, 20];

    var pScope = dlg.add("panel", undefined, L("Portée", "Scope"));
    pScope.orientation = "row";
    pScope.alignChildren = ["left", "center"];
    var rbDoc = pScope.add("radiobutton", undefined, L("Document entier", "Whole document"));
    var rbLayer = pScope.add("radiobutton", undefined, L("Calque actif", "Active layer"));
    var rbSel = pScope.add("radiobutton", undefined, L("Sélection", "Selection"));
    rbDoc.value = true;

    var pSrc = dlg.add("panel", undefined, L("Sources", "Sources"));
    pSrc.alignChildren = ["left", "top"];
    var cbFill = pSrc.add("checkbox", undefined, L("Fonds", "Fills"));
    var cbStroke = pSrc.add("checkbox", undefined, L("Contours", "Strokes"));
    var cbText = pSrc.add("checkbox", undefined, L("Textes (remplissage / contour des caractères)",
                                                   "Text (character fill / stroke)"));
    var cbGrad = pSrc.add("checkbox", undefined, L("Arrêts de dégradé", "Gradient stops"));
    cbFill.value = cbStroke.value = cbText.value = true;
    cbGrad.value = false;

    var pOpts = dlg.add("panel", undefined, L("Options", "Options"));
    pOpts.alignChildren = ["left", "top"];
    var cbSkip = pOpts.add("checkbox", undefined, L("Ignorer objets / calques verrouillés ou masqués",
                                                    "Skip locked or hidden objects / layers"));
    cbSkip.value = true;
    var gTol = pOpts.add("group");
    gTol.add("statictext", undefined, L("Tolérance (0 = stricte, 0–1) :", "Tolerance (0 = strict, 0–1):"));
    var etTol = gTol.add("edittext", undefined, "0");
    etTol.characters = 6;

    var pGroup = dlg.add("panel", undefined, L("Groupe de nuances", "Swatch group"));
    pGroup.alignChildren = ["fill", "top"];
    var gName = pGroup.add("group");
    gName.add("statictext", undefined, L("Nom :", "Name:"));
    var etGroup = gName.add("edittext", undefined, FR ? DEFAULT_GROUP_FR : DEFAULT_GROUP_EN);
    etGroup.characters = 28;
    var cbOverwrite = pGroup.add("checkbox", undefined,
        L("Écraser / vider un groupe du même nom s'il existe",
          "Overwrite / clear an existing group with the same name"));
    cbOverwrite.value = false;

    var pNames = dlg.add("panel", undefined, L("Noms des nuances", "Swatch names"));
    pNames.alignChildren = ["left", "top"];
    var rbAuto = pNames.add("radiobutton", undefined,
        L("Automatiques (RVB / CMJN / Gris / Lab ; noms de tons directs conservés)",
          "Automatic (RGB / CMYK / Gray / Lab; spot names kept)"));
    var gPref = pNames.add("group");
    var rbPrefix = gPref.add("radiobutton", undefined, L("Préfixe + index :", "Prefix + index:"));
    var etPrefix = gPref.add("edittext", undefined, FR ? "Couleur " : "Color ");
    etPrefix.characters = 12;
    rbAuto.value = true;

    rbAuto.onClick = function () { etPrefix.enabled = false; };
    rbPrefix.onClick = function () { etPrefix.enabled = true; };
    etPrefix.enabled = false;

    var stInfo = dlg.add("statictext", undefined,
        L("Cliquez sur Analyser pour compter les couleurs uniques sans rien modifier.",
          "Click Analyze to count unique colours without changing anything."),
        { multiline: true });
    stInfo.preferredSize = [440, 56];

    var gB = dlg.add("group");
    gB.alignment = ["right", "top"];
    var btAnalyze = gB.add("button", undefined, L("Analyser", "Analyze"));
    var btCancel = gB.add("button", undefined, L("Annuler", "Cancel"), { name: "cancel" });
    var btOk = gB.add("button", undefined, L("Extraire", "Extract"), { name: "ok" });

    // ------------------------------------------------------------------
    // Options UI / UI options
    // ------------------------------------------------------------------
    function readOptions() {
        var scope = "document";
        if (rbLayer.value) { scope = "layer"; }
        else if (rbSel.value) { scope = "selection"; }
        var tol = parseNum(etTol.text, 0);
        if (tol < 0) { tol = 0; }
        if (tol > 1) { tol = 1; }
        var gNameVal = String(etGroup.text || "").replace(/^\s+|\s+$/g, "");
        if (!gNameVal) { gNameVal = FR ? DEFAULT_GROUP_FR : DEFAULT_GROUP_EN; }
        var prefix = "";
        if (rbPrefix.value) {
            prefix = String(etPrefix.text || "");
        }
        return {
            scope: scope,
            fill: cbFill.value,
            stroke: cbStroke.value,
            text: cbText.value,
            grad: cbGrad.value,
            skipLockedHidden: cbSkip.value,
            tol: tol,
            groupName: gNameVal,
            overwrite: cbOverwrite.value,
            prefix: prefix
        };
    }

    function validateSources(opt) {
        if (!opt.fill && !opt.stroke && !opt.text && !opt.grad) {
            stInfo.text = L("Cochez au moins une source (fonds, contours, textes ou dégradés).",
                            "Tick at least one source (fills, strokes, text or gradients).");
            return false;
        }
        return true;
    }

    function summaryAnalyze(state, opt) {
        var lines = [];
        lines.push(L("Objets examinés : ", "Objects examined: ") + state.examined +
                   L(" — occurrences de couleur : ", " — colour hits: ") + state.found);
        lines.push(L("Couleurs uniques : ", "Unique colours: ") + state.items.length +
                   (opt.tol > 0 ? L(" (tolérance ", " (tolerance ") + fmt(opt.tol, 3) + ")" : ""));
        if (state.skipped > 0) {
            lines.push(L("Ignorés (verrouillés, masqués, images, symboles…) : ",
                         "Skipped (locked, hidden, images, symbols…): ") + state.skipped);
        }
        if (state.emptySelection) {
            lines.push(L("Sélection vide — rien à analyser.", "Empty selection — nothing to analyze."));
        }
        var maxShow = 8, i, more;
        if (state.items.length > 0) {
            lines.push(L("Aperçu :", "Preview:"));
            more = state.items.length > maxShow ? maxShow : state.items.length;
            for (i = 0; i < more; i++) {
                lines.push("  • " + state.items[i].label);
            }
            if (state.items.length > maxShow) {
                lines.push("  … +" + (state.items.length - maxShow));
            }
        }
        return lines.join("\n");
    }

    btAnalyze.onClick = function () {
        var opt = readOptions();
        if (!validateSources(opt)) { return; }
        var state = collectAll(opt);
        stInfo.text = summaryAnalyze(state, opt);
    };

    btOk.onClick = function () {
        var opt = readOptions();
        if (!validateSources(opt)) { return; }
        if (opt.scope === "selection" && (!doc.selection || doc.selection.length === 0)) {
            stInfo.text = L("Sélection vide. Choisissez une autre portée ou sélectionnez des objets.",
                            "Empty selection. Choose another scope or select objects.");
            return;
        }
        dlg.close(1);
    };

    if (dlg.show() !== 1) { return; }

    // ------------------------------------------------------------------
    // Application / Apply
    // ------------------------------------------------------------------
    var opt = readOptions();
    var state = collectAll(opt);

    if (state.items.length === 0) {
        alert(L("Aucune couleur utilisable trouvée dans la portée choisie.\nRien n'a été modifié.",
                "No usable colour found in the chosen scope.\nNothing was changed."),
              TITLE);
        return;
    }

    var result;
    try {
        app.redraw();
        try { app.beginUndoGroup(TITLE); } catch (eU0) {}
        result = addSwatches(state, opt);
        try { app.endUndoGroup(); } catch (eU1) {}
    } catch (err) {
        try { app.endUndoGroup(); } catch (eU2) {}
        alert(L("Erreur pendant l'extraction : ", "Error while extracting: ") + err +
              L("\nAnnulez avec Ctrl+Z / Cmd+Z si besoin.",
                "\nUndo with Ctrl+Z / Cmd+Z if needed."), TITLE);
        return;
    }
    app.redraw();

    var msg = [];
    msg.push(L("Groupe « ", "Group \"") + result.groupName + L(" »", "\""));
    msg.push(L("Nuances ajoutées : ", "Swatches added: ") + result.created +
             L(" / ", " / ") + state.items.length + L(" couleurs uniques.", " unique colours."));
    if (result.skipped > 0) {
        msg.push(L("Non ajoutées (conflit ou erreur) : ", "Not added (conflict or error): ") + result.skipped);
    }
    msg.push(L("Objets examinés : ", "Objects examined: ") + state.examined);
    msg.push("");
    msg.push(L("Annuler : Ctrl+Z / Cmd+Z (une opération).",
               "Undo: Ctrl+Z / Cmd+Z (one operation)."));
    alert(msg.join("\n"), TITLE);

})();
