// The three reasons a visit happens. Farms that need action ("in danger")
// are red; regular checks are WHH green.
const DANGER = '#CF0033';

export const VISIT_TYPES = {
  help: {
    label: 'Farmer asked for help',
    short: 'Help request',
    danger: true,
    color: DANGER,
    text: '#FFFFFF',
  },
  warning: {
    label: 'Disease warning',
    short: 'Disease warning',
    danger: true,
    color: DANGER,
    text: '#FFFFFF',
  },
  regular: {
    label: 'Regular check',
    short: 'Regular check',
    danger: false,
    color: '#2FAB16',
    text: '#FFFFFF',
  },
};

// Most urgent first — used for the priorities summary.
export const TYPE_ORDER = ['help', 'warning', 'regular'];
