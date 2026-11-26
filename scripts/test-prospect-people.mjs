import assert from 'node:assert/strict';
import {collectProspectPeople} from '../artifacts/growthos/src/lib/prospect-people.ts';

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

console.log('✓ Fiche Prospect 360° : dirigeants issus des sources, rôles, doublons et coordonnées non inventées');
