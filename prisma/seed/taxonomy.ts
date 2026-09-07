/**
 * Frozen category taxonomy — 13 display Groups + an "Other" catch-all group,
 * and the selectable leaf Categories under them. Source: research #3
 * (docs/research/category-taxonomy.md on branch research/category-taxonomy),
 * two-tier / leaf-only / en-GB / immutable kebab-case slugs.
 *
 * Slugs are IMMUTABLE and never reused (rename => change `name` only).
 * `Part.categoryId` always points at a leaf here — never a Group.
 */

export interface GroupSeed {
  slug: string;
  name: string;
}

export interface CategorySeed {
  slug: string;
  name: string;
  groupSlug: string;
  synonyms?: string[];
}

export const GROUPS: GroupSeed[] = [
  { slug: "engine", name: "Engine" },
  { slug: "fuel-and-air", name: "Fuel & air" },
  { slug: "transmission-and-drivetrain", name: "Transmission & drivetrain" },
  { slug: "exhaust-and-emissions", name: "Exhaust & emissions" },
  { slug: "cooling-and-climate", name: "Cooling & climate" },
  { slug: "brakes", name: "Brakes" },
  { slug: "suspension-and-steering", name: "Suspension & steering" },
  { slug: "electrical-and-electronics", name: "Electrical & electronics" },
  { slug: "lighting", name: "Lighting" },
  { slug: "body-exterior", name: "Body — exterior" },
  { slug: "glass-and-mirrors", name: "Glass & mirrors" },
  { slug: "interior-and-safety", name: "Interior & safety" },
  { slug: "wheels", name: "Wheels" },
  { slug: "other", name: "Other" },
];

