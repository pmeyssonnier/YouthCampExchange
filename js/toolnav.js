// toolnav.js — menu commun des outils (formulaire, suivi, coffre, administration) avec retour au site.
// Inséré juste sous l'en-tête. Sur le formulaire d'un candidat ou d'un président de club,
// seul le lien vers le site s'affiche : les outils des coordinateurs n'y ont pas leur place.
"use strict";
(function(){
  const header = document.querySelector("header");
  if(!header) return;
  const here = location.pathname.split("/").pop() || "index.html";
  const q = new URLSearchParams(location.search);
  const staff = here !== "yce_form_filler.html" || q.has("admin") || q.get("sign") === "district";
  const links = staff ? [
    ["index.html", "🏠 Site"],
    ["yce_form_filler.html?admin", "📝 Form filler"],
    ["yce_tracker.html", "📋 Tracker"],
    ["yce_vault.html", "🔐 Vault"],
    ["yce_admin.html", "⚙️ Administration"]
  ] : [["index.html", "← Lions YCE Belgium site"]];
  const nav = document.createElement("nav");
  nav.className = "toolnav";
  nav.setAttribute("aria-label", "Tools");
  links.forEach(function(l){
    const a = document.createElement("a");
    a.href = l[0]; a.textContent = l[1];
    if(l[0].split("?")[0] === here){ a.className = "on"; a.setAttribute("aria-current", "page"); }
    nav.appendChild(a);
  });
  header.insertAdjacentElement("afterend", nav);
})();
