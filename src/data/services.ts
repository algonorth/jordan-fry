export interface Service {
  slug: string;
  name: string;
  text: string;
}

export const services: Service[] = [
  {
    slug: 'built-ins',
    name: 'Custom built-ins',
    text: 'Bookcases, window seats, mudroom benches and media walls, designed for the room they are in and built to look like they were always there.',
  },
  {
    slug: 'trim',
    name: 'Finish carpentry and trim',
    text: 'Casing, base, crown, wainscoting and doors, cut tight and finished clean.',
  },
  {
    slug: 'decks',
    name: 'Decks and porches',
    text: 'New decks, porch rebuilds and repairs, framed to code and built to hold up to Western Pennsylvania winters.',
  },
  {
    slug: 'remodels',
    name: 'Framing and remodels',
    text: 'Structural framing, interior remodels and small additions, done straight, level and square.',
  },
  {
    slug: 'stairs',
    name: 'Stairs and railings',
    text: 'New staircases, tread and riser replacement, handrails and balusters that meet code and feel right under your hand.',
  },
  {
    slug: 'repairs',
    name: 'Repairs and small jobs',
    text: 'Sticking doors, rotted trim, loose railings, and the list of things that never gets done. No job is too small to do properly.',
  },
];
