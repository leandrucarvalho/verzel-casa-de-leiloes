// Suggested bids for the one-click buttons: the minimum, then one and two increments above it.
export const quickBids = (minimumCents: number, incrementCents: number) =>
  [0, 1, 2].map((steps) => minimumCents + steps * incrementCents);
