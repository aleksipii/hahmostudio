import test from 'node:test';
import assert from 'node:assert/strict';
import {dialogueRecorderLabel} from './dialogue-recorder-label.ts';
test('recording controls identify the actual available action in each lifecycle phase',()=>{
 assert.equal(dialogueRecorderLabel('idle'),'Äänitä repliikki omalla äänellä');
 assert.equal(dialogueRecorderLabel('loading'),'Peruuta mikrofonilupa');
 assert.equal(dialogueRecorderLabel('recording'),'Lopeta ja käytä repliikki');
 assert.equal(dialogueRecorderLabel('saving'),'Liitetään ääntä…');
});
