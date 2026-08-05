// sections.js — définition déclarative du formulaire (SECTIONS), liste des camps, drapeaux de mode
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
// Liste (pays, camp) dérivée de camps_data.js (RAW) — plus de duplication des données
const CAMPS=(typeof RAW!=="undefined")?(function(){
  const seen={},out=[];
  RAW.forEach(function(c){const k=c.country+"|"+c.camp_name;if(seen[k])return;seen[k]=1;out.push({c:c.country,n:c.camp_name});});
  out.sort(function(a,b){return a.c===b.c?(a.n<b.n?-1:1):(a.c<b.c?-1:1);});
  return out;
})():[];

const IS_ADMIN=new URLSearchParams(location.search).has("admin");
const SIGN_CLUB=(new URLSearchParams(location.search).get("sign")||"").toLowerCase()==="club";

// ---------------------------------------------------------------
// Définition des sections et champs (ref = cellule cible du xlsx)
// ---------------------------------------------------------------
const SECTIONS = [
 {title:"File header", note:"row 1 — automatically copied to the footer", fields:[
   {ref:"Q1",label:"Year",type:"number",w:1,numeric:true},
   {ref:"V1",label:"Country",type:"text",w:1},
   {ref:"AB1",label:"MD",type:"text",w:1,numeric:true},
   {ref:"AF1",label:"District",type:"text",w:1},
   {ref:"AI1",label:"Nr. (file number)",type:"text",w:2},
 ]},
 {title:"I. Preferred Youth Camp and Exchange Alternatives", fields:[
   {ref:"Q9",label:"Possible dates — From",type:"date",w:3},
   {ref:"AC9",label:"Possible dates — To",type:"date",w:3},
   {ref:"N10",label:"1st Country preference",type:"text",list:"dl-countries",w:2,oninput:"syncCamps(1)",id:"ctry1",ph:"e.g. Turkey - Istanbul"},
   {ref:"AC10",label:"1st Camp preference",type:"text",list:"dl-camp1",w:4},
   {ref:"N11",label:"2nd Country preference",type:"text",list:"dl-countries",w:2,oninput:"syncCamps(2)",id:"ctry2"},
   {ref:"AC11",label:"2nd Camp preference",type:"text",list:"dl-camp2",w:4},
   {ref:"N12",label:"3rd Country preference",type:"text",list:"dl-countries",w:2,oninput:"syncCamps(3)",id:"ctry3"},
   {ref:"AC12",label:"3rd Camp preference",type:"text",list:"dl-camp3",w:4},
   {ref:"N13",label:"Final destination (only for YCEC!)",type:"text",w:3},
   {xgroup:"dest",label:"Stay type",w:3,none:true,opts:[{lbl:"Family & camp",ref:"AC13"},{lbl:"Family only",ref:"AJ13"}]},
 ]},
 {title:"II. Applicant's Basic Data", note:"if not available yet, write “in request”", fields:[
   {ref:"F16",label:"Family Name",type:"text",req:true,w:2},
   {ref:"S16",label:"First Name",type:"text",req:true,w:2},
   {ref:"AD16",label:"Nickname",type:"text",w:2},
   {ref:"J17",label:"Male / Female / Other",type:"select",opts:["","M","F","X"],w:2},
   {ref:"X17",label:"Date of birth",type:"date",w:2},
   {ref:"G22",label:"Nationality",type:"text",w:2},
   {ref:"G18",label:"Street address",type:"text",w:6},
   {ref:"G19",label:"Postal code",type:"text",w:1,half:true},
   {ref:"S19",label:"Town",type:"text",w:2,half:true},
   {ref:"AF19",label:"State / Province",type:"text",w:1},
   {ref:"G20",label:"Country",type:"text",w:2},
   {ref:"S20",label:"Email",type:"email",w:3,ph:"first.last@example.be"},
   {ref:"G21",label:"Phone (home)",type:"tel",w:3},
   {ref:"S21",label:"Mobile",type:"tel",w:3},
   {ref:"X22",label:"Passport / ID / CNI number",type:"text",w:3},
   {ref:"G23",label:"Valid until",type:"date",w:3},
   {ref:"X23",label:"Place of issue",type:"text",w:3},
   {xgroup:"prev",card:true,label:"Previously participated in a Lions Youth Exchange?",w:3,opts:[{lbl:"Yes",ref:"AD24"},{lbl:"No",ref:"AI24"}]},
   {ref:"J25",label:"If yes, where and when?",type:"text",w:3,dep:"prev"},
   {ref:"J26",label:"Hobbies & other interests",type:"text",w:6},
   {xgroup:"engl",label:"Knowledge of English",w:3,opts:[{lbl:"Good",ref:"L27"},{lbl:"Fair",ref:"P27"},{lbl:"None",ref:"T27"}]},

   {ref:"AF27",label:"T-shirt size",type:"pills",opts:["S","M","L","XL","XXL"],w:3},
   {ref:"J28",label:"Other languages spoken",type:"text",w:6},
   {ref:"J29",label:"Field of study",type:"text",w:2},
   {ref:"J30",label:"Career objective",type:"text",w:2},
   {ref:"J31",label:"Religion",type:"text",w:2},
   {xgroup:"leo",card:true,label:"Are you a LEO?",w:6,opts:[{lbl:"Yes",ref:"AA31"},{lbl:"No",ref:"AG31"}]},
 ]},
 {title:"Attachments", note:"compulsory with the application", fields:[
   {photo:true,label:"Applicant's pass photo (JPG)",w:3},
   {payproof:true,label:"Proof of payment of the administrative fees",w:3},
   {download:true,label:"Letter to your (still unknown) host family",w:3},
   {commitCard:true,label:"Commitment to Reciprocity (signed)",w:3},
 ]},
 {title:"III. Health, Medical, Dietary & Insurance Data", fields:[
   {ref:"K42",label:"State of health, in general",type:"select",opts:["","Excellent","Very good","Good","Fair","Poor"],w:4},
   {ref:"AH44",label:"Height (cm)",type:"number",w:2,numeric:true},
   {ref:"S43",label:"Sport activities?",type:"ynbtn",w:2},
   {ref:"AG43",label:"Can you swim?",type:"ynbtn",w:2},
   {ref:"G44",label:"Do you smoke?",type:"ynbtn",w:2},
   {ref:"O44",label:"Vegetarian?",type:"ynbtn",w:2},
   {ref:"Z44",label:"Vegan?",type:"ynbtn",w:2},
   {xgroup:"med1",card:true,label:"Medical / mental condition(s)",w:3,opts:[{lbl:"No",ref:"M45"},{lbl:"Yes",ref:"Q45"}],specify:"X45"},
   {ref:"X45",label:"If yes: specify",type:"text",w:3,dep:"med1"},
   {xgroup:"med2",card:true,label:"Special medication",w:3,opts:[{lbl:"No",ref:"M46"},{lbl:"Yes",ref:"Q46"}],specify:"X46"},
   {ref:"X46",label:"If yes: specify",type:"text",w:3,dep:"med2"},
   {xgroup:"med3",card:true,label:"Medical / religious / other dietary requirements",w:3,opts:[{lbl:"No",ref:"M47"},{lbl:"Yes",ref:"Q47"}],specify:"X47"},
   {ref:"X47",label:"If yes: specify",type:"text",w:3,dep:"med3"},
   {xgroup:"med4",card:true,label:"Allergies (animal, insect, food…)",w:3,opts:[{lbl:"No",ref:"M48"},{lbl:"Yes",ref:"Q48"}],specify:"X48"},
   {ref:"X48",label:"If yes: specify",type:"text",w:3,dep:"med4"},
   {ref:"K49",label:"Health insurance company",type:"text",w:3},
   {ref:"AB49",label:"Policy no",type:"text",w:3},
   {ref:"K50",label:"Liability insurance company",type:"text",w:3},
   {ref:"AB50",label:"Policy no",type:"text",w:3},
   {ref:"K51",label:"Any other point to be noticed",type:"text",w:6},
   {ref:"Q53",label:"Family doctor — name",type:"text",w:2},
   {ref:"E54",label:"Doctor — e-mail",type:"email",w:2},
   {ref:"AB54",label:"Doctor — mobile",type:"tel",w:2},
 ]},
 {title:"IV. Applicant's Family Data", note:"family contact information", fields:[
   {ref:"M57",label:"Parent / guardian signing this form",type:"text",w:3},
   {ref:"AI57",label:"Lion?",type:"ynbtn",w:1},
   {ref:"J61",label:"Age on 01/07/2026",type:"text",w:2},
   {ref:"H62",label:"Contact address",type:"text",w:6},
   {ref:"K63",label:"Contact phone",type:"tel",w:3},
   {ref:"AD63",label:"Contact mobile",type:"tel",w:3},
   {ref:"P64",label:"Emergency e-mail",type:"email",w:3},
   {ref:"AF64",label:"Emergency mobile",type:"tel",w:3},
 ]},
 {title:"V. Responsible Lions Club Data", fields:[
   {ref:"F67",label:"Lions Club",type:"text",w:3},
   {ref:"AE67",label:"District",type:"text",w:1},
   {ref:"H68",label:"Club chairperson",type:"text",w:2},
   {ref:"AE68",label:"Chairperson mobile",type:"tel",w:3},
   {ref:"E69",label:"Club e-mail",type:"email",w:3},
   {xgroup:"fin",label:"Basis of financing of the exchange",w:6,none:true,opts:[{lbl:"By applicant",ref:"S72"},{lbl:"By family",ref:"Y72"},{lbl:"By sponsor club",ref:"AG72"},{lbl:"Others",ref:"AK72"}]},
 ]},
 {title:"VI. Lions Multi District or District Data", note:"prefilled from the loaded district template", fields:[
   {ref:"I78",label:"District YCE chairperson",type:"text",w:3},
   {ref:"AH78",label:"District: D or MD Nr.",type:"text",w:3},
   {ref:"E79",label:"E-mail",type:"email",w:3},
   {ref:"E80",label:"Mobile",type:"tel",w:3},
 ]},
 {title:"VII. Authorized YCE Chairperson & Controller", closed:true, noCount:true, note:"prefilled from the loaded district template", fields:[
   {ref:"E85",label:"Name",type:"text",w:3},
   {ref:"AH85",label:"District: D or MD Nr.",type:"text",w:3},
   {ref:"E86",label:"E-mail",type:"email",w:3},
   {ref:"E87",label:"Mobile",type:"tel",w:3},
 ]},
 {title:"X. GDPR Information & Consent", closed:true, noCount:true, note:"European countries only — prefilled when present in the template", fields:[
   {ref:"L100",label:"Are you from a country of Europe?",type:"ynbtn",yn:["YES","NO"],w:2},
   {ref:"F104",label:"D/MD Name",type:"text",w:4},
   {ref:"A108",label:"Controller — name",type:"text",w:2},
   {ref:"F109",label:"Controller — mobile",type:"tel",w:2},
   {ref:"R109",label:"Controller — e-mail",type:"email",w:2},
   {ref:"F112",label:"Data protection officer — name",type:"text",w:2},
   {ref:"R112",label:"DPO — address",type:"text",w:4},
   {ref:"F113",label:"DPO — mobile",type:"tel",w:2},
   {ref:"R113",label:"DPO — e-mail",type:"email",w:4},
 ]},
 {title:"XI. DPA Information", closed:true, noCount:true, note:"D/MD data protection authority", fields:[
   {ref:"F119",label:"Name",type:"text",w:3},
   {ref:"F120",label:"URL",type:"text",w:3},
   {ref:"F121",label:"Phone",type:"tel",w:2},
   {ref:"F122",label:"Address",type:"text",w:4},
   {ref:"F123",label:"E-mail",type:"email",w:6},
 ]},
 {title:"XII. Signatures", note:"names are computed automatically in Excel — sign on screen, the date fills in automatically"+(IS_ADMIN?" (officials\u2019 signatures unlocked)":""), fields:[
   {sig:"applicant",label:"Applicant signature",dateRef:"AB126",row:126,w:3},
   {sig:"parent",label:"Parent / guardian signature",dateRef:"AB128",row:128,w:3},
   {ref:"AB126",label:"Applicant — date",type:"date",w:3},
   {ref:"AB128",label:"Parent / guardian — date",type:"date",w:3},
   {sig:"club",label:"Club representative signature",dateRef:"AB130",row:130,w:2,adm:true,clubSign:true},
   {sig:"mdyce",label:"MD or D YCE signature",dateRef:"AB132",row:132,w:2,adm:true},
   {sig:"authycec",label:"Auth. YCE chairperson signature",dateRef:"AB134",row:134,w:2,adm:true},
   {ref:"AB130",label:"Club representative — date",type:"date",w:2,adm:true,clubSign:true},
   {ref:"AB132",label:"MD or D YCE — date",type:"date",w:2,adm:true},
   {ref:"AB134",label:"Auth. YCE chairperson — date",type:"date",w:2,adm:true},
 ]},
];
SECTIONS.push({title:"Commitment to Reciprocity", note:"read and validate — replaces the printed & signed copy", commitBlock:true, fields:[]});

// -------------------- rendu du formulaire --------------------
