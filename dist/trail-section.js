import {fixture} from './terrain.js';

// Synthetic receiving fixture, not a scanned trail or a calibrated jump.
export function trailSectionProfile(){
 const p=fixture('flat');
 p.points=[[-3,0],[.5,0],[.65,.01],[.8,0],[1,0],[1.3,.04],[1.65,.09],[1.8,-.08],[3.5,-.08],[5,-.08]];
 p.source={kind:'synthetic',description:'Short 2D trail: flat launch shelf, 10 mm bump, 90 mm crest and descent to an 80 mm lower landing. Authored facets remain sharp. Guided rider; no active jump or calibrated terrain.'};
 return p;
}
