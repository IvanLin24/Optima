export function hasQuotedComparison(offer){
 return offer?.comparisonSource==='supplier-quote'&&Number.isFinite(offer.retail)&&offer.retail>0&&Number.isFinite(offer.retailDelivery)&&offer.retailDelivery>=0;
}
