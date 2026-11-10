/** GST Unit Quantity Codes ("CODE-NAME") as listed in the GST offline tool. */
const UQC = ['BAG-BAGS', 'BAL-BALE', 'BDL-BUNDLES', 'BKL-BUCKLES', 'BOU-BILLIONS OF UNITS', 'BOX-BOX', 'BTL-BOTTLES', 'BUN-BUNCHES', 'CAN-CANS', 'CBM-CUBIC METERS', 'CCM-CUBIC CENTIMETERS', 'CMS-CENTIMETERS', 'CTN-CARTONS', 'DOZ-DOZENS', 'DRM-DRUMS', 'GGK-GREAT GROSS', 'GMS-GRAMMES', 'GRS-GROSS', 'GYD-GROSS YARDS', 'KGS-KILOGRAMS', 'KLR-KILOLITRE', 'KME-KILOMETRE', 'LTR-LITRES', 'MLT-MILILITRE', 'MTR-METERS', 'MTS-METRIC TON', 'NOS-NUMBERS', 'OTH-OTHERS', 'PAC-PACKS', 'PCS-PIECES', 'PRS-PAIRS', 'QTL-QUINTAL', 'ROL-ROLLS', 'SET-SETS', 'SQF-SQUARE FEET', 'SQM-SQUARE METERS', 'SQY-SQUARE YARDS', 'TBS-TABLETS', 'TGM-TEN GROSS', 'THD-THOUSANDS', 'TON-TONNES', 'TUB-TUBES', 'UGS-US GALLONS', 'UNT-UNITS', 'YDS-YARDS'];
const UQC_BY_KEY = new Map(UQC.flatMap((u) => { const [code, name] = u.split('-'); return [[code, u], [name, u]]; }));

/** "NOS" / "Numbers" / "pcs" → "NOS-NUMBERS" (CSV form); anything unknown becomes OTH-OTHERS. */
export const uqcLabel = (u) => UQC_BY_KEY.get(String(u || 'NOS').trim().toUpperCase()) || 'OTH-OTHERS';
/** Same lookup, code only ("NOS") — the JSON form. */
export const uqcCode = (u) => uqcLabel(u).split('-')[0];
