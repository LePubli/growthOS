import assert from 'node:assert/strict';
import {collectProspectPeople} from '../artifacts/growthos/src/lib/prospect-people.ts';
import {collectProspectContactPoints} from '../lib/api-zod/src/prospect-contacts.ts';

const known = collectProspectPeople({
  company:'SOLUTION ENR',
  phone:'07 62 55 71 60', // Standard de la fiche, pas ligne directe attribuée.
  sourceDetails:{societe_com:{companyDetails:{
    managerContacts:[{name:'SOBHEY BETKA',role:'Président de SAS',
      phone:null,email:null,profileUrl:'https://www.societe.com/'}],
    managers:['SOBHEY BETKA · Président de SAS','ABDELWAHID BOUSSAIDA · Directeur Général'],
  }}},
},['ABDELWAHID BOUSSAIDA · Directeur Général']);
assert.equal(known.length,2,'Ne pas compter deux fois la même personne entre les sources');
assert.equal(known.filter(person=>person.isManager).length,2);
assert.equal(known[0].name,'SOBHEY BETKA');
assert.equal(known[0].role,'Président de SAS');
assert.equal(known[0].phone,null,'Ne pas attribuer le standard téléphonique à un dirigeant');
assert.equal(known[1].name,'ABDELWAHID BOUSSAIDA');
assert.equal(known[1].role,'Directeur Général');

const officialOnly=collectProspectPeople({},['Mme MARTIN · Gérante']);
assert.equal(officialOnly.length,1);
assert.equal(officialOnly[0].source,'annuaire');

const crm=collectProspectPeople({firstName:'Alice',lastName:'Martin',jobTitle:'Responsable commerciale',
  phone:'01 00 00 00 00',email:'crm@example.test'});
assert.equal(crm.length,1);
assert.equal(crm[0].isManager,false);
assert.equal(crm[0].phone,null,'Une coordonnée générale du CRM n’est pas prouvée directe');
assert.equal(collectProspectPeople({sourceDetails:{societe_com:{companyDetails:{
  managers:[null, '', {}, ' '],managerContacts:[{},null],
}}}}).length,0,'Les sources incomplètes ne doivent pas créer de faux contacts');

const unsafeLink=collectProspectPeople({sourceDetails:{societe_com:{companyDetails:{
  managerContacts:[{name:'Jean Exemple',profileUrl:'javascript:alert(1)'}],
}}}});
assert.equal(unsafeLink[0].profileUrl,null,'Les liens issus de captures restent limités à HTTP(S)');

const pappersOnly=collectProspectPeople({phone:'0320112233',sourceDetails:{pappers:{companyDetails:{managerContacts:[{name:'Alice PAPPERS',role:'Présidente',phone:null,email:null,profileUrl:'https://www.pappers.fr/dirigeant/alice_pappers_1980-01'}],managers:['Alice PAPPERS']}}}});
assert.equal(pappersOnly.length,1);assert.equal(pappersOnly[0].source,'pappers');assert.equal(pappersOnly[0].role,'Présidente');assert.equal(pappersOnly[0].phone,null,'Pappers ne prouve pas de ligne directe lorsque seul le standard est connu');
console.log('✓ Pappers : dirigeant visible dans le même répertoire, provenance et rôle conservés sans attribuer le standard');
console.log('✓ Fiche Prospect 360° : dirigeants issus des sources, rôles, doublons et coordonnées non inventées');
const multiple={sourceDetails:{societe_com:{companyDetails:{managerContacts:[{name:'Alice Exemple',email:'alice@atelier.fr',phone:'0320112233'}]}},pappers:{companyDetails:{managerContacts:[{name:'Alice Exemple',email:'alice@example.fr',phone:'0611223344'}]}},entreprises:{snapshot:{managers:['Bob Exemple · Directeur']}},website:{snapshot:{identity:'matched',emails:[{email:'contact@atelier.fr',sourceUrl:'https://atelier.fr/contact'},{email:'devis@atelier.fr',sourceUrl:'https://atelier.fr/contact'}],phones:[{phone:'0320112233'}],addresses:[{address:'8 rue du Test, Lille'},{address:'9 rue du Test, Lille'}]}}}};
const multiplePeople=collectProspectPeople(multiple);assert.equal(multiplePeople.length,2);assert.equal(multiplePeople[0].emails.length,2);assert.equal(multiplePeople[0].phones.length,2);assert.equal(multiplePeople[1].name,'Bob Exemple');
const allPoints=collectProspectContactPoints(multiple);assert.equal(allPoints.filter(p=>p.type==='email'&&!p.personName).length,2);assert.equal(allPoints.filter(p=>p.type==='address').length,2);assert.equal(allPoints.filter(p=>p.personName==='Alice Exemple'&&p.type==='email').length,2);
assert.equal(collectProspectContactPoints({sourceDetails:{contactPoints:allPoints}}).length,allPoints.length,'Les coordonnées multiples survivent à une relecture persistée');
console.log('✓ Coordonnées multiples : emails et téléphones directs regroupés par personne, contacts Annuaire persistés, adresses et preuves conservées');
