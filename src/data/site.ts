/**
 * Business facts: the single source for header, call bar, contact, footer and JSON-LD.
 * Every value that still needs real data carries a `TODO:` inside the string (grep-able).
 */
export const site = {
  name: 'Jordan Fry',
  business: 'Jordan Fry Carpentry', // TODO: legal/trade name
  role: 'Carpenter and contractor',
  phone: { e164: '+17245550123', display: '(724) 555-0123' }, // TODO: real number
  sms: { e164: '+17245550123' }, // TODO: real number (no prefilled body: platform syntax differs)
  email: 'jordan@example.com', // TODO: real email
  area: {
    label: 'Westmoreland County and the greater Pittsburgh area', // TODO: confirm area
    short: 'Westmoreland County', // TODO: confirm
    towns: ['Greensburg', 'Latrobe', 'Ligonier', 'Irwin', 'Murrysville', 'Mount Pleasant'], // TODO
  },
  address: { locality: 'Greensburg', region: 'PA', postalCode: '15601', country: 'US' }, // TODO
  geo: { lat: 40.30146, lng: -79.53894 }, // TODO: real base
  hours: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '07:00', closes: '18:00' },
    { days: ['Saturday'], opens: '08:00', closes: '14:00' },
  ], // TODO: real hours
  hic: 'PA000000', // TODO: PA Home Improvement Contractor registration number
  school: 'TODO: Vo-Tech name', // TODO: the Vo-Tech school
  credentials: [
    'Vo-Tech carpentry graduate',
    'Licensed and insured · PA HIC #TODO',
    'Serving Westmoreland County', // TODO: area
  ],
  social: { instagram: '', facebook: '', google: '' }, // '' hides the entry
  founded: 2018, // TODO
} as const;

export const telHref = `tel:${site.phone.e164}`;
export const smsHref = `sms:${site.sms.e164}`;
export const mailHref = `mailto:${site.email}`;
