// admin-tabs.js — onglets de yce_admin.html : Site & season, Camps, Documents.
// L'onglet est repris de l'adresse (#site, #camps, #docs) : l'ancienne page yce_camps.html renvoie vers #camps.
// Chargé en dernier, après admin.js et camps-manager.js.
"use strict";
const ADMIN_TABS = ["site", "camps", "docs"];
let ADMIN_TAB = "site";
function showTab(t){
  if(ADMIN_TABS.indexOf(t) < 0) t = "site";
  ADMIN_TAB = t;
  ADMIN_TABS.forEach(function(k){ document.getElementById("tab-" + k).classList.toggle("on", k === t); });
  document.querySelectorAll("[data-tab]").forEach(function(el){ el.style.display = el.getAttribute("data-tab") === t ? "" : "none"; });
  // Site et Documents demandent la connexion ; les camps se consultent et se sauvegardent en JSON sans elle
  const connected = document.getElementById("panel").style.display !== "none";
  document.getElementById("need-connect").style.display = (t !== "camps" && !connected) ? "" : "none";
  try{ history.replaceState(null, "", "#" + t); }catch(e){}
}
ON_CONNECT.push(function(){ showTab(ADMIN_TAB); });
ON_LOGOUT.push(function(){ showTab(ADMIN_TAB); });
window.addEventListener("hashchange", function(){ showTab(location.hash.slice(1)); });
showTab(location.hash.slice(1) || "site");
