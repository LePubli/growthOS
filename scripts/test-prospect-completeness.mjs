import assert from 'node:assert/strict';
import {computeProspectCompleteness} from '../artifacts/growthos/src/lib/prospect-completeness.ts';

const complete={
  company:'ENTREPRISE FICTIVE',siren:'123456789',siret:'12345678900012',
  apeCode:'12.34A',nafLabel:'Activité de démonstration',
  address:'Voie fictive',postalCode:'75000',city:'Ville fictive',
  lat:45,lng:2,phone:'01 23 45 67 89',email:'contact@example.test',
  website:'https://example.test',
  sourceDetails:{annuaire:{siret:'12345678900012'},societe_com:{companyDetails:{
    managerContacts:[{name:'Personne Exemple',role:'Dirigeant fictif'}],
  }}},
};
const perfect=computeProspectCompleteness(complete);
assert.equal(perfect.total,9);
assert.equal(perfect.completed,9);
assert.equal(perfect.percent,100);

const partial=computeProspectCompleteness({...complete,email:null,lat:null,lng:null});
assert.equal(partial.percent,78,'L’absence d’email et de GPS retire deux critères');
assert.equal(partial.criteria.find(item=>item.label==='Localisation GPS')?.met,false);

const unverified=computeProspectCompleteness({...complete,siret:'12345678900123',sourceDetails:{}});
assert.equal(unverified.criteria.find(item=>item.label==='Identification officielle')?.met,false);
assert.ok(unverified.percent<100,'Une saisie non vérifiée ne doit pas pouvoir atteindre 100 %');

const invalid=computeProspectCompleteness({...complete,website:'javascript:alert(1)',phone:'1234',
  siret:'99999999900000',postalCode:'59',email:'adresse-invalide',lat:0,lng:0,
  sourceDetails:{annuaire:{},societe_com:{companyDetails:{managerContacts:[{name:'Personne Exemple'}]}}}});
assert.equal(invalid.criteria.find(item=>item.label==='Dirigeant nominatif')?.met,false,'Un rôle non renseigné n’est pas un contact complet');
assert.ok(invalid.percent<45,'Des valeurs fictives ou incomplètes ne suffisent pas à simuler un dossier complet');
assert.equal(computeProspectCompleteness({}).percent,0);

console.log('✓ Complétude stricte : SIREN/SIRET cohérents, source INSEE, GPS, contacts valides et dirigeant sourcé');
