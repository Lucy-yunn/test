/**
 * ⚠️ PLACEHOLDER vehicle catalogue.
 *
 * Build step 1 (docs/spec/README.md §6) requires the REAL Make → VehicleModelGroup →
 * VehicleGeneration list, built from the pilot sellers' actual donor vehicles — that
 * needs the founder's Bulgarian contacts. This file is a plausible stand-in so the
 * funnel, Browse facets and seed inventory can be built and demoed now. Replace the
 * generations with real chassis codes / date ranges before any real onboarding.
 *
 * Grain: generation-level (#21). One generation row spans every engine/body; facelifts
 * may split by date. Engine detail lives on DonorVehicle, never here.
 */

export interface MakeSeed {
  slug: string;
  name: string;
  country?: string;
}

export interface ModelGroupSeed {
  slug: string;
  makeSlug: string;
  name: string;
}

export interface GenerationSeed {
  slug: string;
  modelGroupSlug: string;
  label: string;
  chassisCodes: string[];
  productionStart: number;
  productionEnd: number | null;
}

export const MAKES: MakeSeed[] = [
  { slug: "volkswagen", name: "Volkswagen", country: "Germany" },
  { slug: "audi", name: "Audi", country: "Germany" },
  { slug: "bmw", name: "BMW", country: "Germany" },
  { slug: "mercedes-benz", name: "Mercedes-Benz", country: "Germany" },
  { slug: "opel", name: "Opel", country: "Germany" },
  { slug: "renault", name: "Renault", country: "France" },
  { slug: "peugeot", name: "Peugeot", country: "France" },
  { slug: "ford", name: "Ford", country: "Germany" },
  { slug: "toyota", name: "Toyota", country: "Japan" },
];

export const MODEL_GROUPS: ModelGroupSeed[] = [
  { slug: "vw-golf", makeSlug: "volkswagen", name: "Golf, Golf Plus" },
  { slug: "vw-passat", makeSlug: "volkswagen", name: "Passat" },
  { slug: "audi-a4-s4", makeSlug: "audi", name: "A4, S4, RS4" },
  { slug: "audi-a6-s6", makeSlug: "audi", name: "A6, S6, RS6" },
  { slug: "bmw-3", makeSlug: "bmw", name: "3 Series" },
  { slug: "bmw-5", makeSlug: "bmw", name: "5 Series" },
  { slug: "mb-c-class", makeSlug: "mercedes-benz", name: "C-Class" },
  { slug: "mb-e-class", makeSlug: "mercedes-benz", name: "E-Class" },
  { slug: "opel-astra", makeSlug: "opel", name: "Astra" },
  { slug: "renault-megane", makeSlug: "renault", name: "Mégane" },
  { slug: "peugeot-308", makeSlug: "peugeot", name: "308" },
  { slug: "ford-focus", makeSlug: "ford", name: "Focus" },
  { slug: "toyota-corolla", makeSlug: "toyota", name: "Corolla" },
];

