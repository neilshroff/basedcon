import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/gallery/*.{png,jpg,jpeg}', { eager: true });
const g = (name: string) => {
    const key = Object.keys(files).find((k) => k.endsWith('/' + name));
    if (!key) throw new Error(`gallery photo not found: ${name}`);
    return files[key].default;
};

// Single ordered pool for the whole site: the home hero is the first 3,
// the manifesto grid shows all of them, and the lightbox follows this order.
export const photos = [
    { src: g('1.jpeg'), alt: 'Bangerlore, early evening' },
    { src: g('6.jpeg'), alt: 'The living room at Bangerlore' },
    { src: g('9.jpeg'), alt: 'Bangerlore after dark' },
    { src: g('2.jpeg'), alt: 'Bangerlore party' },
    { src: g('3.jpeg'), alt: 'Bangerlore party' },
    { src: g('4.jpeg'), alt: 'Bangerlore party' },
    { src: g('5.png'), alt: 'Bangerlore party' },
    { src: g('7.jpeg'), alt: 'Bangerlore party' },
    { src: g('8.jpeg'), alt: 'Bangerlore party' },
];

export const hero = photos.slice(0, 3);
export const lbIndex = (p: (typeof photos)[number]) => photos.findIndex((q) => q.src === p.src);
