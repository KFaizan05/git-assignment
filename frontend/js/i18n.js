(function initI18n() {
  "use strict";

  var LANGUAGE_STORAGE_KEY = "labelwiseLanguage";
  var LANGUAGES = {
    English: "en",
    "Español": "es",
    "Français": "fr"
  };

  var DICTIONARY = {
    en: {},
    es: {
      "Welcome Back!": "¡Bienvenido de nuevo!",
      Login: "Iniciar sesión",
      "Sign Up": "Registrarse",
      Email: "Correo electrónico",
      Password: "Contraseña",
      "Forgot password?": "¿Olvidaste tu contraseña?",
      or: "o",
      "Create Account": "Crear cuenta",
      "Confirm Password": "Confirmar contraseña",
      "Welcome back!": "¡Bienvenido de nuevo!",
      "Let's find safe food for you": "Encontremos alimentos seguros para ti",
      "Quick Actions": "Acciones rápidas",
      "Scan Product": "Escanear producto",
      "Your Dietary Profile": "Tu perfil alimentario",
      Edit: "Editar",
      "Recent Scans": "Escaneos recientes",
      "View All": "Ver todo",
      "My Safe Items": "Mis productos seguros",
      "View all approved products": "Ver todos los productos aprobados",
      Home: "Inicio",
      Scan: "Escanear",
      History: "Historial",
      "No profile selections yet": "Aún no hay selecciones de perfil",
      "No scans yet. Tap Scan Product to get started.":
        "Aún no hay escaneos. Toca Escanear producto para comenzar.",
      "No scans yet. Tap": "Aún no hay escaneos. Toca",
      "to get started.": "para comenzar.",
      Settings: "Configuración",
      Profile: "Perfil",
      "Personal Information": "Información personal",
      "Name, dietary preferences, allergens":
        "Nombre, preferencias alimentarias, alérgenos",
      Preferences: "Preferencias",
      Language: "Idioma",
      Notifications: "Notificaciones",
      "Scan alerts and updates": "Alertas y actualizaciones de escaneo",
      Support: "Soporte",
      "Help Center": "Centro de ayuda",
      "FAQs and support": "Preguntas frecuentes y soporte",
      "About LabelWise": "Acerca de LabelWise",
      Legal: "Legal",
      "Privacy Policy": "Política de privacidad",
      "Terms of Service": "Términos del servicio",
      "Log Out": "Cerrar sesión",
      "Select Language": "Seleccionar idioma",
      "Analyzing Ingredients": "Analizando ingredientes",
      "Reading the label...": "Leyendo la etiqueta...",
      "Image captured": "Imagen capturada",
      "Reading ingredients...": "Leyendo ingredientes...",
      "Analyzing safety": "Analizando seguridad",
      "Unreadable scan": "Escaneo ilegible",
      "We couldn't read any ingredients from that image.":
        "No pudimos leer ningún ingrediente de esa imagen.",
      Cancel: "Cancelar",
      "Try Again": "Intentar de nuevo",
      "Scan Results": "Resultados del escaneo",
      "Scanned Product": "Producto escaneado",
      "Brand: Unknown": "Marca: desconocida",
      "Caution Required": "Se requiere precaución",
      "This product may contain concerning ingredients.":
        "Este producto puede contener ingredientes preocupantes.",
      "Raw Text": "Texto sin procesar",
      "No text found.": "No se encontró texto.",
      "Ingredient Analysis": "Análisis de ingredientes",
      "Safe Alternatives": "Alternativas seguras",
      "Similar products that match your preferences":
        "Productos similares que coinciden con tus preferencias",
      "Last Scanned:": "Último escaneo:",
      "No alternatives to show yet": "Aún no hay alternativas para mostrar",
      "Scan a Product": "Escanear un producto",
      "Back to Home": "Volver al inicio",
      "AI Chef": "Chef IA",
      "Your personal recipe assistant": "Tu asistente personal de recetas",
      "Welcome to AI Chef!": "¡Bienvenido a Chef IA!",
      "Based on Your Profile": "Basado en tu perfil",
      "Try asking me...": "Prueba preguntándome...",
      "Ask me for a recipe...": "Pídeme una receta...",
      "No dietary preferences set yet. Update your profile to get personalized recipes.":
        "Aún no hay preferencias alimentarias. Actualiza tu perfil para obtener recetas personalizadas.",
      "Quick dinner idea": "Idea rápida para la cena",
      "Something easy for tonight": "Algo fácil para esta noche",
      "Breakfast recipe": "Receta de desayuno",
      "Start my day with something safe": "Comenzar mi día con algo seguro",
      "Healthy snack": "Snack saludable",
      "A snack that fits my profile": "Un snack que se ajusta a mi perfil",
      "Use what I have": "Usar lo que tengo",
      "Turn my safe items into a meal": "Convertir mis productos seguros en una comida",
      "Comfort food": "Comida reconfortante",
      "Cozy meals that work for me": "Comidas reconfortantes que me funcionen",
      "Meal prep ideas": "Ideas para preparar comidas",
      "Batch-friendly recipes for the week": "Recetas por lotes para la semana",
      "AI Chef Recipe": "Receta de Chef IA",
      "No recipe yet": "Aún no hay receta",
      "Back to AI Chef": "Volver a Chef IA",
      "Crop Image": "Recortar imagen",
      "Drag corners to adjust crop area":
        "Arrastra las esquinas para ajustar el área de recorte",
      "Ingredient Scanner": "Escáner de ingredientes",
      "Align the ingredient label within the frame":
        "Alinea la etiqueta de ingredientes dentro del marco",
      Paste: "Pegar",
      "Camera access needed": "Se necesita acceso a la cámara",
      Analyze: "Analizar",
      "Paste ingredients": "Pegar ingredientes",
      "Create Profile": "Crear perfil",
      Name: "Nombre",
      "Dietary Preferences": "Preferencias alimentarias",
      "Allergens to Avoid": "Alérgenos a evitar",
      "Custom Allergens": "Alérgenos personalizados",
      Add: "Agregar",
      "Get Started": "Comenzar",
      "Edit Profile": "Editar perfil",
      "Save Changes": "Guardar cambios",
      Vegan: "Vegano",
      Vegetarian: "Vegetariano",
      "Gluten-Free": "Sin gluten",
      "Dairy-Free": "Sin lácteos",
      Peanuts: "Cacahuates",
      "Tree Nuts": "Frutos secos",
      Milk: "Leche",
      Eggs: "Huevos",
      Soy: "Soya",
      Wheat: "Trigo",
      Fish: "Pescado",
      Shellfish: "Mariscos",
      Sesame: "Sésamo",
      "Scan History": "Historial de escaneos",
      "Your previously scanned products": "Tus productos escaneados anteriormente",
      Safe: "Seguro",
      Unsafe: "No seguro",
      Caution: "Precaución",
      "No scans yet": "Aún no hay escaneos",
      "Products approved for you": "Productos aprobados para ti",
      "Total Safe": "Total seguros",
      Favorites: "Favoritos",
      Categories: "Categorías",
      "All Safe Products": "Todos los productos seguros",
      "No safe items yet": "Aún no hay productos seguros",
      "Scan New Product": "Escanear nuevo producto",
      "View Details": "Ver detalles",
      "Find Similar": "Buscar similares",
      Favorite: "Favorito",
      Unfavorite: "Quitar favorito"
    },
    fr: {
      "Welcome Back!": "Bon retour !",
      Login: "Connexion",
      "Sign Up": "S'inscrire",
      Email: "E-mail",
      Password: "Mot de passe",
      "Forgot password?": "Mot de passe oublié ?",
      or: "ou",
      "Create Account": "Créer un compte",
      "Confirm Password": "Confirmer le mot de passe",
      "Welcome back!": "Bon retour !",
      "Let's find safe food for you": "Trouvons des aliments sûrs pour vous",
      "Quick Actions": "Actions rapides",
      "Scan Product": "Scanner un produit",
      "Your Dietary Profile": "Votre profil alimentaire",
      Edit: "Modifier",
      "Recent Scans": "Scans récents",
      "View All": "Voir tout",
      "My Safe Items": "Mes produits sûrs",
      "View all approved products": "Voir tous les produits approuvés",
      Home: "Accueil",
      Scan: "Scanner",
      History: "Historique",
      "No profile selections yet": "Aucune sélection de profil pour l'instant",
      "No scans yet. Tap Scan Product to get started.":
        "Aucun scan pour l'instant. Appuyez sur Scanner un produit pour commencer.",
      "No scans yet. Tap": "Aucun scan pour l'instant. Appuyez sur",
      "to get started.": "pour commencer.",
      Settings: "Paramètres",
      Profile: "Profil",
      "Personal Information": "Informations personnelles",
      "Name, dietary preferences, allergens":
        "Nom, préférences alimentaires, allergènes",
      Preferences: "Préférences",
      Language: "Langue",
      Notifications: "Notifications",
      "Scan alerts and updates": "Alertes et mises à jour de scan",
      Support: "Assistance",
      "Help Center": "Centre d'aide",
      "FAQs and support": "FAQ et assistance",
      "About LabelWise": "À propos de LabelWise",
      Legal: "Mentions légales",
      "Privacy Policy": "Politique de confidentialité",
      "Terms of Service": "Conditions d'utilisation",
      "Log Out": "Se déconnecter",
      "Select Language": "Choisir la langue",
      "Analyzing Ingredients": "Analyse des ingrédients",
      "Reading the label...": "Lecture de l'étiquette...",
      "Image captured": "Image capturée",
      "Reading ingredients...": "Lecture des ingrédients...",
      "Analyzing safety": "Analyse de la sécurité",
      "Unreadable scan": "Scan illisible",
      "We couldn't read any ingredients from that image.":
        "Nous n'avons pas pu lire les ingrédients de cette image.",
      Cancel: "Annuler",
      "Try Again": "Réessayer",
      "Scan Results": "Résultats du scan",
      "Scanned Product": "Produit scanné",
      "Brand: Unknown": "Marque : inconnue",
      "Caution Required": "Prudence requise",
      "This product may contain concerning ingredients.":
        "Ce produit peut contenir des ingrédients préoccupants.",
      "Raw Text": "Texte brut",
      "No text found.": "Aucun texte trouvé.",
      "Ingredient Analysis": "Analyse des ingrédients",
      "Safe Alternatives": "Alternatives sûres",
      "Similar products that match your preferences":
        "Produits similaires correspondant à vos préférences",
      "Last Scanned:": "Dernier scan :",
      "No alternatives to show yet": "Aucune alternative à afficher pour l'instant",
      "Scan a Product": "Scanner un produit",
      "Back to Home": "Retour à l'accueil",
      "AI Chef": "Chef IA",
      "Your personal recipe assistant": "Votre assistant personnel de recettes",
      "Welcome to AI Chef!": "Bienvenue dans Chef IA !",
      "Based on Your Profile": "Selon votre profil",
      "Try asking me...": "Essayez de me demander...",
      "Ask me for a recipe...": "Demandez-moi une recette...",
      "No dietary preferences set yet. Update your profile to get personalized recipes.":
        "Aucune préférence alimentaire définie. Mettez à jour votre profil pour obtenir des recettes personnalisées.",
      "Quick dinner idea": "Idée de dîner rapide",
      "Something easy for tonight": "Quelque chose de simple pour ce soir",
      "Breakfast recipe": "Recette de petit-déjeuner",
      "Start my day with something safe": "Commencer ma journée avec quelque chose de sûr",
      "Healthy snack": "Collation saine",
      "A snack that fits my profile": "Une collation adaptée à mon profil",
      "Use what I have": "Utiliser ce que j'ai",
      "Turn my safe items into a meal": "Transformer mes produits sûrs en repas",
      "Comfort food": "Plat réconfortant",
      "Cozy meals that work for me": "Repas réconfortants qui me conviennent",
      "Meal prep ideas": "Idées de meal prep",
      "Batch-friendly recipes for the week": "Recettes en lot pour la semaine",
      "AI Chef Recipe": "Recette Chef IA",
      "No recipe yet": "Pas encore de recette",
      "Back to AI Chef": "Retour à Chef IA",
      "Crop Image": "Rogner l'image",
      "Drag corners to adjust crop area":
        "Faites glisser les coins pour ajuster la zone de rognage",
      "Ingredient Scanner": "Scanner d'ingrédients",
      "Align the ingredient label within the frame":
        "Alignez l'étiquette des ingrédients dans le cadre",
      Paste: "Coller",
      "Camera access needed": "Accès à la caméra requis",
      Analyze: "Analyser",
      "Paste ingredients": "Coller les ingrédients",
      "Create Profile": "Créer un profil",
      Name: "Nom",
      "Dietary Preferences": "Préférences alimentaires",
      "Allergens to Avoid": "Allergènes à éviter",
      "Custom Allergens": "Allergènes personnalisés",
      Add: "Ajouter",
      "Get Started": "Commencer",
      "Edit Profile": "Modifier le profil",
      "Save Changes": "Enregistrer les modifications",
      Vegan: "Végétalien",
      Vegetarian: "Végétarien",
      "Gluten-Free": "Sans gluten",
      "Dairy-Free": "Sans produits laitiers",
      Peanuts: "Arachides",
      "Tree Nuts": "Fruits à coque",
      Milk: "Lait",
      Eggs: "Oeufs",
      Soy: "Soja",
      Wheat: "Blé",
      Fish: "Poisson",
      Shellfish: "Crustacés",
      Sesame: "Sésame",
      "Scan History": "Historique des scans",
      "Your previously scanned products": "Vos produits scannés précédemment",
      Safe: "Sûr",
      Unsafe: "Dangereux",
      Caution: "Prudence",
      "No scans yet": "Aucun scan pour l'instant",
      "Products approved for you": "Produits approuvés pour vous",
      "Total Safe": "Total sûrs",
      Favorites: "Favoris",
      Categories: "Catégories",
      "All Safe Products": "Tous les produits sûrs",
      "No safe items yet": "Aucun produit sûr pour l'instant",
      "Scan New Product": "Scanner un nouveau produit",
      "View Details": "Voir les détails",
      "Find Similar": "Trouver des similaires",
      Favorite: "Favori",
      Unfavorite: "Retirer des favoris"
    }
  };

  function getLanguageName() {
    var saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return LANGUAGES[saved] ? saved : "English";
  }

  function getLanguageCode() {
    return LANGUAGES[getLanguageName()] || "en";
  }

  function saveLanguage(name) {
    if (!LANGUAGES[name]) return;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, name);
  }

  function normalize(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function applyDynamicPatterns(text, lang) {
    if (lang === "en") return text;

    var m;
    m = text.match(/^Welcome back,\s*(.+)!$/);
    if (m) {
      return lang === "es"
        ? "¡Bienvenido de nuevo, " + m[1] + "!"
        : "Bon retour, " + m[1] + " !";
    }
    m = text.match(/^Ingredients Detected:\s*(\d+)$/);
    if (m) {
      return lang === "es"
        ? "Ingredientes detectados: " + m[1]
        : "Ingrédients détectés : " + m[1];
    }
    m = text.match(/^(\d+)\s+min ago$/);
    if (m) return lang === "es" ? "hace " + m[1] + " min" : "il y a " + m[1] + " min";
    m = text.match(/^(\d+)\s+hours?\s+ago$/);
    if (m) return lang === "es" ? "hace " + m[1] + " hora(s)" : "il y a " + m[1] + " h";
    m = text.match(/^(\d+)\s+days?\s+ago$/);
    if (m) return lang === "es" ? "hace " + m[1] + " día(s)" : "il y a " + m[1] + " jour(s)";
    m = text.match(/^(\d+)\s+weeks?\s+ago$/);
    if (m) return lang === "es" ? "hace " + m[1] + " semana(s)" : "il y a " + m[1] + " semaine(s)";
    if (text === "just now") return lang === "es" ? "justo ahora" : "à l'instant";

    return text;
  }

  function translateText(text) {
    var lang = getLanguageCode();
    if (lang === "en") return text;
    var cleaned = normalize(text);
    if (!cleaned) return text;
    var translated =
      (DICTIONARY[lang] && DICTIONARY[lang][cleaned]) ||
      applyDynamicPatterns(cleaned, lang);
    if (!translated) return text;
    return text.replace(cleaned, translated);
  }

  var isApplyingTranslations = false;

  function translateElementTree(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node || !node.nodeValue || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        var tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var node;
    while ((node = walker.nextNode())) {
      var next = translateText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }

    var attrs = ["placeholder", "title", "aria-label"];
    var all = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (var i = 0; i < all.length; i++) {
      for (var j = 0; j < attrs.length; j++) {
        var attr = attrs[j];
        var val = all[i].getAttribute(attr);
        if (!val) continue;
        all[i].setAttribute(attr, translateText(val));
      }
    }
  }

  function applyPageLanguage() {
    document.documentElement.lang = getLanguageCode();
    isApplyingTranslations = true;
    try {
      translateElementTree(document.body || document.documentElement);
    } finally {
      isApplyingTranslations = false;
    }
  }

  function t(text) {
    return translateText(text);
  }

  window.i18n = {
    key: LANGUAGE_STORAGE_KEY,
    getLanguageName: getLanguageName,
    getLanguageCode: getLanguageCode,
    saveLanguage: saveLanguage,
    applyPageLanguage: applyPageLanguage,
    t: t
  };

  document.addEventListener("DOMContentLoaded", function () {
    applyPageLanguage();
    if (!document.body || !window.MutationObserver) return;
    var observer = new MutationObserver(function (list) {
      if (isApplyingTranslations) return;
      for (var i = 0; i < list.length; i++) {
        var rec = list[i];
        if (rec.type === "childList") {
          for (var n = 0; n < rec.addedNodes.length; n++) {
            var added = rec.addedNodes[n];
            if (added.nodeType === 1) {
              isApplyingTranslations = true;
              try {
                translateElementTree(added);
              } finally {
                isApplyingTranslations = false;
              }
            }
            if (added.nodeType === 3) {
              var translated = translateText(added.nodeValue);
              if (translated !== added.nodeValue) added.nodeValue = translated;
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
