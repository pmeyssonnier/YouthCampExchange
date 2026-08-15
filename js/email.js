// email.js — e-mails pré-rédigés (président de club, coordinateur de district)
// Chargé par yce_form_filler.html ; scripts classiques partageant la portée globale.
"use strict";
const MAIL_INFO={fam:"",fir:"",files:[]};
function openMail(url){location.href=url;}
function mailPresident(){
  const to=(document.getElementById("f-E69")||{}).value||"";
  const signUrl=location.href.split(/[?#]/)[0]+"?sign=club";
  const mobile=(document.getElementById("f-S21")||{}).value||"";
  const subject="YCE "+YEAR+" Application - "+MAIL_INFO.fir+" "+MAIL_INFO.fam+" - club signature required";
  const body=
"Dear President,\n\n"
+"Please find attached my application file for the Lions Youth Camp & Exchange "+YEAR+" programme, sponsored by our club:\n"
+MAIL_INFO.files.map(function(f){return "- "+f;}).join("\n")
+((MAIL_INFO.contents||[]).length?"\n  (contains: "+MAIL_INFO.contents.join(", ")+")":"")+"\n\n"
+"Your signature is needed on the application form and the Commitment to Reciprocity. You can sign online in a few minutes, nothing to install:\n"
+"1. Open: "+signUrl+"\n"
+"2. Load the attached ZIP file (button at the top of the page) - everything is read automatically.\n"
+"3. Check the information, then sign in the \"Club representative signature\" box - with your finger, mouse, or by uploading an image of your signature. The date fills in automatically.\n"
+"4. Click \"Generate the Excel file\" and simply send me back the downloaded ZIP by replying to this e-mail.\n\n"
+"I will then forward the complete file to the district YCE coordinator. Everything runs in your browser - no data is sent to any server.\n\n"
+"Many thanks for your sponsorship and support,\n\n"
+MAIL_INFO.fir+" "+MAIL_INFO.fam+(mobile?" - "+mobile:"")+"\n"
+"YCE "+YEAR+" candidate";
  openMail("mailto:"+encodeURIComponent(to)+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body));
  setStatus("✉ E-mail draft opened - attach the single ZIP file from your Downloads folder before sending!",false);
}

function mailCoordinator(){
  const to=(document.getElementById("f-E79")||{}).value||"";
  const coord=(document.getElementById("f-I78")||{}).value||"the district YCE coordinator";
  const club=(document.getElementById("f-F67")||{}).value||"";
  const mobile=(document.getElementById("f-S21")||{}).value||"";
  const subject="YCE "+YEAR+" Application - "+MAIL_INFO.fir+" "+MAIL_INFO.fam+" - District "+MD+" "+currentDistrict+" - complete file";
  const body=
"Dear "+coord+",\n\n"
+"Please find attached my complete application file for the Lions Youth Camp & Exchange "+YEAR+" programme"
+(club?", sponsored by LC "+club:"")+" - a single ZIP archive returned countersigned by our club president:\n"
+MAIL_INFO.files.map(function(f){return "- "+f;}).join("\n")
+((MAIL_INFO.contents||[]).length?"\n  (contains: "+MAIL_INFO.contents.join(", ")+")":"")+"\n"
+"The application form and the Commitment to Reciprocity are signed by my parents and myself, and countersigned by our club president.\n\n"
+"I remain available for any further information or document.\n\n"
+"Kind regards,\n\n"
+MAIL_INFO.fir+" "+MAIL_INFO.fam+(mobile?" - "+mobile:"")+"\n"
+"YCE "+YEAR+" candidate"+(club?" - LC "+club:"");
  openMail("mailto:"+encodeURIComponent(to)+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body));
  setStatus("✉ E-mail draft opened - attach the ZIP returned by your club president before sending!",false);
}
