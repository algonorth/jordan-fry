/**
 * All user-facing copy outside the work collection. Voice: warm, plain, confident,
 * a tradesperson talking to a neighbor. No marketing fluff, no exclamation marks.
 */
export const hero = {
  line: 'Trim, built-ins, decks and stairs, cut and fitted by hand in Westmoreland County.', // TODO: area
  alternates: [
    'Custom carpentry for homes in Western Pennsylvania: built-ins, trim, decks, stairs and remodels.',
    'Good carpentry, done by hand, for houses that are meant to last.',
  ],
  ctaMobile: 'Call Jordan',
  ctaDesktop: 'Start a conversation',
  secondary: 'See the work',
};

export const nav = {
  work: 'Work',
  services: 'Services',
  about: 'About',
  allWork: 'All work',
};

export const work = {
  heading: 'Selected work',
  indexHeading: 'Work',
  indexLead: 'Decks, built-ins, stairs, porches and remodels around Westmoreland County.', // TODO: area
  next: 'Next',
  previous: 'Previous',
  location: 'Location',
  scope: 'Scope',
  year: 'Year',
  openPhoto: (n: number, total: number) => `Open photo ${n} of ${total}`,
  photoOf: (n: number, total: number) => `Photo ${n} of ${total}`,
  close: 'Close',
};

export const services = {
  heading: 'What I do',
};

export const about = {
  heading: 'About Jordan',
  paragraphs: [
    'I got my start in the carpentry program at TODO: Vo-Tech name, where I learned to frame square, cut clean and finish work that holds up. I have been working with my hands ever since, first on crews building and remodeling homes around Westmoreland County, and now on my own, one job at a time.',
    'Most of what I do is the work you live with every day: the trim you run your hand along, the stairs you climb, the deck you sit on in July. I keep the crew small, I do the work myself, and I would rather do fewer jobs well than a lot of them fast.',
  ],
  portraitAlt: 'Jordan Fry in his shop, standing beside a workbench', // TODO: real portrait
};

export const testimonials = {
  heading: 'What clients say',
};

export const process = [
  {
    title: 'Talk',
    text: 'Call or text and tell me what you have in mind. I will ask a few questions and we will set a time for me to come see it.',
  },
  {
    title: 'Plan',
    text: 'I measure, talk through options with you, and send a written estimate with real numbers and a start date.',
  },
  {
    title: 'Build',
    text: 'I show up when I say I will, keep the site clean, and check every piece before I call it done.',
  },
];

export const contact = {
  heading: 'Let’s talk about your project',
  lead: 'The easiest way to reach me is a call or a text. If it is easier to write it down, use the form and I will get back to you within a business day.',
  links: { call: 'Call', text: 'Text', email: 'Email' },
  form: {
    name: 'Your name',
    reach: 'Phone or email',
    need: 'What do you need?',
    submit: 'Send',
    sending: 'Sending…',
    success: {
      title: 'Got it, thanks.',
      text: 'I will get back to you within a business day. If it is urgent, call or text me at (724) 555-0123.', // TODO: number
    },
    errors: {
      name: 'Please add your name.',
      reachEmpty: 'Add a phone number or email so I can reach you.',
      reachInvalid: 'That does not look like a phone number or email.',
      need: 'Tell me a little about the job.',
      network: 'That did not go through. You can call or text me instead at (724) 555-0123.', // TODO: number
    },
  },
};

export const callBar = {
  call: 'Call Jordan',
  text: 'Text Jordan',
  label: 'Call or text',
};

export const footer = {
  line: 'Jordan Fry, carpenter and contractor. Serving Westmoreland County and the greater Pittsburgh area.', // TODO: area
  legal: 'Licensed and insured · PA HIC #TODO',
};

export const meta = {
  home: {
    title: 'Jordan Fry | Carpenter and Contractor in Greensburg, PA', // TODO: area
    description:
      'Custom built-ins, finish trim, decks, stairs and remodels for homes in Westmoreland County, PA. Jordan Fry, carpenter and contractor. Call or text for an estimate.',
  },
  work: {
    title: 'Work | Jordan Fry Carpentry',
    description:
      'Selected carpentry projects by Jordan Fry: decks, built-ins, stairs, porches and remodels in Greensburg, Latrobe, Ligonier and across Western Pennsylvania.',
  },
  project: (summary: string, location: string, year: number) =>
    `${summary} ${location}, ${year}. Carpentry by Jordan Fry.`,
  notFound: { title: 'Page not found | Jordan Fry Carpentry', description: 'That page does not exist.' },
  siteName: 'Jordan Fry Carpentry',
};

export const notFound = {
  heading: 'Nothing here.',
  text: 'That page does not exist, or it moved.',
  link: 'Back to the front page',
};

export const skipLink = 'Skip to content';
