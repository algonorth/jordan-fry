export interface Testimonial {
  quote: string;
  name: string;
  town: string;
}

// TODO: replace with real client quotes (with permission).
export const testimonials: Testimonial[] = [
  {
    quote:
      'Jordan built the bookcases we had been talking about for ten years. He showed up when he said he would, kept the dust down, and the shelves look like they came with the house.',
    name: 'Karen M.',
    town: 'Greensburg',
  },
  {
    quote:
      'Two other contractors looked at the porch and both said tear it down. Jordan fixed what was wrong and saved the rest. It is the best-looking house on the street now.',
    name: 'Dave and Lisa R.',
    town: 'Mount Pleasant',
  },
  {
    quote:
      'He sent a written estimate two days after he looked at the stairs, and the final bill matched it. That is rarer than it should be.',
    name: 'Tom S.',
    town: 'Irwin',
  },
];
