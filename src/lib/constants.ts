// Shared constants for the IQ Test application

export const DIMENSIONS = ['analyst', 'strategist', 'observer', 'intuitive'] as const;
export type Dimension = typeof DIMENSIONS[number];

export const DIMENSION_COLORS: Record<Dimension, string> = {
    analyst: 'blue',
    strategist: 'purple',
    observer: 'green',
    intuitive: 'yellow',
};

export const DIMENSION_ICONS: Record<Dimension, string> = {
    analyst: '🔍',
    strategist: '♟️',
    observer: '👁️',
    intuitive: '💡',
};