export const CATEGORIES: CategorySeed[] = [
  // Engine
  { slug: "complete-engine", name: "Complete engine", groupSlug: "engine", synonyms: ["motor", "engine assembly"] },
  { slug: "cylinder-head", name: "Cylinder head", groupSlug: "engine", synonyms: ["head"] },
  { slug: "engine-block", name: "Engine block / short block", groupSlug: "engine", synonyms: ["short block", "bare block"] },
  { slug: "turbocharger", name: "Turbocharger", groupSlug: "engine", synonyms: ["turbo"] },
  { slug: "engine-mount", name: "Engine mount", groupSlug: "engine", synonyms: ["motor mount"] },
  { slug: "oil-sump-oil-pump", name: "Oil sump / oil pump", groupSlug: "engine", synonyms: ["oil pan", "sump"] },

  // Fuel & air
  { slug: "fuel-injector", name: "Fuel injector", groupSlug: "fuel-and-air", synonyms: ["injector"] },
  { slug: "diesel-injection-pump", name: "Diesel injection pump", groupSlug: "fuel-and-air", synonyms: ["high pressure pump", "hpfp"] },
  { slug: "fuel-pump-sender", name: "Fuel pump / sender", groupSlug: "fuel-and-air", synonyms: ["in-tank pump"] },
  { slug: "throttle-body", name: "Throttle body", groupSlug: "fuel-and-air" },
  { slug: "intake-manifold", name: "Intake manifold", groupSlug: "fuel-and-air", synonyms: ["inlet manifold"] },
  { slug: "mass-air-flow-sensor", name: "Mass air flow sensor", groupSlug: "fuel-and-air", synonyms: ["maf", "air mass meter"] },

  // Transmission & drivetrain
  { slug: "manual-gearbox", name: "Manual gearbox", groupSlug: "transmission-and-drivetrain", synonyms: ["manual transmission", "mt"] },
  { slug: "automatic-gearbox", name: "Automatic gearbox", groupSlug: "transmission-and-drivetrain", synonyms: ["automatic transmission", "at", "dsg"] },
  { slug: "clutch-and-flywheel", name: "Clutch & flywheel", groupSlug: "transmission-and-drivetrain", synonyms: ["dmf", "dual mass flywheel"] },
  { slug: "driveshaft", name: "Driveshaft", groupSlug: "transmission-and-drivetrain", synonyms: ["drive shaft", "cv axle", "halfshaft"] },
  { slug: "propshaft", name: "Propshaft", groupSlug: "transmission-and-drivetrain", synonyms: ["prop shaft", "propeller shaft"] },
  { slug: "differential-transfer-case", name: "Differential / transfer case", groupSlug: "transmission-and-drivetrain", synonyms: ["diff", "transfer box"] },
  { slug: "gear-selector-linkage", name: "Gear selector & linkage", groupSlug: "transmission-and-drivetrain", synonyms: ["shifter"] },

  // Exhaust & emissions
  { slug: "catalytic-converter", name: "Catalytic converter", groupSlug: "exhaust-and-emissions", synonyms: ["cat"] },
  { slug: "diesel-particulate-filter", name: "Diesel particulate filter (DPF)", groupSlug: "exhaust-and-emissions", synonyms: ["dpf", "fap"] },
  { slug: "egr-valve-cooler", name: "EGR valve / cooler", groupSlug: "exhaust-and-emissions", synonyms: ["egr"] },
  { slug: "exhaust-manifold", name: "Exhaust manifold", groupSlug: "exhaust-and-emissions", synonyms: ["header"] },

  // Cooling & climate
  { slug: "radiator", name: "Radiator", groupSlug: "cooling-and-climate" },
  { slug: "intercooler", name: "Intercooler", groupSlug: "cooling-and-climate", synonyms: ["charge air cooler"] },
  { slug: "cooling-fan", name: "Cooling fan", groupSlug: "cooling-and-climate", synonyms: ["radiator fan"] },
  { slug: "water-pump", name: "Water pump", groupSlug: "cooling-and-climate", synonyms: ["coolant pump"] },
  { slug: "ac-compressor", name: "A/C compressor", groupSlug: "cooling-and-climate", synonyms: ["air con compressor", "aircon pump"] },
  { slug: "ac-condenser", name: "A/C condenser", groupSlug: "cooling-and-climate", synonyms: ["air con condenser"] },
  { slug: "heater-blower-assembly", name: "Heater / blower assembly", groupSlug: "cooling-and-climate", synonyms: ["blower motor", "heater matrix"] },

  // Brakes
  { slug: "brake-caliper", name: "Brake caliper", groupSlug: "brakes", synonyms: ["caliper"] },
  { slug: "abs-pump-module", name: "ABS pump / module", groupSlug: "brakes", synonyms: ["abs unit", "abs block"] },
  { slug: "brake-servo-master-cylinder", name: "Brake servo & master cylinder", groupSlug: "brakes", synonyms: ["brake booster"] },

  // Suspension & steering
  { slug: "shock-absorber-strut", name: "Shock absorber / strut", groupSlug: "suspension-and-steering", synonyms: ["damper", "shock"] },
  { slug: "coil-spring", name: "Coil spring", groupSlug: "suspension-and-steering", synonyms: ["road spring"] },
  { slug: "control-arm-wishbone", name: "Control arm / wishbone", groupSlug: "suspension-and-steering", synonyms: ["track control arm", "a-arm"] },
  { slug: "wheel-hub-bearing", name: "Wheel hub / bearing", groupSlug: "suspension-and-steering", synonyms: ["hub", "wheel bearing"] },
  { slug: "steering-rack", name: "Steering rack", groupSlug: "suspension-and-steering", synonyms: ["steering gear", "rack and pinion"] },
  { slug: "power-steering-pump", name: "Power steering pump", groupSlug: "suspension-and-steering", synonyms: ["pas pump"] },
  { slug: "subframe-axle-beam", name: "Subframe / axle beam", groupSlug: "suspension-and-steering", synonyms: ["subframe", "rear axle beam", "crossmember"] },

  // Electrical & electronics
  { slug: "engine-control-unit", name: "Engine control unit (ECU)", groupSlug: "electrical-and-electronics", synonyms: ["ecu", "ecm", "engine computer"] },
  { slug: "control-module-other", name: "Control module (other)", groupSlug: "electrical-and-electronics", synonyms: ["bcm", "comfort module", "control unit"] },
  { slug: "alternator", name: "Alternator", groupSlug: "electrical-and-electronics", synonyms: ["generator", "dynamo"] },
  { slug: "starter-motor", name: "Starter motor", groupSlug: "electrical-and-electronics", synonyms: ["starter"] },
  { slug: "instrument-cluster", name: "Instrument cluster", groupSlug: "electrical-and-electronics", synonyms: ["dash cluster", "speedometer", "dials"] },
  { slug: "ignition-coil", name: "Ignition coil", groupSlug: "electrical-and-electronics", synonyms: ["coil pack"] },
  { slug: "wiring-harness", name: "Wiring harness", groupSlug: "electrical-and-electronics", synonyms: ["loom", "wiring loom"] },
  { slug: "infotainment-radio-unit", name: "Infotainment / radio unit", groupSlug: "electrical-and-electronics", synonyms: ["head unit", "stereo", "navigation unit"] },

  // Lighting
  { slug: "headlight", name: "Headlight", groupSlug: "lighting", synonyms: ["headlamp"] },
  { slug: "tail-light", name: "Tail light", groupSlug: "lighting", synonyms: ["rear light", "taillight", "tail lamp"] },
  { slug: "fog-light", name: "Fog light", groupSlug: "lighting", synonyms: ["fog lamp"] },

  // Body — exterior
  { slug: "bonnet", name: "Bonnet", groupSlug: "body-exterior", synonyms: ["hood", "engine bonnet"] },
  { slug: "tailgate-boot-lid", name: "Tailgate / boot lid", groupSlug: "body-exterior", synonyms: ["trunk lid", "hatch"] },
  { slug: "front-bumper", name: "Front bumper", groupSlug: "body-exterior" },
  { slug: "rear-bumper", name: "Rear bumper", groupSlug: "body-exterior" },
  { slug: "front-wing", name: "Front wing", groupSlug: "body-exterior", synonyms: ["fender", "front fender"] },
  { slug: "front-door", name: "Front door", groupSlug: "body-exterior" },
  { slug: "rear-door", name: "Rear door", groupSlug: "body-exterior" },
  { slug: "front-panel-radiator-support", name: "Front panel / radiator support", groupSlug: "body-exterior", synonyms: ["slam panel", "front lock carrier"] },
  { slug: "grille", name: "Grille", groupSlug: "body-exterior", synonyms: ["radiator grille", "front grille"] },
  { slug: "roof-sunroof-panel", name: "Roof / sunroof panel", groupSlug: "body-exterior", synonyms: ["roof skin", "sunroof"] },

  // Glass & mirrors
  { slug: "windscreen", name: "Windscreen", groupSlug: "glass-and-mirrors", synonyms: ["windshield"] },
  { slug: "door-glass", name: "Door glass", groupSlug: "glass-and-mirrors", synonyms: ["window glass"] },
  { slug: "wing-mirror", name: "Wing mirror", groupSlug: "glass-and-mirrors", synonyms: ["door mirror", "side mirror"] },

  // Interior & safety
  { slug: "airbag", name: "Airbag", groupSlug: "interior-and-safety", synonyms: ["air bag", "srs airbag"] },
  { slug: "seatbelt-pretensioner", name: "Seatbelt & pretensioner", groupSlug: "interior-and-safety", synonyms: ["seat belt", "belt tensioner"] },
  { slug: "airbag-control-module", name: "Airbag control module", groupSlug: "interior-and-safety", synonyms: ["srs module", "airbag ecu", "crash sensor module"] },
  { slug: "seat", name: "Seat", groupSlug: "interior-and-safety", synonyms: ["car seat"] },
  { slug: "dashboard", name: "Dashboard", groupSlug: "interior-and-safety", synonyms: ["dash", "fascia"] },
  { slug: "steering-wheel", name: "Steering wheel", groupSlug: "interior-and-safety" },
  { slug: "centre-console-interior-trim", name: "Centre console & interior trim", groupSlug: "interior-and-safety", synonyms: ["center console", "trim panel"] },

  // Wheels
  { slug: "alloy-wheel", name: "Alloy wheel", groupSlug: "wheels", synonyms: ["alloy rim", "mag wheel"] },
  { slug: "steel-wheel", name: "Steel wheel", groupSlug: "wheels", synonyms: ["steel rim", "steelie"] },

  // Other
  { slug: "other-not-listed", name: "Other / not listed", groupSlug: "other", synonyms: ["misc", "uncategorised"] },
];