export const GENERATIONS: GenerationSeed[] = [
  // VW Golf
  { slug: "vw-golf-mk5-1k", modelGroupSlug: "vw-golf", label: "Golf Mk5 (1K, 2003–2009)", chassisCodes: ["1K"], productionStart: 2003, productionEnd: 2009 },
  { slug: "vw-golf-mk6-5k", modelGroupSlug: "vw-golf", label: "Golf Mk6 (5K, 2008–2013)", chassisCodes: ["5K"], productionStart: 2008, productionEnd: 2013 },
  { slug: "vw-golf-mk7-5g", modelGroupSlug: "vw-golf", label: "Golf Mk7 (5G/BA, 2012–2020)", chassisCodes: ["5G", "BA", "BE"], productionStart: 2012, productionEnd: 2020 },
  // VW Passat
  { slug: "vw-passat-b6-3c", modelGroupSlug: "vw-passat", label: "Passat B6 (3C, 2005–2010)", chassisCodes: ["3C", "B6"], productionStart: 2005, productionEnd: 2010 },
  { slug: "vw-passat-b7-36", modelGroupSlug: "vw-passat", label: "Passat B7 (36, 2010–2015)", chassisCodes: ["36", "B7", "3C"], productionStart: 2010, productionEnd: 2015 },
  { slug: "vw-passat-b8-3g", modelGroupSlug: "vw-passat", label: "Passat B8 (3G, 2014–2023)", chassisCodes: ["3G", "B8"], productionStart: 2014, productionEnd: 2023 },
  // Audi A4/S4
  { slug: "audi-a4-b7-8e", modelGroupSlug: "audi-a4-s4", label: "A4/S4 B7 (8E/8H, 2004–2008)", chassisCodes: ["8E", "8H", "B7"], productionStart: 2004, productionEnd: 2008 },
  { slug: "audi-a4-b8-8k", modelGroupSlug: "audi-a4-s4", label: "A4/S4 B8 (8K, 2007–2015)", chassisCodes: ["8K", "B8"], productionStart: 2007, productionEnd: 2015 },
  { slug: "audi-a4-b9-8w", modelGroupSlug: "audi-a4-s4", label: "A4/S4 B9 (8W, 2015–2023)", chassisCodes: ["8W", "B9"], productionStart: 2015, productionEnd: 2023 },
  // Audi A6/S6
  { slug: "audi-a6-c6-4f", modelGroupSlug: "audi-a6-s6", label: "A6/S6 C6 (4F, 2004–2011)", chassisCodes: ["4F", "C6"], productionStart: 2004, productionEnd: 2011 },
  { slug: "audi-a6-c7-4g", modelGroupSlug: "audi-a6-s6", label: "A6/S6 C7 (4G, 2011–2018)", chassisCodes: ["4G", "C7"], productionStart: 2011, productionEnd: 2018 },
  // BMW 3
  { slug: "bmw-3-e90", modelGroupSlug: "bmw-3", label: "3 Series E90/E91/E92/E93 (2005–2013)", chassisCodes: ["E90", "E91", "E92", "E93"], productionStart: 2005, productionEnd: 2013 },
  { slug: "bmw-3-f30", modelGroupSlug: "bmw-3", label: "3 Series F30/F31/F34 (2011–2019)", chassisCodes: ["F30", "F31", "F34"], productionStart: 2011, productionEnd: 2019 },
  // BMW 5
  { slug: "bmw-5-e60", modelGroupSlug: "bmw-5", label: "5 Series E60/E61 (2003–2010)", chassisCodes: ["E60", "E61"], productionStart: 2003, productionEnd: 2010 },
  { slug: "bmw-5-f10", modelGroupSlug: "bmw-5", label: "5 Series F10/F11 (2010–2017)", chassisCodes: ["F10", "F11"], productionStart: 2010, productionEnd: 2017 },
  { slug: "bmw-5-g30", modelGroupSlug: "bmw-5", label: "5 Series G30/G31 (2016–2023)", chassisCodes: ["G30", "G31"], productionStart: 2016, productionEnd: 2023 },
  // Mercedes C-Class
  { slug: "mb-c-w204", modelGroupSlug: "mb-c-class", label: "C-Class W204/S204 (2007–2014)", chassisCodes: ["W204", "S204"], productionStart: 2007, productionEnd: 2014 },
  { slug: "mb-c-w205", modelGroupSlug: "mb-c-class", label: "C-Class W205/S205 (2014–2021)", chassisCodes: ["W205", "S205"], productionStart: 2014, productionEnd: 2021 },
  // Mercedes E-Class
  { slug: "mb-e-w211", modelGroupSlug: "mb-e-class", label: "E-Class W211/S211 (2002–2009)", chassisCodes: ["W211", "S211"], productionStart: 2002, productionEnd: 2009 },
  { slug: "mb-e-w212", modelGroupSlug: "mb-e-class", label: "E-Class W212/S212 (2009–2016)", chassisCodes: ["W212", "S212"], productionStart: 2009, productionEnd: 2016 },
  // Opel Astra
  { slug: "opel-astra-h", modelGroupSlug: "opel-astra", label: "Astra H (A04, 2004–2010)", chassisCodes: ["A-H", "A04"], productionStart: 2004, productionEnd: 2010 },
  { slug: "opel-astra-j", modelGroupSlug: "opel-astra", label: "Astra J (P10, 2009–2015)", chassisCodes: ["A-J", "P10"], productionStart: 2009, productionEnd: 2015 },
  // Renault Megane
  { slug: "renault-megane-3", modelGroupSlug: "renault-megane", label: "Mégane III (2008–2016)", chassisCodes: ["III", "BZ", "DZ"], productionStart: 2008, productionEnd: 2016 },
  // Peugeot 308
  { slug: "peugeot-308-t7", modelGroupSlug: "peugeot-308", label: "308 T7 (2007–2013)", chassisCodes: ["T7"], productionStart: 2007, productionEnd: 2013 },
  { slug: "peugeot-308-t9", modelGroupSlug: "peugeot-308", label: "308 T9 (2013–2021)", chassisCodes: ["T9"], productionStart: 2013, productionEnd: 2021 },
  // Ford Focus
  { slug: "ford-focus-mk2", modelGroupSlug: "ford-focus", label: "Focus Mk2 (DA3, 2004–2011)", chassisCodes: ["DA3", "Mk2"], productionStart: 2004, productionEnd: 2011 },
  { slug: "ford-focus-mk3", modelGroupSlug: "ford-focus", label: "Focus Mk3 (DYB, 2010–2018)", chassisCodes: ["DYB", "Mk3"], productionStart: 2010, productionEnd: 2018 },
  // Toyota Corolla
  { slug: "toyota-corolla-e12", modelGroupSlug: "toyota-corolla", label: "Corolla E120/E130 (2001–2007)", chassisCodes: ["E120", "E130"], productionStart: 2001, productionEnd: 2007 },
  { slug: "toyota-corolla-e15", modelGroupSlug: "toyota-corolla", label: "Corolla E140/E150 (2006–2013)", chassisCodes: ["E140", "E150"], productionStart: 2006, productionEnd: 2013 },
];
