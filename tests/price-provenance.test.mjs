import test from 'node:test';
import assert from 'node:assert/strict';
import { offers,calculate,money } from '../frontend/product/data.js';
import { calculationView } from '../frontend/product/purchase-calculator.js';
import { hasQuotedComparison } from '../frontend/product/price-provenance.js';

test('numeric fields alone never become a claim of customer savings',()=>{
 const offer=offers[0],quote=calculate(offer,100);
 assert.equal(hasQuotedComparison(offer),false);
 const html=calculationView(offer,100);
 assert.doesNotMatch(html,/Экономия с группой|calc-price-bar/);
 assert.equal(html.includes(money(quote.saving)),false);
 assert.match(html,/Нет подтверждённых данных/);
});

test('explicit supplier comparison is labeled as a quoted calculation, not actual savings',()=>{
 const html=calculationView({...offers[0],comparisonSource:'supplier-quote'},100);
 assert.match(html,/Разница по указанным ценам/);
 assert.match(html,/Фактическая экономия.*не подтверждена/);
 assert.doesNotMatch(html,/Экономия с группой/);
});
